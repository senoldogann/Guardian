export const tokens = {
    colors: {
        primary: {
            DEFAULT: "#FFFFFF", // White
            foreground: "#000000", // Black
            50: "#FAFAFA",
            100: "#F5F5F5",
            200: "#E5E5E5",
            300: "#D4D4D4",
            400: "#A3A3A3",
            500: "#737373",
            600: "#525252",
            700: "#404040",
            800: "#262626",
            900: "#171717",
            950: "#0A0A0A",
        },
        cyan: {
            DEFAULT: "#A1A1AA", // Zinc 400
            500: "#71717A",
        },
        onyx: {
            DEFAULT: "#000000", // Pure Black
            50: "#FAFAFA",
            100: "#F4F4F5",
            200: "#E4E4E7",
            300: "#D4D4D8",
            400: "#A1A1AA",
            500: "#71717A",
            600: "#52525B",
            700: "#3F3F46",
            800: "#27272A",
            900: "#18181B",
            950: "#09090B",
        },
        glass: {
            border: "rgba(255, 255, 255, 0.15)",
            surface: "rgba(255, 255, 255, 0.03)",
            highlight: "rgba(255, 255, 255, 0.10)",
        }
    },
    animations: {
        slow: {
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }
        },
        stagger: {
            container: {
                hidden: { opacity: 0 },
                show: {
                    opacity: 1,
                    transition: {
                        staggerChildren: 0.1
                    }
                }
            },
            item: {
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0 }
            }
        },
        glow: {
            initial: { boxShadow: "0 0 0 rgba(255, 255, 255, 0)" },
            hover: { boxShadow: "0 0 20px rgba(255, 255, 255, 0.25)" }
        }
    },
    geometry: {
        radius: {
            sm: "2px", // Sharp
            md: "4px",
            lg: "8px",
            full: "9999px"
        }
    }
} as const;
