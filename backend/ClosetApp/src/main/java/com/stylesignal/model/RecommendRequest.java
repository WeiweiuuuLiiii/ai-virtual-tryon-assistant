package com.stylesignal.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public record RecommendRequest(
    @JsonProperty("location")    String location,
    @JsonProperty("occasion")    String occasion,
    @JsonProperty("time_of_day") String timeOfDay,
    @JsonProperty("extra_notes") String extraNotes
) {}
