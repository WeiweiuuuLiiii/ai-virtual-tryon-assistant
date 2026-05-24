package com.stylesignal.service;

public class DemoGuardException extends RuntimeException {

    private final String userMessage;

    public DemoGuardException(String userMessage) {
        super(userMessage);
        this.userMessage = userMessage;
    }

    public String getUserMessage() {
        return userMessage;
    }
}
