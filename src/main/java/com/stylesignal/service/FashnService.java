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
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class FashnService {

    private static final Logger log = LoggerFactory.getLogger(FashnService.class);

    private static final String FASHN_API        = "https://api.fashn.ai/v1";
    private static final int    POLL_INTERVAL_MS  = 2000;
    private static final int    MAX_POLLS         = 60; // 120s timeout

    @Value("${fashn.api.key:}")
    private String apiKey;

    private final HttpClient   http   = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank() && !apiKey.startsWith("your_");
    }

    /**
     * Maps StyleSignal slot names to FASHN v1.6 category values.
     * Returns null for explicitly unsupported slots (shoes, bag).
     * Returns "auto" for unknown/blank slots so FASHN can auto-detect.
     */
    public static String mapSlotToCategory(String slot) {
        return switch (slot == null ? "" : slot) {
            case "top", "outerwear" -> "tops";
            case "bottom"           -> "bottoms";
            case "dress"            -> "one-pieces";
            case "shoes", "bag"     -> null;   // explicitly unsupported
            default                 -> "auto"; // unknown/blank → let FASHN auto-detect
        };
    }

    public Map<String, Object> generateTryOn(
            byte[] humanImgBytes, String humanImgType,
            byte[] garmImgBytes,  String garmImgType,
            String category, boolean containsModel) throws Exception {

        String humanDataUri = "data:" + humanImgType + ";base64,"
            + Base64.getEncoder().encodeToString(humanImgBytes);
        String garmDataUri  = "data:" + garmImgType  + ";base64,"
            + Base64.getEncoder().encodeToString(garmImgBytes);

        Map<String, Object> inputs = new LinkedHashMap<>();
        inputs.put("model_image",        humanDataUri);
        inputs.put("garment_image",      garmDataUri);
        inputs.put("category",           category != null ? category : "auto");
        inputs.put("garment_photo_type", containsModel ? "model" : "auto");
        inputs.put("segmentation_free",  true);
        inputs.put("mode",               "balanced");
        inputs.put("num_samples",        1);
        inputs.put("output_format",      "png");
        inputs.put("return_base64",      false);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model_name", "tryon-v1.6");
        body.put("inputs",     inputs);

        String predictionId = createRun(body);
        log.info("FASHN prediction created — id={}", predictionId);

        String outputUrl = pollRun(predictionId);
        log.info("FASHN prediction succeeded — output={}", outputUrl);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("status",            "ready");
        resp.put("mode",              "real_try_on");
        resp.put("preview_image_url", outputUrl);
        resp.put("message",           null);
        return resp;
    }

    private String createRun(Map<String, Object> body) throws Exception {
        String url = FASHN_API + "/run";
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
                "FASHN run creation failed at POST " + url
                + " (HTTP " + resp.statusCode() + "): " + snippet);
        }

        Map<String, Object> parsed = mapper.readValue(resp.body(), new TypeReference<>() {});
        String id = (String) parsed.get("id");
        if (id == null || id.isBlank()) {
            throw new RuntimeException("FASHN response missing prediction id.");
        }
        return id;
    }

    private String pollRun(String id) throws Exception {
        String url = FASHN_API + "/status/" + id;
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + apiKey)
            .GET()
            .build();

        for (int attempt = 0; attempt < MAX_POLLS; attempt++) {
            Thread.sleep(POLL_INTERVAL_MS);
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                log.warn("FASHN poll attempt {} returned HTTP {}", attempt + 1, resp.statusCode());
                continue;
            }

            Map<String, Object> parsed = mapper.readValue(resp.body(), new TypeReference<>() {});
            String status = (String) parsed.get("status");
            log.debug("FASHN poll {} — status={}", attempt + 1, status);

            if ("completed".equals(status)) {
                return extractOutputUrl(parsed);
            } else if ("failed".equals(status)) {
                Object error = parsed.get("error");
                throw new RuntimeException(
                    "FASHN prediction failed" + (error != null ? ": " + error : "."));
            }
            // starting / processing — keep polling
        }

        throw new RuntimeException(
            "FASHN try-on timed out after " + (MAX_POLLS * POLL_INTERVAL_MS / 1000) + "s.");
    }

    @SuppressWarnings("unchecked")
    private String extractOutputUrl(Map<String, Object> prediction) {
        Object output = prediction.get("output");
        if (output instanceof List<?> list) {
            if (!list.isEmpty()) return String.valueOf(list.get(0));
        }
        if (output instanceof String s) return s;
        throw new RuntimeException("FASHN returned no output URL.");
    }
}
