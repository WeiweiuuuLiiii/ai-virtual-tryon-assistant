package com.stylesignal.tryon;

public record TryOnRequest(
    byte[] humanImgBytes,
    String humanImgType,
    byte[] garmImgBytes,
    String garmImgType,
    String slot,
    String garmentDes,
    String bodyShape
) {}
