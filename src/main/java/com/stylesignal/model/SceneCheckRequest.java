package com.stylesignal.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public record SceneCheckRequest(
    @JsonProperty("outfit_description") String outfitDescription,
    @JsonProperty("scene")              String scene,
    @JsonProperty("vibe")               String vibe,
    @JsonProperty("location")           String location
) {}
