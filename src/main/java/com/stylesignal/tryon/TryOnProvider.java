package com.stylesignal.tryon;

import java.util.Map;

public interface TryOnProvider {
    String          getId();
    TryOnCapability getCapability();
    boolean         isConfigured();
    Map<String, Object> generate(TryOnRequest request) throws Exception;
}
