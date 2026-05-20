package com.stylesignal.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stylesignal.model.FeedbackRequest;
import com.stylesignal.model.RecommendRequest;
import com.stylesignal.model.SceneCheckRequest;
import com.stylesignal.service.ClaudeService;
import com.stylesignal.service.StorageService;
import com.stylesignal.service.WeatherService;
import com.stylesignal.tryon.TryOnProvider;
import com.stylesignal.tryon.TryOnProviderRegistry;
import com.stylesignal.tryon.TryOnRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ApiController {

    private static final Logger log = LoggerFactory.getLogger(ApiController.class);

    private final ClaudeService          claude;
    private final WeatherService         weather;
    private final StorageService         storage;
    private final TryOnProviderRegistry  providerRegistry;
    private final ObjectMapper           mapper = new ObjectMapper();

    public ApiController(ClaudeService claude, WeatherService weather,
                         StorageService storage, TryOnProviderRegistry providerRegistry) {
        this.claude           = claude;
        this.weather          = weather;
        this.storage          = storage;
        this.providerRegistry = providerRegistry;
    }

    // ── Global error handler ──────────────────────────────────────────────────

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
            @RequestParam("garm_img")                              MultipartFile garmImg,
            @RequestParam("slot")                                  String slot,
            @RequestParam(value = "garment_des", required = false) String garmentDes,
            @RequestParam(value = "body_shape",  required = false) String bodyShape)
            throws Exception {

        log.info("POST /api/try-on/generate — slot={}", slot);

        TryOnProvider provider = providerRegistry.getActiveProvider();
        if (provider == null || !provider.isConfigured()) {
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("status", "provider_required");
            resp.put("mode",   "provider_stub");
            resp.put("preview_image_url", null);
            resp.put("message",
                "Real virtual try-on requires a provider token. "
                + "Add REPLICATE_API_TOKEN to your .env and restart.");
            return ResponseEntity.ok(resp);
        }

        if (!storage.hasModelPhoto()) {
            return ResponseEntity.badRequest().body(errorBody(
                "Build your body model first — go to the My Model tab and upload a full-body photo."));
        }

        byte[] humanBytes = storage.loadModelPhotoBytes();
        String humanType  = "image/jpeg"; // model photos are stored as JPEG
        byte[] garmBytes  = garmImg.getBytes();
        String garmType   = garmImg.getContentType() != null
            ? garmImg.getContentType().toLowerCase() : "image/jpeg";
        if ("image/jpg".equalsIgnoreCase(garmType)) garmType = "image/jpeg";

        TryOnRequest req = new TryOnRequest(
            humanBytes, humanType, garmBytes, garmType, slot, garmentDes, bodyShape);

        try {
            return ResponseEntity.ok(provider.generate(req));
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

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Map<String, Object> errorBody(String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("error",   true);
        m.put("message", message);
        return m;
    }
}
