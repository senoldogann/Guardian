"use client";

import { useState, useRef, type ChangeEvent, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Send,
    Paperclip,
    X,
    AlertCircle,
    Bug,
    Lightbulb,
    Handshake,
    MessageSquare,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SUBJECT_OPTIONS = [
    { id: "improvement", label: "Suggestion / Improvement", icon: Lightbulb, subjectPrefix: "Suggestion: " },
    { id: "bug", label: "Bug Report", icon: Bug, subjectPrefix: "Bug Report: " },
    { id: "collab", label: "Collaboration / Business", icon: Handshake, subjectPrefix: "Business: " },
    { id: "other", label: "General Inquiry", icon: MessageSquare, subjectPrefix: "Inquiry: " },
];

export function ContactForm() {
    const [selectedTopic, setSelectedTopic] = useState<string>(SUBJECT_OPTIONS[0].id);
    const [message, setMessage] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [showFileWarning, setShowFileWarning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSending(true);

        // Mimic loading for better UX
        await new Promise(resolve => setTimeout(resolve, 800));

        const topic = SUBJECT_OPTIONS.find(t => t.id === selectedTopic);
        const subject = `${topic?.subjectPrefix} Guardian Feedback`;

        // Prepare mailto link
        const mailtoLink = `mailto:contact@senoldogan.dev?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;

        // Open mail client
        window.location.href = mailtoLink;

        // Show warning if files were selected
        if (files.length > 0) {
            setShowFileWarning(true);
        }

        setIsSending(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
            {/* Topic Selection */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    What can we help you with?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SUBJECT_OPTIONS.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => setSelectedTopic(option.id)}
                            className={cn(
                                "flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200",
                                selectedTopic === option.id
                                    ? "border-black dark:border-white bg-black/5 dark:bg-white/5 ring-1 ring-black dark:ring-white"
                                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-black"
                            )}
                        >
                            <div className={cn(
                                "p-2 rounded-lg",
                                selectedTopic === option.id
                                    ? "bg-black text-white dark:bg-white dark:text-black"
                                    : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400"
                            )}>
                                <option.icon className="w-5 h-5" />
                            </div>
                            <span className={cn(
                                "font-medium text-sm",
                                selectedTopic === option.id
                                    ? "text-zinc-900 dark:text-zinc-100"
                                    : "text-zinc-600 dark:text-zinc-400"
                            )}>
                                {option.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Message Input */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Your Message
                </label>
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={6}
                    placeholder="Tell us more about it..."
                    className="w-full p-4 rounded-xl bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all resize-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                />
            </div>

            {/* File Attachment */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        Attachments
                    </label>
                    <span className="text-xs text-zinc-500">
                        Optional
                    </span>
                </div>

                <div className="flex flex-wrap gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-2 border-dashed hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                    >
                        <Paperclip className="w-4 h-4" />
                        Attach Files
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    <AnimatePresence>
                        {files.map((file, index) => (
                            <motion.div
                                key={`${file.name}-${index}`}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                            >
                                <span className="text-xs font-medium truncate max-w-[150px]">
                                    {file.name}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => removeFile(index)}
                                    className="text-zinc-400 hover:text-red-500 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Technical Limitation Note */}
                <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Browser security prevents automatic file attachment. You&apos;ll need to drag files into the email manually.
                </p>
            </div>

            {/* Submit Button */}
            <Button
                type="submit"
                size="lg"
                disabled={!message.trim() || isSending}
                className="w-full h-12 text-base font-semibold gap-2 bg-black text-white dark:bg-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all rounded-xl"
            >
                {isSending ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Opening Mail Client...
                    </>
                ) : (
                    <>
                        <Send className="w-5 h-5" />
                        Send Message
                    </>
                )}
            </Button>

            {/* Success/Warning Toast */}
            <AnimatePresence>
                {showFileWarning && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 flex items-start gap-3"
                    >
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                                Almost done!
                            </h4>
                            <p className="text-sm text-amber-700 dark:text-amber-400/90 leading-relaxed">
                                Your email client has been opened with the message.
                                <span className="font-semibold block mt-1">
                                    Please drag your selected {files.length} file(s) into the email manually.
                                </span>
                            </p>
                        </div>
                        <button
                            onClick={() => setShowFileWarning(false)}
                            className="ml-auto text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </form>
    );
}
