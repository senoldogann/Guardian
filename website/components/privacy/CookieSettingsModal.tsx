"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Shield, X } from "lucide-react";
import { useCookieConsent } from "@/lib/cookie-consent";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function CookieSettingsModal() {
    const { isSettingsOpen, closeSettings, preferences, savePreferences, resetConsent, hasConsented } = useCookieConsent();

    const handleSave = () => {
        savePreferences(preferences);
        closeSettings();
    };

    const handleReset = () => {
        resetConsent();
        closeSettings();
    };

    return (
        <AnimatePresence>
            {isSettingsOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeSettings}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 m-auto z-[61] w-full max-w-2xl h-fit max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 md:p-8"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="cookie-settings-title"
                        aria-describedby="cookie-settings-description"
                    >
                        <div className="flex items-center justify-between mb-8">
                            <h2 id="cookie-settings-title" className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                                <Shield className="w-6 h-6 text-zinc-900 dark:text-zinc-100" aria-hidden="true" />
                                Privacy Preferences
                            </h2>
                            <button
                                onClick={closeSettings}
                                aria-label="Close cookie settings"
                                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <X className="w-5 h-5 text-zinc-500" aria-hidden="true" />
                            </button>
                        </div>

                        <p id="cookie-settings-description" className="text-zinc-600 dark:text-zinc-400 mb-8 leading-relaxed">
                            We only store essential preferences on your device, such as your theme choice. We do not run marketing trackers.
                        </p>

                        <div className="space-y-6">
                            <div className="flex items-start justify-between p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">Essential Preferences</span>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded">Required</span>
                                    </div>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
                                        These settings keep the site functional and remember your preferences on this device.
                                    </p>
                                </div>
                                <Switch checked={true} disabled ariaLabel="Essential preferences" onCheckedChange={() => { }} />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                            {hasConsented && (
                                <Button
                                    variant="ghost"
                                    onClick={handleReset}
                                    className="rounded-xl h-11 px-6 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
                                >
                                    Reset Preferences
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                onClick={closeSettings}
                                className="rounded-xl h-11 px-6 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                            >
                                Close
                            </Button>
                            <Button onClick={handleSave} className="bg-black text-white dark:bg-white dark:text-black rounded-xl h-11 px-6 hover:bg-zinc-800 dark:hover:bg-zinc-200">
                                Save
                            </Button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
