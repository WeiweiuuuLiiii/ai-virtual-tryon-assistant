package com.stylesignal.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class WaveSpeedService {

    private static final Logger log = LoggerFactory.getLogger(WaveSpeedService.class);

    private static final String WAVESPEED_API    = "https://api.wavespeed.ai/api/v3";
    private static final String MODEL_PATH       = "wavespeed-ai/ai-virtual-outfit-tryon";
    private static final int    POLL_INTERVAL_MS = 4000;
    private static final int    MAX_POLLS        = 75;  // 5-minute timeout

    // Stable prompt per WaveSpeed AI Virtual Outfit Try-On model requirements.
    private static final String DEFAULT_PROMPT =
        "Full-body virtual outfit try-on. Keep the same person, face, body shape, and pose as much as "
        + "possible. Put the uploaded clothing items on the person as a complete outfit. Preserve the "
        + "garment colors, silhouettes, and clothing details. Do not change the person's identity. "
        + "Do not redesign the clothes.";

    @Value("${wavespeed.api.key:}")
    private String apiKey;

    private final HttpClient   http   = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank() && !apiKey.startsWith("your_");
    }

    /**
     * Generates a full-outfit try-on via WaveSpeed AI.
     *
     * WaveSpeed accepts publicly accessible image URLs only — it cannot reach
     * base64 data URIs or localhost-served images. Call this method only when
     * the caller can supply real public URLs.
     *
     * @param humanImageUrl    public URL of the person/model photo
     * @param clothesImageUrls public URLs of garment images (stable order: top, outerwear, bottom, dress, shoes)
     */
    public Map<String, Object> generateOutfitTryOn(
            String humanImageUrl, List<String> clothesImageUrls) throws Exception {

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("image",          humanImageUrl);
        body.put("clothes_images", clothesImageUrls);
        body.put("prompt",         DEFAULT_PROMPT);
        body.put("duration",       5);

        String requestId = createRun(body);
        log.info("WaveSpeed prediction created — id={}", requestId);

        String outputUrl = pollRun(requestId);
        log.info("WaveSpeed prediction succeeded — output={}", outputUrl);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("status",            "ready");
        resp.put("mode",              "wavespeed_outfit");
        resp.put("preview_image_url", null);
        resp.put("preview_video_url", outputUrl);
        resp.put("message",           null);
        return resp;
    }

    private String createRun(Map<String, Object> body) throws Exception {
        String url = WAVESPEED_API + "/" + MODEL_PATH;
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + apiKey)
            .header("Content-Type",  "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
            .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200 && resp.statusCode() != 201) {
            String snippet = resp.body().length() > 400 ? resp.body().substring(0, 400) : resp.body();
            throw new RuntimeException(
                "WaveSpeed run creation failed (HTTP " + resp.statusCode() + "): " + snippet);
        }

        // WaveSpeed v3 response shape: { "data": { "id": "...", ... }, "status": 200 }
        Map<String, Object> parsed = mapper.readValue(resp.body(), new TypeReference<>() {});
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) parsed.get("data");
        if (data == null) throw new RuntimeException("WaveSpeed response missing 'data' field.");
        String id = (String) data.get("id");
        if (id == null || id.isBlank()) {
            throw new RuntimeException("WaveSpeed response missing prediction id.");
        }
        return id;
    }

    private String pollRun(String id) throws Exception {
        String url = WAVESPEED_API + "/predictions/" + id + "/result";
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + apiKey)
            .GET()
            .build();

        for (int attempt = 0; attempt < MAX_POLLS; attempt++) {
            Thread.sleep(POLL_INTERVAL_MS);
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                log.warn("WaveSpeed poll {} returned HTTP {}", attempt + 1, resp.statusCode());
                continue;
            }

            Map<String, Object> parsed = mapper.readValue(resp.body(), new TypeReference<>() {});
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) parsed.get("data");
            String status = data != null ? (String) data.get("status") : null;
            log.debug("WaveSpeed poll {} — status={}", attempt + 1, status);

            if ("completed".equals(status)) {
                return extractOutputUrl(data);
            } else if ("failed".equals(status)) {
                Object error = data != null ? data.get("error") : null;
                throw new RuntimeException(
                    "WaveSpeed prediction failed" + (error != null ? ": " + error : "."));
            }
            // created / processing — keep polling
        }

        throw new RuntimeException(
            "WaveSpeed try-on timed out after " + (MAX_POLLS * POLL_INTERVAL_MS / 1000) + "s.");
    }

    private String extractOutputUrl(Map<String, Object> data) {
        Object outputs = data.get("outputs");
        if (outputs instanceof List<?> list && !list.isEmpty()) {
            return String.valueOf(list.get(0));
        }
        throw new RuntimeException("WaveSpeed returned no output URL.");
    }
}
