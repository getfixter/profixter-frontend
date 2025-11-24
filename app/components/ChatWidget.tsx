'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/useAuth';
import Image from 'next/image';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  isError?: boolean;
}

interface ChatWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function ChatWidget({ isOpen, onToggle }: ChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [visitorId, setVisitorId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Generate or get visitorId from localStorage
  useEffect(() => {
    let id = localStorage.getItem('chatVisitorId');
    if (!id) {
      id = `visitor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('chatVisitorId', id);
    }
    setVisitorId(id);

    // Welcome message
    setMessages([{
      role: 'assistant',
      content: '👋 Hi! I\'m Taras from Mr. Fixter. How can I help you today?',
      timestamp: new Date()
    }]);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !visitorId) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chatbot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId,
          channel: 'web',
          input: input.trim(),
          lead: user ? {
            email: user.email,
            name: user.name,
            phone: user.phone,
            city: user.city,
            county: user.county
          } : undefined
        })
      });

      if (!response.ok) throw new Error('Chatbot request failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let botMessage = '';

      // Read SSE stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.replace(/^data:\s*/, ''));
            
            if (data.status === 'typing') {
              setIsTyping(true);
            } else if (data.token) {
              botMessage += data.token;
              // Update message in real-time
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                
                if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
                  lastMsg.content = botMessage;
                } else {
                  newMessages.push({
                    role: 'assistant',
                    content: botMessage,
                    isStreaming: true,
                    timestamp: new Date()
                  });
                }
                return newMessages;
              });
            } else if (data.done) {
              setIsTyping(false);
              // Finalize message
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg?.isStreaming) {
                  lastMsg.isStreaming = false;
                }
                return newMessages;
              });
            } else if (data.error) {
              throw new Error(data.error);
            }
          } catch (err) {
            console.error('Parse error:', err);
          }
        }
      }
    } catch (error) {
      console.error('Chatbot error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble connecting. Please try again.',
        timestamp: new Date(),
        isError: true
      }]);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-[100px] sm:bottom-[130px] z-[999998] w-[calc(100vw-2.5rem)] sm:w-[380px]" style={{ right: 'max(1.25rem, calc((100vw - 1240px)/2 + 20px))' }}>
      <div className="bg-white rounded-[20px] shadow-2xl flex flex-col overflow-hidden" style={{ height: 'min(600px, calc(100vh - 180px))' }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#306EEC] to-[#2558c9] text-white p-4 flex justify-between items-center">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              🔧 Mr. Fixter Assistant
            </h3>
            <span className="text-xs opacity-90">Taras is online</span>
          </div>
          <button 
            onClick={onToggle}
            className="text-white text-2xl hover:opacity-80 transition-opacity w-8 h-8 flex items-center justify-center"
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#f7f7f7] flex flex-col gap-3">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
            >
              <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div className={`px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-r from-[#306EEC] to-[#2558c9] text-white rounded-br-sm' 
                    : msg.isError
                    ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                    : 'bg-white border border-gray-200 rounded-bl-sm'
                }`}>
                  {msg.content}
                  {msg.isStreaming && <span className="inline-block animate-blink ml-1">▋</span>}
                </div>
                <div className="text-[11px] text-gray-500 px-1">
                  {msg.timestamp.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '0.2s' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '0.4s' }}></span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 bg-white border-t border-gray-200 flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything..."
            rows={1}
            disabled={isTyping}
            className="flex-1 border border-gray-300 rounded-full px-4 py-2.5 text-sm resize-none outline-none focus:border-[#306EEC] focus:ring-2 focus:ring-[#306EEC]/20 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
            style={{ maxHeight: '100px' }}
          />
          <button 
            onClick={sendMessage}
            disabled={!input.trim() || isTyping}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-[#306EEC] to-[#2558c9] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            aria-label="Send message"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
