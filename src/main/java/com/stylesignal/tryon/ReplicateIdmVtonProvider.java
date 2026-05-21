package com.stylesignal.tryon;

import com.stylesignal.service.ReplicateService;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class ReplicateIdmVtonProvider implements TryOnProvider {

    private final ReplicateService replicate;

    public ReplicateIdmVtonProvider(ReplicateService replicate) {
        this.replicate = replicate;
    }

    @Override
    public String getId() { return "replicate_idm_vton"; }

    @Override
    public boolean isConfigured() { return replicate.isConfigured(); }

    @Override
    public TryOnCapability getCapability() {
        return new TryOnCapability(
            "replicate_idm_vton",
            "IDM-VTON via Replicate",
            replicate.isConfigured() ? "active" : "not_configured",
            1,
            List.of("top", "dress", "outerwear", "bottom", "shoes"),
            List.of("bag"),
            "Open-source diffusion-based virtual try-on. Runs cuuupid/idm-vton on Replicate.",
            List.of(
                "Supports one garment at a time",
                "Full outfit try-on requires a future multi-garment provider"
            ),
            "image",
            false,
            false
        );
    }

    @Override
    public Map<String, Object> generate(TryOnRequest req) throws Exception {
        String category = ReplicateService.mapSlotToCategory(req.slot());
        if (category == null) {
            throw new IllegalArgumentException(
                "Real try-on v1 does not support this item type yet. "
                + "Please try Top, Dress, Outerwear, Bottom, or Shoes.");
        }
        return replicate.generateTryOn(
            req.humanImgBytes(), req.humanImgType(),
            req.garmImgBytes(),  req.garmImgType(),
            req.garmentDes(),    category
        );
    }
}
