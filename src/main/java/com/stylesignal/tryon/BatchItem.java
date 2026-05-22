package com.stylesignal.tryon;

/** One item in a batch Complete-the-Look edit request. */
public record BatchItem(String slot, String description, byte[] bytes, String type) {}
