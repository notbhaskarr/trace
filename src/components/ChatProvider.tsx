"use client";
import React, { createContext, useContext, useState, useTransition, ReactNode, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Navbar from './Navbar';
import { Eraser, Mic, Volume2, VolumeX, PawPrint, Send } from 'lucide-react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  context?: any[];
  isStreaming?: boolean;
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
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [isChatPending, startChatTransition] = useTransition();
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [userName, setUserName] = useState("");
  const pathname = usePathname();
  const showNavbar = pathname !== '/login' && pathname !== '/signup' && pathname !== '/whytrace';

  // Sound State
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Voice Chat State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isAutoSpeak, setIsAutoSpeak] = useState(false);
  const isAutoSpeakRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem('trace_auto_speak');
    if (saved !== null) {
      setIsAutoSpeak(saved === 'true');
    }
  }, []);

  useEffect(() => {
    isAutoSpeakRef.current = isAutoSpeak;
  }, [isAutoSpeak]);

  const handleToggleAutoSpeak = () => {
    setIsAutoSpeak(prev => {
      const next = !prev;
      localStorage.setItem('trace_auto_speak', String(next));
      return next;
    });
  };
  const [isDoobieSpeaking, setIsDoobieSpeaking] = useState(false);
  const doobieAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);

  const playNextAudio = () => {
    if (!doobieAudioRef.current) return;
    if (audioQueueRef.current.length > 0) {
      const nextBase64 = audioQueueRef.current.shift();
      doobieAudioRef.current.src = `data:audio/wav;base64,${nextBase64}`;
      doobieAudioRef.current.play().catch(e => console.error("Audio block", e));
      setIsDoobieSpeaking(true);
    } else {
      setIsDoobieSpeaking(false);
    }
  };

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

  const getDefaultMsg = (name: string): Message[] => [];

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('file', audioBlob);
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
          const data = await res.json();
          if (res.ok && data.transcript) {
            setChatInput(prev => prev + (prev.endsWith(' ') || prev.length === 0 ? '' : ' ') + data.transcript);
          }
        } finally {
          setIsTranscribing(false);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      timeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') stopRecording();
      }, 29000);
    } catch (e) {
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  };

  const speakAnswer = async (text: string) => {
    if (!isAutoSpeak) return;
    try {
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (res.ok && data.audios && data.audios.length > 0) {
        audioQueueRef.current = data.audios;
        playNextAudio();
      }
    } catch (e) {
      console.error('Failed to speak', e);
    }
  };

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

  const scrollChatToBottom = () => {
    requestAnimationFrame(() => {
      const el = chatScrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const handleChatScroll = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  };

  useEffect(() => {
    if (stickToBottomRef.current) scrollChatToBottom();
  }, [chatHistory, streamStatus]);

  useEffect(() => {
    if (isSidebarOpen) scrollChatToBottom();
  }, [isSidebarOpen]);

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
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamStatus(null);
    setChatHistory(getDefaultMsg(userName));
    localStorage.removeItem('trace_chat_history');
  };

  const handleStreamEvent = (data: { type: string; message?: string; content?: string; context?: any[]; answer?: string }) => {
    switch (data.type) {
      case 'status':
        setStreamStatus(data.message || null);
        break;
      case 'retrieved':
        setChatHistory(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, context: data.context || [] };
          }
          return updated;
        });
        break;
      case 'token':
        setStreamStatus(null);
        setChatHistory(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + (data.content || ''),
              isStreaming: true,
            };
          }
          return updated;
        });
        break;
      case 'regenerating':
        setStreamStatus(data.message || 'Let me think again...');
        setChatHistory(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: '', isStreaming: true };
          }
          return updated;
        });
        break;
      case 'done':
        setStreamStatus(null);
        setChatHistory(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: data.answer || '',
            context: data.context || [],
            isStreaming: false,
          };
          return updated;
        });
        if (isAutoSpeakRef.current && data.answer) {
          speakAnswer(data.answer);
        }
        break;
      case 'error':
        setStreamStatus(null);
        setChatHistory(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: data.message || "Error connecting to Doobie.",
          };
          return updated;
        });
        break;
    }
  };

  const handleAskDoobie = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatPending) return;

    const userMessage = chatInput;
    setChatInput("");
    stickToBottomRef.current = true;
    setChatHistory(prev => [
      ...prev,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: '', context: [], isStreaming: true },
    ]);
    setStreamStatus('Connecting...');

    const recentHistory = chatHistory
      .filter(msg => !(msg.role === 'assistant' && msg.content.startsWith("hey ")))
      .slice(-6)
      .map(msg => ({ role: msg.role, content: msg.content }));

    startChatTransition(async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setChatHistory(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: "Please sign in to chat with Doobie." };
          return updated;
        });
        setStreamStatus(null);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`${apiUrl}/api/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ query: userMessage, chat_history: recentHistory }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error('Stream failed');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const line = part.trim();
            if (line.startsWith('data: ')) {
              handleStreamEvent(JSON.parse(line.slice(6)));
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setStreamStatus(null);
        setChatHistory(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: "Error connecting to Doobie.",
          };
          return updated;
        });
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setStreamStatus(null);
      }
    });
  };

  return (
    <ChatContext.Provider value={{ isSidebarOpen, toggleChat, isAudioPlaying, toggleAudio }}>
      <audio ref={audioRef} src="/rain.mp3" loop />
      <audio ref={doobieAudioRef} onEnded={playNextAudio} />
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
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
                  <div className="h-12 w-12 overflow-hidden flex items-center justify-center">
                    <img src="/doobie-line.png" alt="Doobie" className="scale-150 object-contain mix-blend-multiply w-full h-full" />
                  </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => {
                       if (isDoobieSpeaking && doobieAudioRef.current) {
                          doobieAudioRef.current.pause();
                          audioQueueRef.current = [];
                          setIsDoobieSpeaking(false);
                       } else {
                          handleToggleAutoSpeak();
                       }
                    }}
                    className={`transition-colors ${isDoobieSpeaking ? 'text-red-500 animate-pulse' : isAutoSpeak ? 'text-indigo-500' : 'text-gray-300 hover:text-gray-400'}`}
                    title={isDoobieSpeaking ? "Stop Speaking" : isAutoSpeak ? "Auto-Speak ON" : "Auto-Speak OFF"}
                  >
                    {isAutoSpeak || isDoobieSpeaking ? <Volume2 size={16} strokeWidth={2.5} /> : <VolumeX size={16} strokeWidth={2.5} />}
                  </button>
                  <button 
                    onClick={clearChat}
                    className="text-gray-400 hover:text-black transition-colors"
                    title="Clear Chat History"
                  >
                    <Eraser size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

            <div
              ref={chatScrollRef}
              onScroll={handleChatScroll}
              className="flex-1 overflow-y-auto p-6 space-y-6 pt-4"
            >
              {chatHistory.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={idx} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start gap-2'}`}>
                    {!isUser && (
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5 border border-gray-200">
                        <PawPrint className="w-4 h-4 text-gray-500 opacity-70" />
                      </div>
                    )}
                    <div className={`max-w-[85%] text-[13px] leading-relaxed p-3 rounded-2xl shadow-sm border ${
                      isUser 
                        ? 'bg-white text-gray-800 border-gray-200 rounded-tr-sm' 
                        : 'bg-black/5 text-gray-700 border-black/5 rounded-tl-sm'
                    }`}>
                      <p>
                        {msg.content || (msg.isStreaming && streamStatus ? (
                          <span className="text-gray-400 italic">{streamStatus}</span>
                        ) : null)}
                        {msg.isStreaming && msg.content && (
                          <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-gray-400 animate-pulse align-middle" />
                        )}
                      </p>
                      {msg.context && msg.context.length > 0 && !msg.isStreaming && (
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
                                className="px-2 py-1 bg-white/80 hover:bg-white text-[9px] font-mono rounded-md text-gray-500 shadow-sm border border-gray-200 cursor-pointer transition-colors"
                              >
                                [{dateStr}]
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
            </div>

            <form onSubmit={handleAskDoobie} className="p-4 bg-white/40 border-t border-white/50 flex gap-2 backdrop-blur-md items-center">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing || isChatPending}
                className={`p-2 rounded-full transition-all shrink-0 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-black/5 hover:text-black'} ${isTranscribing ? 'opacity-50 cursor-wait' : ''}`}
                title={isRecording ? "Stop Recording" : "Speak to Doobie"}
              >
                <Mic size={18} />
              </button>
              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isChatPending}
                  placeholder="Message Doobie..."
                  className="w-full bg-white/70 border border-white/80 shadow-inner rounded-md pl-4 pr-10 py-3 text-sm font-sans focus:outline-none focus:ring-1 focus:ring-black/20 transition-all placeholder:text-gray-400 placeholder:font-sans"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatPending}
                  className="absolute right-2 p-1.5 text-gray-400 hover:text-gray-800 disabled:opacity-50 disabled:hover:text-gray-400 transition-colors"
                  title="Send Message"
                >
                  <Send size={16} />
                </button>
              </div>
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
