package com.stylesignal.tryon;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class TryOnProviderRegistry {

    private final List<TryOnProvider> providers;

    public TryOnProviderRegistry(List<TryOnProvider> providers) {
        this.providers = providers;
    }

    /** Returns the first configured provider, or the first registered provider if none are configured. */
    public TryOnProvider getActiveProvider() {
        return providers.stream()
            .filter(TryOnProvider::isConfigured)
            .findFirst()
            .orElse(providers.isEmpty() ? null : providers.get(0));
    }

    /** Builds the full capability response for GET /api/try-on/providers. */
    public Map<String, Object> buildCapabilityResponse() {
        TryOnProvider active  = getActiveProvider();
        String        activeId = (active != null && active.isConfigured()) ? active.getId() : null;

        List<Map<String, Object>> all = new ArrayList<>();

        // Real Spring-managed providers
        for (TryOnProvider p : providers) {
            all.add(capToMap(p.getCapability()));
        }

        // Planned providers — metadata only, no implementation yet
        all.add(planned(
            "fashn_vton", "FASHN VTON", 1,
            List.of("top", "bottom", "dress", "outerwear", "shoes"), List.of("bag"),
            "Hosted virtual try-on API with high-quality results. API integration planned.",
            List.of("Requires FASHN_API_KEY", "Integration planned for a future milestone")
        ));
        all.add(planned(
            "kling_kolors", "Kling Kolors", 1,
            List.of("top", "bottom", "dress", "outerwear"), List.of("shoes", "bag"),
            "Video-model-based try-on from Kuaishou. Integration planned.",
            List.of("Requires Kling API access", "Integration planned for a future milestone")
        ));
        all.add(planned(
            "future_multi_garment_provider", "Multi-Garment Provider", 6,
            List.of("top", "bottom", "dress", "outerwear", "shoes", "bag"), List.of(),
            "Future provider capable of compositing a full outfit across all garment slots.",
            List.of("Not yet available", "Required for full outfit try-on generation")
        ));

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("active_provider", activeId);
        resp.put("providers",       all);
        return resp;
    }

    private static Map<String, Object> capToMap(TryOnCapability c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",                c.id());
        m.put("name",              c.name());
        m.put("status",            c.status());
        m.put("max_garments",      c.maxGarments());
        m.put("supported_slots",   c.supportedSlots());
        m.put("unsupported_slots", c.unsupportedSlots());
        m.put("description",       c.description());
        m.put("limitations",       c.limitations());
        return m;
    }

    private static Map<String, Object> planned(
            String id, String name, int maxGarments,
            List<String> supportedSlots, List<String> unsupportedSlots,
            String description, List<String> limitations) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",                id);
        m.put("name",              name);
        m.put("status",            "planned");
        m.put("max_garments",      maxGarments);
        m.put("supported_slots",   supportedSlots);
        m.put("unsupported_slots", unsupportedSlots);
        m.put("description",       description);
        m.put("limitations",       limitations);
        return m;
    }
}
