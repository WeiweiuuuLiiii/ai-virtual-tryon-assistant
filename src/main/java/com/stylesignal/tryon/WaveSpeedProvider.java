package com.stylesignal.tryon;

import com.stylesignal.service.CloudinaryUploadService;
import com.stylesignal.service.WaveSpeedService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class WaveSpeedProvider implements TryOnProvider {

    private static final Logger log = LoggerFactory.getLogger(WaveSpeedProvider.class);

    // Stable slot order for clothes_images[]: top, outerwear, bottom, dress, shoes.
    // Bag is excluded — WaveSpeed does not support it.
    static final List<String> SLOT_ORDER = List.of("top", "outerwear", "bottom", "dress", "shoes");

    private final WaveSpeedService        wavespeed;
    private final CloudinaryUploadService cloudinary;

    public WaveSpeedProvider(WaveSpeedService wavespeed, CloudinaryUploadService cloudinary) {
        this.wavespeed  = wavespeed;
        this.cloudinary = cloudinary;
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
                "Requires Cloudinary credentials for provider-accessible image hosting",
                "Bag slot not supported"
            ),
            "video",
            true,
            true
        );
    }

    @Override
    public Map<String, Object> generate(TryOnRequest req) throws Exception {
        // Cloudinary is required to convert local image bytes into provider-accessible HTTPS URLs.
        if (!cloudinary.isConfigured()) {
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("status",            "failed");
            resp.put("mode",              "wavespeed_outfit");
            resp.put("preview_image_url", null);
            resp.put("preview_video_url", null);
            resp.put("message",
                "WaveSpeed requires provider-accessible image URLs. "
                + "Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET "
                + "to your .env to enable automatic image hosting for WaveSpeed.");
            return resp;
        }

        // TODO: add cleanup or expiration policy for hosted provider input images.

        // Upload model image to Cloudinary to obtain a public HTTPS URL.
        // Cloudinary upload exceptions are caught here to prevent raw provider error
        // text (which may contain internal details) from reaching the frontend.
        String humanUrl;
        try {
            log.info("Uploading model image to Cloudinary for WaveSpeed...");
            humanUrl = cloudinary.upload(req.humanImgBytes(), req.humanImgType());
        } catch (Exception e) {
            log.warn("Cloudinary upload failed for WaveSpeed input image.");
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("status",            "failed");
            resp.put("mode",              "wavespeed_outfit");
            resp.put("preview_image_url", null);
            resp.put("preview_video_url", null);
            resp.put("message",           "Could not upload images for WaveSpeed. Please try again.");
            return resp;
        }

        // Upload garment images in stable slot order (top, outerwear, bottom, dress, shoes).
        // Unsupported slots (bag) are already rejected by the frontend guard before this point.
        List<String>      clothesUrls = new ArrayList<>();
        List<GarmentItem> garments    = req.garments() != null ? req.garments() : List.of();

        try {
            if (!garments.isEmpty()) {
                for (GarmentItem g : garments) {
                    if (!SLOT_ORDER.contains(g.slot())) continue; // defense-in-depth: skip unsupported
                    log.info("Uploading {} garment to Cloudinary for WaveSpeed...", g.slot());
                    clothesUrls.add(cloudinary.upload(g.bytes(), g.type()));
                }
            } else if (req.garmImgBytes() != null) {
                // Single-garment fallback for the legacy garm_img path (edge case)
                log.info("Uploading single garment to Cloudinary for WaveSpeed...");
                clothesUrls.add(cloudinary.upload(req.garmImgBytes(), req.garmImgType()));
            }
        } catch (Exception e) {
            log.warn("Cloudinary upload failed for WaveSpeed input image.");
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("status",            "failed");
            resp.put("mode",              "wavespeed_outfit");
            resp.put("preview_image_url", null);
            resp.put("preview_video_url", null);
            resp.put("message",           "Could not upload images for WaveSpeed. Please try again.");
            return resp;
        }

        if (clothesUrls.isEmpty()) {
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("status",            "failed");
            resp.put("mode",              "wavespeed_outfit");
            resp.put("preview_image_url", null);
            resp.put("preview_video_url", null);
            resp.put("message",           "No supported garment images provided for WaveSpeed generation.");
            return resp;
        }

        try {
            return wavespeed.generateOutfitTryOn(humanUrl, clothesUrls);
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage().toLowerCase() : "";
            if (msg.contains("poll") || msg.contains("timeout")) {
                log.warn("WaveSpeed polling failed.");
            } else {
                log.warn("WaveSpeed request failed.");
            }
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("status",            "failed");
            resp.put("mode",              "wavespeed_outfit");
            resp.put("preview_image_url", null);
            resp.put("preview_video_url", null);
            resp.put("message",           "WaveSpeed generation failed. Please try again.");
            return resp;
        }
    }
}
