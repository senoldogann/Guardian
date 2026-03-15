import { useMemo, useState, type ReactElement } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import clsx from "clsx";
import { STORAGE_KEYS } from "../constants";
import { useI18n } from "../i18n";

interface Slide {
  title: string;
  description: string;
  highlight?: string;
}

interface OnboardingWizardProps {
    onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps): ReactElement {
  const { t } = useI18n();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides: Slide[] = useMemo(
    () => [
      {
        title: t("onboarding.slides.welcome.title"),
        description: t("onboarding.slides.welcome.description"),
        highlight: t("onboarding.slides.welcome.highlight"),
      },
      {
        title: t("onboarding.slides.neural.title"),
        description: t("onboarding.slides.neural.description"),
        highlight: t("onboarding.slides.neural.highlight"),
      },
      {
        title: t("onboarding.slides.realtime.title"),
        description: t("onboarding.slides.realtime.description"),
        highlight: t("onboarding.slides.realtime.highlight"),
      },
      {
        title: t("onboarding.slides.ready.title"),
        description: t("onboarding.slides.ready.description"),
        highlight: t("onboarding.slides.ready.highlight"),
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
        <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-6">
            <div className="max-w-lg w-full text-center space-y-8">
                {/* Progress Dots */}
                <div className="flex items-center justify-center gap-2">
                    {slides.map((_, index) => (
                        <div
                            key={index}
                            className={clsx(
                                "w-2 h-2 rounded-full transition-all duration-300",
                                index === currentSlide
                                    ? "w-8 bg-[var(--accent-500)]"
                                    : index < currentSlide
                                        ? "bg-[var(--accent-500)]/50"
                                        : "bg-border-main"
                            )}
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
                        <h1 className="text-3xl font-bold text-text-main">
                            {slide.title}
                        </h1>

                        <p className="text-text-muted leading-relaxed">
                            {slide.description}
                        </p>

                        {slide.highlight && (
                            <p className="text-sm font-semibold text-[var(--accent-500)] flex items-center justify-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                {slide.highlight}
                            </p>
                        )}
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
                        className={clsx(
                            "px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all",
                            "bg-[var(--accent-500)] text-background hover:opacity-90"
                        )}
                    >
                        {isLast ? t("onboarding.getStarted") : t("onboarding.continue")}
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
