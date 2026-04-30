package com.stylesignal.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class ClaudeService {

    private static final Logger log = LoggerFactory.getLogger(ClaudeService.class);

    private static final String API_URL = "https://api.anthropic.com/v1/messages";
    private static final String MODEL   = "claude-sonnet-4-6";

    private static final Set<String> SUPPORTED_TYPES =
        Set.of("image/jpeg", "image/png", "image/gif", "image/webp");

    @Value("${anthropic.api.key:}")
    private String apiKey;

    private final HttpClient   http   = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    /** Built once at startup from style-taxonomy.json. */
    private String styleAnalysisPrompt;

    // ── Startup: load taxonomy ────────────────────────────────────────────────

    @PostConstruct
    public void init() throws Exception {
        ClassPathResource res = new ClassPathResource("style-taxonomy.json");
        String json = new String(res.getInputStream().readAllBytes(), StandardCharsets.UTF_8);

        Map<String, Object> root = mapper.readValue(json, new TypeReference<>() {});
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> styles = (List<Map<String, Object>>) root.get("style_taxonomy");

        // Build compact taxonomy reference for the prompt (~24 lines)
        StringBuilder taxonomyRef = new StringBuilder();
        for (Map<String, Object> s : styles) {
            @SuppressWarnings("unchecked")
            List<String> vibes = (List<String>) s.get("core_vibe");
            taxonomyRef
                .append("  • ").append(s.get("name"))
                .append(" — ").append(String.join(", ", vibes))
                .append(" [dressiness: ").append(s.get("dressiness")).append("]\n");
        }

        styleAnalysisPrompt = buildStyleAnalysisPrompt(taxonomyRef.toString());
        log.info("Taxonomy loaded: {} styles", styles.size());
    }

    private static String buildStyleAnalysisPrompt(String taxonomyRef) {
        return "You are a fashion stylist AI. Analyze the outfit photos and classify the person's style "
            + "using ONLY the predefined taxonomy below. Do not invent new style labels.\n\n"
            + "STYLE TAXONOMY (these are the only valid style names):\n"
            + taxonomyRef + "\n"
            + "INSTRUCTIONS:\n"
            + "1. dominant_styles — 1 or 2 taxonomy names that best describe the majority of outfits.\n"
            + "2. secondary_styles — 0–2 taxonomy names that appear as secondary influences. Use [] if none.\n"
            + "3. color_palette.specific_colors — specific color names you actually see (e.g. cream, cobalt, olive).\n"
            + "4. color_palette.color_families — broad families (neutrals, earth tones, pastels, etc.).\n"
            + "5. silhouettes — shape and fit words you observe (e.g. oversized, tailored, flowy).\n"
            + "6. common_items — recurring clothing pieces across photos.\n"
            + "7. textures_materials — fabrics and textures you can identify.\n"
            + "8. dressiness_level — one of: low | low-medium | medium | medium-high | high.\n"
            + "9. layering_level — one of: rarely | sometimes | frequently.\n"
            + "10. fit_preference — e.g. [\"relaxed\", \"tailored\"] — what fit patterns you see.\n"
            + "11. style_consistency — one of: low | medium | high — how uniform the style is across photos.\n"
            + "12. overall_vibe_keywords — 4–8 short adjectives that capture the vibe (can overlap with taxonomy vibes).\n"
            + "13. occasion_patterns — describe how they dress for casual, work, evening, travel, party. "
            + "Use null if the photos show no evidence for that occasion.\n"
            + "14. overall_summary — 2–3 sentences describing the person's style identity.\n\n"
            + "RULES:\n"
            + "- dominant_styles and secondary_styles MUST use exact taxonomy names only.\n"
            + "- Return ONLY valid JSON. No prose before or after.\n\n"
            + "{\n"
            + "  \"dominant_styles\": [],\n"
            + "  \"secondary_styles\": [],\n"
            + "  \"color_palette\": {\n"
            + "    \"specific_colors\": [],\n"
            + "    \"color_families\": []\n"
            + "  },\n"
            + "  \"silhouettes\": [],\n"
            + "  \"common_items\": [],\n"
            + "  \"textures_materials\": [],\n"
            + "  \"dressiness_level\": \"medium\",\n"
            + "  \"layering_level\": \"sometimes\",\n"
            + "  \"fit_preference\": [],\n"
            + "  \"style_consistency\": \"medium\",\n"
            + "  \"overall_vibe_keywords\": [],\n"
            + "  \"occasion_patterns\": {\n"
            + "    \"casual\": null,\n"
            + "    \"work\": null,\n"
            + "    \"evening\": null,\n"
            + "    \"travel\": null,\n"
            + "    \"party\": null\n"
            + "  },\n"
            + "  \"overall_summary\": \"\",\n"
            + "  \"photo_count_analyzed\": 0\n"
            + "}";
    }

    // ── Validation ────────────────────────────────────────────────────────────

    private void validateApiKey() {
        if (apiKey == null || apiKey.isBlank() || apiKey.startsWith("your_")) {
            throw new IllegalStateException(
                "Missing ANTHROPIC_API_KEY. Add it to .env and restart the app.");
        }
    }

    private String validateMediaType(MultipartFile file) {
        String ct = file.getContentType();
        if (ct == null || ct.isBlank()) {
            log.warn("No content-type for '{}', defaulting to image/jpeg", file.getOriginalFilename());
            return "image/jpeg";
        }
        if (ct.equalsIgnoreCase("image/jpg")) return "image/jpeg";
        String lower = ct.toLowerCase();
        if (!SUPPORTED_TYPES.contains(lower)) {
            throw new IllegalArgumentException(
                "Unsupported image type '" + ct + "' for '" + file.getOriginalFilename()
                + "'. Please use JPEG, PNG, GIF, or WebP.");
        }
        return lower;
    }

    // ── Style Analysis ────────────────────────────────────────────────────────

    public Map<String, Object> analyzeStylePhotos(List<MultipartFile> photos) throws Exception {
        validateApiKey();
        log.info("analyzeStylePhotos — {} photo(s)", photos.size());

        List<Map<String, Object>> batches = new ArrayList<>();
        for (int i = 0; i < photos.size(); i += 10) {
            List<MultipartFile> batch = photos.subList(i, Math.min(i + 10, photos.size()));
            log.info("Batch {}/{} — {} photos",
                (i / 10) + 1, (int) Math.ceil(photos.size() / 10.0), batch.size());
            batches.add(analyzeBatch(batch));
        }

        Map<String, Object> result = batches.size() == 1 ? batches.get(0) : mergeAnalyses(batches);
        result.put("photo_count_analyzed", photos.size());
        log.info("analyzeStylePhotos complete");
        return result;
    }

    private Map<String, Object> analyzeBatch(List<MultipartFile> photos) throws Exception {
        List<Object> content = new ArrayList<>();
        for (MultipartFile photo : photos) {
            String mt  = validateMediaType(photo);
            String b64 = Base64.getEncoder().encodeToString(photo.getBytes());
            content.add(Map.of(
                "type", "image",
                "source", Map.of("type", "base64", "media_type", mt, "data", b64)
            ));
        }
        content.add(Map.of("type", "text", "text", styleAnalysisPrompt));
        return callClaude(content, 2000);
    }

    private Map<String, Object> mergeAnalyses(List<Map<String, Object>> analyses) throws Exception {
        String combined = mapper.writeValueAsString(analyses);
        String mergePrompt =
            "These are style analyses from multiple photo batches for the same person. "
            + "Merge them into one final profile using the same JSON schema. "
            + "Combine lists, pick the most represented dominant_styles, and sum photo_count_analyzed.\n\n"
            + combined
            + "\n\nReturn ONLY valid JSON. No prose.";
        return callClaude(List.of(Map.of("type", "text", "text", mergePrompt)), 2000);
    }

    // ── Outfit Recommendation ─────────────────────────────────────────────────

    public Map<String, Object> recommendOutfit(
            Map<String, Object> profile,
            Map<String, Object> weather,
            String occasion,
            String timeOfDay,
            String extraNotes) throws Exception {

        validateApiKey();
        String extra = (extraNotes != null && !extraNotes.isBlank())
            ? "\nAdditional context: " + extraNotes : "";

        String prompt = """
            You are a personal fashion stylist. Recommend an outfit based on this person's style profile.

            STYLE PROFILE:
            %s

            WEATHER:
            - Temperature: %s°C (feels like %s°C)
            - Conditions: %s
            - Rain chance: %s%%
            - Wind: %s km/h
            - Time of day: %s

            OCCASION: %s%s

            The profile's dominant_styles and overall_vibe_keywords are the primary style signals.
            Recommend a complete outfit consistent with those styles, suitable for the weather and occasion.

            For short_reasons: exactly 2–3 one-line statements (≤12 words each) explaining why this outfit works.
            For the three score fields: rate 1–10 on how well the outfit fits each dimension.

            Return ONLY valid JSON:
            {"top":"","bottom":"","outerwear":null,"shoes":"","accessories":[],"color_direction":"","style_match_score":8,"weather_fit_score":8,"scene_fit_score":8,"short_reasons":[],"why_it_fits_your_style":"","weather_reasoning":"","occasion_notes":""}
            """.formatted(
                mapper.writeValueAsString(profile),
                weather.getOrDefault("temp", "?"),
                weather.getOrDefault("feels_like", "?"),
                weather.getOrDefault("description", "unknown"),
                weather.getOrDefault("rain_chance", 0),
                weather.getOrDefault("wind_speed", 0),
                timeOfDay, occasion, extra);

        return callClaude(List.of(Map.of("type", "text", "text", prompt)), 1000);
    }

    // ── Model Analysis ────────────────────────────────────────────────────────

    public Map<String, Object> analyzeModel(MultipartFile photo) throws Exception {
        validateApiKey();
        String mt  = validateMediaType(photo);
        String b64 = Base64.getEncoder().encodeToString(photo.getBytes());

        String prompt = """
            You are a fashion expert. Analyze this full-body photo for body shape and styling guidance.

            Identify the body shape category and give practical advice on what works best for this frame.
            For style_tips: 3–4 specific tips (≤15 words each).
            For best_silhouettes: 3–5 silhouette or cut names that genuinely flatter this shape.
            For avoid_silhouettes: 1–3 silhouettes that tend to clash with this shape.

            Return ONLY valid JSON:
            {"body_shape":"hourglass or pear or apple or rectangle or inverted_triangle","shape_description":"","key_proportions":"","best_silhouettes":[],"avoid_silhouettes":[],"style_tips":[]}
            """;

        List<Object> content = List.of(
            Map.of("type", "image", "source", Map.of("type", "base64", "media_type", mt, "data", b64)),
            Map.of("type", "text", "text", prompt)
        );
        return callClaude(content, 1000);
    }

    // ── Scene Check ───────────────────────────────────────────────────────────

    public Map<String, Object> checkScene(
            String outfitDescription,
            String scene,
            Map<String, Object> weather,
            String vibe,
            Map<String, Object> modelData) throws Exception {

        validateApiKey();

        String modelContext = "";
        if (modelData != null && !modelData.isEmpty()) {
            modelContext = "\nMODEL INFO:\nBody shape: " + modelData.getOrDefault("body_shape", "unknown")
                + "\nBest silhouettes: " + modelData.getOrDefault("best_silhouettes", "[]") + "\n";
        }

        String prompt = """
            You are a personal fashion consultant. Evaluate this outfit for the given scene and weather.

            OUTFIT: %s
            SCENE: %s
            VIBE: %s
            WEATHER: %s°C, %s, rain %s%%%s

            Rate this outfit directly. For suggested_swaps: 0–2 specific item swaps that would help (empty [] if outfit is already good).
            For short_reasons: exactly 3 one-line statements (≤12 words each).

            Return ONLY valid JSON:
            {"scene_verdict":"great fit or adjust or not ideal","scene_fit_score":8,"weather_fit_score":8,"style_fit_score":8,"short_reasons":[],"suggested_swaps":[],"overall_notes":""}
            """.formatted(
                outfitDescription,
                scene,
                vibe != null && !vibe.isBlank() ? vibe : "balanced",
                weather.getOrDefault("temp", "?"),
                weather.getOrDefault("description", "unknown"),
                weather.getOrDefault("rain_chance", 0),
                modelContext
            );

        return callClaude(List.of(Map.of("type", "text", "text", prompt)), 800);
    }

    // ── Try-On Analysis ───────────────────────────────────────────────────────

    public Map<String, Object> analyzeTryOn(Map<String, MultipartFile> items) throws Exception {
        validateApiKey();

        List<Object> content = new ArrayList<>();
        List<String> slotNames = new ArrayList<>();
        for (Map.Entry<String, MultipartFile> entry : items.entrySet()) {
            if (entry.getValue() != null && !entry.getValue().isEmpty()) {
                String mt  = validateMediaType(entry.getValue());
                String b64 = Base64.getEncoder().encodeToString(entry.getValue().getBytes());
                content.add(Map.of("type", "image",
                    "source", Map.of("type", "base64", "media_type", mt, "data", b64)));
                slotNames.add(entry.getKey());
            }
        }

        if (content.isEmpty()) {
            throw new IllegalArgumentException("Upload at least one clothing item to analyze.");
        }

        String itemList = String.join(", ", slotNames);
        String prompt = """
            You are a personal stylist. Analyze how these clothing pieces work together as an outfit.
            The images show (in order): %s.

            Assess cohesion, color harmony, and overall vibe. Be specific and direct.
            For try_on_notes: 3–4 specific observations about how these pieces work together (≤15 words each).
            For suggested_tweaks: 1–2 specific improvements, or [] if the outfit works well as-is.

            Return ONLY valid JSON:
            {"overall_vibe":"","combination_score":8,"color_harmony":"great or good or clashes","fit_harmony":"great or good or clashes","try_on_notes":[],"suggested_tweaks":[],"verdict":"works or adjust or clash"}
            """.formatted(itemList);

        content.add(Map.of("type", "text", "text", prompt));
        return callClaude(content, 1000);
    }

    // ── Buy Check ─────────────────────────────────────────────────────────────

    public Map<String, Object> checkPurchase(MultipartFile photo, Map<String, Object> profile) throws Exception {
        validateApiKey();
        String mt  = validateMediaType(photo);
        String b64 = Base64.getEncoder().encodeToString(photo.getBytes());

        String prompt = """
            You are a brutally honest personal stylist. Should this person buy this item?

            THEIR STYLE PROFILE:
            %s

            Their dominant_styles and overall_vibe_keywords define what truly fits their wardrobe.
            Analyze: does this item match those styles? Is it repetitive? Will they actually wear it?
            Be honest — better to say skip than encourage a bad purchase.

            For short_reasons: 2–3 one-line statements (≤12 words each) giving the key verdict reasoning.
            For best_scenes: 2–4 specific occasions this item works well (e.g. "casual lunch", "weekend errand").
            For avoid_scenes: 0–2 occasions it genuinely doesn't work for. Use [] if none.
            For head_to_toe_styling: a complete outfit pairing — top, bottom, shoes, outerwear, accessories.

            Return ONLY valid JSON:
            {"verdict":"buy or skip or maybe","verdict_headline":"","fits_style_score":0,"repetitiveness":"low or medium or high","best_scenes":[],"avoid_scenes":[],"wear_likelihood":"rarely or sometimes or often","short_reasons":[],"main_reasoning":"","style_gap_filled":null,"concerns":[],"head_to_toe_styling":{"top":null,"bottom":null,"shoes":null,"outerwear":null,"accessories":[]}}
            """.formatted(mapper.writeValueAsString(profile));

        List<Object> content = List.of(
            Map.of("type", "image", "source", Map.of("type", "base64", "media_type", mt, "data", b64)),
            Map.of("type", "text", "text", prompt)
        );
        return callClaude(content, 1000);
    }

    // ── Core HTTP call ────────────────────────────────────────────────────────

    private Map<String, Object> callClaude(List<Object> content, int maxTokens) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model",      MODEL);
        body.put("max_tokens", maxTokens);
        body.put("messages",   List.of(Map.of("role", "user", "content", content)));

        log.info("Calling Claude API (model={}, maxTokens={})", MODEL, maxTokens);

        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(API_URL))
            .header("Content-Type",     "application/json")
            .header("x-api-key",         apiKey)
            .header("anthropic-version", "2023-06-01")
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
            .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        int status = resp.statusCode();
        log.info("Claude API status: {}", status);

        if (status != 200) {
            String snippet = resp.body().length() > 500 ? resp.body().substring(0, 500) : resp.body();
            log.error("Claude API error {}: {}", status, snippet);
            String friendly = switch (status) {
                case 401 -> "Invalid or missing ANTHROPIC_API_KEY. Check your .env file and restart.";
                case 403 -> "Access denied by Anthropic API. Verify your API key permissions.";
                case 429 -> "Claude API rate limit hit. Wait a moment and try again.";
                case 400 -> "Bad request sent to Claude. Details: " + snippet;
                case 529 -> "Anthropic API is overloaded. Try again in a few seconds.";
                default  -> "Claude API returned HTTP " + status + ". Details: " + snippet;
            };
            throw new RuntimeException(friendly);
        }

        String rawText;
        try {
            Map<String, Object> parsed = mapper.readValue(resp.body(), new TypeReference<>() {});
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> respContent = (List<Map<String, Object>>) parsed.get("content");
            if (respContent == null || respContent.isEmpty()) {
                throw new RuntimeException("Claude returned an empty content array.");
            }
            rawText = (String) respContent.get(0).get("text");
            if (rawText == null || rawText.isBlank()) {
                throw new RuntimeException("Claude returned blank text content.");
            }
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to read Claude response structure: {}", e.getMessage());
            throw new RuntimeException("Unexpected Claude response format: " + e.getMessage());
        }

        String json = extractJson(rawText);
        log.debug("Extracted JSON (first 200): {}",
            json.length() > 200 ? json.substring(0, 200) + "…" : json);

        try {
            return mapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.error("JSON parse failure. Raw Claude text:\n{}", rawText);
            throw new RuntimeException(
                "Claude's response was not valid JSON. Please try again.");
        }
    }

    private String extractJson(String text) {
        text = text.strip();
        if (text.contains("```json")) text = text.split("```json", 2)[1].split("```", 2)[0].strip();
        else if (text.contains("```")) text = text.split("```", 2)[1].split("```", 2)[0].strip();
        int start = text.indexOf('{');
        int end   = text.lastIndexOf('}');
        if (start != -1 && end != -1 && end > start) return text.substring(start, end + 1);
        return text;
    }
}
