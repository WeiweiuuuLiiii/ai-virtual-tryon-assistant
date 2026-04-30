package com.stylesignal.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class WeatherService {

    @Value("${openweather.api.key:}")
    private String apiKey;

    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    public Map<String, Object> getWeather(String location) {
        if (apiKey == null || apiKey.isBlank() || apiKey.equals("your_openweather_api_key_here")) {
            return mockWeather(location);
        }
        try {
            String encoded = URLEncoder.encode(location, StandardCharsets.UTF_8);
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("https://api.openweathermap.org/data/2.5/weather?q="
                    + encoded + "&appid=" + apiKey + "&units=metric"))
                .GET().build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) return mockWeather(location);

            Map<String, Object> data = mapper.readValue(resp.body(), new TypeReference<>() {});

            @SuppressWarnings("unchecked")
            Map<String, Object> main = (Map<String, Object>) data.get("main");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> weather = (List<Map<String, Object>>) data.get("weather");
            @SuppressWarnings("unchecked")
            Map<String, Object> wind = (Map<String, Object>) data.get("wind");

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("location",    data.get("name"));
            result.put("temp",        Math.round(((Number) main.get("temp")).doubleValue()));
            result.put("feels_like",  Math.round(((Number) main.get("feels_like")).doubleValue()));
            result.put("description", weather.get(0).get("description"));
            result.put("humidity",    main.get("humidity"));
            result.put("wind_speed",  Math.round(((Number) wind.get("speed")).doubleValue() * 3.6));
            result.put("rain_chance", 0);
            result.put("icon",        weather.get(0).get("icon"));
            result.put("is_mock",     false);
            return result;
        } catch (Exception e) {
            Map<String, Object> m = mockWeather(location);
            m.put("error", e.getMessage());
            return m;
        }
    }

    private Map<String, Object> mockWeather(String location) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("location",    location);
        m.put("temp",        18);
        m.put("feels_like",  16);
        m.put("description", "partly cloudy");
        m.put("humidity",    65);
        m.put("wind_speed",  12);
        m.put("rain_chance", 20);
        m.put("icon",        "02d");
        m.put("is_mock",     true);
        return m;
    }
}
