package com.stylesignal.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class StorageService {

    private final Path dataDir = Path.of(System.getProperty("user.dir")).resolve("data");
    private final ObjectMapper mapper = new ObjectMapper();

    @PostConstruct
    public void init() throws IOException {
        Files.createDirectories(dataDir);
    }

    public void saveProfile(Map<String, Object> profile) throws IOException {
        profile.put("updated_at", Instant.now().toString());
        mapper.writerWithDefaultPrettyPrinter()
              .writeValue(dataDir.resolve("style_profile.json").toFile(), profile);
    }

    public Optional<Map<String, Object>> loadProfile() throws IOException {
        Path path = dataDir.resolve("style_profile.json");
        if (!Files.exists(path)) return Optional.empty();
        return Optional.of(mapper.readValue(path.toFile(), new TypeReference<>() {}));
    }

    public void saveFeedback(Map<String, Object> feedback) throws IOException {
        Path path = dataDir.resolve("feedback.json");
        List<Map<String, Object>> entries = new ArrayList<>();
        if (Files.exists(path)) {
            entries = new ArrayList<>(mapper.readValue(path.toFile(), new TypeReference<>() {}));
        }
        feedback.put("timestamp", Instant.now().toString());
        entries.add(feedback);
        mapper.writerWithDefaultPrettyPrinter().writeValue(path.toFile(), entries);
    }

    public void saveModelData(Map<String, Object> modelData) throws IOException {
        modelData.put("updated_at", Instant.now().toString());
        mapper.writerWithDefaultPrettyPrinter()
              .writeValue(dataDir.resolve("model_data.json").toFile(), modelData);
    }

    public Optional<Map<String, Object>> loadModelData() throws IOException {
        Path path = dataDir.resolve("model_data.json");
        if (!Files.exists(path)) return Optional.empty();
        return Optional.of(mapper.readValue(path.toFile(), new TypeReference<>() {}));
    }

    public void saveModelPhoto(byte[] bytes) throws IOException {
        Files.write(dataDir.resolve("model_photo.jpg"), bytes);
    }

    public boolean hasModelPhoto() {
        return Files.exists(dataDir.resolve("model_photo.jpg"));
    }

    public byte[] loadModelPhotoBytes() throws IOException {
        return Files.readAllBytes(dataDir.resolve("model_photo.jpg"));
    }
}
