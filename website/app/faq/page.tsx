"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  HelpCircle,
  Download,
  Shield,
  Code,
  MessageCircle,
  ChevronDown,
  FolderOpen,
  Menu
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";

const faqCategories = [
  {
    id: "general",
    title: "General",
    icon: HelpCircle,
    questions: [
      {
        q: "What is Guardian?",
        a: "Guardian is a desktop governance application that helps engineering teams maintain code quality and security standards. It provides real-time monitoring of a selected workspace, architecture and quality audits, and an AI assistant (Guru) that can explain findings and suggest fixes."
      },
      {
        q: "Who is Guardian for?",
        a: "Guardian is designed for engineering teams of all sizes who want to enforce code quality standards without slowing down development. Whether you're a solo developer, a startup, or an enterprise team, Guardian scales to your needs. It's particularly valuable for teams working with sensitive codebases or those needing to maintain strict compliance standards."
      },
      {
        q: "Is Guardian open source?",
        a: "This repository is licensed under MIT. If you are using a fork or a packaged distribution, check the LICENSE file shipped with that build for the definitive terms."
      },
      {
        q: "What platforms does Guardian support?",
        a: "Guardian is available for macOS (Intel & Apple Silicon), Windows (64-bit), and Linux (AppImage and deb packages). We automatically detect your operating system and provide the appropriate installer."
      }
    ]
  },
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Download,
    questions: [
      {
        q: "How do I install Guardian?",
        a: "Simply visit our download page and click the download button. We automatically detect your operating system and provide the best installer for your platform. After downloading, run the installer and Guardian will guide you through the initial setup."
      },
      {
        q: "What are the system requirements?",
        a: "Guardian is designed to be lightweight. Typical requirements: macOS 12+, Windows 10+, or a recent Linux distribution. At least 4GB RAM and ~500MB free disk space. Internet access is required if you enable cloud AI providers or in-app update checks."
      },
      {
        q: "How do I configure Guardian for my project?",
        a: "After installation, select a local workspace folder. Configure your AI provider settings in Settings, then start monitoring to scan and review findings. Documentation covers the main workflows and configuration options."
      },
      {
        q: "Can I use Guardian with multiple projects?",
        a: "Guardian works with one active workspace at a time. You can switch between projects by selecting a different folder; Guardian will reset the monitoring state and load the new workspace context."
      }
    ]
  },
  {
    id: "security",
    title: "Security & Privacy",
    icon: Shield,
    questions: [
      {
        q: "How does Guardian handle my code?",
        a: "Guardian analyzes your workspace locally. If you configure a cloud AI provider, the app will send selected context to that provider to answer questions or generate suggestions. API keys are stored using OS secure storage where available."
      },
      {
        q: "Is my data secure with Guardian?",
        a: "Guardian is designed to keep analysis local by default. When you enable integrations (AI providers, web search), the app will make outbound requests to those third-party services you configure. Guardian does not require a Guardian-managed backend service."
      },
      {
        q: "What authentication providers are supported?",
        a: "Guardian supports device authorization for identity verification. For AI analysis, it supports multiple providers including OpenAI, Anthropic, Google Gemini, hosted models, and local models via Ollama."
      },
      {
        q: "Does Guardian comply with security standards?",
        a: "Guardian applies security-oriented best practices (local-first scanning, least-privilege configs, signed update capability). Exact guarantees depend on your deployment setup and which integrations you enable."
      }
    ]
  },
  {
    id: "integration",
    title: "Integration",
    icon: Code,
    questions: [
      {
        q: "What git providers does Guardian support?",
        a: "Guardian works with any local Git repository, regardless of where it is hosted (GitLab, Bitbucket, Azure DevOps, etc.). You simply open your local repository folder in Guardian."
      },
      {
        q: "Does Guardian work with my existing tools?",
        a: "Guardian is designed to complement your existing toolchain. It runs alongside your IDE and other tools, providing real-time governance and auditing without interfering with your workflow."
      },
      {
        q: "Can I write custom rules?",
        a: "Guardian enforces a combination of built-in checks and workspace rule sets. Today, extensibility is primarily configuration and rule-file based (not a visual rule builder)."
      }
    ]
  },
  {
    id: "support",
    title: "Support & Community",
    icon: MessageCircle,
    questions: [
      {
        q: "How can I get help with Guardian?",
        a: "Start with the documentation on this website. For issues and feature requests, use the repository issue tracker for the build you are using."
      },
      {
        q: "Where can I report bugs or request features?",
        a: "Use the repository issue tracker for the build you are using, and include reproduction steps plus logs/screenshots where possible."
      },
      {
        q: "How often is Guardian updated?",
        a: "Updates are delivered through the in-app updater when enabled, and new releases may also be available via the distribution repository."
      },
      {
        q: "Can I contribute to Guardian?",
        a: "Contributions depend on the repository you are working in. In general, bug reports and documentation improvements are always helpful."
      }
    ]
  }
];

