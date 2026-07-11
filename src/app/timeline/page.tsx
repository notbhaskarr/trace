"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import UserWidget from '@/components/UserWidget';

type Entry = {
  id: string;
  date: string;
  content: string;
};

const MOCK_ENTRIES: Entry[] = [
  {
    id: "1",
    date: "OCTOBER 12, 2024",
    content: "Feeling extremely burned out today. There are too many moving parts in this project and I'm losing the thread. I need to step back and reorganize my priorities before I drop something important."
  },
  {
    id: "2",
    date: "OCTOBER 10, 2024",
    content: "Had a great conversation about AI aesthetics. Minimalist UI with complex backend logic seems to be the winning formula. We need to focus on typography and space rather than cluttering the screen with features."
  },
  {
    id: "3",
    date: "OCTOBER 05, 2024",
    content: "Why do we overcomplicate everything? The simplest solution is almost always the right one, yet we spend hours engineering ourselves into corners. Note to self: always start with the dumbest possible solution that works."
  }
];

export default function Timeline() {
  const [entries, setEntries] = useState<Entry[]>(MOCK_ENTRIES);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

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
    if (!selectedEntry) return;
    
    // Update local state
    setEntries(entries.map(e => 
      e.id === selectedEntry.id ? { ...e, content: editContent } : e
    ));
    
    // Update selected entry so modal reflects changes
    setSelectedEntry({ ...selectedEntry, content: editContent });
    setIsEditing(false);
  };

  return (
    <main className="flex flex-col h-screen w-full bg-gradient-to-br from-gray-100 via-white to-gray-200 text-black overflow-hidden relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-indigo-100/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-stone-200/50 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
      </div>

      <UserWidget />
      <Navbar isTimeline={true} />

      {/* TIMELINE FEED */}
      <div className="flex-1 overflow-y-auto relative z-10 p-8 pb-32">
        <div className="max-w-2xl mx-auto space-y-16 py-8">
          
          {entries.map(entry => (
            <div key={entry.id} className="space-y-4">
               <h2 className="text-xs font-black tracking-[0.2em] text-gray-400">{entry.date}</h2>
               <div 
                 onClick={() => handleOpenModal(entry)}
                 className="p-8 bg-white/60 backdrop-blur-md shadow-sm border border-white/80 rounded-sm space-y-4 hover:shadow-md transition-all cursor-pointer group"
               >
                 <p className="text-base text-gray-800 leading-loose line-clamp-2 text-ellipsis group-hover:text-black">
                   {entry.content}
                 </p>
               </div>
            </div>
          ))}

          <div className="pt-8 flex justify-center">
             <span className="text-xs font-black tracking-[0.2em] text-gray-300">END OF TRACES</span>
          </div>

        </div>
      </div>

      {/* DETAIL OVERLAY */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden animate-in fade-in duration-200">
          
          {/* Overlay Header */}
          <div className="flex items-center justify-between p-6 px-8 border-b border-gray-100">
            <h2 className="text-xs font-black tracking-[0.2em] text-gray-400">{selectedEntry.date}</h2>
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
            <div className="max-w-2xl mx-auto h-full flex flex-col">
              {isEditing ? (
                <textarea 
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full flex-1 p-0 text-lg bg-transparent border-none focus:outline-none focus:ring-0 resize-none leading-relaxed text-black"
                />
              ) : (
                <p className="text-lg text-black leading-relaxed whitespace-pre-wrap">
                  {selectedEntry.content}
                </p>
              )}
            </div>
          </div>

          {/* Overlay Footer */}
          <div className="p-8 flex justify-end max-w-2xl mx-auto w-full">
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
              >
                Edit Trace
              </button>
            ) : (
              <div className="flex items-center gap-6">
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
                  className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors flex items-center gap-2 group"
                >
                  Save Changes
                  <span className="text-lg leading-none transform group-hover:translate-x-1 transition-transform">&rarr;</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </main>
  );
}
