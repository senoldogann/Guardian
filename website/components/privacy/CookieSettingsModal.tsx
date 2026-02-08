"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, X } from "lucide-react";
import { useCookieConsent } from "@/lib/cookie-consent";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function CookieSettingsModal() {
    const { isSettingsOpen, closeSettings, preferences, savePreferences } = useCookieConsent();
    const [localPrefs, setLocalPrefs] = useState(preferences);

    // Sync local state when open
    useEffect(() => {
        if (isSettingsOpen) {
            setLocalPrefs(preferences);
        }
    }, [isSettingsOpen, preferences]);

    const handleSave = () => {
        savePreferences(localPrefs);
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
                            We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic.
                            Below you can manage your preferences for each category.
                        </p>

                        <div className="space-y-6">
                            {/* Strictly Necessary */}
                            <div className="flex items-start justify-between p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">Strictly Necessary</span>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded">Required</span>
                                    </div>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
                                        These cookies are essential for the website to function properly. They cannot be disabled.
                                    </p>
                                </div>
                                <Switch checked={true} disabled ariaLabel="Strictly necessary cookies" onCheckedChange={() => { }} />
                            </div>

                            {/* Analytics */}
                            <div className="flex items-start justify-between p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                                <div className="space-y-1">
                                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">Analytics & Performance</span>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
                                        Help us understand how visitors interact with the website by collecting and reporting information anonymously.
                                    </p>
                                </div>
                                <Switch
                                    checked={localPrefs.analytics}
                                    ariaLabel="Analytics cookies"
                                    onCheckedChange={(checked: boolean) => setLocalPrefs(prev => ({ ...prev, analytics: checked }))}
                                />
                            </div>

                            {/* Marketing */}
                            <div className="flex items-start justify-between p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                                <div className="space-y-1">
                                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">Marketing & Targeting</span>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
                                        Used to track visitors across websites to display ads that are relevant and engaging.
                                    </p>
                                </div>
                                <Switch
                                    checked={localPrefs.marketing}
                                    ariaLabel="Marketing cookies"
                                    onCheckedChange={(checked: boolean) => setLocalPrefs(prev => ({ ...prev, marketing: checked }))}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                            <Button variant="outline" onClick={closeSettings} className="rounded-xl h-11 px-6 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700">
                                Cancel
                            </Button>
                            <Button onClick={handleSave} className="bg-black text-white dark:bg-white dark:text-black rounded-xl h-11 px-6 hover:bg-zinc-800 dark:hover:bg-zinc-200">
                                Save Preferences
                            </Button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
