package com.stylesignal.tryon;

/** A single garment contributed to a multi-garment try-on request. */
public record GarmentItem(byte[] bytes, String type, String slot) {}
