package com.stylesignal.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Uploads local image bytes to Cloudinary and returns a provider-accessible HTTPS URL.
 * Uses the Cloudinary REST Upload API with HMAC-SHA1 signed authentication — no SDK required.
 */
@Service
public class CloudinaryUploadService {

    private static final Logger log = LoggerFactory.getLogger(CloudinaryUploadService.class);

    @Value("${cloudinary.cloud.name:}")
    private String cloudName;

    @Value("${cloudinary.api.key:}")
    private String apiKey;

    @Value("${cloudinary.api.secret:}")
    private String apiSecret;

    private final HttpClient   http   = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    public boolean isConfigured() {
        return !cloudName.isBlank() && !apiKey.isBlank() && !apiSecret.isBlank();
    }

    /**
     * Uploads raw image bytes to Cloudinary and returns the public HTTPS URL.
     *
     * @param bytes    raw image bytes
     * @param mimeType MIME type (e.g. "image/jpeg", "image/png")
     * @return         public {@code secure_url} from Cloudinary
     */
    public String upload(byte[] bytes, String mimeType) throws Exception {
        long   timestamp = System.currentTimeMillis() / 1000;
        String signature = computeSignature(timestamp);
        String boundary  = "----CloudinaryBoundary" + UUID.randomUUID().toString().replace("-", "");

        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("api_key",   apiKey);
        fields.put("timestamp", String.valueOf(timestamp));
        fields.put("signature", signature);

        byte[]      body      = buildMultipartBody(boundary, fields, bytes, "upload", mimeType);
        String      uploadUrl = "https://api.cloudinary.com/v1_1/" + cloudName + "/image/upload";
        HttpRequest req       = HttpRequest.newBuilder()
            .uri(URI.create(uploadUrl))
            .header("Content-Type", "multipart/form-data; boundary=" + boundary)
            .POST(HttpRequest.BodyPublishers.ofByteArray(body))
            .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200) {
            String snippet = resp.body().length() > 300 ? resp.body().substring(0, 300) : resp.body();
            throw new RuntimeException(
                "Cloudinary upload failed (HTTP " + resp.statusCode() + "): " + snippet);
        }

        Map<String, Object> result = mapper.readValue(resp.body(), new TypeReference<>() {});
        String url = (String) result.get("secure_url");
        if (url == null || url.isBlank()) {
            throw new RuntimeException("Cloudinary response missing secure_url.");
        }
        log.debug("Cloudinary upload complete — public url obtained");
        return url;
    }

    /** Computes HMAC-SHA1 signature for a signed Cloudinary upload (timestamp only). */
    private String computeSignature(long timestamp) throws Exception {
        // Signature = SHA1("timestamp={ts}" + api_secret)
        String        toSign = "timestamp=" + timestamp + apiSecret;
        MessageDigest sha1   = MessageDigest.getInstance("SHA-1");
        byte[]        hash   = sha1.digest(toSign.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb     = new StringBuilder();
        for (byte b : hash) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    /** Builds a multipart/form-data body with text fields followed by a binary file field. */
    private byte[] buildMultipartBody(
            String boundary, Map<String, String> fields,
            byte[] fileBytes, String fileName, String mimeType) throws IOException {
        ByteArrayOutputStream out  = new ByteArrayOutputStream();
        String                crlf = "\r\n";

        for (Map.Entry<String, String> e : fields.entrySet()) {
            out.write(("--" + boundary + crlf).getBytes(StandardCharsets.UTF_8));
            out.write(("Content-Disposition: form-data; name=\"" + e.getKey() + "\"" + crlf + crlf)
                .getBytes(StandardCharsets.UTF_8));
            out.write((e.getValue() + crlf).getBytes(StandardCharsets.UTF_8));
        }

        out.write(("--" + boundary + crlf).getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Disposition: form-data; name=\"file\"; filename=\"" + fileName + "\"" + crlf)
            .getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Type: " + mimeType + crlf + crlf).getBytes(StandardCharsets.UTF_8));
        out.write(fileBytes);
        out.write(crlf.getBytes(StandardCharsets.UTF_8));
        out.write(("--" + boundary + "--" + crlf).getBytes(StandardCharsets.UTF_8));

        return out.toByteArray();
    }
}
