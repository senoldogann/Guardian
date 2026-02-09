"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Shield } from "lucide-react";
import { useCookieConsent } from "@/lib/cookie-consent";
import { Button } from "@/components/ui/button";
import { CookieSettingsModal } from "./CookieSettingsModal";

export function CookieBanner() {
    const { showBanner, acceptAll, openSettings } = useCookieConsent();

    return (
        <>
            <AnimatePresence>
                {showBanner && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 z-[50] p-4 md:p-6 pointer-events-none"
                    >
                        <div
                            className="pointer-events-auto max-w-5xl mx-auto bg-white dark:bg-zinc-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="cookie-banner-title"
                            aria-describedby="cookie-banner-description"
                        >
                            <div className="space-y-2 max-w-2xl">
                                <h3 id="cookie-banner-title" className="font-bold text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <Shield className="w-5 h-5" aria-hidden="true" />
                                    Cookie Privacy
                                </h3>
                                <p id="cookie-banner-description" className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-sm md:text-base">
                                    We only store essential preferences on your device, like your theme choice.
                                    Learn more in our
                                    <a href="/privacy-policy" className="text-black dark:text-white underline mx-1 font-medium hover:opacity-80 transition-opacity">Privacy Policy</a>.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                                <button
                                    onClick={openSettings}
                                    className="text-sm font-medium text-zinc-500 hover:text-black dark:hover:text-white underline px-2 py-2 transition-colors"
                                >
                                    Preferences
                                </button>
                                <Button
                                    onClick={acceptAll}
                                    className="w-full sm:w-auto bg-black text-white dark:bg-white dark:text-black rounded-xl h-11 px-8 hover:bg-zinc-800 dark:hover:bg-zinc-200 font-medium shadow-lg shadow-zinc-200 dark:shadow-none transition-all"
                                >
                                    Got it
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <CookieSettingsModal />
        </>
    );
}
