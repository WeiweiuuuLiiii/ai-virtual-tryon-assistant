package com.stylesignal.tryon;

import java.util.List;

public record TryOnCapability(
    String       id,
    String       name,
    String       status,           // "active" | "not_configured" | "planned"
    int          maxGarments,
    List<String> supportedSlots,
    List<String> unsupportedSlots,
    String       description,
    List<String> limitations
) {}
