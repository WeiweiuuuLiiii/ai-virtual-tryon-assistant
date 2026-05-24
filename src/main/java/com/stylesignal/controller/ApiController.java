package com.stylesignal.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stylesignal.model.FeedbackRequest;
import com.stylesignal.model.RecommendRequest;
import com.stylesignal.model.SceneCheckRequest;
import com.stylesignal.service.ClaudeService;
import com.stylesignal.service.DemoGuardException;
import com.stylesignal.service.DemoGuardService;
import com.stylesignal.service.OpenAiImageService;
import com.stylesignal.service.OpenAiProviderException;
import com.stylesignal.service.StorageService;
import com.stylesignal.service.WeatherService;
import com.stylesignal.tryon.BatchItem;
import com.stylesignal.tryon.GarmentItem;
import com.stylesignal.tryon.TryOnProvider;
import com.stylesignal.tryon.TryOnProviderRegistry;
import com.stylesignal.tryon.TryOnRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ApiController {

    private static final Logger log = LoggerFactory.getLogger(ApiController.class);

    private final ClaudeService          claude;
    private final WeatherService         weather;
    private final StorageService         storage;
    private final TryOnProviderRegistry  providerRegistry;
    private final OpenAiImageService     openAi;
    private final DemoGuardService       demoGuard;
    private final ObjectMapper           mapper = new ObjectMapper();

    public ApiController(ClaudeService claude, WeatherService weather,
                         StorageService storage, TryOnProviderRegistry providerRegistry,
                         OpenAiImageService openAi, DemoGuardService demoGuard) {
        this.claude           = claude;
        this.weather          = weather;
        this.storage          = storage;
        this.providerRegistry = providerRegistry;
        this.openAi           = openAi;
        this.demoGuard        = demoGuard;
    }

    // ── Global error handlers ─────────────────────────────────────────────────

    @ExceptionHandler(DemoGuardException.class)
    public ResponseEntity<Map<String, Object>> handleDemoGuard(DemoGuardException e) {
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("status",  "demo_locked");
        resp.put("message", e.getUserMessage());
        return ResponseEntity.ok(resp);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception e) {
        log.error("Unhandled API error: {}", e.getMessage(), e);
        Map<String, Object> err = new LinkedHashMap<>();
        err.put("error",   true);
        err.put("message", e.getMessage() != null
            ? e.getMessage()
            : "An unexpected error occurred. Check the server logs.");
        return ResponseEntity.internalServerError().body(err);
    }

    // ── Style Profile ─────────────────────────────────────────────────────────

    @GetMapping("/profile")
    public ResponseEntity<Map<String, Object>> getProfile() throws Exception {
        Optional<Map<String, Object>> profile = storage.loadProfile();
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("exists", profile.isPresent());
        profile.ifPresent(p -> resp.put("profile", p));
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/analyze-style")
    public ResponseEntity<?> analyzeStyle(
            @RequestParam("photos") List<MultipartFile> photos) throws Exception {

        int count = photos != null ? photos.size() : 0;
        log.info("POST /api/analyze-style — {} photo(s) received", count);

        if (photos == null || photos.isEmpty()) {
            return ResponseEntity.badRequest().body(errorBody("No photos provided."));
        }

        Map<String, Object> profile = claude.analyzeStylePhotos(photos);
        storage.saveProfile(profile);
        log.info("Style analysis saved successfully");
        return ResponseEntity.ok(profile);
    }

    // ── Body Model ────────────────────────────────────────────────────────────

    @GetMapping("/model")
    public ResponseEntity<Map<String, Object>> getModel() throws Exception {
        Optional<Map<String, Object>> modelData = storage.loadModelData();
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("exists",    modelData.isPresent());
        resp.put("has_photo", storage.hasModelPhoto());
        modelData.ifPresent(m -> resp.put("model", m));
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/model")
    public ResponseEntity<?> setupModel(
            @RequestParam("photo") MultipartFile photo,
            @RequestParam(value = "measurements", required = false) String measurementsJson)
            throws Exception {

        log.info("POST /api/model — file={}", photo.getOriginalFilename());
        Map<String, Object> analysis = claude.analyzeModel(photo);

        if (measurementsJson != null && !measurementsJson.isBlank()) {
            try {
                Map<String, Object> measurements =
                    mapper.readValue(measurementsJson, new TypeReference<>() {});
                analysis.put("measurements", measurements);
            } catch (Exception e) {
                log.warn("Could not parse measurements JSON: {}", e.getMessage());
            }
        }

        storage.saveModelData(analysis);
        storage.saveModelPhoto(photo.getBytes());
        log.info("Model saved — body_shape={}", analysis.get("body_shape"));
        return ResponseEntity.ok(analysis);
    }

    @GetMapping("/model/photo")
    public ResponseEntity<byte[]> getModelPhoto() throws Exception {
        if (!storage.hasModelPhoto()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok()
            .contentType(MediaType.IMAGE_JPEG)
            .body(storage.loadModelPhotoBytes());
    }

    @PatchMapping("/model/measurements")
    public ResponseEntity<?> updateMeasurements(
            @RequestBody Map<String, Object> incoming) throws Exception {
        log.info("PATCH /api/model/measurements — fields={}", incoming.keySet());
        Optional<Map<String, Object>> modelOpt = storage.loadModelData();
        if (modelOpt.isEmpty()) {
            return ResponseEntity.badRequest()
                .body(errorBody("No model found. Build your model first."));
        }
        Map<String, Object> model = new LinkedHashMap<>(modelOpt.get());
        // Merge into existing measurements so partial updates preserve other fields
        @SuppressWarnings("unchecked")
        Map<String, Object> existing = model.get("measurements") instanceof Map
            ? new LinkedHashMap<>((Map<String, Object>) model.get("measurements"))
            : new LinkedHashMap<>();
        existing.putAll(incoming);
        model.put("measurements", existing);
        storage.saveModelData(model);
        log.info("Measurements saved — {}", existing);
        return ResponseEntity.ok(model);
    }

    // ── Weather ───────────────────────────────────────────────────────────────

    @GetMapping("/weather")
    public ResponseEntity<Map<String, Object>> getWeather(@RequestParam String location) {
        log.info("GET /api/weather — location={}", location);
        return ResponseEntity.ok(weather.getWeather(location));
    }

    // ── Scene Check ───────────────────────────────────────────────────────────

    @PostMapping("/scene-check")
    public ResponseEntity<?> sceneCheck(@RequestBody SceneCheckRequest req) throws Exception {
        log.info("POST /api/scene-check — scene={}", req.scene());

        if (req.outfitDescription() == null || req.outfitDescription().isBlank()) {
            return ResponseEntity.badRequest().body(errorBody("Describe your outfit first."));
        }
        if (req.scene() == null || req.scene().isBlank()) {
            return ResponseEntity.badRequest().body(errorBody("Pick a scene first."));
        }

        String location = (req.location() != null && !req.location().isBlank())
            ? req.location() : "New York";
        Map<String, Object> weatherData = weather.getWeather(location);
        Optional<Map<String, Object>> modelData = storage.loadModelData();

        Map<String, Object> result = claude.checkScene(
            req.outfitDescription(), req.scene(), weatherData, req.vibe(),
            modelData.orElse(null));
        result.put("weather", weatherData);
        return ResponseEntity.ok(result);
    }

    // ── Try-On Studio ─────────────────────────────────────────────────────────

    @PostMapping("/try-on-studio")
    public ResponseEntity<?> tryOnStudio(
            @RequestParam(required = false) MultipartFile top,
            @RequestParam(required = false) MultipartFile bottom,
            @RequestParam(required = false) MultipartFile dress,
            @RequestParam(required = false) MultipartFile outerwear,
            @RequestParam(required = false) MultipartFile shoes,
            @RequestParam(required = false) MultipartFile bag) throws Exception {

        log.info("POST /api/try-on-studio");
        Map<String, MultipartFile> items = new LinkedHashMap<>();
        if (top       != null && !top.isEmpty())       items.put("top",       top);
        if (bottom    != null && !bottom.isEmpty())    items.put("bottom",    bottom);
        if (dress     != null && !dress.isEmpty())     items.put("dress",     dress);
        if (outerwear != null && !outerwear.isEmpty()) items.put("outerwear", outerwear);
        if (shoes     != null && !shoes.isEmpty())     items.put("shoes",     shoes);
        if (bag       != null && !bag.isEmpty())       items.put("bag",       bag);

        if (items.isEmpty()) {
            return ResponseEntity.badRequest()
                .body(errorBody("Upload at least one clothing item to analyze."));
        }

        Optional<Map<String, Object>> modelData = storage.loadModelData();
        return ResponseEntity.ok(claude.analyzeTryOn(items, modelData.orElse(null)));
    }

    // ── Try-On Providers ──────────────────────────────────────────────────────

    @GetMapping("/try-on/providers")
    public ResponseEntity<Map<String, Object>> getTryOnProviders() {
        log.info("GET /api/try-on/providers");
        return ResponseEntity.ok(providerRegistry.buildCapabilityResponse());
    }

    // ── Try-On Generation ─────────────────────────────────────────────────────

    @PostMapping("/try-on/generate")
    public ResponseEntity<?> generateTryOn(
            // Single-garment params (FASHN, IDM-VTON)
            @RequestParam(value = "garm_img",          required = false)              MultipartFile garmImg,
            @RequestParam(value = "slot",              required = false)              String slot,
            @RequestParam(value = "provider_id",       required = false)              String providerId,
            @RequestParam(value = "garment_des",       required = false)              String garmentDes,
            @RequestParam(value = "body_shape",        required = false)              String bodyShape,
            @RequestParam(value = "contains_model",    required = false,
                          defaultValue = "false")                                     boolean containsModel,
            // Per-slot garment images for multi-garment providers (stable order: top, outerwear, bottom, dress, shoes, bag, glasses, earrings, hair_accessory, scarf, necklace, bracelet, belt, hat, watch, tights, socks)
            @RequestParam(value = "garm_img_top",            required = false) MultipartFile garmImgTop,
            @RequestParam(value = "garm_img_outerwear",      required = false) MultipartFile garmImgOuterwear,
            @RequestParam(value = "garm_img_bottom",         required = false) MultipartFile garmImgBottom,
            @RequestParam(value = "garm_img_dress",          required = false) MultipartFile garmImgDress,
            @RequestParam(value = "garm_img_shoes",          required = false) MultipartFile garmImgShoes,
            @RequestParam(value = "garm_img_bag",            required = false) MultipartFile garmImgBag,
            @RequestParam(value = "garm_img_glasses",        required = false) MultipartFile garmImgGlasses,
            @RequestParam(value = "garm_img_earrings",       required = false) MultipartFile garmImgEarrings,
            @RequestParam(value = "garm_img_hair_accessory", required = false) MultipartFile garmImgHairAccessory,
            @RequestParam(value = "garm_img_scarf",          required = false) MultipartFile garmImgScarf,
            @RequestParam(value = "garm_img_necklace",       required = false) MultipartFile garmImgNecklace,
            @RequestParam(value = "garm_img_bracelet",       required = false) MultipartFile garmImgBracelet,
            @RequestParam(value = "garm_img_belt",           required = false) MultipartFile garmImgBelt,
            @RequestParam(value = "garm_img_hat",            required = false) MultipartFile garmImgHat,
            @RequestParam(value = "garm_img_watch",          required = false) MultipartFile garmImgWatch,
            @RequestParam(value = "garm_img_tights",         required = false) MultipartFile garmImgTights,
            @RequestParam(value = "garm_img_socks",          required = false) MultipartFile garmImgSocks,
            @RequestParam(value = "outfit_mode",             required = false) String outfitMode,
            @RequestParam(value = "hair_accessory_placement",required = false) String hairAccessoryPlacement,
            @RequestHeader(value = "X-Demo-Code",            required = false) String demoCode)
            throws Exception {

        demoGuard.checkAndIncrement(demoCode);
        log.info("POST /api/try-on/generate — slot={}, provider={}", slot, providerId);

        // ── Provider resolution ──────────────────────────────────────────────
        TryOnProvider provider;
        if (providerId != null && !providerId.isBlank()) {
            provider = providerRegistry.getProviderById(providerId);
            if (provider == null) {
                return ResponseEntity.badRequest()
                    .body(errorBody("Unknown provider: " + providerId));
            }
            if (!provider.isConfigured()) {
                Map<String, Object> resp = new LinkedHashMap<>();
                resp.put("status", "provider_required");
                resp.put("mode",   "provider_stub");
                resp.put("preview_image_url", null);
                resp.put("message",
                    "Provider '" + providerId + "' is not configured. "
                    + "Add the required API token to your .env and restart.");
                return ResponseEntity.ok(resp);
            }
        } else {
            provider = providerRegistry.getActiveProvider();
            if (provider == null || !provider.isConfigured()) {
                Map<String, Object> resp = new LinkedHashMap<>();
                resp.put("status", "provider_required");
                resp.put("mode",   "provider_stub");
                resp.put("preview_image_url", null);
                resp.put("message",
                    "Real virtual try-on requires a provider token. "
                    + "Add REPLICATE_API_TOKEN, FASHN_API_KEY, or WAVESPEED_API_KEY to your .env and restart.");
                return ResponseEntity.ok(resp);
            }
        }

        // ── Model photo ──────────────────────────────────────────────────────
        if (!storage.hasModelPhoto()) {
            return ResponseEntity.badRequest().body(errorBody(
                "Build your body model first — go to the My Model tab and upload a full-body photo."));
        }

        byte[] humanBytes = storage.loadModelPhotoBytes();
        String humanType  = "image/jpeg"; // model photos are stored as JPEG

        // ── Build garments list from per-slot params (stable order: top, outerwear, bottom, dress, shoes, bag, glasses, earrings, hair_accessory, scarf, necklace, bracelet, belt, hat, watch, tights, socks) ──
        // Use a mutable map so null values (absent slots) do not throw NPE — Map.entry() disallows null.
        Map<String, MultipartFile> slotFiles = new LinkedHashMap<>();
        slotFiles.put("top",            garmImgTop);
        slotFiles.put("outerwear",      garmImgOuterwear);
        slotFiles.put("bottom",         garmImgBottom);
        slotFiles.put("dress",          garmImgDress);
        slotFiles.put("shoes",          garmImgShoes);
        slotFiles.put("bag",            garmImgBag);
        slotFiles.put("glasses",        garmImgGlasses);
        slotFiles.put("earrings",       garmImgEarrings);
        slotFiles.put("hair_accessory", garmImgHairAccessory);
        slotFiles.put("scarf",          garmImgScarf);
        slotFiles.put("necklace",       garmImgNecklace);
        slotFiles.put("bracelet",       garmImgBracelet);
        slotFiles.put("belt",           garmImgBelt);
        slotFiles.put("hat",            garmImgHat);
        slotFiles.put("watch",          garmImgWatch);
        slotFiles.put("tights",         garmImgTights);
        slotFiles.put("socks",          garmImgSocks);

        List<GarmentItem> garments = new ArrayList<>();
        for (Map.Entry<String, MultipartFile> entry : slotFiles.entrySet()) {
            MultipartFile f = entry.getValue();
            if (f != null && !f.isEmpty()) {
                String t = f.getContentType() != null ? f.getContentType().toLowerCase() : "image/jpeg";
                if ("image/jpg".equalsIgnoreCase(t)) t = "image/jpeg";
                garments.add(new GarmentItem(f.getBytes(), t, entry.getKey()));
            }
        }

        // ── Primary garment validation (single-garment path) ────────────────
        boolean hasSingleGarment = garmImg != null && !garmImg.isEmpty();
        if (!hasSingleGarment && garments.isEmpty()) {
            return ResponseEntity.badRequest().body(errorBody("No garment image provided."));
        }
        if (hasSingleGarment && (slot == null || slot.isBlank())) {
            return ResponseEntity.badRequest().body(errorBody("Slot is required with garm_img."));
        }

        byte[] garmBytes = hasSingleGarment ? garmImg.getBytes() : null;
        String garmType  = null;
        if (hasSingleGarment) {
            garmType = garmImg.getContentType() != null
                ? garmImg.getContentType().toLowerCase() : "image/jpeg";
            if ("image/jpg".equalsIgnoreCase(garmType)) garmType = "image/jpeg";
        }

        TryOnRequest req = new TryOnRequest(
            humanBytes, humanType, garmBytes, garmType, slot, garmentDes, bodyShape, containsModel, garments,
            outfitMode, hairAccessoryPlacement);

        try {
            return ResponseEntity.ok(provider.generate(req));
        } catch (OpenAiProviderException e) {
            log.warn("Try-on generate provider error — category={}", e.getCategory());
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("status",  "failed");
            resp.put("message", e.getMessage());
            return ResponseEntity.ok(resp);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody(e.getMessage()));
        }
    }

    // ── Garment Analysis ─────────────────────────────────────────────────────

    @PostMapping("/garment/analyze")
    public ResponseEntity<?> analyzeGarment(
            @RequestParam("photo") MultipartFile photo) throws Exception {
        log.info("POST /api/garment/analyze — file={}", photo.getOriginalFilename());
        if (photo == null || photo.isEmpty()) {
            return ResponseEntity.badRequest().body(errorBody("No photo provided."));
        }
        return ResponseEntity.ok(claude.analyzeGarment(photo));
    }

    // ── Outfit recommendation ─────────────────────────────────────────────────

    @PostMapping("/recommend")
    public ResponseEntity<?> recommend(@RequestBody RecommendRequest req) throws Exception {
        log.info("POST /api/recommend — location={}, occasion={}", req.location(), req.occasion());
        Optional<Map<String, Object>> profile = storage.loadProfile();
        if (profile.isEmpty()) {
            return ResponseEntity.badRequest()
                .body(errorBody("No style profile yet — analyze outfit photos first."));
        }
        Map<String, Object> weatherData    = weather.getWeather(req.location());
        Map<String, Object> recommendation = claude.recommendOutfit(
            profile.get(), weatherData, req.occasion(), req.timeOfDay(), req.extraNotes());

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("weather",        weatherData);
        resp.put("recommendation", recommendation);
        return ResponseEntity.ok(resp);
    }

    // ── Feedback / Outfit Log ─────────────────────────────────────────────────

    @PostMapping("/feedback")
    public ResponseEntity<Map<String, Object>> logFeedback(
            @RequestBody FeedbackRequest req) throws Exception {
        log.info("POST /api/feedback — occasion={}", req.occasion());
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("wore_today",          req.woreToday());
        entry.put("occasion",            req.occasion());
        entry.put("comfort_vs_polish",   req.comfortVsPolish());
        entry.put("walked_a_lot",        req.walkedALot());
        entry.put("wanted_to_stand_out", req.wantedToStandOut());
        entry.put("notes",               req.notes());
        storage.saveFeedback(entry);
        return ResponseEntity.ok(
            Map.of("message", "Logged! Your style profile improves with every entry."));
    }

    // ── Buy Check ─────────────────────────────────────────────────────────────

    @PostMapping("/buy-check")
    public ResponseEntity<?> buyCheck(@RequestParam("photo") MultipartFile photo) throws Exception {
        log.info("POST /api/buy-check — file={}", photo.getOriginalFilename());

        Optional<Map<String, Object>> modelData = storage.loadModelData();
        Optional<Map<String, Object>> profile   = storage.loadProfile();

        if (modelData.isEmpty() && profile.isEmpty()) {
            return ResponseEntity.badRequest()
                .body(errorBody("Set up your model first — go to the My Model tab."));
        }

        Map<String, Object> context = new LinkedHashMap<>();
        modelData.ifPresent(m -> context.put("body_model", m));
        profile.ifPresent(p -> context.put("style_profile", p));

        return ResponseEntity.ok(claude.checkPurchase(photo, context));
    }

    // ── Complete the Look ─────────────────────────────────────────────────────

    @PostMapping("/try-on/suggest-items")
    public ResponseEntity<?> suggestItems(
            @RequestParam("assigned_slots") String assignedSlots,
            @RequestParam(value = "recent_history", required = false, defaultValue = "") String recentHistory) {
        log.info("POST /api/try-on/suggest-items — assigned_slots={}", assignedSlots);
        if (assignedSlots == null || assignedSlots.isBlank()) {
            return ResponseEntity.badRequest().body(errorBody("assigned_slots is required."));
        }

        List<Map<String, Object>> suggestions;
        try {
            suggestions = claude.suggestCompleteTheLook(assignedSlots, recentHistory);
            if (suggestions == null || suggestions.isEmpty()) {
                log.warn("Complete-the-look suggestions fell back to curated defaults.");
                suggestions = buildFallbackSuggestions(assignedSlots);
            }
        } catch (Exception e) {
            log.warn("Complete-the-look suggestions fell back to curated defaults.");
            suggestions = buildFallbackSuggestions(assignedSlots);
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("suggestions", suggestions);
        return ResponseEntity.ok(resp);
    }

    private List<Map<String, Object>> buildFallbackSuggestions(String assignedSlots) {
        Set<String> assigned = assignedSlots == null || assignedSlots.isBlank()
            ? new HashSet<>()
            : new HashSet<>(Arrays.asList(assignedSlots.split(",")));

        // 37-item pool interleaved across all slot types; slots already in the outfit are skipped.
        List<Map<String, Object>> candidates = new java.util.ArrayList<>(List.of(
            Map.of("slot","bag",            "name","Small Black Shoulder Bag",     "reason","Versatile everyday essential"),
            Map.of("slot","earrings",       "name","Gold Hoop Earrings",           "reason","Adds warmth and polish"),
            Map.of("slot","glasses",        "name","Thin Black Glasses",           "reason","Defines the face effortlessly"),
            Map.of("slot","hair_accessory", "name","Silk Bow Hair Clip",           "reason","Elevates any hairstyle"),
            Map.of("slot","scarf",          "name","Cream Silk Scarf",             "reason","Luxurious soft finishing touch"),
            Map.of("slot","necklace",       "name","Gold Pendant Necklace",        "reason","Delicate statement at the neckline"),
            Map.of("slot","shoes",          "name","Black Loafers",                "reason","Grounded and versatile"),
            Map.of("slot","outerwear",      "name","Light Trench Coat",            "reason","Classic layering piece"),
            Map.of("slot","bracelet",       "name","Gold Bangle Bracelet",         "reason","Warm accent that catches light"),
            Map.of("slot","belt",           "name","Black Leather Belt",           "reason","Defines the waist and anchors the look"),
            Map.of("slot","hat",            "name","Black Wide Brim Hat",          "reason","Dramatic and sun-protective"),
            Map.of("slot","watch",          "name","Gold Watch",                   "reason","Refined punctuation on the wrist"),
            Map.of("slot","bag",            "name","Tan Leather Tote Bag",         "reason","Adds warmth and practicality"),
            Map.of("slot","earrings",       "name","Pearl Drop Earrings",          "reason","Timeless feminine elegance"),
            Map.of("slot","glasses",        "name","Brown Tortoise Round Glasses", "reason","Warm intellectual charm"),
            Map.of("slot","hair_accessory", "name","Pearl Headband",               "reason","Polished and put-together"),
            Map.of("slot","scarf",          "name","Black Wool Scarf",             "reason","Cozy and effortlessly chic"),
            Map.of("slot","necklace",       "name","Pearl Strand Necklace",        "reason","Classic elegance, always in style"),
            Map.of("slot","shoes",          "name","White Sneakers",               "reason","Fresh and effortlessly casual"),
            Map.of("slot","outerwear",      "name","Camel Blazer",                 "reason","Sharp structure and warmth"),
            Map.of("slot","tights",         "name","Black Sheer Tights",           "reason","Polishes legs and extends the season"),
            Map.of("slot","socks",          "name","White Ankle Socks",            "reason","Fresh casual detail"),
            Map.of("slot","bag",            "name","White Crossbody Bag",          "reason","Fresh and hands-free ease"),
            Map.of("slot","earrings",       "name","Silver Stud Earrings",         "reason","Clean and versatile accent"),
            Map.of("slot","glasses",        "name","Gold Rimless Glasses",         "reason","Subtle sophisticated detail"),
            Map.of("slot","hair_accessory", "name","Black Velvet Scrunchie",       "reason","Effortless retro texture"),
            Map.of("slot","scarf",          "name","Navy Stripe Scarf",            "reason","Graphic accent with warmth"),
            Map.of("slot","necklace",       "name","Silver Chain Necklace",        "reason","Minimalist shine and versatility"),
            Map.of("slot","shoes",          "name","Nude Block Heel Pumps",        "reason","Leg-lengthening elegance"),
            Map.of("slot","outerwear",      "name","Navy Denim Jacket",            "reason","Casual cool contrast"),
            Map.of("slot","bracelet",       "name","Silver Chain Bracelet",        "reason","Cool minimalist wrist detail"),
            Map.of("slot","belt",           "name","Tan Woven Belt",               "reason","Relaxed texture with structure"),
            Map.of("slot","hat",            "name","Cream Fedora Hat",             "reason","Effortless boho sophistication"),
            Map.of("slot","watch",          "name","Silver Minimalist Watch",      "reason","Clean precision and elegance"),
            Map.of("slot","tights",         "name","Nude Tights",                  "reason","Seamless skin-tone coverage"),
            Map.of("slot","socks",          "name","Black Crew Socks",             "reason","Understated everyday finish"),
            Map.of("slot","hat",            "name","Navy Knit Beanie",             "reason","Casual warmth and texture")
        ));

        return candidates.stream()
            .filter(s -> !assigned.contains(s.get("slot")))
            .limit(3)
            .collect(Collectors.toList());
    }

    @PostMapping("/try-on/add-item")
    public ResponseEntity<?> addItemToLook(
            @RequestParam("preview_image")                                   MultipartFile previewImage,
            @RequestParam("slot")                                            String slot,
            @RequestParam("item_description")                                String itemDescription,
            @RequestParam(value = "reference_image", required = false)       MultipartFile referenceImage,
            @RequestHeader(value = "X-Demo-Code",    required = false)       String demoCode)
            throws Exception {
        demoGuard.checkAndIncrement(demoCode);
        log.info("POST /api/try-on/add-item — slot={}, hasReference={}", slot, referenceImage != null);

        if (previewImage == null || previewImage.isEmpty()) {
            return ResponseEntity.badRequest().body(errorBody("No preview image provided."));
        }
        if (slot == null || slot.isBlank()) {
            return ResponseEntity.badRequest().body(errorBody("slot is required."));
        }
        if (itemDescription == null || itemDescription.isBlank()) {
            return ResponseEntity.badRequest().body(errorBody("item_description is required."));
        }
        if (!openAi.isConfigured()) {
            return ResponseEntity.badRequest().body(errorBody(
                "OpenAI API key not configured. Add OPENAI_API_KEY to your .env and restart."));
        }

        String previewType = previewImage.getContentType() != null
            ? previewImage.getContentType().toLowerCase() : "image/png";

        byte[] referenceBytes = null;
        String referenceType  = null;
        if (referenceImage != null && !referenceImage.isEmpty()) {
            referenceBytes = referenceImage.getBytes();
            referenceType  = referenceImage.getContentType() != null
                ? referenceImage.getContentType().toLowerCase() : "image/png";
        }

        try {
            Map<String, Object> result = openAi.addItemToPreview(
                previewImage.getBytes(), previewType,
                referenceBytes, referenceType,
                slot, itemDescription);
            return ResponseEntity.ok(result);
        } catch (OpenAiProviderException e) {
            log.warn("Add-item provider error — category={}", e.getCategory());
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("status",  "failed");
            resp.put("message", e.getMessage());
            return ResponseEntity.ok(resp);
        }
    }

    @PostMapping("/try-on/add-items")
    public ResponseEntity<?> addItemsBatchToLook(
            @RequestParam("preview_image")                                       MultipartFile previewImage,
            @RequestParam("slots")                                               List<String> slots,
            @RequestParam("item_descriptions")                                   List<String> itemDescriptions,
            @RequestParam(value = "reference_images", required = false)          List<MultipartFile> referenceImages,
            @RequestHeader(value = "X-Demo-Code",     required = false)          String demoCode)
            throws Exception {
        demoGuard.checkAndIncrement(demoCode);
        log.info("POST /api/try-on/add-items — count={}", slots != null ? slots.size() : 0);

        if (previewImage == null || previewImage.isEmpty()) {
            return ResponseEntity.badRequest().body(errorBody("No preview image provided."));
        }
        if (slots == null || slots.isEmpty()) {
            return ResponseEntity.badRequest().body(errorBody("slots is required."));
        }
        if (itemDescriptions == null || itemDescriptions.size() != slots.size()) {
            return ResponseEntity.badRequest().body(errorBody("item_descriptions count must match slots count."));
        }
        if (!openAi.isConfigured()) {
            return ResponseEntity.badRequest().body(errorBody(
                "OpenAI API key not configured. Add OPENAI_API_KEY to your .env and restart."));
        }

        String previewType = previewImage.getContentType() != null
            ? previewImage.getContentType().toLowerCase() : "image/png";

        List<BatchItem> items = new ArrayList<>();
        for (int i = 0; i < slots.size(); i++) {
            byte[] refBytes = null;
            String refType  = null;
            if (referenceImages != null && i < referenceImages.size()
                    && referenceImages.get(i) != null && !referenceImages.get(i).isEmpty()) {
                refBytes = referenceImages.get(i).getBytes();
                refType  = referenceImages.get(i).getContentType() != null
                    ? referenceImages.get(i).getContentType().toLowerCase() : "image/png";
            }
            items.add(new BatchItem(slots.get(i), itemDescriptions.get(i), refBytes, refType));
        }

        try {
            Map<String, Object> result = openAi.addItemsBatchToPreview(
                previewImage.getBytes(), previewType, items);
            return ResponseEntity.ok(result);
        } catch (OpenAiProviderException e) {
            log.warn("Batch add-items provider error — category={}", e.getCategory());
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("status",  "failed");
            resp.put("message", e.getMessage());
            return ResponseEntity.ok(resp);
        }
    }

    // ── Skin Tone Detection ───────────────────────────────────────────────────

    @PostMapping("/model/detect-skin-tone")
    public ResponseEntity<?> detectSkinTone() throws Exception {
        log.info("POST /api/model/detect-skin-tone");

        if (!storage.hasModelPhoto()) {
            return ResponseEntity.badRequest().body(errorBody(
                "No model photo found. Upload a photo in the My Model tab first."));
        }

        if (!claude.isConfigured()) {
            Map<String, Object> fallback = new LinkedHashMap<>();
            fallback.put("skin_depth",  "medium");
            fallback.put("undertone",   "not_sure");
            fallback.put("confidence",  0.0);
            return ResponseEntity.ok(fallback);
        }

        byte[] photoBytes = storage.loadModelPhotoBytes();
        try {
            Map<String, Object> result = claude.detectSkinTone(photoBytes, "image/jpeg");
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.warn("Skin tone detection failed; returning uncertain defaults.");
            Map<String, Object> fallback = new LinkedHashMap<>();
            fallback.put("skin_depth",  "medium");
            fallback.put("undertone",   "not_sure");
            fallback.put("confidence",  0.0);
            return ResponseEntity.ok(fallback);
        }
    }

    // ── Color Fit Analysis ────────────────────────────────────────────────────

    @PostMapping("/try-on/color-fit")
    public ResponseEntity<?> analyzeColorFit(
            @RequestParam("preview_image")                                                   MultipartFile previewImage,
            @RequestParam(value = "skin_depth",  required = false, defaultValue = "medium") String skinDepth,
            @RequestParam(value = "undertone",   required = false, defaultValue = "neutral") String undertone)
            throws Exception {

        log.info("POST /api/try-on/color-fit — depth={}, undertone={}", skinDepth, undertone);

        if (previewImage == null || previewImage.isEmpty()) {
            return ResponseEntity.badRequest().body(errorBody("No preview image provided."));
        }

        if (!claude.isConfigured()) {
            return ResponseEntity.ok(emptyColorFit("Claude API key not configured."));
        }

        String mimeType = previewImage.getContentType() != null
            ? previewImage.getContentType().toLowerCase() : "image/jpeg";
        if ("image/jpg".equalsIgnoreCase(mimeType)) mimeType = "image/jpeg";

        try {
            Map<String, Object> result = claude.analyzeColorFit(
                previewImage.getBytes(), mimeType, skinDepth, undertone);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.warn("Color fit analysis failed; returning empty result.");
            return ResponseEntity.ok(emptyColorFit("Analysis could not be completed. Try again with a clearer photo."));
        }
    }

    private Map<String, Object> emptyColorFit(String lightingNote) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("color_fit_score", 0);
        m.put("verdict",         "");
        m.put("reasons",         List.of());
        m.put("lighting_note",   lightingNote);
        m.put("better_colors",   List.of());
        m.put("caution_colors",  List.of());
        return m;
    }

    // ── Full-Outfit Try-On (Whole Outfit from Reference Photo) ───────────────

    @PostMapping("/try-on/full-outfit")
    public ResponseEntity<?> tryWholeOutfit(
            @RequestParam("outfit_ref")                           MultipartFile outfitRef,
            @RequestHeader(value = "X-Demo-Code", required = false) String demoCode) throws Exception {

        demoGuard.checkAndIncrement(demoCode);
        log.info("POST /api/try-on/full-outfit");

        if (!openAi.isConfigured()) {
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("status",            "provider_required");
            resp.put("mode",              "provider_stub");
            resp.put("preview_image_url", null);
            resp.put("message",
                "Try Whole Outfit requires GPT Image. Add OPENAI_API_KEY to your .env and restart.");
            return ResponseEntity.ok(resp);
        }

        if (!storage.hasModelPhoto()) {
            return ResponseEntity.badRequest().body(errorBody(
                "Build your body model first — go to the My Model tab and upload a full-body photo."));
        }

        if (outfitRef == null || outfitRef.isEmpty()) {
            return ResponseEntity.badRequest().body(errorBody("No outfit reference photo provided."));
        }

        byte[] modelBytes  = storage.loadModelPhotoBytes();
        byte[] outfitBytes = outfitRef.getBytes();
        String outfitType  = outfitRef.getContentType() != null
            ? outfitRef.getContentType().toLowerCase() : "image/jpeg";
        if ("image/jpg".equalsIgnoreCase(outfitType)) outfitType = "image/jpeg";

        try {
            Map<String, Object> result = openAi.tryWholeOutfit(
                modelBytes, "image/jpeg", outfitBytes, outfitType);
            return ResponseEntity.ok(result);
        } catch (OpenAiProviderException e) {
            log.warn("Whole-outfit provider error — category={}", e.getCategory());
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("status",  "failed");
            resp.put("message", e.getMessage());
            return ResponseEntity.ok(resp);
        }
    }

    // ── Outfit Reference Analysis ─────────────────────────────────────────────

    @PostMapping("/try-on/analyze-outfit")
    public ResponseEntity<?> analyzeOutfitReference(
            @RequestParam("outfit_img") MultipartFile outfitImg) throws Exception {

        log.info("POST /api/try-on/analyze-outfit");

        if (outfitImg == null || outfitImg.isEmpty()) {
            return ResponseEntity.badRequest().body(errorBody("No outfit image provided."));
        }

        if (!claude.isConfigured()) {
            return ResponseEntity.ok(Map.of("detected_pieces", List.of()));
        }

        String mimeType = outfitImg.getContentType() != null
            ? outfitImg.getContentType().toLowerCase() : "image/jpeg";
        if ("image/jpg".equalsIgnoreCase(mimeType)) mimeType = "image/jpeg";

        try {
            Map<String, Object> result = claude.analyzeOutfitReference(
                outfitImg.getBytes(), mimeType);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.warn("Outfit reference analysis failed; continuing without detected pieces.");
            return ResponseEntity.ok(Map.of("detected_pieces", List.of()));
        }
    }

    // ── Size Fit Preview ──────────────────────────────────────────────────────

    @PostMapping("/try-on/fit-preview")
    public ResponseEntity<?> fitPreview(
            @RequestParam("preview_image")                                                                  MultipartFile previewImage,
            @RequestParam(value = "fit_adjustment",  required = false, defaultValue = "size_up")           String fitAdjustment,
            @RequestParam(value = "height",          required = false, defaultValue = "")                  String height,
            @RequestParam(value = "size",            required = false, defaultValue = "")                  String size,
            @RequestParam(value = "fit_preference",  required = false, defaultValue = "not_sure")          String fitPreference,
            @RequestHeader(value = "X-Demo-Code",    required = false)                                     String demoCode) {

        demoGuard.checkAndIncrement(demoCode);
        log.info("POST /api/try-on/fit-preview — fit_adjustment={}", fitAdjustment);

        if (!openAi.isConfigured()) {
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("status",            "provider_required");
            resp.put("preview_image_url", null);
            resp.put("message",
                "Size Fit Preview requires GPT Image. Add OPENAI_API_KEY to your .env and restart.");
            return ResponseEntity.ok(resp);
        }

        if (previewImage == null || previewImage.isEmpty()) {
            return ResponseEntity.badRequest().body(errorBody("No preview image provided."));
        }

        if (!"size_up".equalsIgnoreCase(fitAdjustment) && !"size_down".equalsIgnoreCase(fitAdjustment)) {
            return ResponseEntity.badRequest().body(
                errorBody("fit_adjustment must be 'size_up' or 'size_down'."));
        }

        String mimeType;
        byte[] imageBytes;
        try {
            imageBytes = previewImage.getBytes();
            mimeType   = previewImage.getContentType() != null
                ? previewImage.getContentType().toLowerCase() : "image/jpeg";
            if ("image/jpg".equalsIgnoreCase(mimeType)) mimeType = "image/jpeg";
        } catch (Exception e) {
            log.warn("Fit preview: failed to read uploaded image.");
            return ResponseEntity.badRequest().body(errorBody("Could not read the uploaded image."));
        }

        try {
            Map<String, Object> result = openAi.fitPreview(
                imageBytes, mimeType, fitAdjustment, height, size, fitPreference);
            result.put("fit_adjustment", fitAdjustment);
            return ResponseEntity.ok(result);
        } catch (OpenAiProviderException e) {
            log.warn("Fit preview provider error — category={}", e.getCategory());
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("status",  "failed");
            resp.put("message", e.getMessage());
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            log.warn("Fit preview generation failed; returning error.");
            return ResponseEntity.status(500).body(
                errorBody("Fit preview could not be generated. Please try again."));
        }
    }

    // ── Generation Plan ───────────────────────────────────────────────────────

    @PostMapping("/try-on/generate-plan")
    public ResponseEntity<?> generatePlan(
            @RequestParam("preview_image") MultipartFile previewImage,
            @RequestParam(value = "plan_items",  required = false, defaultValue = "[]") String planItemsJson,
            @RequestParam(value = "fit_shift",   required = false, defaultValue = "none") String fitShift,
            @RequestParam(value = "scene",       required = false, defaultValue = "original") String scene,
            @RequestHeader(value = "X-Demo-Code", required = false) String demoCode)
            throws Exception {

        demoGuard.checkAndIncrement(demoCode);
        log.info("POST /api/try-on/generate-plan — fit_shift={}, scene={}", fitShift, scene);

        if (!openAi.isConfigured()) {
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("status", "provider_required");
            resp.put("preview_image_url", null);
            resp.put("message", "Generate Plan requires GPT Image. Add OPENAI_API_KEY to your .env and restart.");
            return ResponseEntity.ok(resp);
        }

        if (previewImage == null || previewImage.isEmpty()) {
            return ResponseEntity.badRequest().body(errorBody("No preview image provided."));
        }

        List<Map<String, String>> planItems;
        try {
            planItems = mapper.readValue(planItemsJson, new TypeReference<>() {});
        } catch (Exception e) {
            planItems = List.of();
        }

        String mimeType = previewImage.getContentType() != null
                ? previewImage.getContentType().toLowerCase() : "image/jpeg";
        if ("image/jpg".equalsIgnoreCase(mimeType)) mimeType = "image/jpeg";
        byte[] imageBytes = previewImage.getBytes();

        try {
            Map<String, Object> result = openAi.generatePlanLook(imageBytes, mimeType, planItems, fitShift, scene);
            return ResponseEntity.ok(result);
        } catch (OpenAiProviderException e) {
            log.warn("Generate plan provider error — category={}", e.getCategory());
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("status",  "failed");
            resp.put("message", e.getMessage());
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            log.warn("Generate plan failed; returning error.");
            return ResponseEntity.status(500).body(errorBody("Plan generation failed. Please try again."));
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Map<String, Object> errorBody(String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("error",   true);
        m.put("message", message);
        return m;
    }
}
