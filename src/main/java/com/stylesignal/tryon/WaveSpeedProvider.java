package com.stylesignal.tryon;

import com.stylesignal.service.WaveSpeedService;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class WaveSpeedProvider implements TryOnProvider {

    // Stable slot order for clothes_images[]: top, outerwear, bottom, dress, shoes.
    // Bag is excluded — WaveSpeedService does not support it.
    static final List<String> SLOT_ORDER = List.of("top", "outerwear", "bottom", "dress", "shoes");

    private final WaveSpeedService wavespeed;

    public WaveSpeedProvider(WaveSpeedService wavespeed) {
        this.wavespeed = wavespeed;
    }

    @Override
    public String getId() { return "wavespeed_ai_virtual_outfit_tryon"; }

    @Override
    public boolean isConfigured() { return wavespeed.isConfigured(); }

    @Override
    public TryOnCapability getCapability() {
        return new TryOnCapability(
            "wavespeed_ai_virtual_outfit_tryon",
            "WaveSpeed Full Outfit Try-On",
            wavespeed.isConfigured() ? "active" : "not_configured",
            8,
            List.of("top", "outerwear", "bottom", "dress", "shoes"),
            List.of("bag"),
            "WaveSpeed AI multi-garment full-outfit try-on. Recommended for full outfit generation. "
                + "AI-generated preview — may adjust pose or background. Generation takes 1–5 minutes.",
            List.of(
                "Slow generation: typically 1–5 minutes per request",
                "May change background or pose",
                "Face identity may drift with dark or blurry input photos",
                "Garment list is not strict slot control — results are AI-synthesised",
                "Requires provider-accessible image URLs (not supported for local-only deployments)",
                "Bag slot not supported"
            )
        );
    }

    @Override
    public Map<String, Object> generate(TryOnRequest req) throws Exception {
        // WaveSpeed requires publicly accessible image URLs.
        // In the current local-dev setup the model photo and garment images are
        // served from localhost, which WaveSpeed's cloud infrastructure cannot reach.
        // Return a clear limitation message rather than attempting a doomed request.
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("status",            "failed");
        resp.put("mode",              "wavespeed_outfit");
        resp.put("preview_image_url", null);
        resp.put("preview_video_url", null);
        resp.put("message",
            "WaveSpeed requires provider-accessible image URLs. "
            + "Local uploads need a public upload/hosting step before this provider "
            + "can run inside the local app.");
        return resp;
    }
}
