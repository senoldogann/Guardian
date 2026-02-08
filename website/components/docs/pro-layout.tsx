"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FileText, FolderOpen, ChevronRight, Menu } from "lucide-react";

interface TocItem {
    title: string;
    url: string;
    items?: TocItem[];
}

interface DocSection {
    title: string;
    items: {
        title: string;
        slug: string;
    }[];
}

interface ProLayoutProps {
    children: React.ReactNode;
    sidebar: DocSection[];
    toc?: TocItem[];
}

export function ProLayout({ children, sidebar, toc }: ProLayoutProps) {
    const pathname = usePathname();
    const [activeSectionIndex, setActiveSectionIndex] = React.useState<number>(-1);
    const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
    const [mobileTocOpen, setMobileTocOpen] = React.useState(false);

    // Scroll spy to highlight active section
    React.useEffect(() => {
        if (!toc || toc.length === 0) return;

        const handleScroll = () => {
            const headings = toc.map((item, index) => ({
                id: item.url.replace('#', ''),
                url: item.url,
                index: index
            }));

            let currentIndex = -1;
            for (const heading of headings) {
                const element = document.getElementById(heading.id);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    if (rect.top <= 150) {
                        currentIndex = heading.index;
                    }
                }
            }

            if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100) {
                currentIndex = headings.length - 1;
            }

            setActiveSectionIndex(currentIndex);
        };

        window.addEventListener("scroll", handleScroll);
        handleScroll();

        return () => window.removeEventListener("scroll", handleScroll);
    }, [toc]);

    return (
        <div className="flex w-full min-h-screen pt-24 pb-12 bg-white dark:bg-black transition-colors duration-300">
            {/* Desktop Sidebar (IDE Style) */}
            <aside className="hidden lg:block w-72 sticky top-24 h-[calc(100vh-8rem)] pl-6 pr-4">
                <SidebarContent sidebar={sidebar} pathname={pathname} />
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0 px-4 md:px-8 lg:px-12">
                {/* Mobile Navigation Bar */}
                <div className="lg:hidden flex items-center gap-2 mb-6 -mx-4 px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border-y border-neutral-200 dark:border-neutral-800 sticky top-20 z-30">
                    {/* Mobile Nav Toggle */}
                    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                        <SheetTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mobile-nav-button flex items-center gap-2 flex-1 justify-start bg-white dark:bg-black border-neutral-300 dark:border-neutral-700 text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
                                style={{ transitionProperty: 'background-color, border-color', transitionDuration: '150ms', transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
                            >
                                <Menu className="w-4 h-4" />
                                <span className="text-sm">Sections</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-80 p-0 bg-white dark:bg-black border-r border-neutral-200 dark:border-neutral-800">
                            <SheetHeader className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                                <SheetTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                                    <FolderOpen className="w-4 h-4" />
                                    Documentation Sections
                                </SheetTitle>
                            </SheetHeader>
                            <ScrollArea className="h-[calc(100vh-5rem)] p-4">
                                <SidebarContent
                                    sidebar={sidebar}
                                    pathname={pathname}
                                    onItemClick={() => setMobileNavOpen(false)}
                                />
                            </ScrollArea>
                        </SheetContent>
                    </Sheet>

                    {/* Mobile TOC Toggle */}
                    {toc && toc.length > 0 && (
                        <Sheet open={mobileTocOpen} onOpenChange={setMobileTocOpen}>
                            <SheetTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mobile-nav-button flex items-center gap-2 flex-1 justify-start bg-white dark:bg-black border-neutral-300 dark:border-neutral-700 text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
                                    style={{ transitionProperty: 'background-color, border-color', transitionDuration: '150ms', transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                    <span className="text-sm">On This Page</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-80 p-0 bg-white dark:bg-black border-l border-neutral-200 dark:border-neutral-800">
                                <SheetHeader className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                                    <SheetTitle className="text-sm font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                                        On This Page
                                    </SheetTitle>
                                </SheetHeader>
                                <ScrollArea className="h-[calc(100vh-5rem)] p-4">
                                    <TocContent
                                        toc={toc}
                                        activeSectionIndex={activeSectionIndex}
                                        onItemClick={() => setMobileTocOpen(false)}
                                    />
                                </ScrollArea>
                            </SheetContent>
                        </Sheet>
                    )}
                </div>

                <div className="max-w-3xl mx-auto">
                    {children}
                </div>
            </main>

            {/* Desktop Table of Contents (Right Sidebar) */}
            {toc && toc.length > 0 && (
                <aside className="hidden xl:block w-64 sticky top-24 h-[calc(100vh-8rem)] pr-6">
                    <div className="h-full p-4 flex flex-col">
                        <h2 className="mb-4 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest flex items-center gap-2 flex-shrink-0">
                            On This Page
                        </h2>
                        <ScrollArea className="flex-1 max-h-[calc(100vh-12rem)]">
                            <TocContent
                                toc={toc}
                                activeSectionIndex={activeSectionIndex}
                            />
                        </ScrollArea>
                    </div>
                </aside>
            )}
        </div>
    );
}

// Sidebar Content Component
function SidebarContent({
    sidebar,
    pathname,
    onItemClick
}: {
    sidebar: DocSection[];
    pathname: string;
    onItemClick?: () => void;
}) {
    return (
        <div className="h-full overflow-hidden">
            <div className="p-4 hidden lg:block">
                <h2 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                    <FolderOpen className="w-3 h-3" />
                    Sections
                </h2>
            </div>
            <ScrollArea className="h-full lg:h-[calc(100%-3rem)] p-4">
                <div className="space-y-6">
                    {sidebar.map((section) => (
                        <div key={section.title}>
                            <h3 className="mb-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest pl-2">
                                {section.title}
                            </h3>
                            <div className="space-y-1">
                                {section.items.map((item) => {
                                    const href = `/docs/${item.slug}`;
                                    const isActive = pathname === href;

                                    return (
                                        <Link
                                            key={item.slug}
                                            href={href}
                                            onClick={onItemClick}
                                            className={cn(
                                                "group flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-200 cursor-pointer",
                                                isActive
                                                    ? "bg-black/10 dark:bg-white/10 text-black dark:text-white font-medium"
                                                    : "text-neutral-500 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white"
                                            )}
                                        >
                                            <span>
                                                {item.title}
                                            </span>
                                            {isActive && (
                                                <motion.div
                                                    layoutId="sidebar-active"
                                                    className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white"
                                                />
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}

// Table of Contents Component
function TocContent({
    toc,
    activeSectionIndex,
    onItemClick
}: {
    toc: TocItem[];
    activeSectionIndex: number;
    onItemClick?: () => void;
}) {
    const navRef = React.useRef<HTMLElement>(null);

    // Auto-scroll the sidebar to keep active item in view
    React.useEffect(() => {
        if (activeSectionIndex >= 0 && navRef.current) {
            const activeLink = navRef.current.children[activeSectionIndex] as HTMLElement;
            if (activeLink) {
                activeLink.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                });
            }
        }
    }, [activeSectionIndex]);

    return (
        <nav ref={navRef} className="space-y-1 relative border-l border-neutral-200 dark:border-neutral-800 pl-4">
            {toc.map((item, index) => {
                const isActive = activeSectionIndex === index;
                return (
                    <a
                        key={`${item.url}-${index}`}
                        href={item.url}
                        onClick={(e) => {
                            e.preventDefault();
                            onItemClick?.();
                            const target = document.querySelector(item.url);
                            if (target) {
                                target.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                        }}
                        className={cn(
                            "block text-sm py-1.5 transition-all duration-200 scroll-smooth border-l-2 -ml-[17px] pl-4 cursor-pointer",
                            isActive
                                ? "text-black dark:text-white border-black dark:border-white font-medium"
                                : "text-neutral-500 border-transparent hover:text-black dark:hover:text-white hover:border-neutral-400 dark:hover:border-neutral-600"
                        )}
                    >
                        {item.title}
                    </a>
                );
            })}
        </nav>
    );
}
