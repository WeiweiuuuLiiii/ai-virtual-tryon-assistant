package com.stylesignal.service;

/**
 * Thrown when the OpenAI Images API returns a non-200 response.
 * The message is always a safe, user-facing string — no raw provider
 * response body, no secrets, no API details.
 */
public class OpenAiProviderException extends RuntimeException {

    private final String category;

    public OpenAiProviderException(String safeMessage, String category) {
        super(safeMessage);
        this.category = category;
    }

    public String getCategory() { return category; }
}
