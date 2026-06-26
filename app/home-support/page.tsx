"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
    "Hi, I am Profixter AI. Ask about a home problem, upload photos, or share a contractor quote, agreement, or PDF. I can help you think through safety, materials, tools, difficulty, timing, shopping lists, and whether to DIY or hire someone.",
};

const STARTERS = [
  "What is wrong with this leak?",
  "Review this contractor quote",
  "What materials do I need?",
  "Is this dangerous?",
  "Should I DIY this or hire someone?",
];

const HOW_TO_USE = [
  "Upload photos of leaks, damage, fixtures, walls, ceilings, doors, or other home issues.",
  "Upload PDFs, contractor quotes, scopes, or agreements for a practical second look.",
  "Ask repair, maintenance, seasonal planning, materials, tools, and shopping list questions.",
  "Ask if something looks dangerous or if you should stop and call a utility, emergency service, or licensed professional.",
  "Ask whether a task is a good DIY project, a one-time handyman visit, Membership work, or a renovation estimate.",
  "Profixter AI gives recommendations, not final professional or legal advice.",
];

function MessageContent({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-1" />;
        if (/^[-*]\s+/.test(trimmed)) {
          return (
            <div key={index} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current opacity-50" />
              <span>{trimmed.replace(/^[-*]\s+/, "")}</span>
            </div>
          );
        }
        return <p key={index}>{line}</p>;
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
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const filesRef = useRef<FilePreview[]>([]);

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
    const accepted = Array.from(list)
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

    if (accepted.length) {
      trackEvent("home_support_file_uploaded", {
        count: accepted.length,
        hasPdf: accepted.some((item) => item.type.toLowerCase() === "application/pdf"),
        hasImage: accepted.some((item) => item.type.toLowerCase().startsWith("image/")),
      });
    }

    setFiles((current) => [...current, ...accepted].slice(0, 4));
  }

  function removeFile(index: number) {
    setFiles((current) => {
      const item = current[index];
      if (item?.url) URL.revokeObjectURL(item.url);
      return current.filter((_, i) => i !== index);
    });
  }

  function newChat() {
    files.forEach((item) => {
      if (item.url) URL.revokeObjectURL(item.url);
    });
    setFiles([]);
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
    <main className="min-h-screen bg-[#EEF3FB] text-[#0B1628]">
      <Header />

      <section className="mx-auto flex min-h-[calc(100svh-112px)] max-w-[1040px] flex-col px-3 pb-4 pt-2 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[880px] pb-4 pt-2 text-center sm:pt-6">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
            Free homeowner assistant
          </div>
          <h1 className="mt-3 text-[34px] font-black leading-[0.98] text-[#0B1628] sm:text-5xl">
            Profixter AI for home decisions.
          </h1>
          <p className="mx-auto mt-4 max-w-[680px] text-sm font-medium leading-6 text-[#526078] sm:text-base">
            Ask about repairs, maintenance, photos, PDFs, contractor quotes, safety concerns, materials, tools, shopping lists, and whether to DIY or hire someone.
          </p>
        </div>

        <details className="mx-auto mb-3 w-full max-w-[880px] rounded-[20px] border border-white/70 bg-white/82 shadow-[0_14px_42px_rgba(9,22,43,0.08)] backdrop-blur">
          <summary className="cursor-pointer list-none px-4 py-4 text-sm font-black text-[#0B1628] marker:hidden">
            How to use
          </summary>
          <div className="border-t border-[#E5ECF6] px-4 pb-4 pt-1">
            <div className="grid gap-2 sm:grid-cols-2">
              {HOW_TO_USE.map((item) => (
                <div key={item} className="rounded-[14px] bg-[#F6F8FC] px-3 py-3 text-sm leading-6 text-[#4B5A73]">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm font-black">
              <Link
                href="/book"
                onClick={() => trackEvent("book_cta_clicked", { placement: "home_support_how_to" })}
                className="rounded-full bg-[#EAF7EF] px-3 py-2 text-[#15803D]"
              >
                Book Handyman
              </Link>
              <Link
                href="/membership"
                onClick={() => trackEvent("membership_cta_clicked", { placement: "home_support_how_to" })}
                className="rounded-full bg-[#EEF4FF] px-3 py-2 text-[#306EEC]"
              >
                Membership
              </Link>
              <Link
                href="/projects"
                onClick={() => trackEvent("estimate_cta_clicked", { placement: "home_support_how_to" })}
                className="rounded-full bg-[#FFF5E6] px-3 py-2 text-[#B45309]"
              >
                Renovation estimate
              </Link>
            </div>
          </div>
        </details>

        <section className="mx-auto flex min-h-[620px] w-full max-w-[880px] flex-1 flex-col overflow-hidden rounded-[24px] border border-white/70 bg-white shadow-[0_22px_70px_rgba(9,22,43,0.12)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#E5ECF6] px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <div className="text-sm font-black text-[#0B1628]">Profixter AI</div>
              <div className="truncate text-xs font-semibold text-[#6B768A]">
                Photos and PDFs stay in this chat request. No appliance repair.
              </div>
            </div>
            <button
              type="button"
              onClick={newChat}
              className="flex-shrink-0 rounded-full border border-[#DDE6F3] bg-white px-4 py-2 text-xs font-black text-[#172033] transition hover:bg-[#F6F8FC]"
            >
              New Chat
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-[#F8FAFD] px-3 py-4 sm:px-5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] rounded-[20px] px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[78%] ${
                    message.role === "user"
                      ? "bg-[#0B1628] text-white"
                      : message.error
                        ? "border border-red-200 bg-red-50 text-red-800"
                        : "border border-[#E4EBF5] bg-white text-[#243149]"
                  }`}
                >
                  <MessageContent text={message.content} />
                  {!!message.files?.length && (
                    <div className="mt-3 rounded-[14px] bg-black/5 px-3 py-2 text-xs opacity-85">
                      Attached: {message.files.join(", ")}
                    </div>
                  )}
                  {message.role === "assistant" && !message.error && (
                    <button
                      type="button"
                      onClick={() => copyMessage(message)}
                      className="mt-3 rounded-full bg-[#EEF4FF] px-3 py-1.5 text-xs font-black text-[#306EEC]"
                    >
                      {copiedId === message.id ? "Copied" : "Copy response"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E4EBF5] bg-white px-4 py-3 text-sm font-semibold text-[#526078]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#306EEC]" />
                Reviewing your home question...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-[#E5ECF6] bg-white p-3 sm:p-4">
            {!isAuthenticated && (
              <div className="mb-3 rounded-[16px] border border-[#E1EAFE] bg-[#F6F9FF] px-3 py-2 text-xs font-semibold leading-5 text-[#526078]">
                Free to use without logging in. An account can help keep your Profixter experience organized when you are ready.
              </div>
            )}

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

            {files.length > 0 && (
              <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {files.map((item, index) => (
                  <button
                    key={`${item.name}-${index}`}
                    type="button"
                    onClick={() => removeFile(index)}
                    className="min-w-0 rounded-[16px] border border-[#DDE6F3] bg-[#F8FAFD] p-2 text-left text-xs font-bold text-[#34435C]"
                  >
                    {item.url ? (
                      <span
                        aria-hidden="true"
                        className="mb-2 block h-20 w-full rounded-[12px] bg-cover bg-center"
                        style={{ backgroundImage: `url(${item.url})` }}
                      />
                    ) : (
                      <div className="mb-2 flex h-20 items-center justify-center rounded-[12px] bg-white text-[#6B768A]">
                        PDF
                      </div>
                    )}
                    <span className="block truncate">{item.name}</span>
                    <span className="mt-1 block text-[11px] font-semibold text-[#7C879A]">
                      Tap to remove
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="rounded-[22px] border border-[#DDE6F3] bg-[#F8FAFD] p-2 shadow-inner">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={2}
                placeholder="Ask about a leak, quote, material list, safety issue, or maintenance plan..."
                className="min-h-[64px] w-full resize-none bg-transparent px-3 py-3 text-base text-[#0B1628] outline-none placeholder:text-[#7C879A]"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <label className="flex min-h-[42px] cursor-pointer items-center rounded-full border border-[#DDE6F3] bg-white px-4 text-sm font-black text-[#34435C] transition hover:bg-[#F6F8FC]">
                  Upload photo/PDF
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    onChange={(event) => addFiles(event.target.files)}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || sending}
                  className="min-h-[42px] rounded-full bg-[#306EEC] px-5 text-sm font-black text-white shadow-[0_10px_26px_rgba(48,110,236,0.26)] transition hover:bg-[#1F5FD8] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
