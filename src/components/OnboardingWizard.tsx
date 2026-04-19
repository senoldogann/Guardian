import { useMemo, useRef, useState, type ReactElement } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, Shield, Eye, Zap } from "lucide-react";
import clsx from "clsx";
import { STORAGE_KEYS } from "../constants";
import { useI18n } from "../i18n";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface Slide {
  title: string;
  description: string;
  highlight?: string;
  icon: "shield" | "eye" | "zap" | "sparkles";
}

interface OnboardingWizardProps {
    onComplete: () => void;
}

/* ── Decorative background lines ─────────────────────────── */
function DecoLines(): ReactElement {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {/* Diagonal cross */}
      <line x1="30%" y1="12%" x2="70%" y2="72%" stroke="var(--border-main)" strokeWidth="1" />
      <line x1="70%" y1="12%" x2="30%" y2="72%" stroke="var(--border-main)" strokeWidth="1" />
      {/* Horizontal connector */}
      <line x1="20%" y1="42%" x2="80%" y2="42%" stroke="var(--border-main)" strokeWidth="1" />
    </svg>
  );
}

/* ── Slide icon ──────────────────────────────────────────── */
function SlideIcon({ icon }: { icon: Slide["icon"] }): ReactElement {
  const iconMap = {
    shield: Shield,
    eye: Eye,
    zap: Zap,
    sparkles: Sparkles,
  };
  const Icon = iconMap[icon];

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center"
      style={{
        backgroundColor: "var(--accent-500)",
        boxShadow: "0 4px 24px var(--guardian-shadow)",
      }}
    >
      <Icon
        className="w-7 h-7"
        style={{ color: "var(--on-accent)" }}
      />
    </motion.div>
  );
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps): ReactElement {
  const { t } = useI18n();
  const [currentSlide, setCurrentSlide] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useFocusTrap({ active: true, containerRef });

  const slides: Slide[] = useMemo(
    () => [
      {
        title: t("onboarding.slides.welcome.title"),
        description: t("onboarding.slides.welcome.description"),
        highlight: t("onboarding.slides.welcome.highlight"),
        icon: "shield" as const,
      },
      {
        title: t("onboarding.slides.neural.title"),
        description: t("onboarding.slides.neural.description"),
        highlight: t("onboarding.slides.neural.highlight"),
        icon: "zap" as const,
      },
      {
        title: t("onboarding.slides.realtime.title"),
        description: t("onboarding.slides.realtime.description"),
        highlight: t("onboarding.slides.realtime.highlight"),
        icon: "eye" as const,
      },
      {
        title: t("onboarding.slides.ready.title"),
        description: t("onboarding.slides.ready.description"),
        highlight: t("onboarding.slides.ready.highlight"),
        icon: "sparkles" as const,
      },
    ],
    [t]
  );

    const handleNext = (): void => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(prev => prev + 1);
        } else {
            localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, "true");
            onComplete();
        }
    };

    const handleSkip = (): void => {
        localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, "true");
        onComplete();
    };

    const slide = slides[currentSlide];
    const isLast = currentSlide === slides.length - 1;

    return (
        <div ref={containerRef} className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-6">
            {/* Decorative background lines — uses var(--border-main) for both themes */}
            <DecoLines />

            <div className="relative max-w-lg w-full text-center space-y-8">
                {/* Progress Dots */}
                <div className="flex items-center justify-center gap-2">
                    {slides.map((_, index) => (
                        <div
                            key={index}
                            className={clsx(
                                "h-2 rounded-full transition-all duration-300",
                                index === currentSlide ? "w-8" : "w-2"
                            )}
                            style={{
                                backgroundColor:
                                    index === currentSlide
                                        ? "var(--accent-500)"
                                        : index < currentSlide
                                            ? "var(--edge-muted)"
                                            : "var(--border-main)",
                            }}
                        />
                    ))}
                </div>

                {/* Slide Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentSlide}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                    >
                        {/* Icon */}
                        <SlideIcon icon={slide.icon} />

                        {/* Subtitle badge */}
                        <span
                            className="inline-block px-3 py-1 text-xs font-semibold rounded-full"
                            style={{
                                color: "var(--accent-500)",
                                backgroundColor: "var(--accent-200)",
                            }}
                        >
                            {slide.highlight ?? ""}
                        </span>

                        <h1 className="text-3xl font-bold text-text-main">
                            {slide.title}
                        </h1>

                        <p className="text-text-muted leading-relaxed">
                            {slide.description}
                        </p>
                    </motion.div>
                </AnimatePresence>

                {/* Actions */}
                <div className="flex items-center justify-center gap-4 pt-4">
                    {!isLast && (
                        <button
                            onClick={handleSkip}
                            className="px-4 py-2 text-sm text-text-muted hover:text-text-main transition-colors"
                        >
                            {t("onboarding.skip")}
                        </button>
                    )}
                    <button
                        onClick={handleNext}
                        className="px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all hover:opacity-90"
                        style={{
                            backgroundColor: "var(--text-main)",
                            color: "var(--background)",
                        }}
                    >
                        {isLast ? t("onboarding.getStarted") : t("onboarding.continue")}
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
