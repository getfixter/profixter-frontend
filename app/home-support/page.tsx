"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpIcon,
  ClipboardDocumentIcon,
  DocumentTextIcon,
  PhotoIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Header from "@/app/components/sections/Header";
import { trackEvent } from "@/lib/analytics";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: string[];
  error?: boolean;
};

type FilePreview = {
  file: File;
  name: string;
  type: string;
  url?: string;
};

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi, I am Profixter AI. Tell me what is happening at home, upload a photo or PDF, or share a quote or agreement. I will help you think through the safest, most practical next step.",
};

const STARTERS = [
  "What should I do about this leak?",
  "Review this contractor quote",
  "What materials do I need?",
  "Is this dangerous?",
  "Should I DIY this or hire a pro?",
  "Plan seasonal maintenance",
];

const NEXT_STEPS = {
  handyman: {
    label: "Book Handyman",
    href: "/book",
  },
  membership: {
    label: "Become a Member",
    href: "/membership/plans",
  },
  renovation: {
    label: "Request Renovation Estimate",
    href: "/projects#estimate",
  },
} as const;

function getMessageActions(text: string) {
  const lower = text.toLowerCase();
  const actions: Array<(typeof NEXT_STEPS)[keyof typeof NEXT_STEPS]> = [];

  if (
    /\b(renovation|renovate|remodel|roof|roofing|siding|kitchen|bathroom|addition|construction|contractor quote|agreement|estimate)\b/.test(
      lower
    )
  ) {
    actions.push(NEXT_STEPS.renovation);
  }

  if (
    /\b(maintenance|seasonal|recurring|ongoing|to-do list|task list|multiple|regular|membership|member)\b/.test(
      lower
    )
  ) {
    actions.push(NEXT_STEPS.membership);
  }

  if (
    /\b(handyman|small fix|minor repair|faucet|fixture|caulk|drywall|mount|shelf|mirror|door|patch|paint touch-up)\b/.test(
      lower
    )
  ) {
    actions.push(NEXT_STEPS.handyman);
  }

  return actions.slice(0, 2);
}

function InlineText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*)|\[([^\]]+)\]\((https?:\/\/[^)]+|\/[^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[2]) {
      nodes.push(
        <strong key={`${match.index}-bold`} className="font-black text-inherit">
          {match[2]}
        </strong>
      );
    } else if (match[3] && match[4]) {
      nodes.push(
        <Link
          key={`${match.index}-link`}
          href={match[4]}
          className="font-black text-[#2563EB] underline decoration-[#AFC5F8] decoration-2 underline-offset-4"
        >
          {match[3]}
        </Link>
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return <>{nodes}</>;
}

function MessageContent({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-2.5">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-1" />;
        if (/^#{1,3}\s+/.test(trimmed)) {
          return (
            <p key={index} className="pt-1 text-[15px] font-black text-[#0B1628]">
              <InlineText text={trimmed.replace(/^#{1,3}\s+/, "")} />
            </p>
          );
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          const number = trimmed.match(/^(\d+)\.\s+/)?.[1] || `${index + 1}`;
          return (
            <div key={index} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#EAF1FF] text-xs font-black text-[#2563EB]">
                {number}
              </span>
              <span>
                <InlineText text={trimmed.replace(/^\d+\.\s+/, "")} />
              </span>
            </div>
          );
        }
        if (/^[-*]\s+/.test(trimmed)) {
          return (
            <div key={index} className="flex gap-3">
              <span className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2563EB]" />
              <span>
                <InlineText text={trimmed.replace(/^[-*]\s+/, "")} />
              </span>
            </div>
          );
        }
        return (
          <p key={index}>
            <InlineText text={line} />
          </p>
        );
      })}
    </div>
  );
}

