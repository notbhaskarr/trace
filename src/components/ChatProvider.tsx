"use client";
import React, { createContext, useContext, useState, useTransition, ReactNode } from 'react';
import { createClient } from '@/utils/supabase/client';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  context?: any[];
};

type ChatContextType = {
  isSidebarOpen: boolean;
  toggleChat: () => void;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<Message[]>([
    { role: 'assistant', content: "hey, this is doobie. what brought you here today?" }
  ]);
  const [isChatPending, startChatTransition] = useTransition();
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const apiUrl = rawApiUrl.replace(/\/$/, '');

  const toggleChat = () => setIsSidebarOpen(prev => !prev);

  const handleAskDoobie = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatPending) return;

    const userMessage = chatInput;
    setChatInput("");
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);

    startChatTransition(async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ query: userMessage })
      });
      const result = await res.json();
      
      if (!res.ok) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: result.detail || "Error connecting to Doobie." }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'assistant', content: result.answer, context: result.context }]);
      }
    });
  };

  return (
    <ChatContext.Provider value={{ isSidebarOpen, toggleChat }}>
      <div className="flex h-screen w-full overflow-hidden">
        {/* Main Application Content */}
        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>

        {/* Global Chat Sidebar */}
        {isSidebarOpen && (
          <section className="w-1/3 flex flex-col border-l border-white/50 bg-white/60 backdrop-blur-2xl shadow-xl z-40 relative">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className="space-y-1">
                  <p className={`text-xs font-semibold uppercase tracking-wider ${msg.role === 'user' ? 'text-gray-500' : 'text-gray-400'}`}>
                    {msg.role === 'user' ? 'You' : 'Doobie'}
                  </p>
                  <div className={`text-sm leading-relaxed p-3 rounded-lg border ${msg.role === 'user' ? 'text-gray-800 bg-white/50 shadow-sm border-white/60' : 'text-gray-700 bg-black/5 border-black/5'}`}>
                    <p>{msg.content}</p>
                    {msg.context && msg.context.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {msg.context.map((c, i) => {
                          let dateStr = `TRACE REF ${i+1}`;
                          if (c.created_at) {
                            dateStr = new Date(c.created_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric'
                            }).toUpperCase() + " ENTRY";
                          }
                          return (
                            <button 
                              key={i}
                              onClick={() => setSelectedEntry(c)}
                              className="px-2 py-1 bg-white/80 hover:bg-white text-[10px] font-mono rounded-md text-gray-600 shadow-sm border border-gray-200 cursor-pointer transition-colors"
                            >
                              [{dateStr}]
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isChatPending && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Doobie</p>
                  <div className="text-sm leading-relaxed text-gray-700 bg-black/5 p-3 rounded-lg border border-black/5 animate-pulse">
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleAskDoobie} className="p-4 bg-white/40 border-t border-white/50 flex gap-2 backdrop-blur-md">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isChatPending}
                placeholder="Ask Doobie about your entries..."
                className="flex-1 bg-white/70 border border-white/80 shadow-inner rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black/20 transition-all placeholder:text-gray-400"
              />
            </form>
          </section>
        )}
      </div>

      {/* Global Detail Overlay */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden animate-in fade-in duration-200">
          <div className="flex items-center justify-between p-6 px-8 border-b border-gray-100">
            <h2 className="text-xs font-black tracking-[0.2em] text-gray-400">
              {selectedEntry.created_at ? (
                <>
                  {new Date(selectedEntry.created_at).toLocaleDateString('en-US', {
                    month: 'long', day: '2-digit', year: 'numeric'
                  }).toUpperCase()} • {new Date(selectedEntry.created_at).toLocaleTimeString('en-US', {
                    hour: 'numeric', minute: '2-digit'
                  })}
                </>
              ) : "TRACE REFERENCE"}
            </h2>
            {selectedEntry.location && <h2 className="text-[10px] font-black tracking-[0.2em] text-gray-300 ml-4">{selectedEntry.location}</h2>}
            <div className="flex-1"></div>
            <button 
              onClick={() => setSelectedEntry(null)}
              className="text-gray-400 hover:text-black transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-8 relative">
            <div className="max-w-5xl mx-auto h-full flex flex-col">
                <p className="text-lg text-black leading-relaxed whitespace-pre-wrap font-sans">
                  {selectedEntry.full_content || selectedEntry.content || selectedEntry.chunk_content}
                </p>
            </div>
          </div>
        </div>
      )}
    </ChatContext.Provider>
  );
}
