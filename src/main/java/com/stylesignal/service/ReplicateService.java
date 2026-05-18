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
public class ReplicateService {

    private static final Logger log = LoggerFactory.getLogger(ReplicateService.class);

    private static final String REPLICATE_API    = "https://api.replicate.com/v1";
    private static final String MODEL_OWNER      = "cuuupid";
    private static final String MODEL_NAME       = "idm-vton";
    private static final int    POLL_INTERVAL_MS = 2000;
    private static final int    MAX_POLLS        = 60; // 120s timeout

    @Value("${replicate.api.token:}")
    private String apiToken;

    private final HttpClient   http   = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    public boolean isConfigured() {
        return apiToken != null && !apiToken.isBlank() && !apiToken.startsWith("your_");
    }

    /** Returns the IDM-VTON category for a slot, or null if unsupported in v1. */
    public static String mapSlotToCategory(String slot) {
        return switch (slot == null ? "" : slot) {
            case "top",  "outerwear" -> "upper_body";
            case "bottom", "shoes"   -> "lower_body";
            case "dress"             -> "dresses";
            default                  -> null; // bag and unknown slots unsupported in v1
        };
    }

    public Map<String, Object> generateTryOn(
            byte[] humanImgBytes, String humanImgType,
            byte[] garmImgBytes,  String garmImgType,
            String garmentDes, String category) throws Exception {

        String humanDataUri = "data:" + humanImgType + ";base64,"
            + Base64.getEncoder().encodeToString(humanImgBytes);
        String garmDataUri  = "data:" + garmImgType  + ";base64,"
            + Base64.getEncoder().encodeToString(garmImgBytes);

        Map<String, Object> input = new LinkedHashMap<>();
        input.put("human_img",   humanDataUri);
        input.put("garm_img",    garmDataUri);
        input.put("garment_des", garmentDes != null ? garmentDes : "");
        input.put("category",    category);
        input.put("crop",        true);
        input.put("steps",       30);
        input.put("seed",        42);

        String predictionId = createPrediction(input);
        log.info("IDM-VTON prediction created — id={}", predictionId);

        String outputUrl = pollPrediction(predictionId);
        log.info("IDM-VTON prediction succeeded — output={}", outputUrl);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("status",            "ready");
        resp.put("mode",              "real_try_on");
        resp.put("preview_image_url", outputUrl);
        resp.put("message",           null);
        return resp;
    }

    private String createPrediction(Map<String, Object> input) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("input", input);

        String url = REPLICATE_API + "/models/" + MODEL_OWNER + "/" + MODEL_NAME + "/predictions";
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + apiToken)
            .header("Content-Type",  "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
            .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 201) {
            String snippet = resp.body().length() > 400 ? resp.body().substring(0, 400) : resp.body();
            throw new RuntimeException(
                "Replicate create prediction failed (HTTP " + resp.statusCode() + "): " + snippet);
        }

        Map<String, Object> parsed = mapper.readValue(resp.body(), new TypeReference<>() {});
        String id = (String) parsed.get("id");
        if (id == null || id.isBlank()) {
            throw new RuntimeException("Replicate response missing prediction id.");
        }
        return id;
    }

    private String pollPrediction(String id) throws Exception {
        String url = REPLICATE_API + "/predictions/" + id;
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + apiToken)
            .GET()
            .build();

        for (int attempt = 0; attempt < MAX_POLLS; attempt++) {
            Thread.sleep(POLL_INTERVAL_MS);
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                log.warn("Replicate poll attempt {} returned HTTP {}", attempt + 1, resp.statusCode());
                continue;
            }

            Map<String, Object> parsed = mapper.readValue(resp.body(), new TypeReference<>() {});
            String status = (String) parsed.get("status");
            log.debug("IDM-VTON poll {} — status={}", attempt + 1, status);

            if ("succeeded".equals(status)) {
                return extractOutputUrl(parsed);
            } else if ("failed".equals(status) || "canceled".equals(status)) {
                Object error = parsed.get("error");
                throw new RuntimeException(
                    "IDM-VTON prediction " + status + (error != null ? ": " + error : "."));
            }
            // starting / processing — keep polling
        }

        throw new RuntimeException(
            "IDM-VTON try-on timed out after " + (MAX_POLLS * POLL_INTERVAL_MS / 1000) + "s.");
    }

    @SuppressWarnings("unchecked")
    private String extractOutputUrl(Map<String, Object> prediction) {
        Object output = prediction.get("output");
        if (output instanceof List<?> list) {
            if (!list.isEmpty()) return String.valueOf(list.get(0));
        }
        if (output instanceof String s) return s;
        throw new RuntimeException("IDM-VTON returned no output URL.");
    }
}
