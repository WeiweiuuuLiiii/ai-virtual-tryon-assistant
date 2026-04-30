package com.stylesignal.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public record FeedbackRequest(
    @JsonProperty("wore_today")          String woreToday,
    @JsonProperty("occasion")            String occasion,
    @JsonProperty("comfort_vs_polish")   String comfortVsPolish,
    @JsonProperty("walked_a_lot")        boolean walkedALot,
    @JsonProperty("wanted_to_stand_out") boolean wantedToStandOut,
    @JsonProperty("notes")               String notes
) {}
