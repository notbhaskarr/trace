"use client";
import React, { createContext, useContext, useState, useTransition, ReactNode, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Navbar from './Navbar';
import { Eraser } from 'lucide-react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  context?: any[];
};

type ChatContextType = {
  isSidebarOpen: boolean;
  toggleChat: () => void;
  // Sound fields
  isAudioPlaying: boolean;
  toggleAudio: () => void;
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
    { role: 'assistant', content: "hey, want to trace back some memories?" }
  ]);
  const [isChatPending, startChatTransition] = useTransition();
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [userName, setUserName] = useState("");
  const pathname = usePathname();
  const showNavbar = pathname !== '/login' && pathname !== '/signup';

  // Sound State
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleAudio = () => {
    setIsAudioPlaying(prev => !prev);
  };

  useEffect(() => {
    if (audioRef.current) {
      if (isAudioPlaying) {
        audioRef.current.play().catch(e => {
          console.log("Audio play blocked", e);
          setIsAudioPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isAudioPlaying]);

  const getDefaultMsg = (name: string): Message[] => [
    { role: 'assistant', content: name ? `hey ${name}, want to trace back some memories?` : `hey, want to trace back some memories?` }
  ];

  useEffect(() => {
    const initChat = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      let name = "";
      if (session?.user?.user_metadata?.first_name) {
        name = session.user.user_metadata.first_name.toLowerCase();
      } else if (session?.user?.user_metadata?.full_name) {
        name = session.user.user_metadata.full_name.split(' ')[0].toLowerCase();
      } else if (session?.user?.email) {
        name = session.user.email.split('@')[0].toLowerCase();
      }
      setUserName(name);
      const defaultMsg = getDefaultMsg(name);

      const saved = localStorage.getItem('trace_chat_history');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Overwrite if it's just a default greeting
          if (parsed.length === 1 && parsed[0].content.startsWith("hey")) {
            setChatHistory(defaultMsg);
          } else {
            setChatHistory(parsed);
          }
        } catch (e) {
          setChatHistory(defaultMsg);
        }
      } else {
        setChatHistory(defaultMsg);
      }
      setIsMounted(true);
    };
    initChat();
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('trace_chat_history', JSON.stringify(chatHistory));
    }
  }, [chatHistory, isMounted]);

  // Resize State
  const [sidebarWidth, setSidebarWidth] = useState(400); // default width in px
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      // Calculate width from the right edge of the screen
      const newWidth = document.body.clientWidth - e.clientX;
      
      // Enforce min and max widths (e.g., 300px min, 800px max)
      if (newWidth > 250 && newWidth < (document.body.clientWidth * 0.6)) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection while dragging
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const apiUrl = rawApiUrl.replace(/\/$/, '');

  const toggleChat = () => setIsSidebarOpen(prev => !prev);

  const clearChat = () => {
    setChatHistory(getDefaultMsg(userName));
    localStorage.removeItem('trace_chat_history');
  };

  const handleAskDoobie = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatPending) return;

    const userMessage = chatInput;
    setChatInput("");
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);

    // Extract recent history (last 6 msgs), excluding the default greeting
    const recentHistory = chatHistory
      .filter(msg => !(msg.role === 'assistant' && msg.content.startsWith("hey ")))
      .slice(-6)
      .map(msg => ({ role: msg.role, content: msg.content }));

    startChatTransition(async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ query: userMessage, chat_history: recentHistory })
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
    <ChatContext.Provider value={{ isSidebarOpen, toggleChat, isAudioPlaying, toggleAudio }}>
      <audio ref={audioRef} src="/rain.mp3" loop />
      <div className="flex flex-col h-screen w-full overflow-hidden bg-gradient-to-br from-gray-100 via-white to-gray-200 text-black relative">
        
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-indigo-100/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-stone-200/50 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
        </div>

        {/* Global Navbar */}
        {showNavbar && (
          <div className="relative z-40">
            <Navbar />
          </div>
        )}

        <div className="flex flex-1 overflow-hidden relative z-10">
          {/* Main Application Content */}
          <div className="flex-1 overflow-hidden relative">
            {children}
          </div>

          {/* Global Chat Sidebar */}
          {isSidebarOpen && (
            <section 
              style={{ width: `${sidebarWidth}px` }}
              className={`flex flex-col border-l border-white/50 bg-white/60 backdrop-blur-2xl shadow-xl z-30 relative shrink-0 ${isDragging ? 'pointer-events-none' : ''}`}
            >
              
              {/* Invisible Drag Handle */}
              <div 
                onMouseDown={() => setIsDragging(true)}
                className="absolute top-0 -left-1 w-2 h-full cursor-col-resize z-50 hover:bg-black/10 active:bg-black/20 transition-colors pointer-events-auto"
                title="Drag to resize"
              />

              {/* Chat Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-2 border-b border-white/30">
                <span className="text-[10px] font-black tracking-[0.2em] text-gray-400">DOOBIE</span>
                <button 
                  onClick={clearChat}
                  className="text-gray-400 hover:text-black transition-colors"
                  title="Clear Chat History"
                >
                  <Eraser size={14} strokeWidth={2.5} />
                </button>
              </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 pt-4">
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
