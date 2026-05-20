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
    List<GarmentItem> garments  // all garments in stable slot order — used by multi-garment providers
) {}
