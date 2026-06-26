"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpIcon,
  ClipboardDocumentIcon,
  DocumentTextIcon,
  PaperClipIcon,
  PhotoIcon,
  PlusIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Header from "@/app/components/sections/Header";
import { useAuth } from "@/lib/useAuth";
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

const HISTORY_KEY = "homeSupportMessages";

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

const HOW_TO_USE = [
  "Upload photos of leaks, damage, fixtures, walls, ceilings, doors, quotes, or project details.",
  "Upload PDFs, contractor quotes, scopes, or agreements for a practical homeowner opinion.",
  "Ask repair, maintenance, seasonal planning, renovation, materials, tools, and shopping list questions.",
  "Ask whether something looks dangerous, or whether you should stop and call a utility, emergency service, or licensed professional.",
  "Ask whether a task is better as DIY, Book Handyman, Membership, or a Renovation Estimate.",
  "Profixter AI gives recommendations, not final professional or legal advice. It does not offer appliance repair.",
];

const FEATURE_CARDS = [
  "Photos and PDFs",
  "Quotes and agreements",
  "DIY or hire guidance",
  "Safety-first recommendations",
];

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
  const { isAuthenticated } = useAuth();
  const [visitorId, setVisitorId] = useState("");
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
    let id = localStorage.getItem("homeSupportVisitorId");
    if (!id) {
      id = `home-support-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("homeSupportVisitorId", id);
    }
    setVisitorId(id);

    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Message[];
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      } catch {
        localStorage.removeItem(HISTORY_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (visitorId) localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-30)));
  }, [messages, visitorId]);

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
    localStorage.removeItem(HISTORY_KEY);
    trackEvent("home_support_new_chat", { page: "/home-support" });
  }

  async function copyMessage(message: Message) {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(""), 1200);
  }

  async function sendMessage(text?: string) {
    const value = (text ?? input).trim();
    if (!value || !visitorId || sending) return;

    const attachedFiles = files;
    const fileNames = attachedFiles.map((item) => item.name);
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
      formData.append("visitorId", visitorId);
      formData.append("channel", "home_support");
      formData.append("input", value);
      attachedFiles.forEach((item) => formData.append("files", item.file));

      const headers: HeadersInit = {};
      const token = localStorage.getItem("token");
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chatbot/home-support/message`,
        {
          method: "POST",
          headers,
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
    <main className="min-h-screen bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF4FA_46%,#F7F8F2_100%)] text-[#0B1628]">
      <Header />

      <section className="mx-auto flex min-h-[calc(100svh-92px)] w-full max-w-[1480px] flex-col px-3 pb-5 pt-3 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1320px] rounded-[30px] border border-white/80 bg-white/70 p-4 shadow-[0_24px_80px_rgba(9,22,43,0.10)] backdrop-blur-xl sm:p-6 lg:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_370px] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#DCE8F8] bg-white/85 px-3 py-2 text-[11px] font-black uppercase tracking-[0.17em] text-[#2563EB] shadow-sm">
                <SparklesIcon className="h-4 w-4" aria-hidden="true" />
                Free homeowner assistant
              </div>
              <h1 className="mt-4 max-w-[820px] text-[38px] font-black leading-[0.98] tracking-[-0.02em] text-[#071325] sm:text-6xl lg:text-[72px]">
                Your personal AI for home questions.
              </h1>
              <p className="mt-4 max-w-[760px] text-base font-semibold leading-7 text-[#4B5870] sm:text-lg">
                Upload a photo, quote, agreement, or ask what to do next. Get practical recommendations before you hire anyone.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:max-w-[760px] xl:grid-cols-4">
                {FEATURE_CARDS.map((item) => (
                  <div
                    key={item}
                    className="rounded-[18px] border border-white/80 bg-white/75 px-4 py-3 text-sm font-black text-[#243149] shadow-[0_10px_28px_rgba(9,22,43,0.07)]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <details className="overflow-hidden rounded-[24px] border border-[#DCE6F4] bg-white/90 shadow-[0_16px_46px_rgba(9,22,43,0.09)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-sm font-black text-[#0B1628] marker:hidden">
                <span>How to use</span>
                <PlusIcon className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />
              </summary>
              <div className="border-t border-[#E5ECF6] px-4 pb-4 pt-3">
                <div className="grid gap-2">
                  {HOW_TO_USE.map((item) => (
                    <div
                      key={item}
                      className="rounded-[16px] bg-[#F6F8FC] px-3 py-3 text-sm font-semibold leading-6 text-[#4B5A73]"
                    >
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-2 text-sm font-black sm:grid-cols-3 lg:grid-cols-1">
                  <Link
                    href="/book"
                    onClick={() => trackEvent("book_cta_clicked", { placement: "home_support_how_to" })}
                    className="rounded-full bg-[#EAF7EF] px-4 py-2.5 text-center text-[#15803D] transition hover:bg-[#DDF1E5]"
                  >
                    Book Handyman
                  </Link>
                  <Link
                    href="/membership"
                    onClick={() => trackEvent("membership_cta_clicked", { placement: "home_support_how_to" })}
                    className="rounded-full bg-[#EEF4FF] px-4 py-2.5 text-center text-[#2563EB] transition hover:bg-[#E1ECFF]"
                  >
                    Membership
                  </Link>
                  <Link
                    href="/projects"
                    onClick={() => trackEvent("estimate_cta_clicked", { placement: "home_support_how_to" })}
                    className="rounded-full bg-[#FFF5E6] px-4 py-2.5 text-center text-[#B45309] transition hover:bg-[#FEECCB]"
                  >
                    Renovation Estimate
                  </Link>
                </div>
              </div>
            </details>
          </div>
        </div>

        <section className="mx-auto mt-4 flex min-h-[72svh] w-full max-w-[1320px] flex-1 flex-col overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-[0_28px_90px_rgba(9,22,43,0.14)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#E5ECF6] bg-white/95 px-4 py-3 sm:px-5 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[#0B1628] text-white shadow-[0_12px_28px_rgba(9,22,43,0.22)]">
                <SparklesIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black text-[#0B1628]">Profixter AI</div>
                <div className="truncate text-xs font-semibold text-[#6B768A]">
                  Built for repairs, projects, safety, materials, and contractor research.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={newChat}
              className="inline-flex h-10 flex-shrink-0 items-center gap-2 rounded-full border border-[#DDE6F3] bg-white px-3 text-xs font-black text-[#172033] transition hover:bg-[#F6F8FC] sm:px-4"
            >
              <PlusIcon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">New Chat</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-[linear-gradient(180deg,#FBFCFF_0%,#F6F8FC_100%)] px-3 py-4 sm:px-6 lg:px-8">
            {!hasUserMessages && (
              <div className="mx-auto max-w-[820px] py-5 text-center sm:py-10">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[22px] bg-[#0B1628] text-white shadow-[0_18px_42px_rgba(9,22,43,0.24)]">
                  <SparklesIcon className="h-7 w-7" aria-hidden="true" />
                </div>
                <h2 className="mt-5 text-2xl font-black tracking-[-0.01em] text-[#0B1628] sm:text-4xl">
                  Ask anything about your home.
                </h2>
                <p className="mx-auto mt-3 max-w-[620px] text-sm font-semibold leading-6 text-[#526078] sm:text-base">
                  Describe the issue, upload a photo or PDF, or paste a quote. Profixter AI will help you decide what is safe, what materials you may need, and whether DIY, Book Handyman, Membership, or a Renovation Estimate makes sense.
                </p>
                <div className="mx-auto mt-5 flex max-w-[760px] gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:justify-center sm:overflow-visible">
                  {STARTERS.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => sendMessage(starter)}
                      className="flex-shrink-0 rounded-full border border-[#DDE6F3] bg-white px-4 py-2.5 text-xs font-black text-[#34435C] shadow-sm transition hover:border-[#BBD0FA] hover:bg-[#EEF4FF] sm:text-sm"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages
              .filter((message) => hasUserMessages || message.id !== "welcome")
              .map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[94%] rounded-[24px] px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[78%] lg:max-w-[70%] ${
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
                      <button
                        type="button"
                        onClick={() => copyMessage(message)}
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#EEF4FF] px-3 py-1.5 text-xs font-black text-[#2563EB] transition hover:bg-[#E1ECFF]"
                      >
                        <ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />
                        {copiedId === message.id ? "Copied" : "Copy response"}
                      </button>
                    )}
                  </div>
                </div>
              ))}

            {sending && (
              <div className="inline-flex max-w-[92%] items-center gap-3 rounded-full border border-[#E4EBF5] bg-white px-4 py-3 text-sm font-semibold text-[#526078] shadow-sm">
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

          <div className="border-t border-[#E5ECF6] bg-white/95 p-3 sm:p-4 lg:p-5">
            {!isAuthenticated && (
              <div className="mb-3 rounded-[18px] border border-[#E1EAFE] bg-[#F6F9FF] px-3 py-2 text-xs font-semibold leading-5 text-[#526078]">
                Free without logging in. An account can help keep your Profixter experience organized when you are ready.
              </div>
            )}

            {hasUserMessages && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => sendMessage(starter)}
                    className="flex-shrink-0 rounded-full border border-[#DDE6F3] bg-[#F8FAFD] px-3 py-2 text-xs font-black text-[#34435C] transition hover:border-[#BBD0FA] hover:bg-[#EEF4FF]"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            )}

            {fileNotice && (
              <div className="mb-3 rounded-[16px] border border-[#F8D9A2] bg-[#FFF8EC] px-3 py-2 text-xs font-bold leading-5 text-[#965C09]">
                {fileNotice}
              </div>
            )}

            {files.length > 0 && (
              <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {files.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="group relative min-w-0 overflow-hidden rounded-[18px] border border-[#DDE6F3] bg-[#F8FAFD] p-2 text-left text-xs font-bold text-[#34435C]"
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

            <div className="rounded-[28px] border border-[#DDE6F3] bg-[#F8FAFD] p-2 shadow-inner">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={2}
                placeholder="Ask about a leak, quote, materials, safety concern, renovation idea, or maintenance plan..."
                className="min-h-[74px] w-full resize-none bg-transparent px-3 py-3 text-base font-medium text-[#0B1628] outline-none placeholder:text-[#7C879A]"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-[#DDE6F3] bg-white px-4 text-sm font-black text-[#34435C] transition hover:bg-[#F6F8FC]">
                  <PaperClipIcon className="h-4 w-4" aria-hidden="true" />
                  <span>Upload photo/PDF</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    onChange={(event) => addFiles(event.target.files)}
                    className="hidden"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <div className="hidden items-center gap-1 text-xs font-semibold text-[#7C879A] sm:flex">
                    <PhotoIcon className="h-4 w-4" aria-hidden="true" />
                    <DocumentTextIcon className="h-4 w-4" aria-hidden="true" />
                    Files are reviewed for this request.
                  </div>
                  <button
                    type="button"
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || sending}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-[0_12px_28px_rgba(37,99,235,0.28)] transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label={sending ? "Sending message" : "Send message"}
                  >
                    <ArrowUpIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
            <p className="mt-2 px-1 text-[11px] font-semibold leading-5 text-[#7C879A]">
              Profixter AI gives homeowner recommendations, not final professional or legal advice. Appliance repair is not offered.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
