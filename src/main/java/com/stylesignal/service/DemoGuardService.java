package com.stylesignal.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Service
public class DemoGuardService {

    private static final Logger log = LoggerFactory.getLogger(DemoGuardService.class);

    @Value("${app.public-demo-mode:false}")
    private boolean publicDemoMode;

    @Value("${app.public-demo-sample-results:true}")
    private boolean sampleResultsEnabled;

    @Value("${app.demo-codes:}")
    private String demoCodesConfig;

    @Value("${app.demo-code-max-uses:10}")
    private int demoCodeMaxUses;

    @Value("${app.daily-generation-limit:50}")
    private int dailyLimit;

    private final ConcurrentHashMap<String, AtomicInteger> codeUsage = new ConcurrentHashMap<>();
    private final AtomicInteger dailyCount = new AtomicInteger(0);
    private volatile String lastResetDate = "";

    /**
     * Returns true when the request should be served with a static sample result:
     *   - publicDemoMode is enabled
     *   - sampleResultsEnabled is true
     *   - the provided code is missing, invalid, or exhausted
     * Returns false in all other cases (local mode, valid code, or sample results disabled).
     * Does not increment any counters or create usage entries.
     */
    public boolean shouldServeSample(String code) {
        if (!publicDemoMode || !sampleResultsEnabled) return false;
        return !isCodeValidAndAvailable(code);
    }

    private boolean isCodeValidAndAvailable(String code) {
        resetDailyIfNeeded();
        if (dailyCount.get() >= dailyLimit) return false;
        Set<String> validCodes = parseValidCodes();
        if (validCodes.isEmpty()) return false;
        String trimmed = (code != null) ? code.trim() : "";
        if (!validCodes.contains(trimmed)) return false;
        AtomicInteger perCode = codeUsage.get(trimmed);
        int count = (perCode != null) ? perCode.get() : 0;
        return count < demoCodeMaxUses;
    }

    /**
     * Validates the demo code and increments usage counters.
     * No-op when public demo mode is disabled.
     * Throws DemoGuardException with a user-facing message on any check failure.
     */
    public void checkAndIncrement(String code) {
        if (!publicDemoMode) {
            return;
        }

        resetDailyIfNeeded();

        int current = dailyCount.get();
        if (current >= dailyLimit) {
            log.warn("Demo daily limit reached — count={}", current);
            throw new DemoGuardException(
                "Today's public demo generation limit has been reached. " +
                "You can still explore the UI and saved-look workflows, " +
                "or contact Weiwei Li for a live walkthrough.");
        }

        Set<String> validCodes = parseValidCodes();
        if (validCodes.isEmpty()) {
            throw new DemoGuardException(
                "Live AI generation is credit-protected in this public demo. " +
                "You can still explore the UI and saved-look workflows, " +
                "or contact Weiwei Li for a private demo code or live walkthrough.");
        }

        String trimmed = (code != null) ? code.trim() : "";
        if (!validCodes.contains(trimmed)) {
            log.warn("Demo: invalid or missing code — provided={}", trimmed.isEmpty() ? "(empty)" : "[redacted]");
            throw new DemoGuardException(
                "Live AI generation is credit-protected in this public demo. " +
                "You can still explore the UI and saved-look workflows, " +
                "or contact Weiwei Li for a private demo code or live walkthrough.");
        }

        AtomicInteger perCode = codeUsage.computeIfAbsent(trimmed, k -> new AtomicInteger(0));
        int perCodeCount = perCode.get();
        if (perCodeCount >= demoCodeMaxUses) {
            log.warn("Demo: per-code limit reached — count={}", perCodeCount);
            throw new DemoGuardException(
                "This demo code has reached its live generation limit. " +
                "You can still explore the UI and saved-look workflows, " +
                "or contact Weiwei Li for more access or a live walkthrough.");
        }

        dailyCount.incrementAndGet();
        perCode.incrementAndGet();
        log.info("Demo generation approved — daily={}, perCode={}", dailyCount.get(), perCode.get());
    }

    private void resetDailyIfNeeded() {
        String today = LocalDate.now().toString();
        if (!today.equals(lastResetDate)) {
            synchronized (this) {
                if (!today.equals(lastResetDate)) {
                    log.info("Demo daily count reset for {}", today);
                    dailyCount.set(0);
                    lastResetDate = today;
                }
            }
        }
    }

    public Map<String, Object> getDemoConfig() {
        Map<String, Object> cfg = new LinkedHashMap<>();
        cfg.put("publicDemoMode",       publicDemoMode);
        cfg.put("sampleResultsEnabled", sampleResultsEnabled);
        return cfg;
    }

    private Set<String> parseValidCodes() {
        if (demoCodesConfig == null || demoCodesConfig.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(demoCodesConfig.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .collect(Collectors.toSet());
    }
}
