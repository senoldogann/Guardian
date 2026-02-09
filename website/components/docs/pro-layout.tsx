"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FolderOpen, ChevronRight, Menu } from "lucide-react";

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

    // Scroll spy using IntersectionObserver to avoid scroll-jank

    React.useEffect(() => {
        if (!toc || toc.length === 0) return;

        const content = document.querySelector<HTMLElement>("[data-docs-body]");
        if (!content) return;

        const headingElements = toc
            .map((item) => document.getElementById(item.url.replace("#", "")))
            .filter((el): el is HTMLElement => Boolean(el));

        if (headingElements.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                let closestIndex = -1;
                let minTop = Number.POSITIVE_INFINITY;

                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    const index = headingElements.indexOf(entry.target as HTMLElement);
                    if (index < 0) return;

                    const top = Math.abs(entry.boundingClientRect.top);
                    if (top < minTop) {
                        minTop = top;
                        closestIndex = index;
                    }
                });

                if (closestIndex >= 0) {
                    setActiveSectionIndex((prev) => (prev === closestIndex ? prev : closestIndex));
                }
            },
            {
                root: null,
                rootMargin: "-120px 0px -70% 0px",
                threshold: [0.1, 0.5, 1]
            }
        );

        headingElements.forEach((heading) => observer.observe(heading));

        return () => observer.disconnect();
    }, [toc]);

    // Handle sticky positioning to stop at footer
    React.useEffect(() => {
        const handleScroll = () => {
            const footer = document.querySelector('footer');
            const sidebars = document.querySelectorAll('aside');

            if (!footer) return;

            const footerRect = footer.getBoundingClientRect();
            const windowHeight = window.innerHeight;

            sidebars.forEach(sidebar => {
                const sidebarContent = sidebar.firstElementChild as HTMLElement;
                if (!sidebarContent) return;

                // Calculate distance to footer
                const distanceToFooter = footerRect.top - windowHeight;

                // If footer is entering viewport or we're past it
                if (distanceToFooter < 0) {
                    sidebarContent.style.maxHeight = `calc(100vh - 8rem - ${Math.abs(distanceToFooter)}px)`;
                } else {
                    sidebarContent.style.maxHeight = 'calc(100vh - 8rem)';
                }
            });
        };

        window.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);
        };
    }, []);

    return (
        <div className="flex w-full min-h-screen pt-24 pb-12 bg-white dark:bg-black transition-colors duration-300 overflow-x-hidden relative">
            {/* Desktop Sidebar (IDE Style) - Sticky, scrolls with content */}
            <aside className="hidden lg:block w-72 pl-6 pr-4 self-start">
                <div className="sticky top-24 w-60 max-h-[calc(100vh-8rem)] overflow-y-auto transition-all duration-200">
                    <SidebarContent sidebar={sidebar} pathname={pathname} />
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0 px-4 md:px-8 lg:px-12 lg:ml-72" data-docs-body>
                {/* Mobile Navigation Bar - Fixed position */}
                <div className="lg:hidden fixed left-4 right-4 top-24 z-40 flex items-center gap-3">
                    {/* Mobile Nav Toggle */}
                    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                        <SheetTrigger asChild>
                            <Button
                                variant="outline"
                                className="flex-1 h-10 gap-2 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm hover:bg-white dark:hover:bg-neutral-900 rounded-xl"
                            >
                                <Menu className="w-4 h-4" aria-hidden="true" />
                                <span className="text-sm font-medium">Sections</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-80 p-0 bg-white dark:bg-black border-r border-neutral-200 dark:border-neutral-800">
                            <SheetHeader className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                                <SheetTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                                    <FolderOpen className="w-4 h-4" aria-hidden="true" />
                                    Documentation
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
                                    className="flex-1 h-10 gap-2 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm hover:bg-white dark:hover:bg-neutral-900 rounded-xl"
                                >
                                    <span className="text-sm font-medium">On This Page</span>
                                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-80 p-0 bg-white dark:bg-black border-l border-neutral-200 dark:border-neutral-800">
                                <SheetHeader className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
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

                {/* Content with padding for fixed mobile nav */}
                <div className="max-w-3xl mx-auto lg:pt-0 pt-16">
                    {children}
                </div>
            </main>

            {/* Desktop Table of Contents (Right Sidebar) - Sticky, scrolls with content */}
            {toc && toc.length > 0 && (
                <aside className="hidden xl:block w-64 pr-6 self-start">
                    <div className="sticky top-24 w-56 max-h-[calc(100vh-8rem)] p-4 flex flex-col overflow-y-auto transition-all duration-200">
                        <h2 className="mb-4 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest flex items-center gap-2 flex-shrink-0">
                            On This Page
                        </h2>
                        <TocContent
                            toc={toc}
                            activeSectionIndex={activeSectionIndex}
                        />
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
        <div className="h-full flex flex-col">
            <div className="p-4 hidden lg:block flex-shrink-0">
                <h2 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                    <FolderOpen className="w-3 h-3" aria-hidden="true" />
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

    // Auto-scroll the TOC container to keep active item in view
    React.useEffect(() => {
        if (activeSectionIndex < 0 || !navRef.current) return;

        const container = navRef.current.parentElement;
        if (!container) return;

        const activeLink = navRef.current.children[activeSectionIndex] as HTMLElement | undefined;
        if (!activeLink) return;

        const linkTop = activeLink.offsetTop;
        const linkBottom = linkTop + activeLink.offsetHeight;
        const viewTop = container.scrollTop;
        const viewBottom = viewTop + container.clientHeight;

        if (linkTop < viewTop) {
            container.scrollTop = Math.max(0, linkTop - 8);
        } else if (linkBottom > viewBottom) {
            container.scrollTop = linkBottom - container.clientHeight + 8;
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
                                const headerOffset = 100;
                                const elementPosition = target.getBoundingClientRect().top;
                                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                                window.scrollTo({
                                    top: offsetPosition,
                                    behavior: "smooth"
                                });
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
