"use client";
import React, { useState } from 'react';
import { PawPrint } from 'lucide-react';

const NodesLogo = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 16L12 7L18 16" />
    <circle cx="6" cy="16" r="2" fill="currentColor" />
    <circle cx="12" cy="7" r="2" fill="currentColor" />
    <circle cx="18" cy="16" r="2" fill="currentColor" />
  </svg>
);

export default function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <main className="flex flex-col h-screen w-full bg-gradient-to-br from-gray-100 via-white to-gray-200 text-black overflow-hidden relative">
      
      {/* Decorative Background Elements for Glassmorphism */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-indigo-100/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-stone-200/50 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
      </div>

      {/* GLOBAL NAVBAR (Always Visible) */}
      <header className="relative z-20 w-full flex items-center justify-between p-6 px-8 border-b border-white/50 bg-white/40 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-2">
          <NodesLogo className="w-5 h-5 text-black" />
          <h1 className="text-lg font-black tracking-[0.15em] uppercase text-black pt-0.5">TRACE</h1>
        </div>
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-gray-400 hover:text-black transition-all flex items-center justify-center p-1.5 rounded-full hover:bg-black/5"
            title={isSidebarOpen ? 'Close Panel' : 'Ask Doobie'}
          >
            <PawPrint className="w-5 h-5" />
          </button>
          <div className="text-xs font-bold text-gray-500 hover:text-black cursor-pointer transition-colors uppercase tracking-wider">
            Guest User
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        
        {/* EDITOR INTERFACE (Dump State) */}
        <section className="flex-1 flex flex-col bg-white/40 backdrop-blur-xl">
          <header className="p-8 pb-4 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900">OCTOBER 14, 2024</h2>
              <p className="text-sm text-gray-500 font-medium mt-1">Unfiltered Thoughts on Present States</p>
            </div>
          </header>

          <div className="flex-1 p-8 pt-4">
            <textarea
              className="w-full h-full resize-none bg-transparent text-base leading-loose focus:outline-none placeholder:text-gray-400 text-gray-800"
              placeholder="Start writing..."
              defaultValue={`The year is moving fast. Reflecting on productivity, mental clarity, and the persistent urge to optimize everything. It feels like a constant balance between structured goals and organic existence.\n\nI find myself revisiting previous challenges, wondering if the patterns I noticed last month are recurring today.\n\nI need to simplify. The focus must be on presence rather than productivity. The feeling of being overwhelmed often resurfaces when I neglect to pause and acknowledge small achievements.`}
            />
          </div>
          
          <div className="p-8 flex justify-end">
          <button className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors flex items-center gap-2 group">
            Leave a Trace
            <span className="text-lg leading-none transform group-hover:translate-x-1 transition-transform">&rarr;</span>
          </button>
        </div>
        </section>

        {/* CHAT INTERFACE (Retrieve State) */}
        {isSidebarOpen && (
          <section className="w-1/3 flex flex-col border-l border-white/50 bg-white/60 backdrop-blur-2xl shadow-xl">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">You</p>
                <p className="text-sm leading-relaxed text-gray-800 bg-white/50 p-3 rounded-lg shadow-sm border border-white/60">
                  Can you show me past entries where I felt *overwhelmed* about work? I want to reflect.
                </p>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Doobie</p>
                <div className="text-sm leading-relaxed text-gray-700 bg-black/5 p-3 rounded-lg border border-black/5">
                  <p>Analyzing your entries. I found a few moments related to work stress and overwhelm.</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="px-2 py-1 bg-white/80 text-[10px] font-mono rounded-md text-gray-600 shadow-sm border border-gray-100 cursor-pointer hover:bg-white transition-colors">[14 JUN 23 18:02]</span>
                    <span className="px-2 py-1 bg-white/80 text-[10px] font-mono rounded-md text-gray-600 shadow-sm border border-gray-100 cursor-pointer hover:bg-white transition-colors">[11 OCT 23 11:55]</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white/40 border-t border-white/50 flex gap-2 backdrop-blur-md">
              <input
                type="text"
                placeholder="Ask Doobie about your entries..."
                className="flex-1 bg-white/70 border border-white/80 shadow-inner rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black/20 transition-all placeholder:text-gray-400"
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
