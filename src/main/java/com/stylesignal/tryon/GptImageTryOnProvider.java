package com.stylesignal.tryon;

import com.stylesignal.service.OpenAiImageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class GptImageTryOnProvider implements TryOnProvider {

    private static final Logger log = LoggerFactory.getLogger(GptImageTryOnProvider.class);

    static final List<String> SUPPORTED_SLOTS   = List.of("top", "outerwear", "bottom", "dress", "shoes");
    static final List<String> UNSUPPORTED_SLOTS = List.of("bag");

    private final OpenAiImageService openAi;

    public GptImageTryOnProvider(OpenAiImageService openAi) {
        this.openAi = openAi;
    }

    @Override
    public String getId() { return "gpt_image_static_tryon"; }

    @Override
    public boolean isConfigured() { return openAi.isConfigured(); }

    @Override
    public TryOnCapability getCapability() {
        return new TryOnCapability(
            "gpt_image_static_tryon",
            "GPT Image Static Try-On",
            openAi.isConfigured() ? "active" : "not_configured",
            5,
            SUPPORTED_SLOTS,
            UNSUPPORTED_SLOTS,
            "OpenAI GPT Image high-fidelity static outfit preview. "
                + "Prioritizes face/body identity preservation and garment color/silhouette accuracy. "
                + "Returns a single static image. Experimental.",
            List.of(
                "Experimental — output quality varies by image",
                "Generation time: 15–60 seconds",
                "Bag slot not supported",
                "Data URI response (~1 MB) — may be slow on low-bandwidth connections",
                "Requires OPENAI_API_KEY"
            ),
            "image",
            true,
            true
        );
    }

    @Override
    public Map<String, Object> generate(TryOnRequest req) throws Exception {
        // Collect supported garments in stable order; filter out unsupported slots.
        List<GarmentItem> garments = req.garments() != null
            ? req.garments().stream()
                .filter(g -> SUPPORTED_SLOTS.contains(g.slot()))
                .toList()
            : List.of();

        // Single-garment legacy fallback (garm_img path)
        if (garments.isEmpty() && req.garmImgBytes() != null) {
            String slot = req.slot() != null ? req.slot() : "top";
            garments = List.of(new GarmentItem(req.garmImgBytes(), req.garmImgType(), slot));
        }

        if (garments.isEmpty()) {
            return failResponse("No supported garment images provided for GPT Image generation.");
        }

        try {
            log.info("GPT Image try-on requested — {} garment(s)", garments.size());
            return openAi.generateTryOn(req.humanImgBytes(), req.humanImgType(), garments);
        } catch (Exception e) {
            log.warn("GPT Image generation failed: {}", e.getMessage());
            return failResponse("GPT Image generation failed. Please try again.");
        }
    }

    private Map<String, Object> failResponse(String message) {
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("status",            "failed");
        resp.put("mode",              "gpt_image_tryon");
        resp.put("preview_image_url", null);
        resp.put("preview_video_url", null);
        resp.put("message",           message);
        return resp;
    }
}
