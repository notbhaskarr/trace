import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function WhyTracePage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-indigo-200 relative overflow-x-hidden flex flex-col">
      
      {/* Decorative Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 fixed">
        <div className="absolute top-[-20%] left-[-10%] w-[50rem] h-[50rem] bg-indigo-200/40 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50rem] h-[50rem] bg-stone-200/60 rounded-full mix-blend-multiply filter blur-[100px] opacity-70"></div>
      </div>

      <main className="flex-1 relative z-10">
        
        {/* Navigation */}
        <nav className="p-8 md:p-12">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-black tracking-[0.2em] text-gray-400 hover:text-gray-900 transition-colors uppercase">
            <ArrowLeft size={14} strokeWidth={2.5} />
            Back to App
          </Link>
        </nav>

        {/* Hero Section */}
        <section className="px-8 md:px-24 pt-12 pb-32 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <h2 className="text-xs font-black tracking-[0.2em] text-gray-400 mb-6 uppercase">The Problem</h2>
          <h1 className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.9] text-gray-900 mb-12">
            YOU ARE <br/><span className="text-gray-300">FORGETTING</span> <br/>YOUR LIFE.
          </h1>
          
          <div className="max-w-2xl text-xl md:text-3xl text-gray-500 font-medium leading-tight tracking-tight">
            <p className="mb-6">
              Every day, we experience a rush of ideas, feelings, and anxieties that shape who we are. But where do they go?
            </p>
            <p>
              Traditional journaling is a one-way street. You pour your heart into an app, and it goes into a void. Notes apps become <span className="text-gray-900 font-semibold italic font-serif">graveyards of thoughts</span> you never revisit.
            </p>
          </div>
        </section>

        {/* The Solution Section */}
        <section className="bg-white/50 backdrop-blur-2xl border-y border-white/60 py-32">
          <div className="px-8 md:px-24 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-xs font-black tracking-[0.2em] text-gray-400 mb-6 uppercase">The Solution</h2>
              <h3 className="text-4xl md:text-6xl font-black tracking-tighter leading-none mb-8">
                A SECOND BRAIN.
              </h3>
              <p className="text-lg md:text-2xl text-gray-600 leading-relaxed font-medium">
                <strong className="text-indigo-600 font-bold">Trace</strong> reimagines the journal. It starts before you even speak—immersing you in a calming, ambient environment to create a safe space to decompress.
              </p>
              <p className="text-lg md:text-2xl text-gray-600 leading-relaxed font-medium mt-6">
                When you're ready, just tap a button and speak natively. Perfect English or messy Hinglish—Trace understands the <em className="font-serif italic text-gray-900">meaning</em> and <em className="font-serif italic text-gray-900">emotion</em> of your words. It organizes your chaos.
              </p>
            </div>
            
            {/* Brutalist Graphics Box */}
            <div className="aspect-square bg-gradient-to-br from-indigo-50 to-stone-100 rounded-3xl border border-white/60 shadow-2xl flex items-center justify-center p-12 relative overflow-hidden group">
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
               <div className="text-center z-10 relative">
                  <div className="w-24 h-24 bg-indigo-600 rounded-full mx-auto mb-8 shadow-xl shadow-indigo-300 group-hover:scale-110 transition-transform duration-500 ease-out flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                      <line x1="12" y1="19" x2="12" y2="22"></line>
                    </svg>
                  </div>
                  <h4 className="text-2xl font-black tracking-tight">FRICTIONLESS INPUT</h4>
                  <p className="text-sm font-bold tracking-widest text-gray-400 uppercase mt-2">Just Speak.</p>
               </div>
            </div>
          </div>
        </section>

        {/* The Magic Section */}
        <section className="px-8 md:px-24 py-32 max-w-7xl mx-auto">
          <div className="max-w-4xl">
            <h2 className="text-xs font-black tracking-[0.2em] text-gray-400 mb-6 uppercase">The Magic</h2>
            <h3 className="text-5xl md:text-7xl font-black tracking-tighter leading-none mb-10">
              IT TALKS <span className="font-serif italic text-indigo-500 font-medium">BACK.</span>
            </h3>
            
            <p className="text-xl md:text-3xl text-gray-500 font-medium leading-tight tracking-tight mb-12">
              A second brain shouldn't just be a silent database. Meet <strong className="text-gray-900">Doobie</strong>—your personal AI companion with a perfect memory of your life.
            </p>

            <div className="p-8 md:p-14 bg-gray-900 text-white rounded-[2rem] shadow-2xl border border-gray-800">
              <p className="text-xs font-black tracking-[0.2em] text-gray-500 uppercase mb-4">You</p>
              <p className="text-2xl md:text-4xl font-serif italic mb-12 text-gray-300 leading-tight">
                "Doobie, maine pichle mahine kya goals set kiye the?"
              </p>
              
              <p className="text-xs font-black tracking-[0.2em] text-gray-500 uppercase mb-4">Doobie</p>
              <p className="text-xl md:text-2xl font-medium leading-relaxed text-gray-100">
                He searches the meaning behind your words, connects the dots of your past, and answers you instantly, out loud, in a natural, conversational voice. <br/><br/>
                <span className="text-indigo-400 font-serif italic">He reminds you of who you are when you forget.</span>
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-8 py-32 text-center bg-black text-white selection:bg-indigo-500 border-t border-gray-900">
           <h2 className="text-5xl md:text-8xl font-black tracking-tighter mb-8 leading-none">
             DON'T SHOUT INTO <br/>
             <span className="font-serif italic text-gray-500 font-medium">THE VOID.</span>
           </h2>
           <p className="text-xl md:text-3xl text-gray-400 font-medium tracking-tight mb-16">
             Speak your thoughts to a friend who remembers.
           </p>
           <Link href="/" className="inline-block bg-white text-black font-black tracking-widest uppercase text-sm px-10 py-5 rounded-full hover:bg-indigo-50 transition-all hover:scale-105 shadow-xl shadow-white/10">
             Start Tracing
           </Link>
        </section>
      </main>
    </div>
  );
}
