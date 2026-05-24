package com.stylesignal.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Service
public class DemoGuardService {

    private static final Logger log = LoggerFactory.getLogger(DemoGuardService.class);

    @Value("${app.public-demo-mode:false}")
    private boolean publicDemoMode;

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
                "Daily generation limit reached. The demo resets tomorrow.");
        }

        Set<String> validCodes = parseValidCodes();
        if (validCodes.isEmpty()) {
            throw new DemoGuardException(
                "Demo mode is active but no demo codes are configured. Contact the owner.");
        }

        String trimmed = (code != null) ? code.trim() : "";
        if (!validCodes.contains(trimmed)) {
            log.warn("Demo: invalid or missing code — provided={}", trimmed.isEmpty() ? "(empty)" : "[redacted]");
            throw new DemoGuardException(
                "Enter a valid demo code to use this feature.");
        }

        AtomicInteger perCode = codeUsage.computeIfAbsent(trimmed, k -> new AtomicInteger(0));
        int perCodeCount = perCode.get();
        if (perCodeCount >= demoCodeMaxUses) {
            log.warn("Demo: per-code limit reached — count={}", perCodeCount);
            throw new DemoGuardException(
                "This demo code has reached its generation limit. Request a new code.");
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
