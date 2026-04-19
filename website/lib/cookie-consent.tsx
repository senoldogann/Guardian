"use client";

import React, { createContext, useContext, useState } from "react";

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

type CookieConsentState = {
    hasConsented: boolean;
    isSettingsOpen: boolean;
    preferences: CookiePreferences;
    showBanner: boolean;
};

function readStoredConsentState(): CookieConsentState {
    if (typeof window === "undefined") {
        return {
            hasConsented: false,
            isSettingsOpen: false,
            preferences: DEFAULT_PREFERENCES,
            showBanner: false,
        };
    }

    const stored = localStorage.getItem(COOKIE_KEY);
    if (!stored) {
        return {
            hasConsented: false,
            isSettingsOpen: false,
            preferences: DEFAULT_PREFERENCES,
            showBanner: true,
        };
    }

    try {
        const parsed = JSON.parse(stored);

        return {
            hasConsented: true,
            isSettingsOpen: false,
            preferences: { ...DEFAULT_PREFERENCES, ...parsed, necessary: true },
            showBanner: false,
        };
    } catch {
        return {
            hasConsented: false,
            isSettingsOpen: false,
            preferences: DEFAULT_PREFERENCES,
            showBanner: true,
        };
    }
}

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
    const [consentState, setConsentState] = useState<CookieConsentState>(() => readStoredConsentState());
    const { hasConsented, isSettingsOpen, preferences, showBanner } = consentState;

    const saveToStorage = (prefs: CookiePreferences) => {
        localStorage.setItem(COOKIE_KEY, JSON.stringify(prefs));
        setConsentState((currentState) => ({
            ...currentState,
            hasConsented: true,
            isSettingsOpen: false,
            preferences: prefs,
            showBanner: false,
        }));
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
        setConsentState((currentState) => ({
            ...currentState,
            hasConsented: false,
            preferences: DEFAULT_PREFERENCES,
            showBanner: true,
        }));
    };

    const openSettings = () => setConsentState((currentState) => ({ ...currentState, isSettingsOpen: true }));
    const closeSettings = () => setConsentState((currentState) => ({ ...currentState, isSettingsOpen: false }));

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