export default function HomeSupportPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [fileNotice, setFileNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const filesRef = useRef<FilePreview[]>([]);
  const hasUserMessages = messages.some((message) => message.role === "user");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((item) => {
        if (item.url) URL.revokeObjectURL(item.url);
      });
    };
  }, []);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFileNotice("");
    const incoming = Array.from(list);
    const accepted = incoming
      .filter((file) => {
        const type = file.type.toLowerCase();
        return type.startsWith("image/") || type === "application/pdf";
      })
      .map((file) => ({
        file,
        name: file.name,
        type: file.type,
        url: file.type.toLowerCase().startsWith("image/") ? URL.createObjectURL(file) : undefined,
      }));

    const willExceedLimit = files.length + accepted.length > 4;

    if (willExceedLimit) {
      setFileNotice("Up to 4 files can be reviewed at once.");
    } else if (accepted.length < incoming.length) {
      setFileNotice("Profixter AI accepts images and PDFs. Unsupported files were skipped.");
    }

    if (accepted.length) {
      trackEvent("home_support_file_uploaded", {
        count: accepted.length,
        hasPdf: accepted.some((item) => item.type.toLowerCase() === "application/pdf"),
        hasImage: accepted.some((item) => item.type.toLowerCase().startsWith("image/")),
      });
    }

    setFiles((current) => {
      const combined = [...current, ...accepted];
      const next = combined.slice(0, 4);
      combined.slice(4).forEach((item) => {
        if (item.url) URL.revokeObjectURL(item.url);
      });
      return next;
    });
  }

  function removeFile(index: number) {
    setFiles((current) => {
      const item = current[index];
      if (item?.url) URL.revokeObjectURL(item.url);
      return current.filter((_, i) => i !== index);
    });
    setFileNotice("");
  }

  function newChat() {
    files.forEach((item) => {
      if (item.url) URL.revokeObjectURL(item.url);
    });
    setFiles([]);
    setFileNotice("");
    setInput("");
    setMessages([WELCOME]);
    trackEvent("home_support_new_chat", { page: "/home-support" });
  }

  async function copyMessage(message: Message) {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(""), 1200);
  }

  async function sendMessage(text?: string) {
    const value = (text ?? input).trim();
    if (!value || sending) return;

    const attachedFiles = files;
    const fileNames = attachedFiles.map((item) => item.name);
    const recentHistory = messages
      .filter((message) => message.id !== "welcome" && !message.error)
      .slice(-8)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));
    trackEvent("home_support_message_sent", {
      hasFiles: attachedFiles.length > 0,
      fileCount: attachedFiles.length,
      suggestedPrompt: text ? true : false,
    });

    setMessages((current) => [
      ...current,
      {
        id: `u-${Date.now()}`,
        role: "user",
        content: value,
        files: fileNames,
      },
    ]);
    setInput("");
    setSending(true);

    const assistantId = `a-${Date.now()}`;
    let reply = "";

    try {
      const formData = new FormData();
      formData.append("input", value);
      formData.append("history", JSON.stringify(recentHistory));
      attachedFiles.forEach((item) => formData.append("files", item.file));

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chatbot/home-support/message`,
        {
          method: "POST",
          body: formData,
        }
      );
      if (!response.ok) throw new Error("Home Support AI request failed");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        const lines = decoder
          .decode(chunk)
          .split("\n")
          .filter((line) => line.startsWith("data:"));
        for (const line of lines) {
          const data = JSON.parse(line.slice(5).trim());
          if (data.token) {
            reply += data.token;
            setMessages((current) => {
              const existing = current.find((message) => message.id === assistantId);
              if (existing) {
                return current.map((message) =>
                  message.id === assistantId ? { ...message, content: reply } : message
                );
              }
              return [
                ...current,
                { id: assistantId, role: "assistant", content: reply },
              ];
            });
          }
          if (data.error) throw new Error(data.error);
        }
      }

      attachedFiles.forEach((item) => {
        if (item.url) URL.revokeObjectURL(item.url);
      });
      setFiles([]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content:
            "I had trouble reviewing that. Try a shorter message, remove very large files, or call Profixter at 631-599-1363.",
          error: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F7F2] text-[#0B1628]">
      <Header />

      <section className="mx-auto flex min-h-[calc(100svh-76px)] w-full max-w-[1120px] flex-col px-3.5 pb-4 pt-2 sm:min-h-[calc(100svh-86px)] sm:px-6 sm:pb-5 sm:pt-4 lg:px-8">
        <div className={`flex flex-1 flex-col ${hasUserMessages ? "justify-start" : "justify-center"}`}>
          {!hasUserMessages && (
            <div className="mx-auto w-full max-w-[900px] pb-6 pt-5 text-center sm:pb-10 sm:pt-8">
              <h1 className="mx-auto max-w-[860px] text-[40px] font-black leading-[0.94] tracking-[-0.055em] text-[#071325] sm:text-[82px] sm:leading-[0.88] sm:tracking-[-0.07em] lg:text-[96px]">
                Your personal AI for your home.
              </h1>
              <p className="mx-auto mt-4 max-w-[610px] text-[15px] font-semibold leading-6 text-[#4B5870] sm:mt-6 sm:text-xl sm:leading-7">
                Upload a photo, quote, agreement, or ask what to do next.
              </p>
            </div>
          )}

          <section className="mx-auto flex w-full max-w-[980px] flex-1 flex-col">
            {hasUserMessages && (
              <div className="mb-3 flex items-center justify-between gap-3 pt-1 sm:mb-4 sm:pt-2">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6B7280] sm:text-[13px]">
                    Profixter AI
                  </div>
                  <h1 className="mt-1 text-[28px] font-black tracking-[-0.045em] text-[#071325] sm:text-[44px] sm:tracking-[-0.05em]">
                    Home answers.
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={newChat}
                  className="inline-flex h-10 flex-shrink-0 items-center gap-2 rounded-full bg-[#0B1628] px-3.5 text-xs font-black text-white transition hover:bg-[#17263D] sm:h-11 sm:px-4"
                >
                  <PlusIcon className="h-4 w-4" aria-hidden="true" />
                  New
                </button>
              </div>
            )}

            <div className={`${hasUserMessages ? "min-h-[42svh] flex-1 space-y-4 overflow-y-auto px-1 py-3 sm:space-y-5 sm:py-4" : "hidden"}`}>
              {messages
              .filter((message) => hasUserMessages || message.id !== "welcome")
              .map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[94%] rounded-[20px] px-3.5 py-3 text-[13px] leading-5 shadow-sm sm:max-w-[78%] sm:rounded-[24px] sm:px-4 sm:text-sm sm:leading-6 lg:max-w-[70%] ${
                      message.role === "user"
                        ? "bg-[#0B1628] text-white shadow-[0_12px_30px_rgba(9,22,43,0.18)]"
                        : message.error
                          ? "border border-red-200 bg-red-50 text-red-800"
                          : "border border-[#E4EBF5] bg-white text-[#243149]"
                    }`}
                  >
                    <MessageContent text={message.content} />
                    {!!message.files?.length && (
                      <div
                        className={`mt-3 rounded-[16px] px-3 py-2 text-xs font-semibold ${
                          message.role === "user"
                            ? "bg-white/15 text-white/85"
                            : "bg-[#F1F5FB] text-[#526078]"
                        }`}
                      >
                        Attached: {message.files.join(", ")}
                      </div>
                    )}
                    {message.role === "assistant" && !message.error && (
                      <>
                        <button
                          type="button"
                          onClick={() => copyMessage(message)}
                          className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#EEF4FF] px-3 py-1.5 text-xs font-black text-[#2563EB] transition hover:bg-[#E1ECFF]"
                        >
                          <ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />
                          {copiedId === message.id ? "Copied" : "Copy response"}
                        </button>
                        {getMessageActions(message.content).length > 0 ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#E4EBF5] pt-3">
                            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7C879A]">
                              Next step
                            </span>
                            {getMessageActions(message.content).map((action) => (
                              <Link
                                key={action.href}
                                href={action.href}
                                onClick={() =>
                                  trackEvent("home_support_recommendation_clicked", {
                                    label: action.label,
                                    href: action.href,
                                  })
                                }
                                className="rounded-full bg-[#0B1628] px-3 py-1.5 text-xs font-black text-white transition hover:bg-[#17263D]"
                              >
                                {action.label}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="inline-flex max-w-[92%] items-center gap-3 rounded-full bg-white px-3.5 py-2.5 text-[13px] font-semibold text-[#526078] shadow-sm sm:px-4 sm:py-3 sm:text-sm">
                  <span className="flex gap-1" aria-hidden="true">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#2563EB]" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#41A66A] [animation-delay:120ms]" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#E0A12A] [animation-delay:240ms]" />
                  </span>
                  Thinking through the safest next step...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {fileNotice && (
              <div className="mb-3 rounded-[18px] bg-[#FFF8EC] px-4 py-3 text-xs font-bold leading-5 text-[#965C09]">
                {fileNotice}
              </div>
            )}

            {files.length > 0 && (
              <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {files.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="group relative min-w-0 overflow-hidden rounded-[20px] bg-white p-2 text-left text-xs font-bold text-[#34435C] shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
                  >
                    {item.url ? (
                      <span
                        aria-hidden="true"
                        className="mb-2 block h-24 w-full rounded-[14px] bg-cover bg-center"
                        style={{ backgroundImage: `url(${item.url})` }}
                      />
                    ) : (
                      <div className="mb-2 flex h-24 items-center justify-center rounded-[14px] bg-white text-[#526078]">
                        <DocumentTextIcon className="h-8 w-8" aria-hidden="true" />
                      </div>
                    )}
                    <span className="block truncate pr-8">{item.name}</span>
                    <span className="mt-1 block text-[11px] font-semibold text-[#7C879A]">
                      Ready to review
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#34435C] shadow-sm transition hover:bg-[#EEF4FF]"
                      aria-label={`Remove ${item.name}`}
                    >
                      <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-[28px] bg-white p-1.5 shadow-[0_24px_70px_rgba(15,23,42,0.14)] sm:rounded-[34px] sm:p-2 sm:shadow-[0_34px_100px_rgba(15,23,42,0.16)]">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={3}
                placeholder="Ask anything about your house..."
                className="min-h-[78px] w-full resize-none bg-transparent px-4 py-4 text-[16px] font-medium leading-6 text-[#0B1628] outline-none placeholder:text-[#8A94A6] sm:min-h-[92px] sm:px-5 sm:py-5 sm:text-[21px] sm:leading-7"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2 px-1.5 pb-1.5 sm:px-2 sm:pb-2">
                <div className="flex items-center gap-2">
                  <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-[#F5F6F8] px-3 text-xs font-black text-[#34435C] transition hover:bg-[#ECEFF3] sm:h-11 sm:gap-2 sm:px-4 sm:text-sm">
                    <PhotoIcon className="h-4 w-4" aria-hidden="true" />
                    Photo
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => addFiles(event.target.files)}
                      className="hidden"
                    />
                  </label>
                  <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-[#F5F6F8] px-3 text-xs font-black text-[#34435C] transition hover:bg-[#ECEFF3] sm:h-11 sm:gap-2 sm:px-4 sm:text-sm">
                    <DocumentTextIcon className="h-4 w-4" aria-hidden="true" />
                    PDF
                    <input
                      type="file"
                      accept="application/pdf"
                      multiple
                      onChange={(event) => addFiles(event.target.files)}
                      className="hidden"
                    />
                  </label>
                </div>
                  <button
                    type="button"
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || sending}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0B1628] text-white shadow-[0_12px_28px_rgba(11,22,40,0.24)] transition hover:bg-[#17263D] disabled:cursor-not-allowed disabled:opacity-35 sm:h-12 sm:w-12"
                    aria-label={sending ? "Sending message" : "Send message"}
                  >
                    <ArrowUpIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2 pb-2 sm:mt-4">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => sendMessage(starter)}
                  className="max-w-full rounded-full bg-white/70 px-3.5 py-2 text-xs font-black leading-snug text-[#34435C] shadow-sm transition hover:bg-white sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  {starter}
                </button>
              ))}
            </div>
            <p className="mx-auto mt-1 max-w-[680px] px-2 text-center text-[11px] font-semibold leading-5 text-[#7C879A]">
              Chats are not saved. Every new visit starts with a fresh conversation. Recommendations only, not
              professional or legal advice. Appliance repair is not offered.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
