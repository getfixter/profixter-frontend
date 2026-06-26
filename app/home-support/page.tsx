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
    "Hi, I am Profixter Home Support AI. Ask about a home problem, upload photos, or share a contractor quote, agreement, or PDF. I will give practical recommendations, safety notes, rough difficulty and time estimates, shopping lists, and the best next step.",
};

const STARTER_GROUPS = [
  {
    title: "Diagnose",
    prompts: ["What is wrong with this leak?", "Is this dangerous?", "Should I DIY this or hire someone?"],
  },
  {
    title: "Plan",
    prompts: ["What materials do I need?", "Make me a seasonal maintenance schedule", "Give me a shopping list for this repair"],
  },
  {
    title: "Review",
    prompts: ["Review this contractor quote", "What questions should I ask before signing?", "Is this scope missing anything?"],
  },
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
        if (/^\d+\.\s+/.test(trimmed)) {
          return <p key={index}>{trimmed}</p>;
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
    <main className="min-h-screen bg-[#F6F8FC] text-[#0B1628]">
      <Header />
      <section className="mx-auto grid min-h-[calc(100svh-76px)] max-w-[1240px] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[340px_1fr] lg:px-8">
        <aside className="rounded-[8px] border border-slate-200 bg-white p-4">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
            Free Home Support AI
          </div>
          <h1 className="mt-3 text-3xl font-black leading-tight text-slate-950">
            A home expert you can ask before you hire.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Upload photos, PDFs, contractor quotes, and agreements. Ask about repairs, maintenance, danger, materials, tools, shopping lists, and whether to DIY or hire.
          </p>
          <div className="mt-4 rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            Not for appliance repair or emergency service. For danger, call 911, your utility company, or the right licensed emergency provider.
          </div>

          <div className="mt-5 space-y-4">
            {STARTER_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                  {group.title}
                </div>
                <div className="space-y-2">
                  {group.prompts.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => sendMessage(starter)}
                      className="w-full rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm font-bold text-slate-800 transition hover:border-blue-200 hover:bg-blue-50"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {!isAuthenticated && (
            <div className="mt-5 rounded-[8px] border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-900">
              Use it free without logging in. An account gives you a better saved experience when you are ready.
              <div className="mt-2 flex gap-2">
                <Link href="/signin" className="font-black text-blue-700">
                  Sign in
                </Link>
                <Link href="/signup" className="font-black text-blue-700">
                  Create account
                </Link>
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-2 text-sm">
            <Link
              href="/book"
              onClick={() => trackEvent("book_cta_clicked", { placement: "home_support_sidebar" })}
              className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-2 font-black text-emerald-800"
            >
              Book a $99 Handyman Visit
            </Link>
            <Link
              href="/membership"
              onClick={() => trackEvent("membership_cta_clicked", { placement: "home_support_sidebar" })}
              className="rounded-[8px] border border-blue-100 bg-blue-50 px-3 py-2 font-black text-blue-800"
            >
              Compare Membership
            </Link>
            <Link
              href="/projects"
              onClick={() => trackEvent("estimate_cta_clicked", { placement: "home_support_sidebar" })}
              className="rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 font-black text-amber-900"
            >
              Request Project Estimate
            </Link>
          </div>
        </aside>

        <section className="flex min-h-[76svh] flex-col overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <div className="text-sm font-black text-slate-950">Profixter Home Support AI</div>
              <div className="text-xs font-semibold text-slate-500">
                Recommendations, safety notes, difficulty/time estimates, and natural next steps.
              </div>
            </div>
            <button
              type="button"
              onClick={newChat}
              className="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
            >
              New chat
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-[8px] px-4 py-3 text-sm leading-6 shadow-sm ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : message.error
                        ? "border border-red-200 bg-red-50 text-red-800"
                        : "border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  <MessageContent text={message.content} />
                  {!!message.files?.length && (
                    <div className="mt-3 rounded-[8px] bg-black/5 px-3 py-2 text-xs opacity-85">
                      Attached: {message.files.join(", ")}
                    </div>
                  )}
                  {message.role === "assistant" && !message.error && (
                    <button
                      type="button"
                      onClick={() => copyMessage(message)}
                      className="mt-3 text-xs font-black text-blue-700"
                    >
                      {copiedId === message.id ? "Copied" : "Copy response"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="inline-flex items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
                Reviewing your home question...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            {files.length > 0 && (
              <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {files.map((item, index) => (
                  <button
                    key={`${item.name}-${index}`}
                    type="button"
                    onClick={() => removeFile(index)}
                    className="min-w-0 rounded-[8px] border border-slate-200 bg-slate-50 p-2 text-left text-xs font-bold text-slate-700"
                  >
                    {item.url ? (
                      <span
                        aria-hidden="true"
                        className="mb-2 block h-20 w-full rounded-[6px] bg-cover bg-center"
                        style={{ backgroundImage: `url(${item.url})` }}
                      />
                    ) : (
                      <div className="mb-2 flex h-20 items-center justify-center rounded-[6px] bg-white text-slate-500">
                        PDF
                      </div>
                    )}
                    <span className="block truncate">{item.name}</span>
                    <span className="mt-1 block text-[11px] font-semibold text-slate-400">
                      Click to remove
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
              <label className="flex min-h-[48px] cursor-pointer items-center justify-center rounded-[8px] border border-slate-200 px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                Upload photo/PDF
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={(event) => addFiles(event.target.files)}
                  className="hidden"
                />
              </label>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={1}
                placeholder="Ask about a leak, quote, material list, safety issue, or maintenance plan..."
                className="min-h-[48px] resize-none rounded-[8px] border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={!input.trim() || sending}
                className="min-h-[48px] rounded-[8px] bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
