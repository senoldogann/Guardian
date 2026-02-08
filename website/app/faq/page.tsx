import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  HelpCircle,
  Download,
  Shield,
  Code,
  MessageCircle,
  ChevronDown
} from "lucide-react";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about Guardian, installation, security, and pricing.",
};

const faqCategories = [
  {
    id: "general",
    title: "General",
    icon: HelpCircle,
    questions: [
      {
        q: "What is Guardian?",
        a: "Guardian is a desktop governance application that helps engineering teams maintain code quality and security standards. It provides real-time architecture auditing, AI-powered code analysis through Guru, secure identity management, and automated release governance—all in a native desktop experience."
      },
      {
        q: "Who is Guardian for?",
        a: "Guardian is designed for engineering teams of all sizes who want to enforce code quality standards without slowing down development. Whether you're a solo developer, a startup, or an enterprise team, Guardian scales to your needs. It's particularly valuable for teams working with sensitive codebases or those needing to maintain strict compliance standards."
      },
      {
        q: "Is Guardian open source?",
        a: "Guardian follows an open-core model. The core application and many features are freely available. While the complete source code isn't fully open source, we believe in transparency and building with the community. Future enterprise features may include additional proprietary components."
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
        a: "Guardian is designed to be lightweight. Minimum requirements: macOS 10.15+, Windows 10+, or Ubuntu 20.04+ (or equivalent Linux distribution). At least 4GB RAM and 500MB free disk space. An internet connection is required for initial setup and updates."
      },
      {
        q: "How do I configure Guardian for my project?",
        a: "After installation, Guardian walks you through a simple setup wizard. You'll connect your repository, configure your quality rules, and optionally set up authentication providers. Our documentation provides detailed guides for each step."
      },
      {
        q: "Can I use Guardian with multiple projects?",
        a: "Yes! Guardian supports multiple projects simultaneously. You can switch between projects from the main interface, and each project can have its own configuration, rules, and team settings."
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
        a: "Guardian analyzes your code locally on your machine. Your source code never leaves your device unless you explicitly configure cloud integrations (like OpenAI). We use platform-native secure storage for all credentials and sensitive data."
      },
      {
        q: "Is my data secure with Guardian?",
        a: "Absolutely. Guardian uses platform-native secure storage (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux) for all sensitive data. We never transmit your code or credentials to our servers. All analysis happens locally."
      },
      {
        q: "What authentication providers are supported?",
        a: "Guardian currently supports GitHub for secure identity verification. For AI analysis, we support OpenAI, Anthropic, Google Gemini, and local models via Ollama."
      },
      {
        q: "Does Guardian comply with security standards?",
        a: "Guardian is built with security best practices including signed distribution artifacts, secure update mechanisms, and local-only code analysis."
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
        a: "Guardian works with any local Git repository, regardless of where it is hosted (GitHub, GitLab, Bitbucket, etc.). You simply open your local repository folder in Guardian."
      },
      {
        q: "Does Guardian work with my existing tools?",
        a: "Guardian is designed to complement your existing toolchain. It runs alongside your IDE and other tools, providing real-time governance and auditing without interfering with your workflow."
      },
      {
        q: "Can I write custom rules?",
        a: "Yes, Guardian supports custom rule creation. You can write rules in JavaScript/TypeScript or use our visual rule builder to enforce specific patterns and standards for your team."
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
        a: "You can access our documentation, GitHub discussions, and community Discord for support. We are building a community of developers passionate about code quality."
      },
      {
        q: "Where can I report bugs or request features?",
        a: "We welcome feedback! Please use our GitHub Issues page for bug reports and feature requests. We actively monitor and respond to community input."
      },
      {
        q: "How often is Guardian updated?",
        a: "We release updates regularly. All updates are delivered through our secure in-app update system."
      },
      {
        q: "Can I contribute to Guardian?",
        a: "While Guardian isn't fully open source, we welcome community contributions through feedback, bug reports, feature suggestions, and documentation improvements."
      }
    ]
  }
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Hero */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/5 dark:bg-white/5 mb-8">
            <HelpCircle className="w-4 h-4 text-black dark:text-white" />
            <span className="text-sm font-medium text-black dark:text-white">Support Center</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-black dark:text-white mb-6">
            Frequently Asked Questions
          </h1>
          <p className="text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Everything you need to know about Guardian. Can&apos;t find what you&apos;re looking for?
            Feel free to <Link href="/contact" className="text-black dark:text-white underline hover:no-underline">contact us</Link>.
          </p>
        </div>
      </section>

      {/* Quick Links */}
      <section className="pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {faqCategories.filter(c => c.id !== 'pricing').map((cat) => (
              <a
                key={cat.id}
                href={`#${cat.id}`}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-black dark:hover:border-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-center"
              >
                <cat.icon className="w-6 h-6 text-black dark:text-white" />
                <span className="text-sm font-medium text-black dark:text-white">{cat.title}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Categories */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-4xl mx-auto space-y-16">
          {faqCategories.filter(c => c.id !== 'pricing').map((category) => (
            <div key={category.id} id={category.id} className="scroll-mt-32">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-black dark:bg-white flex items-center justify-center">
                  <category.icon className="w-5 h-5 text-white dark:text-black" />
                </div>
                <h2 className="text-2xl font-bold text-black dark:text-white">{category.title}</h2>
              </div>
              <div className="space-y-4">
                {category.questions.map((item, idx) => (
                  <details
                    key={idx}
                    className="group bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                  >
                    <summary className="flex items-center justify-between p-6 cursor-pointer list-none hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                      <span className="font-semibold text-black dark:text-white pr-4">{item.q}</span>
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-open:bg-black dark:group-open:bg-white transition-colors">
                        <ChevronDown className="w-5 h-5 text-zinc-600 dark:text-zinc-400 group-open:text-white dark:group-open:text-black group-open:rotate-180 transition-all" />
                      </span>
                    </summary>
                    <div className="px-6 pb-6 text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {item.a}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Still Have Questions */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-zinc-50 dark:bg-zinc-900 rounded-3xl p-8 lg:p-12 text-center border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-4">
              Still have questions?
            </h2>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8 max-w-2xl mx-auto">
              Can&apos;t find what you&apos;re looking for? Our team is here to help.
              Reach out and we&apos;ll get back to you as soon as possible.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="rounded-full px-8 bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                <Link href="/contact">
                  Contact Support
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-8 border-zinc-300 text-black hover:bg-zinc-100 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800">
                <Link href="/docs">
                  Browse Documentation
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