export default function FAQPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="mx-auto max-w-6xl px-4 pt-28 pb-20">
        <section className="mb-10">
          <p className="text-xs font-semibold tracking-[0.24em] uppercase text-neutral-500 dark:text-neutral-400">
            Support Center
          </p>
          <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg text-neutral-600 dark:text-neutral-400">
            Everything you need to know about Guardian. Can&apos;t find what you&apos;re looking for?
            Feel free to <Link href="/contact" className="text-neutral-950 dark:text-white underline decoration-neutral-300 hover:decoration-neutral-900">contact us</Link>.
          </p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-10 overflow-x-hidden">
          <aside className="hidden lg:block">
            <div className="fixed top-28 w-60 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/50 backdrop-blur p-5 max-h-[calc(100vh-10rem)] overflow-y-auto">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                <FolderOpen className="h-4 w-4" aria-hidden="true" />
                Categories
              </div>
              <div className="mt-4 space-y-2">
                {faqCategories.filter(c => c.id !== "pricing").map((cat) => (
                  <a
                    key={cat.id}
                    href={`#${cat.id}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                  >
                    <cat.icon className="h-4 w-4" aria-hidden="true" />
                    <span>{cat.title}</span>
                  </a>
                ))}
              </div>
            </div>
          </aside>

          <main className="lg:ml-0 relative">
            {/* Mobile Navigation Bar - Fixed position like docs */}
            <div className="lg:hidden fixed left-0 right-0 top-20 z-40 px-4 py-3 bg-neutral-50/95 dark:bg-neutral-900/95 border-y border-neutral-200 dark:border-neutral-800 backdrop-blur-sm">
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 w-full justify-start bg-white/90 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100/80 dark:hover:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                  >
                    <Menu className="w-4 h-4" aria-hidden="true" />
                    <span className="text-sm">Browse FAQ Sections</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-0 bg-white dark:bg-black border-r border-neutral-200 dark:border-neutral-800">
                  <SheetHeader className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                    <SheetTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                      <FolderOpen className="w-4 h-4" aria-hidden="true" />
                      FAQ Sections
                    </SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(100vh-5rem)] p-4">
                    <div className="space-y-2">
                      {faqCategories.filter(c => c.id !== "pricing").map((cat) => (
                        <a
                          key={cat.id}
                          href={`#${cat.id}`}
                          onClick={() => setMobileNavOpen(false)}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                        >
                          <cat.icon className="h-4 w-4" aria-hidden="true" />
                          <span>{cat.title}</span>
                        </a>
                      ))}
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            </div>

            {/* Content with padding for fixed mobile nav */}
            <div className="space-y-12 lg:pt-0 pt-16">
              {faqCategories.filter(c => c.id !== "pricing").map((category) => (
                <section key={category.id} id={category.id} className="scroll-mt-32">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-neutral-900 dark:bg-white flex items-center justify-center">
                      <category.icon className="w-5 h-5 text-white dark:text-black" />
                    </div>
                    <h2 className="text-2xl font-semibold text-neutral-950 dark:text-white">
                      {category.title}
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {category.questions.map((item, idx) => (
                      <details
                        key={idx}
                        className="group rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-950/60 backdrop-blur"
                      >
                        <summary className="flex items-center justify-between p-6 cursor-pointer list-none hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                          <span className="font-semibold text-neutral-950 dark:text-white pr-4">{item.q}</span>
                          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center group-open:bg-neutral-900 dark:group-open:bg-white transition-colors">
                            <ChevronDown className="w-5 h-5 text-neutral-600 dark:text-neutral-400 group-open:text-white dark:group-open:text-black group-open:rotate-180 transition-all" />
                          </span>
                        </summary>
                        <div className="px-6 pb-6 text-neutral-600 dark:text-neutral-400 leading-relaxed">
                          {item.a}
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <section className="mt-16">
              <div className="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 p-8 sm:p-10">
                <h2 className="text-2xl sm:text-3xl font-semibold text-neutral-950 dark:text-white">Still have questions?</h2>
                <p className="mt-3 text-neutral-600 dark:text-neutral-400 max-w-2xl">
                  Can&apos;t find what you&apos;re looking for? Our team is here to help. Reach out and we&apos;ll get back to you as soon as possible.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-4">
                  <Button asChild size="lg" className="rounded-full px-8 bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200">
                    <Link href="/contact">Contact Support</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="rounded-full px-8 border-neutral-300 text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800">
                    <Link href="/docs">Browse Documentation</Link>
                  </Button>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
