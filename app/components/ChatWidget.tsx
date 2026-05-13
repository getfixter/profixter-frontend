'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  isError?: boolean;
  chips?: ChipDef[];
}

interface ChipDef {
  label: string;
  message?: string;
  href?: string;
  phone?: boolean;
}

const PHONE = '631-599-1363';
const PHONE_TEL = 'tel:6315991363';

const WELCOME_CHIPS: ChipDef[] = [
  { label: 'How does it work?', message: 'How does the handyman membership work?' },
  { label: "What's included?", message: 'What tasks are included in the membership?' },
  { label: 'See plans & pricing', href: '/membership' },
  { label: 'Call 631-599-1363', phone: true },
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [visitorId, setVisitorId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    let id = localStorage.getItem('chatVisitorId');
    if (!id) {
      id = `visitor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('chatVisitorId', id);
    }
    setVisitorId(id);

    if (localStorage.getItem('chatHasOpened')) setHasOpened(true);

    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm the Profixter assistant.\n\nWhat can I help you with today?",
      timestamp: new Date(),
      chips: WELCOME_CHIPS,
    }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  const openChat = () => {
    setIsOpen(true);
    if (!hasOpened) {
      setHasOpened(true);
      localStorage.setItem('chatHasOpened', '1');
    }
  };

  const handleChip = (chip: ChipDef) => {
    if (chip.phone) { window.location.href = PHONE_TEL; return; }
    if (chip.href) { window.location.href = chip.href; return; }
    if (chip.message) sendMessage(chip.message);
  };

  const sendMessage = useCallback(async (text?: string) => {
    const msgText = (text ?? input).trim();
    if (!msgText || !visitorId || isTyping) return;
    if (!text) setInput('');

    setMessages(prev => [...prev, {
      id: `u-${Date.now()}`,
      role: 'user',
      content: msgText,
      timestamp: new Date(),
    }]);
    setIsTyping(true);

    const botId = `b-${Date.now()}`;
    let botText = '';

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chatbot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId,
          channel: 'web',
          input: msgText,
          lead: user ? {
            email: user.email,
            name: user.name,
            phone: user.phone,
            city: user.city,
            county: user.county,
          } : undefined,
        }),
      });

      if (!res.ok) throw new Error('Request failed');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data:'));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(5).trim());
            if (data.token) {
              botText += data.token;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.id === botId) {
                  return [...prev.slice(0, -1), { ...last, content: botText }];
                }
                return [...prev, { id: botId, role: 'assistant' as const, content: botText, timestamp: new Date(), isStreaming: true }];
              });
            } else if (data.done) {
              setIsTyping(false);
              setMessages(prev => prev.map(m => m.id === botId ? { ...m, isStreaming: false } : m));
            } else if (data.error) {
              throw new Error(data.error);
            }
          } catch { /* skip parse errors */ }
        }
      }
    } catch {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Having trouble connecting. Call ${PHONE}`,
        timestamp: new Date(),
        isError: true,
      }]);
    }
  }, [input, visitorId, isTyping, user]);

  return (
    <>
      {/* ── Panel ── */}
      {isOpen && (
        <div
          className="fixed z-[999998] flex flex-col"
          style={{
            bottom: 'max(76px, calc(env(safe-area-inset-bottom) + 76px))',
            right: '20px',
            width: 'min(376px, calc(100vw - 24px))',
            height: 'min(560px, calc(100dvh - 130px))',
          }}
        >
          <div className="flex flex-col h-full rounded-[20px] overflow-hidden border border-[#D9E2F0] shadow-[0_24px_64px_rgba(11,22,40,0.20)] bg-white">

            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3.5 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #0B1628 0%, #1A2D4A 100%)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#306EEC] flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_rgba(48,110,236,0.40)]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div className="text-[14px] font-bold text-white leading-none">Profixter Assistant</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" style={{ boxShadow: '0 0 5px rgba(74,222,128,0.8)' }} />
                    <span className="text-[11px] text-white/50">Online now</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[#F8FAFF]"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#C5CBD8 transparent' }}
            >
              {messages.map((msg) => (
                <div key={msg.id}>
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[84%] px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-[#306EEC] text-white rounded-[16px] rounded-br-[4px]'
                          : msg.isError
                          ? 'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA] rounded-[16px] rounded-bl-[4px]'
                          : 'bg-white text-[#1E293B] border border-[#E2E8F0] shadow-[0_1px_4px_rgba(15,23,42,0.06)] rounded-[16px] rounded-bl-[4px]'
                      }`}
                    >
                      {msg.content}
                      {msg.isStreaming && <span className="inline-block ml-0.5 opacity-50 animate-pulse">▋</span>}
                    </div>
                  </div>

                  {/* Quick chips */}
                  {msg.chips && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {msg.chips.map((chip) => (
                        <button
                          key={chip.label}
                          onClick={() => handleChip(chip)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-[#C5CBD8] text-[12px] font-semibold text-[#1E3A6E] hover:bg-[#EEF2FF] hover:border-[#306EEC] hover:text-[#306EEC] transition-colors shadow-[0_1px_3px_rgba(15,23,42,0.07)]"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-[#E2E8F0] shadow-[0_1px_4px_rgba(15,23,42,0.06)] rounded-[16px] rounded-bl-[4px] px-4 py-3">
                    <div className="flex gap-1.5 items-center h-4">
                      {[0, 150, 300].map((delay) => (
                        <span
                          key={delay}
                          className="w-2 h-2 rounded-full bg-[#306EEC]/40 animate-bounce"
                          style={{ animationDelay: `${delay}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Call strip */}
            <a
              href={PHONE_TEL}
              className="flex-shrink-0 flex items-center justify-center gap-2 bg-[#EEF2FF] border-t border-[#D9E4FF] px-4 py-2.5 text-[12px] font-semibold text-[#306EEC] hover:bg-[#E0E9FF] transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Call {PHONE}
            </a>

            {/* Input */}
            <div className="flex-shrink-0 flex gap-2 items-end p-3 bg-white border-t border-[#E2E8F0]">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                placeholder="Ask anything…"
                rows={1}
                disabled={isTyping}
                className="flex-1 border border-[#C5CBD8] rounded-[12px] px-3.5 py-2.5 text-[13.5px] text-[#1E293B] placeholder:text-[#94A3B8] resize-none outline-none focus:border-[#306EEC] focus:ring-2 focus:ring-[#306EEC]/20 transition-colors disabled:bg-[#F8FAFF] disabled:cursor-not-allowed"
                style={{ maxHeight: '96px', lineHeight: '1.5' }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isTyping}
                aria-label="Send message"
                className="w-10 h-10 rounded-[12px] bg-[#306EEC] text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2558C9] transition-colors"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <line x1="22" y1="2" x2="11" y2="13" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                  <polygon points="22,2 15,22 11,13 2,9" fill="white" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toggle button ── */}
      <button
        onClick={isOpen ? () => setIsOpen(false) : openChat}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        className="fixed z-[999999] right-5 sm:right-6 w-14 h-14 rounded-full bg-[#306EEC] hover:bg-[#2558C9] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(48,110,236,0.45)] transition-all duration-200 hover:scale-105 active:scale-95"
        style={{ bottom: 'max(20px, calc(env(safe-area-inset-bottom) + 16px))' }}
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}

        {/* Notification badge */}
        {!hasOpened && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#EF4444] rounded-full text-white text-[10px] font-bold flex items-center justify-center shadow-sm pointer-events-none">
            1
          </span>
        )}
      </button>
    </>
  );
}
