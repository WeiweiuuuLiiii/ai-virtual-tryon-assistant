package com.stylesignal;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class StyleSignalApplication {

    public static void main(String[] args) {
        // Load .env from the working directory (project root when run via mvnw)
        Dotenv dotenv = Dotenv.configure()
            .directory(System.getProperty("user.dir"))
            .ignoreIfMissing()
            .load();

        dotenv.entries().forEach(e -> {
            String existing = System.getProperty(e.getKey());
            if (existing == null || existing.isBlank()) {
                System.setProperty(e.getKey(), e.getValue());
            }
        });

        // Startup diagnostic — prints presence and first 8 chars only, never the full key
        String key = System.getProperty("ANTHROPIC_API_KEY", "");
        if (key.isBlank()) {
            System.out.println("[StyleSignal] WARNING: ANTHROPIC_API_KEY is not set. Add it to .env in the project root.");
        } else {
            String preview = key.length() >= 8 ? key.substring(0, 8) : key;
            System.out.println("[StyleSignal] ANTHROPIC_API_KEY loaded: " + preview + "... (" + key.length() + " chars)");
        }

        SpringApplication.run(StyleSignalApplication.class, args);
    }
}
