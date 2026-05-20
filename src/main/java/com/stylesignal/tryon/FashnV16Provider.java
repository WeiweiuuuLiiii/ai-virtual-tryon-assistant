package com.stylesignal.tryon;

import com.stylesignal.service.FashnService;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class FashnV16Provider implements TryOnProvider {

    private final FashnService fashn;

    public FashnV16Provider(FashnService fashn) {
        this.fashn = fashn;
    }

    @Override
    public String getId() { return "fashn_tryon_v1_6"; }

    @Override
    public boolean isConfigured() { return fashn.isConfigured(); }

    @Override
    public TryOnCapability getCapability() {
        return new TryOnCapability(
            "fashn_tryon_v1_6",
            "FASHN Try-On v1.6",
            fashn.isConfigured() ? "active" : "not_configured",
            1,
            List.of("top", "outerwear", "bottom", "dress"),
            List.of("shoes", "bag"),
            "FASHN's production virtual try-on model. Handles on-model and flat-lay garment images via segmentation_free mode.",
            List.of(
                "Supports one garment at a time",
                "Shoes and bags are not supported",
                "Full outfit try-on requires a future multi-garment provider"
            )
        );
    }

    @Override
    public Map<String, Object> generate(TryOnRequest req) throws Exception {
        String category = FashnService.mapSlotToCategory(req.slot());
        if (category == null) {
            throw new IllegalArgumentException(
                "FASHN v1.6 does not support this item type. "
                + "Please try Top, Outerwear, Bottom, or Dress.");
        }
        return fashn.generateTryOn(
            req.humanImgBytes(), req.humanImgType(),
            req.garmImgBytes(),  req.garmImgType(),
            category, req.containsModel()
        );
    }
}
