package com.stylesignal.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stylesignal.tryon.BatchItem;
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

    @Value("${openai.image.quality:high}")
    private String quality;

    @Value("${openai.image.size:1024x1024}")
    private String size;

    @Value("${openai.image.output.format:jpeg}")
    private String outputFormat;

    @Value("${openai.image.output.compression:92}")
    private String outputCompression;

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
            byte[] humanBytes, String humanType, List<GarmentItem> garments,
            String outfitMode, String hairAccessoryPlacement) throws Exception {

        String boundary = "----OpenAiBoundary" + UUID.randomUUID().toString().replace("-", "");
        String prompt   = buildPrompt(garments, outfitMode, hairAccessoryPlacement);
        byte[] body     = buildMultipartBody(boundary, prompt, humanBytes, humanType, garments, true);

        log.info("Sending GPT Image try-on request — model={}, garments={}", model, garments.size());

        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(OPENAI_API + "/images/edits"))
            .header("Authorization",  "Bearer " + apiKey)
            .header("Content-Type",   "multipart/form-data; boundary=" + boundary)
            .POST(HttpRequest.BodyPublishers.ofByteArray(body))
            .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        boolean usedOptFormat = isUsingOptimizedFormat();

        if (resp.statusCode() != 200 && usedOptFormat) {
            // Retry once without output_format/output_compression — preserve all other params.
            log.warn("Optimized output format rejected (HTTP {}); retrying try-on without output_format/output_compression", resp.statusCode());
            String boundary2 = "----OpenAiBoundary" + UUID.randomUUID().toString().replace("-", "");
            byte[] body2     = buildMultipartBody(boundary2, prompt, humanBytes, humanType, garments, false);
            HttpRequest req2 = HttpRequest.newBuilder()
                .uri(URI.create(OPENAI_API + "/images/edits"))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type",  "multipart/form-data; boundary=" + boundary2)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body2))
                .build();
            resp = http.send(req2, HttpResponse.BodyHandlers.ofString());
            usedOptFormat = false; // fallback path — OpenAI will return default PNG
            if (resp.statusCode() != 200) {
                throwClassified(resp.statusCode(), resp.body(), "try-on (fallback)");
            }
            log.info("GPT Image try-on succeeded via fallback (no output_format/output_compression)");
        } else if (resp.statusCode() != 200) {
            throwClassified(resp.statusCode(), resp.body(), "try-on");
        }

        Map<String, Object> result = mapper.readValue(resp.body(), new TypeReference<>() {});
        String dataUrl = extractImageDataUrl(result, usedOptFormat);
        log.info("GPT Image try-on complete — returning data URL ({} chars)", dataUrl.length());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status",            "ready");
        out.put("mode",              "gpt_image_tryon");
        out.put("preview_image_url", dataUrl);
        out.put("preview_video_url", null);
        out.put("message",           null);
        return out;
    }

    /**
     * Generates a try-on where the user's model photo (identity) wears the complete
     * outfit visible in an inspiration/reference photo.
     *
     * @param modelBytes    raw bytes of the user's model photo (identity source)
     * @param modelType     MIME type of the model photo
     * @param outfitRefBytes raw bytes of the outfit reference photo (style source only)
     * @param outfitRefType MIME type of the outfit reference photo
     */
    public Map<String, Object> tryWholeOutfit(
            byte[] modelBytes, String modelType,
            byte[] outfitRefBytes, String outfitRefType) throws Exception {

        String boundary = "----OpenAiBoundary" + UUID.randomUUID().toString().replace("-", "");
        String prompt   = buildWholeOutfitPrompt();
        byte[] body     = buildAddItemBody(boundary, prompt,
                                           modelBytes, modelType,
                                           outfitRefBytes, outfitRefType, true);

        log.info("Sending GPT Image whole-outfit request — model={}", model);

        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(OPENAI_API + "/images/edits"))
            .header("Authorization", "Bearer " + apiKey)
            .header("Content-Type",  "multipart/form-data; boundary=" + boundary)
            .POST(HttpRequest.BodyPublishers.ofByteArray(body))
            .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        boolean usedOptFormat = isUsingOptimizedFormat();

        if (resp.statusCode() != 200 && usedOptFormat) {
            log.warn("Optimized format rejected for whole-outfit (HTTP {}); retrying without output_format", resp.statusCode());
            String boundary2 = "----OpenAiBoundary" + UUID.randomUUID().toString().replace("-", "");
            byte[] body2     = buildAddItemBody(boundary2, prompt,
                                                modelBytes, modelType,
                                                outfitRefBytes, outfitRefType, false);
            HttpRequest req2 = HttpRequest.newBuilder()
                .uri(URI.create(OPENAI_API + "/images/edits"))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type",  "multipart/form-data; boundary=" + boundary2)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body2))
                .build();
            resp = http.send(req2, HttpResponse.BodyHandlers.ofString());
            usedOptFormat = false;
            if (resp.statusCode() != 200) {
                throwClassified(resp.statusCode(), resp.body(), "whole-outfit (fallback)");
            }
            log.info("GPT Image whole-outfit succeeded via fallback");
        } else if (resp.statusCode() != 200) {
            throwClassified(resp.statusCode(), resp.body(), "whole-outfit");
        }

        Map<String, Object> result = mapper.readValue(resp.body(), new TypeReference<>() {});
        String dataUrl = extractImageDataUrl(result, usedOptFormat);
        log.info("GPT Image whole-outfit complete — {} chars", dataUrl.length());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status",            "ready");
        out.put("mode",              "gpt_image_tryon");
        out.put("preview_image_url", dataUrl);
        out.put("preview_video_url", null);
        out.put("message",           null);
        return out;
    }

    /**
     * Edits the current preview image to simulate one size larger (direction="up")
     * or one size smaller (direction="down"). Identity, pose, outfit colors/patterns,
     * and background are preserved; only the visual clothing fit is adjusted.
     */
    public Map<String, Object> fitPreview(
            byte[] previewBytes, String previewType,
            String fitAdjustment, String height, String size, String fitPreference) throws Exception {

        String boundary = "----OpenAiBoundary" + UUID.randomUUID().toString().replace("-", "");
        String prompt   = buildFitPreviewPrompt(fitAdjustment, height, size, fitPreference);
        byte[] body     = buildAddItemBody(boundary, prompt, previewBytes, previewType, null, null, true);

        log.info("GPT Image fit-preview request — fit_adjustment={}", fitAdjustment);

        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(OPENAI_API + "/images/edits"))
            .header("Authorization", "Bearer " + apiKey)
            .header("Content-Type",  "multipart/form-data; boundary=" + boundary)
            .POST(HttpRequest.BodyPublishers.ofByteArray(body))
            .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        boolean usedOptFormat = isUsingOptimizedFormat();

        if (resp.statusCode() != 200 && usedOptFormat) {
            log.warn("Optimized format rejected for fit-preview (HTTP {}); retrying without output_format", resp.statusCode());
            String boundary2 = "----OpenAiBoundary" + UUID.randomUUID().toString().replace("-", "");
            byte[] body2     = buildAddItemBody(boundary2, prompt, previewBytes, previewType, null, null, false);
            HttpRequest req2 = HttpRequest.newBuilder()
                .uri(URI.create(OPENAI_API + "/images/edits"))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type",  "multipart/form-data; boundary=" + boundary2)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body2))
                .build();
            resp = http.send(req2, HttpResponse.BodyHandlers.ofString());
            usedOptFormat = false;
            if (resp.statusCode() != 200) {
                throwClassified(resp.statusCode(), resp.body(), "fit-preview (fallback)");
            }
            log.info("GPT Image fit-preview succeeded via fallback");
        } else if (resp.statusCode() != 200) {
            throwClassified(resp.statusCode(), resp.body(), "fit-preview");
        }

        Map<String, Object> result = mapper.readValue(resp.body(), new TypeReference<>() {});
        String dataUrl = extractImageDataUrl(result, usedOptFormat);
        log.info("GPT Image fit-preview complete — fit_adjustment={}", fitAdjustment);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status",            "ready");
        out.put("preview_image_url", dataUrl);
        return out;
    }

    private String buildFitPreviewPrompt(String fitAdjustment, String height, String size, String fitPreference) {
        boolean sizeUp = "size_up".equalsIgnoreCase(fitAdjustment);
        StringBuilder sb = new StringBuilder();
        sb.append("Photorealistic virtual fit simulation: ");
        sb.append("Keep the same person, face, skin tone, hair, body shape, pose, and identity exactly. ");
        sb.append("Keep the same outfit items, colours, patterns, textures, and background exactly. ");
        if (sizeUp) {
            sb.append("Adjust ONLY the visual fit of the clothing to appear one size larger: ");
            sb.append("the garments should look slightly looser and more relaxed, with a little extra fabric — ");
            sb.append("subtle visual cues like slightly wider shoulders, looser through the torso, and less tension in the fabric. ");
        } else {
            sb.append("Adjust ONLY the visual fit of the clothing to appear one size smaller: ");
            sb.append("the garments should look slightly more fitted and closer to the body — ");
            sb.append("subtle visual cues like a slightly narrower torso line and fabric following the body more closely. ");
        }
        sb.append("Do not change outfit colours, patterns, fabric type, garment type, style, or background. ");
        sb.append("Do not redesign, add, or remove any garment or accessory. ");
        sb.append("Do not change the person's face, skin tone, hair, or identity. ");
        sb.append("This is an approximate visual simulation for styling purposes only — not a sizing recommendation. ");
        sb.append("Output must look like a real fashion photograph. ");
        sb.append("No cartoon, illustration, painting, rendering, or artistic stylization.");
        if (height != null && !height.isBlank()) {
            sb.append(" Person height for proportion context only: ").append(height.replaceAll("[^\\w'\".,/ ]", "")).append(".");
        }
        if (size != null && !size.isBlank()) {
            sb.append(" Current usual size: ").append(size.replaceAll("[^\\w ]", "")).append(".");
        }
        if (fitPreference != null && !fitPreference.isBlank() && !"not_sure".equalsIgnoreCase(fitPreference)) {
            sb.append(" Usual fit preference: ").append(fitPreference.replaceAll("[^\\w]", "")).append(".");
        }
        return sb.toString();
    }

    private String buildWholeOutfitPrompt() {
        return "Photorealistic virtual try-on: "
            + "The FIRST IMAGE is the PERSON — preserve their face, skin tone, body shape, hair, and identity exactly. "
            + "The SECOND IMAGE is the OUTFIT REFERENCE ONLY — do not use the face, body type, hair, or identity of any person shown in it. "
            + "Dress the person from the first image in the complete outfit shown in the second image. "
            + "Reproduce every visible garment and accessory from the reference: "
            + "clothing (top, jacket, trousers, skirt, dress), shoes, bags, and accessories (glasses, jewellery, scarf, hat, belt, etc.). "
            + "Match each item's exact colour, pattern, texture, cut, and fit as shown in the reference. "
            + "Preserve the first person's face, skin tone, body shape, hair, and identity exactly — do not alter them. "
            + "Do not copy or reference the face, hairstyle, skin tone, or body proportions from the second image. "
            + "The output person must be identifiable as the person from the first image wearing the outfit from the second image. "
            + "Maintain a natural, photorealistic pose and lighting consistent with a fashion photograph. "
            + "Output must look like a real fashion photograph. "
            + "No cartoon, illustration, painting, rendering, or artistic stylization.";
    }

    /**
     * Edits an existing preview image to add a single described item (for Complete the Look).
     * If referenceBytes is provided (SVG thumbnail rendered to PNG), it is sent as a second
     * image so the model can see the item's colour and shape, not just a text description.
     */
    public Map<String, Object> addItemToPreview(
            byte[] previewBytes, String previewType,
            byte[] referenceBytes, String referenceType,
            String slot, String itemDescription) throws Exception {

        String boundary = "----OpenAiBoundary" + UUID.randomUUID().toString().replace("-", "");
        String slotLabel = slot != null ? slot.replace('_', ' ') : "accessory";
        boolean hasRef = referenceBytes != null && referenceBytes.length > 0;

        String prompt = (hasRef
            ? "The first image is the current outfit preview. "
              + "The second image shows the colour and shape of the " + slotLabel + " to add. "
            : "The image is the current outfit preview. ")
            + "Add a " + itemDescription + " (" + slotLabel + ") to the person. "
            + "Match the colour and style of the item to the description: " + itemDescription + ". "
            + "Preserve the person's exact face, skin tone, body shape, pose, and all existing outfit items. "
            + "Preserve the background exactly. "
            + "Only add the requested " + slotLabel + " — do not change or remove anything else. "
            + "Place the item anatomically according to its type: "
            + "glasses: on the face at the eyes; "
            + "earrings: on the earlobes; "
            + "bag: held or worn on shoulder or arm; "
            + "hair accessory: in or on the hair; "
            + "scarf: draped naturally around the neck, shoulders, hair, or bag handle — do not turn it into a shirt or coat; "
            + "necklace: around the neck — do not change the face, neckline, or clothing; "
            + "bracelet: on the wrist — do not change the arm, hand, or pose; "
            + "watch: on the wrist — do not change the arm, hand, or pose; "
            + "belt: around the waist or over the garment — do not redesign the clothing; "
            + "hat: on the head — do not change the face or hairstyle except where the hat covers it; "
            + "tights: on the legs only — do not change the dress, skirt, shoes, or rest of the outfit; "
            + "socks: visible around the ankles or calves — do not change the shoes unless necessary for visibility; "
            + "outerwear and shoes: worn as intended. "
            + "Output must look like a real fashion photograph. No cartoon or artistic stylization.";

        byte[] body = buildAddItemBody(boundary, prompt, previewBytes, previewType,
                                       referenceBytes, referenceType, true);

        log.info("GPT Image add-item request — slot={}, hasReference={}", slot, hasRef);
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(OPENAI_API + "/images/edits"))
            .header("Authorization", "Bearer " + apiKey)
            .header("Content-Type",  "multipart/form-data; boundary=" + boundary)
            .POST(HttpRequest.BodyPublishers.ofByteArray(body))
            .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        boolean usedOptFormat = isUsingOptimizedFormat();

        if (resp.statusCode() != 200 && usedOptFormat) {
            // Retry once without output_format/output_compression — preserve all other params.
            log.warn("Optimized output format rejected (HTTP {}); retrying add-item without output_format/output_compression", resp.statusCode());
            String boundary2 = "----OpenAiBoundary" + UUID.randomUUID().toString().replace("-", "");
            byte[] body2     = buildAddItemBody(boundary2, prompt, previewBytes, previewType,
                                               referenceBytes, referenceType, false);
            HttpRequest req2 = HttpRequest.newBuilder()
                .uri(URI.create(OPENAI_API + "/images/edits"))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type",  "multipart/form-data; boundary=" + boundary2)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body2))
                .build();
            resp = http.send(req2, HttpResponse.BodyHandlers.ofString());
            usedOptFormat = false; // fallback path — OpenAI will return default PNG
            if (resp.statusCode() != 200) {
                throwClassified(resp.statusCode(), resp.body(), "add-item (fallback)");
            }
            log.info("GPT Image add-item succeeded via fallback (no output_format/output_compression)");
        } else if (resp.statusCode() != 200) {
            throwClassified(resp.statusCode(), resp.body(), "add-item");
        }

        Map<String, Object> result  = mapper.readValue(resp.body(), new TypeReference<>() {});
        String              dataUrl = extractImageDataUrl(result, usedOptFormat);
        log.info("GPT Image add-item complete");

        Map<String, Object> out2 = new LinkedHashMap<>();
        out2.put("status",            "ready");
        out2.put("preview_image_url", dataUrl);
        return out2;
    }

    /**
     * Applies multiple styling suggestions to a preview image in a single GPT Image edit.
     * The preview is the first image[]; each item's reference PNG follows in slot order.
     * Strong guardrails preserve the person, existing outfit, pose, and background.
     */
    public Map<String, Object> addItemsBatchToPreview(
            byte[] previewBytes, String previewType,
            List<BatchItem> items) throws Exception {

        String boundary = "----OpenAiBoundary" + UUID.randomUUID().toString().replace("-", "");
        String prompt   = buildBatchAddPrompt(items);
        byte[] body     = buildBatchAddItemBody(boundary, prompt, previewBytes, previewType, items, true);

        log.info("GPT Image batch add-items request — items={}", items.size());

        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(OPENAI_API + "/images/edits"))
            .header("Authorization", "Bearer " + apiKey)
            .header("Content-Type",  "multipart/form-data; boundary=" + boundary)
            .POST(HttpRequest.BodyPublishers.ofByteArray(body))
            .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        boolean usedOptFormat = isUsingOptimizedFormat();

        if (resp.statusCode() != 200 && usedOptFormat) {
            log.warn("Optimized format rejected (HTTP {}); retrying batch add-items without output_format/output_compression", resp.statusCode());
            String boundary2 = "----OpenAiBoundary" + UUID.randomUUID().toString().replace("-", "");
            byte[] body2     = buildBatchAddItemBody(boundary2, prompt, previewBytes, previewType, items, false);
            HttpRequest req2 = HttpRequest.newBuilder()
                .uri(URI.create(OPENAI_API + "/images/edits"))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type",  "multipart/form-data; boundary=" + boundary2)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body2))
                .build();
            resp = http.send(req2, HttpResponse.BodyHandlers.ofString());
            usedOptFormat = false;
            if (resp.statusCode() != 200) {
                throwClassified(resp.statusCode(), resp.body(), "batch-add-items (fallback)");
            }
            log.info("GPT Image batch add-items succeeded via fallback (no output_format/output_compression)");
        } else if (resp.statusCode() != 200) {
            throwClassified(resp.statusCode(), resp.body(), "batch-add-items");
        }

        Map<String, Object> result = mapper.readValue(resp.body(), new TypeReference<>() {});
        String dataUrl = extractImageDataUrl(result, usedOptFormat);
        log.info("GPT Image batch add-items complete — {} items", items.size());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status",            "ready");
        out.put("preview_image_url", dataUrl);
        return out;
    }

    private String buildBatchAddPrompt(List<BatchItem> items) {
        StringBuilder sb = new StringBuilder();
        sb.append("The first image is the current outfit preview. ");

        int refIdx = 2;
        for (BatchItem item : items) {
            if (item.bytes() != null && item.bytes().length > 0) {
                sb.append("Reference image ").append(refIdx++).append(" shows the ")
                  .append(item.slot().replace('_', ' ')).append(" to add. ");
            }
        }

        sb.append("Add ALL of the following items to the person: ");
        for (int i = 0; i < items.size(); i++) {
            if (i > 0) sb.append("; ");
            sb.append(items.get(i).description())
              .append(" (").append(items.get(i).slot().replace('_', ' ')).append(")");
        }
        sb.append(". ");

        sb.append("STRICT GUARDRAILS — keep the same person, face, body shape, skin tone, pose, ");
        sb.append("existing outfit items, lighting, and background exactly as in the first image. ");
        sb.append("Do not redesign, remove, or alter any existing clothing or background. ");
        sb.append("Only add the items listed above — nothing else. ");
        sb.append("Place each item anatomically according to its type: ");
        sb.append("glasses: on the face at the eyes; ");
        sb.append("earrings: on the earlobes; ");
        sb.append("bag: held or worn on shoulder or arm; ");
        sb.append("hair accessory: in or on the hair; ");
        sb.append("scarf: draped naturally around the neck, shoulders, hair, or bag handle — do not turn it into a shirt or coat; ");
        sb.append("necklace: around the neck — do not change the face, neckline, or clothing; ");
        sb.append("bracelet: on the wrist — do not change the arm, hand, or pose; ");
        sb.append("watch: on the wrist — do not change the arm, hand, or pose; ");
        sb.append("belt: around the waist or over the garment — do not redesign the clothing; ");
        sb.append("hat: on the head — do not change the face or hairstyle except where the hat covers it; ");
        sb.append("tights: on the legs only — do not change the dress, skirt, shoes, or rest of the outfit; ");
        sb.append("socks: visible around the ankles or calves — do not change the shoes unless necessary for visibility; ");
        sb.append("outerwear and shoes: worn as intended. ");
        sb.append("Match each item's colour and style to its description and reference image exactly. ");
        sb.append("Do not confuse accessory types — do not turn earrings into glasses or vice versa. ");
        sb.append("Do not invent extra items not listed. ");
        sb.append("Output must look like a real fashion photograph. ");
        sb.append("No cartoon, illustration, painting, rendering, or artistic stylization.");
        return sb.toString();
    }

    private byte[] buildBatchAddItemBody(
            String boundary, String prompt,
            byte[] previewBytes, String previewType,
            List<BatchItem> items,
            boolean includeOptFormat) throws IOException {

        ByteArrayOutputStream out  = new ByteArrayOutputStream();
        String                crlf = "\r\n";
        writeTextField(out, boundary, "model",   model,   crlf);
        writeTextField(out, boundary, "prompt",  prompt,  crlf);
        writeTextField(out, boundary, "n",       "1",     crlf);
        writeTextField(out, boundary, "size",    size,    crlf);
        writeTextField(out, boundary, "quality", quality, crlf);
        if (includeOptFormat) writeOutputFormatFields(out, boundary, crlf);

        // First: the current preview
        String previewExt = previewType != null && previewType.contains("png") ? "png" : "jpg";
        writeFileField(out, boundary, "image[]", "preview." + previewExt, previewBytes, previewType, crlf);

        // Then: reference images for each item (skipped when bytes are absent)
        for (BatchItem item : items) {
            if (item.bytes() != null && item.bytes().length > 0) {
                String refExt = item.type() != null && item.type().contains("png") ? "png" : "jpg";
                writeFileField(out, boundary, "image[]",
                               item.slot() + "_ref." + refExt,
                               item.bytes(), item.type(), crlf);
            }
        }

        out.write(("--" + boundary + "--" + crlf).getBytes(StandardCharsets.UTF_8));
        return out.toByteArray();
    }

    // ---------------------------------------------------------------------------
    // Prompt
    // ---------------------------------------------------------------------------

    private String buildPrompt(List<GarmentItem> garments, String outfitMode, String hairAccessoryPlacement) {
        StringBuilder sb = new StringBuilder();

        // Task opening
        sb.append("Photorealistic virtual try-on. The first image shows the model/person. ");

        // Explicit numbered assignment list
        sb.append("Assigned items — reference images in order: ");
        for (int i = 0; i < garments.size(); i++) {
            String role = garments.get(i).slot().replace('_', ' ');
            sb.append((i + 1)).append(") image ").append(i + 2).append(" = ").append(role).append("; ");
        }

        // Mandatory multi-garment rule
        sb.append("Apply EVERY assigned item. Do not omit, ignore, or replace any item from the list. ");
        if (garments.size() > 1) {
            sb.append("Compose all assigned items together into one coherent outfit on the same person. ");
        }

        // Role-specific mandatory rules for common combinations
        boolean hasDress  = garments.stream().anyMatch(g -> "dress".equals(g.slot()));
        boolean hasTop    = garments.stream().anyMatch(g -> "top".equals(g.slot()));
        boolean hasBottom = garments.stream().anyMatch(g -> "bottom".equals(g.slot()));
        boolean hasShoes  = garments.stream().anyMatch(g -> "shoes".equals(g.slot()));

        if (hasDress) {
            sb.append("MANDATORY: the dress/skirt from the reference image is the primary clothing garment — it must appear in the output. ");
            sb.append("Do not drop, omit, or replace the dress/skirt with anything else. ");
        }
        if (hasTop && hasBottom) {
            sb.append("MANDATORY: both the top and bottom from the reference images must appear together as the outfit. ");
        }
        if (hasShoes && (hasDress || hasTop || hasBottom)) {
            sb.append("MANDATORY: the shoes must appear on the feet as footwear. ");
            sb.append("Do not replace the main outfit garment with the shoes — both must be present. ");
        }

        // Dress mode stability guardrails
        if ("dress".equalsIgnoreCase(outfitMode)) {
            sb.append("Main outfit mode: Dress look. ");
            sb.append("The dress is the main garment and must be worn as the primary clothing item. ");
            sb.append("Do not replace the dress with a top and bottom outfit. ");
            sb.append("Do not omit the dress. ");
            sb.append("Preserve the dress color, silhouette, neckline, length, fabric, and visible details as much as possible. ");
        }

        sb.append("Preserve the person's exact face, skin tone, body shape, and identity. ");
        sb.append("Reproduce each garment's exact color, pattern, texture, cut, and fit. ");
        sb.append("For glasses: place them on the person's face at the eyes. ");
        sb.append("For earrings: place them on the earlobes. ");
        sb.append("For bag: show the person holding or wearing it as intended. ");
        sb.append("For scarf: drape it around the neck or shoulders as shown in the reference. ");
        sb.append("For necklace: place it around the neck, visible on the chest. ");
        sb.append("For bracelet: place it on the wrist of one hand. ");
        sb.append("For belt: place it around the waist, over the clothing as shown. ");
        sb.append("For hat: place it on top of the head as shown in the reference. ");
        sb.append("For watch: place it on the wrist, visible below the sleeve. ");
        sb.append("For tights: show them on the legs, under any skirt or dress. ");
        sb.append("For socks: show them on the feet/ankles, above the shoes. ");

        // Hair accessory placement
        if (hairAccessoryPlacement != null && !hairAccessoryPlacement.isBlank()
                && !"auto".equalsIgnoreCase(hairAccessoryPlacement)) {
            String placementText = hairAccessoryPlacement.replace('_', ' ');
            sb.append("Hair accessory placement: ").append(placementText).append(" of the hair. ");
        } else {
            sb.append("For hair accessory: place it in or on the hair appropriately, based on the reference image. ");
        }

        sb.append("Do not confuse accessory types — do not turn earrings into glasses or vice versa. ");
        sb.append("Do not turn bags into clothing. ");
        sb.append("Do not invent extra accessories not provided. ");
        sb.append("Do not invent, alter, or stylize any garment or accessory or body part. ");
        sb.append("Output must look like a real fashion photograph. ");
        sb.append("No cartoon, illustration, painting, rendering, or artistic stylization.");
        return sb.toString();
    }

    // ---------------------------------------------------------------------------
    // Multipart body construction
    // ---------------------------------------------------------------------------

    private boolean isUsingOptimizedFormat() {
        return outputFormat != null && !outputFormat.isBlank()
            && !"png".equalsIgnoreCase(outputFormat.trim());
    }

    private byte[] buildAddItemBody(
            String boundary, String prompt,
            byte[] previewBytes, String previewType,
            byte[] referenceBytes, String referenceType,
            boolean includeOptFormat) throws IOException {

        ByteArrayOutputStream out  = new ByteArrayOutputStream();
        String                crlf = "\r\n";
        writeTextField(out, boundary, "model",   model,   crlf);
        writeTextField(out, boundary, "prompt",  prompt,  crlf);
        writeTextField(out, boundary, "n",       "1",     crlf);
        writeTextField(out, boundary, "size",    size,    crlf);
        writeTextField(out, boundary, "quality", quality, crlf);
        if (includeOptFormat) writeOutputFormatFields(out, boundary, crlf);
        String ext = previewType != null && previewType.contains("png") ? "png" : "jpg";
        writeFileField(out, boundary, "image[]", "preview." + ext, previewBytes, previewType, crlf);
        if (referenceBytes != null && referenceBytes.length > 0) {
            String refExt = referenceType != null && referenceType.contains("png") ? "png" : "jpg";
            writeFileField(out, boundary, "image[]", "reference." + refExt,
                           referenceBytes, referenceType, crlf);
        }
        out.write(("--" + boundary + "--" + crlf).getBytes(StandardCharsets.UTF_8));
        return out.toByteArray();
    }

    private byte[] buildMultipartBody(
            String boundary, String prompt,
            byte[] humanBytes, String humanType,
            List<GarmentItem> garments,
            boolean includeOptFormat) throws IOException {

        ByteArrayOutputStream out  = new ByteArrayOutputStream();
        String                crlf = "\r\n";

        writeTextField(out, boundary, "model",   model,   crlf);
        writeTextField(out, boundary, "prompt",  prompt,  crlf);
        writeTextField(out, boundary, "n",       "1",     crlf);
        writeTextField(out, boundary, "size",    size,    crlf);
        writeTextField(out, boundary, "quality", quality, crlf);
        if (includeOptFormat) writeOutputFormatFields(out, boundary, crlf);

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

    /**
     * Appends output_format and output_compression fields when the configured format
     * is not the API default (png). Safe to omit for png — the API default is already png.
     * If the API rejects these fields for an unsupported model, the existing HTTP error
     * handling in the callers will surface the failure cleanly.
     */
    private void writeOutputFormatFields(ByteArrayOutputStream out, String boundary,
                                         String crlf) throws IOException {
        String fmt = (outputFormat != null && !outputFormat.isBlank()) ? outputFormat.toLowerCase() : "png";
        if (!"png".equals(fmt)) {
            writeTextField(out, boundary, "output_format", fmt, crlf);
            // output_compression only applies to jpeg and webp
            if (("jpeg".equals(fmt) || "webp".equals(fmt))
                    && outputCompression != null && !outputCompression.isBlank()) {
                writeTextField(out, boundary, "output_compression", outputCompression, crlf);
            }
        }
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
    // Error classification
    // ---------------------------------------------------------------------------

    private String classifyOpenAiError(int status, String body) {
        String lower = body == null ? "" : body.toLowerCase();
        if (lower.contains("insufficient_funds") || lower.contains("insufficient_credits")
                || lower.contains("billing") || lower.contains("credits") || lower.contains("balance")
                || lower.contains("quota") || lower.contains("insufficient_quota")) {
            return "billing_or_credits";
        }
        if (status == 429 || lower.contains("rate_limit") || lower.contains("rate limit")) {
            return "rate_limited";
        }
        if (status == 500 || status == 502 || status == 503) {
            return "provider_unavailable";
        }
        if (status == 400) {
            return "bad_request";
        }
        return "unknown_provider_error";
    }

    private String safeMessageForCategory(String category) {
        return switch (category) {
            case "billing_or_credits"   -> "OpenAI credits or billing may be unavailable. Please check your API billing and try again.";
            case "rate_limited"         -> "OpenAI is rate limiting requests right now. Please wait a moment and try again.";
            case "provider_unavailable" -> "OpenAI Images API is temporarily unavailable. Please try again in a moment.";
            default                     -> "Could not generate this preview. Please try again.";
        };
    }

    private void throwClassified(int status, String body, String context) {
        String category = classifyOpenAiError(status, body);
        log.warn("OpenAI Images API {} failed — HTTP {}, category={}", context, status, category);
        throw new OpenAiProviderException(safeMessageForCategory(category), category);
    }

    // ---------------------------------------------------------------------------
    // Generation Plan (Issue 26)
    // ---------------------------------------------------------------------------

    public Map<String, Object> generatePlanLook(
            byte[] previewBytes, String previewType,
            List<Map<String, String>> planItems,
            String fitShift, String scene) throws Exception {

        byte[] normalizedPreview = normalizeImageSize(previewBytes, previewType);
        String prompt   = buildPlanPrompt(planItems, fitShift, scene);
        String boundary = "----OpenAiBoundary" + UUID.randomUUID().toString().replace("-", "");
        byte[] body     = buildAddItemBody(boundary, prompt, normalizedPreview, previewType, null, null, true);

        log.info("Sending GPT Image plan-look request — items={}, fit_shift={}, scene={}",
                 planItems == null ? 0 : planItems.size(), fitShift, scene);

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(OPENAI_API + "/images/edits"))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type",  "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        boolean usedOptFormat = isUsingOptimizedFormat();

        if (resp.statusCode() != 200 && usedOptFormat) {
            String boundary2 = "----OpenAiBoundary" + UUID.randomUUID().toString().replace("-", "");
            byte[] body2     = buildAddItemBody(boundary2, prompt, normalizedPreview, previewType, null, null, false);
            HttpRequest req2 = HttpRequest.newBuilder()
                    .uri(URI.create(OPENAI_API + "/images/edits"))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type",  "multipart/form-data; boundary=" + boundary2)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body2))
                    .build();
            resp = http.send(req2, HttpResponse.BodyHandlers.ofString());
            usedOptFormat = false;
            if (resp.statusCode() != 200) throwClassified(resp.statusCode(), resp.body(), "plan-look (fallback)");
            log.info("GPT Image plan-look succeeded via fallback");
        } else if (resp.statusCode() != 200) {
            throwClassified(resp.statusCode(), resp.body(), "plan-look");
        }

        Map<String, Object> result = mapper.readValue(resp.body(), new TypeReference<>() {});
        String dataUrl = extractImageDataUrl(result, usedOptFormat);
        log.info("GPT Image plan-look complete");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status",            "ready");
        out.put("preview_image_url", dataUrl);
        return out;
    }

    public Map<String, Object> sceneVersion(
            byte[] imageBytes, String imageType, String scene) throws Exception {

        String boundary = "----OpenAiBoundary" + UUID.randomUUID().toString().replace("-", "");
        String prompt   = buildSceneVersionPrompt(scene);
        byte[] body     = buildAddItemBody(boundary, prompt, imageBytes, imageType, null, null, true);

        log.info("GPT Image scene-version request — scene={}", scene);

        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(OPENAI_API + "/images/edits"))
            .header("Authorization", "Bearer " + apiKey)
            .header("Content-Type",  "multipart/form-data; boundary=" + boundary)
            .POST(HttpRequest.BodyPublishers.ofByteArray(body))
            .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        boolean usedOptFormat = isUsingOptimizedFormat();

        if (resp.statusCode() != 200 && usedOptFormat) {
            log.warn("Optimized format rejected for scene-version (HTTP {}); retrying without output_format",
                     resp.statusCode());
            String boundary2 = "----OpenAiBoundary" + UUID.randomUUID().toString().replace("-", "");
            byte[] body2     = buildAddItemBody(boundary2, prompt, imageBytes, imageType, null, null, false);
            HttpRequest req2 = HttpRequest.newBuilder()
                .uri(URI.create(OPENAI_API + "/images/edits"))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type",  "multipart/form-data; boundary=" + boundary2)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body2))
                .build();
            resp = http.send(req2, HttpResponse.BodyHandlers.ofString());
            usedOptFormat = false;
            if (resp.statusCode() != 200) {
                throwClassified(resp.statusCode(), resp.body(), "scene-version (fallback)");
            }
            log.info("GPT Image scene-version succeeded via fallback");
        } else if (resp.statusCode() != 200) {
            throwClassified(resp.statusCode(), resp.body(), "scene-version");
        }

        Map<String, Object> result = mapper.readValue(resp.body(), new TypeReference<>() {});
        String dataUrl = extractImageDataUrl(result, usedOptFormat);
        log.info("GPT Image scene-version complete — scene={}", scene);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status",  "success");
        out.put("imageUrl", dataUrl);
        out.put("message",  "Scene version generated.");
        return out;
    }

    private String buildSceneVersionPrompt(String scene) {
        StringBuilder sb = new StringBuilder();
        sb.append("Photorealistic fashion photography. ");
        sb.append("Keep the outfit and person exactly the same: same garments, garment colors, patterns, ");
        sb.append("fabric textures, fit, face, skin tone, hair, body shape, and pose. ");
        sb.append("Do not replace, redesign, or alter any clothing items. ");
        sb.append("Only change the background, lighting, and atmosphere to match this scene: ");
        String lower = (scene == null ? "" : scene.toLowerCase().trim());
        switch (lower) {
            case "street_night"      -> sb.append(
                "Evening city street: urban ambient lighting, neon sign reflections on wet pavement, nocturnal city mood.");
            case "daylight"          -> sb.append(
                "Bright natural daylight outdoors, clean sunlit shadows, open sky or park background, fresh and clear.");
            case "warm_indoor"       -> sb.append(
                "Cozy warm indoor scene with soft golden-hour-style ambient glow, comfortable home or lounge atmosphere.");
            case "cafe"              -> sb.append(
                "Warm cafe interior: soft warm lighting, wooden tones, coffee shop ambiance in the background.");
            case "office"            -> sb.append(
                "Polished professional office: clean neutral lighting, modern corporate interior background.");
            case "date_night"        -> sb.append(
                "Romantic evening: soft candlelight or dim restaurant lighting, elegant dark background.");
            case "studio_editorial"  -> sb.append(
                "Fashion editorial studio: seamless light grey backdrop, professional studio strobe lighting, high-fashion look.");
            case "soft_natural"      -> sb.append(
                "Soft diffused natural window light, airy minimal indoor background, bright clean atmosphere.");
            default                  -> sb.append(
                scene == null ? "original setting" : scene.replace('_', ' '));
        }
        sb.append(" Maintain full photorealism. The output must look like a professional fashion photograph.");
        return sb.toString();
    }

    private String buildPlanPrompt(List<Map<String, String>> planItems, String fitShift, String scene) {
        StringBuilder sb = new StringBuilder();
        sb.append("High-quality virtual styling update: ");
        sb.append("Keep the same person, face, skin tone, hair, body shape, pose, and identity exactly. ");
        sb.append("Keep the background and environment exactly. ");

        if (planItems != null && !planItems.isEmpty()) {
            sb.append("Add the following accessories and styling items to the outfit — ");
            sb.append("preserve all existing clothing and colours exactly: ");
            for (int i = 0; i < planItems.size(); i++) {
                Map<String, String> item = planItems.get(i);
                String slot = item.getOrDefault("slot", "");
                String name = item.getOrDefault("name", "");
                if (!name.isBlank()) {
                    sb.append(name);
                    if (!slot.isBlank()) sb.append(" (").append(slot.replace("_", " ")).append(")");
                    if (i < planItems.size() - 1) sb.append(", ");
                }
            }
            sb.append(". ");
        }

        if ("size_up".equalsIgnoreCase(fitShift)) {
            sb.append("Show the outfit fitting one size looser. Keep all other details identical. ");
        } else if ("size_down".equalsIgnoreCase(fitShift)) {
            sb.append("Show the outfit fitting one size more fitted. Keep all other details identical. ");
        }

        switch (scene == null ? "original" : scene.toLowerCase()) {
            case "daytime"      -> sb.append("Change the lighting to bright natural daylight. Keep person and outfit unchanged. ");
            case "night"        -> sb.append("Change the scene to nighttime with warm ambient city lighting. Keep person and outfit unchanged. ");
            case "sunset"       -> sb.append("Change the lighting to warm golden sunset light. Keep person and outfit unchanged. ");
            case "indoor_warm"  -> sb.append("Change the lighting to warm indoor ambient light. Keep person and outfit unchanged. ");
            case "street_flash" -> sb.append("Change the lighting to a street photography flash effect. Keep person and outfit unchanged. ");
        }

        sb.append("Do not change face, hair, or identity under any circumstance. ");
        sb.append("Maintain photorealistic quality.");
        return sb.toString();
    }

    private byte[] normalizeImageSize(byte[] imageBytes, String mimeType) {
        if (imageBytes == null || imageBytes.length == 0) return imageBytes;
        final int MAX_DIM = 1024;
        try {
            java.io.ByteArrayInputStream bais = new java.io.ByteArrayInputStream(imageBytes);
            java.awt.image.BufferedImage img  = javax.imageio.ImageIO.read(bais);
            if (img == null) return imageBytes;
            int w = img.getWidth(), h = img.getHeight();
            if (w <= MAX_DIM && h <= MAX_DIM) return imageBytes;
            double scale = (double) MAX_DIM / Math.max(w, h);
            int nw = (int)(w * scale), nh = (int)(h * scale);
            java.awt.image.BufferedImage scaled = new java.awt.image.BufferedImage(
                    nw, nh, java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g2d = scaled.createGraphics();
            g2d.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION,
                                 java.awt.RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g2d.drawImage(img, 0, 0, nw, nh, null);
            g2d.dispose();
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            String fmt = (mimeType != null && mimeType.contains("png")) ? "png" : "jpeg";
            javax.imageio.ImageIO.write(scaled, fmt, baos);
            log.info("Normalized image from {}x{} to {}x{}", w, h, nw, nh);
            return baos.toByteArray();
        } catch (Exception e) {
            log.warn("Image normalization failed; using original bytes");
            return imageBytes;
        }
    }

    // ---------------------------------------------------------------------------
    // Response parsing
    // ---------------------------------------------------------------------------

    /**
     * Extracts the base64 image from the API response and returns a data URI.
     * useConfiguredFormat=true  → optimized request succeeded; use the configured output format MIME.
     * useConfiguredFormat=false → fallback request (no format fields); OpenAI returns PNG by default.
     */
    @SuppressWarnings("unchecked")
    private String extractImageDataUrl(Map<String, Object> response, boolean useConfiguredFormat) {
        Object data = response.get("data");
        if (data instanceof List<?> list && !list.isEmpty()) {
            Object first = list.get(0);
            if (first instanceof Map<?, ?> map) {
                String b64 = (String) ((Map<String, Object>) map).get("b64_json");
                if (b64 != null && !b64.isBlank()) {
                    String mime;
                    if (useConfiguredFormat) {
                        String fmt = (outputFormat != null && !outputFormat.isBlank())
                            ? outputFormat.toLowerCase() : "png";
                        mime = "jpeg".equals(fmt) ? "image/jpeg"
                             : "webp".equals(fmt) ? "image/webp"
                             : "image/png";
                    } else {
                        mime = "image/png"; // fallback path — no format fields → OpenAI default is PNG
                    }
                    return "data:" + mime + ";base64," + b64;
                }
                // URL fallback (response_format=url path, if ever used)
                String url = (String) ((Map<String, Object>) map).get("url");
                if (url != null && !url.isBlank()) return url;
            }
        }
        throw new RuntimeException("OpenAI Images API returned no image data in response.");
    }
}
