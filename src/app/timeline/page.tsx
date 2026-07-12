"use client";
import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import UserWidget from '@/components/UserWidget';
import { createClient } from '@/utils/supabase/client';

type Entry = {
  id: string;
  date: string;
  time: string;
  content: string;
  location?: string;
};

// No mock entries needed

export default function Timeline() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isPending, startTransition] = useTransition();

  // Safely grab the API URL and strip any accidental trailing slashes
  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const apiUrl = rawApiUrl.replace(/\/$/, '');

  useEffect(() => {
    const loadEntries = async () => {
      setIsLoading(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setIsLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('entries')
        .select('id, content, created_at, location')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const formattedData = data.map((entry: any) => ({
          ...entry,
          date: new Date(entry.created_at).toLocaleDateString('en-US', {
            month: 'long', day: '2-digit', year: 'numeric'
          }).toUpperCase(),
          time: new Date(entry.created_at).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit'
          })
        }));
        setEntries(formattedData);
      }
      setIsLoading(false);
    };
    loadEntries();
  }, []);

  const handleOpenModal = (entry: Entry) => {
    setSelectedEntry(entry);
    setEditContent(entry.content);
    setIsEditing(false);
  };

  const handleCloseModal = () => {
    setSelectedEntry(null);
    setIsEditing(false);
  };

  const handleSave = () => {
    if (!selectedEntry || isPending) return;
    
    startTransition(async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${apiUrl}/api/entries/${selectedEntry.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ content: editContent })
      });
      
      const result = await res.json();
      if (!res.ok) {
        alert(result.detail || "Failed to update");
        return;
      }
      
      // Update local state to reflect changes instantly
      setEntries(entries.map(e => 
        e.id === selectedEntry.id ? { ...e, content: editContent } : e
      ));
      
      setSelectedEntry({ ...selectedEntry, content: editContent });
      setIsEditing(false);
    });
  };

  const handleDelete = () => {
    if (!selectedEntry || isPending) return;

    if (confirm("Are you sure you want to permanently delete this trace?")) {
      startTransition(async () => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${apiUrl}/api/entries/${selectedEntry.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        });
        
        if (!res.ok) {
          alert("Failed to delete trace.");
          return;
        }

        setEntries(entries.filter(e => e.id !== selectedEntry.id));
        handleCloseModal();
      });
    }
  };

  // Reverting date grouping as requested
  return (
    <main className="flex flex-col h-full w-full overflow-hidden relative">
      <UserWidget />

      {/* TIMELINE FEED */}
      <div className="flex-1 overflow-y-auto relative z-10 p-8 pb-32">
        <div className="max-w-5xl mx-auto space-y-16 py-8">
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-pulse">
               <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin"></div>
               <p className="text-[10px] font-black tracking-[0.2em] text-gray-400">LOADING TRACES</p>
            </div>
          ) : (
            <>
              {entries.map(entry => (
                <div key={entry.id} className="space-y-4">
                   <div className="flex justify-between items-center">
                     <h2 className="text-xs font-black tracking-[0.2em] text-gray-400">{entry.date} • {entry.time}</h2>
                     {entry.location && <h2 className="text-[10px] font-black tracking-[0.2em] text-gray-300">{entry.location}</h2>}
                   </div>
                   <div 
                     onClick={() => handleOpenModal(entry)}
                     className="p-6 py-5 bg-white/60 backdrop-blur-md shadow-sm border border-white/80 rounded-sm space-y-4 hover:shadow-md transition-all cursor-pointer group"
                   >
                     <p className="text-base text-gray-800 leading-loose line-clamp-3 text-ellipsis group-hover:text-black font-sans">
                       {entry.content}
                     </p>
                   </div>
                </div>
              ))}

              <div className="pt-8 flex justify-center">
                 <span className="text-xs font-black tracking-[0.2em] text-gray-300">END OF TRACES</span>
              </div>
            </>
          )}

        </div>
      </div>

      {/* DETAIL OVERLAY */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden animate-in fade-in duration-200">
          
          {/* Overlay Header */}
          <div className="flex items-center justify-between p-6 px-8 border-b border-gray-100">
            <h2 className="text-xs font-black tracking-[0.2em] text-gray-400">{selectedEntry.date} • {selectedEntry.time}</h2>
            {selectedEntry.location && <h2 className="text-[10px] font-black tracking-[0.2em] text-gray-300 ml-4">{selectedEntry.location}</h2>}
            <div className="flex-1"></div>
            <button 
              onClick={handleCloseModal}
              className="text-gray-400 hover:text-black transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Overlay Body */}
          <div className="flex-1 overflow-y-auto p-8 relative">
            <div className="max-w-5xl mx-auto h-full flex flex-col">
              {isEditing ? (
                <textarea 
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full flex-1 p-0 text-lg bg-transparent border-none focus:outline-none focus:ring-0 resize-none leading-relaxed text-black"
                />
              ) : (
                <p className="text-lg text-black leading-relaxed whitespace-pre-wrap font-sans">
                  {selectedEntry.content}
                </p>
              )}
            </div>
          </div>

          {/* Overlay Footer */}
          <div className="p-8 flex justify-between items-center max-w-5xl mx-auto w-full">
            {!isEditing ? (
              <>
                <button 
                  onClick={handleDelete}
                  disabled={isPending}
                  className="text-xs font-bold uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors"
                >
                  {isPending ? "..." : "Delete"}
                </button>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
                >
                  Edit Trace
                </button>
              </>
            ) : (
              <div className="flex items-center gap-6 ml-auto">
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(selectedEntry.content);
                  }}
                  className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isPending}
                  className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors flex items-center gap-2 group disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save Changes"}
                  {!isPending && <span className="text-lg leading-none transform group-hover:translate-x-1 transition-transform">&rarr;</span>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </main>
  );
}
