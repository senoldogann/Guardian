"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface CookiePreferences {
    necessary: boolean;
}

interface CookieConsentContextType {
    preferences: CookiePreferences;
    showBanner: boolean;
    hasConsented: boolean;
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
    necessary: true,
};

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
    const [preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_PREFERENCES);
    const [showBanner, setShowBanner] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [hasConsented, setHasConsented] = useState(false);

    useEffect(() => {
        // Check for existing consent
        const stored = localStorage.getItem(COOKIE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setPreferences({ ...DEFAULT_PREFERENCES, ...parsed, necessary: true });
                setShowBanner(false);
                setHasConsented(true);
            } catch {
                // Invalid JSON, treat as no consent
                setShowBanner(true);
                setHasConsented(false);
            }
        } else {
            // No consent found, show banner
            setShowBanner(true);
            setHasConsented(false);
        }
    }, []);

    const saveToStorage = (prefs: CookiePreferences) => {
        localStorage.setItem(COOKIE_KEY, JSON.stringify(prefs));
        setPreferences(prefs);
        setShowBanner(false);
        setIsSettingsOpen(false);
        setHasConsented(true);

        // Trigger GTM/Analytics update here if needed (e.g. window.gtag('consent', ...))
    };

    const acceptAll = () => {
        saveToStorage({ necessary: true });
    };

    const rejectAll = () => {
        saveToStorage({ necessary: true });
    };

    const savePreferences = (prefs: CookiePreferences) => {
        // Today we only support "necessary" cookies; keep the shape for future expansion.
        saveToStorage({ ...prefs, necessary: true });
    };

    const resetConsent = () => {
        localStorage.removeItem(COOKIE_KEY);
        setPreferences(DEFAULT_PREFERENCES);
        setShowBanner(true);
        setHasConsented(false);
    };

    const openSettings = () => setIsSettingsOpen(true);
    const closeSettings = () => setIsSettingsOpen(false);

    // if (!isInitialized) return null; // Removed to prevent blocking app render

    return (
        <CookieConsentContext.Provider
            value={{
                preferences,
                showBanner,
                hasConsented,
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
