package com.stylesignal.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stylesignal.tryon.GarmentItem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Calls the OpenAI Images Edit API (gpt-image-1) to produce a high-fidelity
 * static try-on preview from a model photo and one or more garment reference images.
 *
 * Request shape: multipart/form-data POST to /v1/images/edits.
 * All image bytes are sent in-process — no external hosting required.
 * The API returns base64-encoded PNG which is returned as a data URI.
 */
@Service
public class OpenAiImageService {

    private static final Logger log = LoggerFactory.getLogger(OpenAiImageService.class);
    private static final String OPENAI_API = "https://api.openai.com/v1";

    @Value("${openai.api.key:}")
    private String apiKey;

    @Value("${openai.image.model:gpt-image-2}")
    private String model;

    private final HttpClient   http   = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    /**
     * Generates a high-fidelity static try-on image.
     *
     * @param humanBytes raw bytes of the model/person photo
     * @param humanType  MIME type of the model photo (image/jpeg or image/png)
     * @param garments   garments in stable slot order; must be non-empty
     * @return           response map with status, preview_image_url (data URI), etc.
     */
    public Map<String, Object> generateTryOn(
            byte[] humanBytes, String humanType, List<GarmentItem> garments) throws Exception {

        String boundary = "----OpenAiBoundary" + UUID.randomUUID().toString().replace("-", "");
        String prompt   = buildPrompt(garments);
        byte[] body     = buildMultipartBody(boundary, prompt, humanBytes, humanType, garments);

        log.info("Sending GPT Image try-on request — model={}, garments={}", model, garments.size());

        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(OPENAI_API + "/images/edits"))
            .header("Authorization",  "Bearer " + apiKey)
            .header("Content-Type",   "multipart/form-data; boundary=" + boundary)
            .POST(HttpRequest.BodyPublishers.ofByteArray(body))
            .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200) {
            // Log only the status code — never include response body (may contain error details).
            log.warn("OpenAI Images API request failed — HTTP {}, model={}", resp.statusCode(), model);
            throw new RuntimeException(
                "OpenAI Images API request failed (HTTP " + resp.statusCode() + ").");
        }

        Map<String, Object> result = mapper.readValue(resp.body(), new TypeReference<>() {});
        String dataUrl = extractImageDataUrl(result);
        log.info("GPT Image try-on complete — returning data URL ({} chars)", dataUrl.length());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status",            "ready");
        out.put("mode",              "gpt_image_tryon");
        out.put("preview_image_url", dataUrl);
        out.put("preview_video_url", null);
        out.put("message",           null);
        return out;
    }

    // ---------------------------------------------------------------------------
    // Prompt
    // ---------------------------------------------------------------------------

    private String buildPrompt(List<GarmentItem> garments) {
        StringBuilder sb = new StringBuilder();
        sb.append("Photorealistic virtual try-on: dress the person from the first image ");
        sb.append("in the exact garments shown in the following reference images. ");
        if (!garments.isEmpty()) {
            sb.append("Reference garments provided: ");
            for (int i = 0; i < garments.size(); i++) {
                sb.append(garments.get(i).slot());
                if (i < garments.size() - 1) sb.append(", ");
            }
            sb.append(". ");
        }
        sb.append("Preserve the person's exact face, skin tone, body shape, and identity. ");
        sb.append("Reproduce each garment's exact color, pattern, texture, cut, and fit. ");
        sb.append("Do not invent, alter, or stylize any garment or body part. ");
        sb.append("Output must look like a real fashion photograph. ");
        sb.append("No cartoon, illustration, painting, rendering, or artistic stylization.");
        return sb.toString();
    }

    // ---------------------------------------------------------------------------
    // Multipart body construction
    // ---------------------------------------------------------------------------

    private byte[] buildMultipartBody(
            String boundary, String prompt,
            byte[] humanBytes, String humanType,
            List<GarmentItem> garments) throws IOException {

        ByteArrayOutputStream out  = new ByteArrayOutputStream();
        String                crlf = "\r\n";

        writeTextField(out, boundary, "model",   model,  crlf);
        writeTextField(out, boundary, "prompt",  prompt, crlf);
        writeTextField(out, boundary, "n",       "1",    crlf);
        writeTextField(out, boundary, "size",    "1024x1024", crlf);
        writeTextField(out, boundary, "quality", "high", crlf);

        // Model photo — sent as first image so the prompt can reference "the first image"
        String humanExt = humanType != null && humanType.contains("png") ? "png" : "jpg";
        writeFileField(out, boundary, "image[]", "model." + humanExt, humanBytes, humanType, crlf);

        // Garment reference images — sent in stable slot order
        for (GarmentItem g : garments) {
            String ext = g.type() != null && g.type().contains("png") ? "png" : "jpg";
            writeFileField(out, boundary, "image[]", g.slot() + "." + ext, g.bytes(), g.type(), crlf);
        }

        out.write(("--" + boundary + "--" + crlf).getBytes(StandardCharsets.UTF_8));
        return out.toByteArray();
    }

    private void writeTextField(ByteArrayOutputStream out, String boundary,
                                String name, String value, String crlf) throws IOException {
        out.write(("--" + boundary + crlf).getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Disposition: form-data; name=\"" + name + "\"" + crlf + crlf)
            .getBytes(StandardCharsets.UTF_8));
        out.write((value + crlf).getBytes(StandardCharsets.UTF_8));
    }

    private void writeFileField(ByteArrayOutputStream out, String boundary,
                                String name, String filename,
                                byte[] data, String mimeType, String crlf) throws IOException {
        String ct = mimeType != null ? mimeType : "image/jpeg";
        out.write(("--" + boundary + crlf).getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Disposition: form-data; name=\"" + name
            + "\"; filename=\"" + filename + "\"" + crlf).getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Type: " + ct + crlf + crlf).getBytes(StandardCharsets.UTF_8));
        out.write(data);
        out.write(crlf.getBytes(StandardCharsets.UTF_8));
    }

    // ---------------------------------------------------------------------------
    // Response parsing
    // ---------------------------------------------------------------------------

    @SuppressWarnings("unchecked")
    private String extractImageDataUrl(Map<String, Object> response) {
        Object data = response.get("data");
        if (data instanceof List<?> list && !list.isEmpty()) {
            Object first = list.get(0);
            if (first instanceof Map<?, ?> map) {
                String b64 = (String) ((Map<String, Object>) map).get("b64_json");
                if (b64 != null && !b64.isBlank()) {
                    return "data:image/png;base64," + b64;
                }
                // URL fallback (response_format=url path, if ever used)
                String url = (String) ((Map<String, Object>) map).get("url");
                if (url != null && !url.isBlank()) return url;
            }
        }
        throw new RuntimeException("OpenAI Images API returned no image data in response.");
    }
}
