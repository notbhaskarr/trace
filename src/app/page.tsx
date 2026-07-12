"use client";
import React, { useState, useTransition } from 'react';
import { PawPrint, Mic } from 'lucide-react';
import Navbar from '@/components/Navbar';
import UserWidget from '@/components/UserWidget';
import { createClient } from '@/utils/supabase/client';


const NodesLogo = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 16L12 7L18 16" />
    <circle cx="6" cy="16" r="2" fill="currentColor" />
    <circle cx="12" cy="7" r="2" fill="currentColor" />
    <circle cx="18" cy="16" r="2" fill="currentColor" />
  </svg>
);

export default function Dashboard() {
  const [meta, setMeta] = useState("...");
  const [locationStr, setLocationStr] = useState("");
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Safely grab the API URL and strip any accidental trailing slashes
  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const apiUrl = rawApiUrl.replace(/\/$/, '');

  const handleSave = () => {
    if (!content.trim() || isPending) return;
    
    startTransition(async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${apiUrl}/api/entries`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ content, location: locationStr })
      });
      const result = await res.json();
      if (!res.ok) {
        alert(result.detail || "Failed to save");
      } else {
        setContent(""); // clear the editor on success
      }
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('file', audioBlob);
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          if (res.ok && data.transcript) {
            setContent(prev => prev + (prev.endsWith(' ') || prev.length === 0 ? '' : ' ') + data.transcript);
          } else {
            alert(data.error || 'Failed to transcribe');
          }
        } catch (error) {
          alert('Transcription error');
        } finally {
          setIsTranscribing(false);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Auto-stop at 29 seconds to respect Sarvam's 30s limit
      timeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, 29000);
      
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };


  React.useEffect(() => {
    // ponytail: this internal edge route falls back to IP location on localhost, but uses native edge headers on vercel.
    fetch('/api/geo').then(r => r.json()).then(d => {
      const loc = `${d.city?.toUpperCase() || 'UNKNOWN'}, ${d.region || ''}`;
      setLocationStr(loc);
      setMeta(`${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • ${loc}`);
    }).catch(() => setMeta(`${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • OFFLINE`));
  }, []);

  return (
    <main className="flex flex-col h-full w-full overflow-hidden relative">
      
      <UserWidget />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        
        {/* EDITOR INTERFACE (Dump State) */}
        <section className="flex-1 flex flex-col bg-white/40 backdrop-blur-xl">
          <header className="p-8 pb-4 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
              </h2>
              <p className="text-[10px] font-medium text-gray-500 mt-1">{meta}</p>
            </div>
          </header>

          <div className="flex-1 p-8 pt-4">
            <textarea
              className="w-full h-full resize-none bg-transparent text-base leading-loose focus:outline-none placeholder:text-gray-400 text-gray-800"
              placeholder="Start writing..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isPending}
            />
          </div>
          
          <div className="p-8 flex justify-end items-center gap-6">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing}
              className={`p-3 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-black/5 hover:text-black'} ${isTranscribing ? 'opacity-50 cursor-wait' : ''}`}
              title={isRecording ? "Stop Recording" : "Start Voice to Text"}
            >
              <Mic className="w-5 h-5" />
            </button>

            <button 
              onClick={handleSave}
              disabled={!content.trim() || isPending || isRecording || isTranscribing}
              className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "Saving..." : "Leave a Trace"}
              {!isPending && <span className="text-lg leading-none transform group-hover:translate-x-1 transition-transform">&rarr;</span>}
            </button>
          </div>
        </section>
      </div>

    </main>
  );
}
