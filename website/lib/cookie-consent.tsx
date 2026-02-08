"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface CookiePreferences {
    necessary: boolean;
    analytics: boolean;
    marketing: boolean;
}

interface CookieConsentContextType {
    preferences: CookiePreferences;
    showBanner: boolean;
    acceptAll: () => void;
    rejectAll: () => void;
    savePreferences: (prefs: CookiePreferences) => void;
    resetConsent: () => void;
    openSettings: () => void;
    closeSettings: () => void;
    isSettingsOpen: boolean;
}

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

const COOKIE_KEY = "guardian_cookie_consent";

const DEFAULT_PREFERENCES: CookiePreferences = {
    necessary: true, // Always true
    analytics: false, // Default opt-out (GDPR)
    marketing: false, // Default opt-out (GDPR)
};

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
    const [preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_PREFERENCES);
    const [showBanner, setShowBanner] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        // Check for existing consent
        const stored = localStorage.getItem(COOKIE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setPreferences({ ...DEFAULT_PREFERENCES, ...parsed, necessary: true });
                setShowBanner(false);
            } catch {
                // Invalid JSON, treat as no consent
                setShowBanner(true);
            }
        } else {
            // No consent found, show banner
            setShowBanner(true);
        }
    }, []);

    const saveToStorage = (prefs: CookiePreferences) => {
        localStorage.setItem(COOKIE_KEY, JSON.stringify(prefs));
        setPreferences(prefs);
        setShowBanner(false);
        setIsSettingsOpen(false);

        // Trigger GTM/Analytics update here if needed (e.g. window.gtag('consent', ...))
    };

    const acceptAll = () => {
        saveToStorage({ necessary: true, analytics: true, marketing: true });
    };

    const rejectAll = () => {
        saveToStorage({ necessary: true, analytics: false, marketing: false });
    };

    const savePreferences = (prefs: CookiePreferences) => {
        saveToStorage({ ...prefs, necessary: true });
    };

    const resetConsent = () => {
        localStorage.removeItem(COOKIE_KEY);
        setPreferences(DEFAULT_PREFERENCES);
        setShowBanner(true);
    };

    const openSettings = () => setIsSettingsOpen(true);
    const closeSettings = () => setIsSettingsOpen(false);

    // if (!isInitialized) return null; // Removed to prevent blocking app render

    return (
        <CookieConsentContext.Provider
            value={{
                preferences,
                showBanner,
                acceptAll,
                rejectAll,
                savePreferences,
                resetConsent,
                openSettings,
                closeSettings,
                isSettingsOpen,
            }}
        >
            {children}
        </CookieConsentContext.Provider>
    );
}

export function useCookieConsent() {
    const context = useContext(CookieConsentContext);
    if (context === undefined) {
        throw new Error("useCookieConsent must be used within a CookieConsentProvider");
    }
    return context;
}
