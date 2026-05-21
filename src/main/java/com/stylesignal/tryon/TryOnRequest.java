package com.stylesignal.tryon;

import java.util.List;

public record TryOnRequest(
    byte[] humanImgBytes,
    String humanImgType,
    byte[] garmImgBytes,        // primary garment bytes — used by single-garment providers
    String garmImgType,
    String slot,
    String garmentDes,
    String bodyShape,
    boolean containsModel,
    List<GarmentItem> garments, // all garments in stable slot order — used by multi-garment providers
    String outfitMode,          // "top_bottom" | "dress" — informs prompt guardrails for multi-garment providers
    String hairAccessoryPlacement // e.g. "auto", "left_side", "top_of_head" — passed to prompt when hair_accessory is present
) {}
