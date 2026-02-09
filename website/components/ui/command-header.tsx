"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import {
    Menu,
    X,
    ShieldCheck,
    Book,
    Sparkles,
    Mail,
    Users,
    HelpCircle,
} from "lucide-react";

import { DirectDownloadButton } from "./direct-download-button";
import { ThemeToggle } from "../theme-toggle";

const navLabels = {
    docs: "Documentation",
    changelog: "Changelog",
    contact: "Contact",
    download: "Download",
    about: "About",
    faq: "FAQ"
};

export function CommandHeader() {
    const [isOpen, setIsOpen] = React.useState(false);
    const pathname = usePathname();
    const [scrolled, setScrolled] = React.useState(false);
    const mobileMenuRef = React.useRef<HTMLDivElement>(null);
    const menuButtonRef = React.useRef<HTMLButtonElement>(null);

    React.useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Focus management for mobile menu
    React.useEffect(() => {
        if (isOpen && mobileMenuRef.current) {
            // Focus first link when menu opens
            const firstLink = mobileMenuRef.current.querySelector("a");
            firstLink?.focus();
        }
    }, [isOpen]);

    // Close mobile menu on escape key
    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                setIsOpen(false);
                menuButtonRef.current?.focus();
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [isOpen]);

    const navItems = [
        { href: "/docs", label: navLabels.docs, icon: Book },
        { href: "/changelog", label: navLabels.changelog, icon: Sparkles },
        { href: "/faq", label: navLabels.faq, icon: HelpCircle },
        { href: "/contact", label: navLabels.contact, icon: Mail },
    ];

    const isActive = (path: string) => pathname?.includes(path);

    return (
        <header
            role="banner"
            className={cn(
                "fixed top-4 left-0 right-0 z-50 transition-all duration-300 px-4 md:px-6",
                scrolled ? "max-w-5xl mx-auto" : "max-w-7xl mx-auto"
            )}
        >
            <div
                className={cn(
                    "relative flex items-center justify-between p-2 rounded-full transition-all duration-300 overflow-hidden",
                    "bg-white/80 dark:bg-black/50 backdrop-blur-xl border border-black/10 dark:border-white/10 shadow-2xl",
                    scrolled && "shadow-black/5 dark:shadow-white/5 border-black/20 dark:border-white/20"
                )}
            >
                {/* Logo Area */}
                <Link
                    href="/"
                    className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                    <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-black/10 dark:bg-white/10 text-black dark:text-white">
                        <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                        <div className="absolute inset-0 bg-black/10 dark:bg-white/10 blur-lg rounded-full" aria-hidden="true" />
                    </div>
                    <span className="font-bold tracking-tight text-black dark:text-white block">
                        Guardian
                    </span>
                </Link>

                {/* Desktop Nav */}
                <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-0.5 flex-shrink min-w-0">
                    {navItems.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "relative px-3 py-2 rounded-full text-xs font-medium transition-all duration-300 group cursor-pointer whitespace-nowrap",
                                    active
                                        ? "text-black dark:text-white bg-black/10 dark:bg-white/10"
                                        : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                                )}
                            >
                                <span className="relative z-10">
                                    {item.label}
                                </span>
                                {active && (
                                    <motion.div
                                        layoutId="navbar-active"
                                        className="absolute inset-0 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* GitHub Icon Removed */}

                    <DirectDownloadButton />

                    {/* Theme Toggle */}
                    <div className="hidden sm:block" role="group" aria-label="Theme selection">
                        <ThemeToggle />
                    </div>

                    {/* Mobile Menu Toggle */}
                    <Button
                        ref={menuButtonRef}
                        variant="ghost"
                        size="icon"
                        className="lg:hidden rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                        onClick={() => setIsOpen(!isOpen)}
                        aria-expanded={isOpen}
                        aria-controls="mobile-menu"
                        aria-label={isOpen ? "Close menu" : "Open menu"}
                    >
                        {isOpen ? (
                          <X className="w-5 h-5 text-black dark:text-white" aria-hidden="true" />
                        ) : (
                          <Menu className="w-5 h-5 text-black dark:text-white" aria-hidden="true" />
                        )}
                    </Button>
                </div>

            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={mobileMenuRef}
                        id="mobile-menu"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Mobile navigation"
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="absolute top-full left-0 right-0 mt-4 p-4 rounded-3xl bg-white dark:bg-black border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden lg:hidden"
                    >
                        <nav aria-label="Mobile navigation" className="flex flex-col gap-2">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                                >
                                    <item.icon className="w-5 h-5 text-zinc-600 dark:text-white" aria-hidden="true" />
                                    {item.label}
                                </Link>
                            ))}
                            {/* Theme Toggle for Mobile */}
                            <div className="px-4 py-3">
                                <ThemeToggle />
                            </div>
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
