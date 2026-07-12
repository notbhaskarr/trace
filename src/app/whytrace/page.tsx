import React from 'react';
import Link from 'next/link';

export default function WhyTracePage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-200">
      <main className="max-w-3xl mx-auto px-6 py-24 md:py-32">
        <header className="mb-16">
          <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium tracking-wide text-sm uppercase mb-8 inline-block transition-colors">
            &larr; Back to Trace
          </Link>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900 mb-6">
            Why Trace?
          </h1>
        </header>

        <article className="prose prose-lg md:prose-xl prose-gray max-w-none space-y-8 leading-relaxed">
          <p className="text-xl md:text-2xl text-gray-600 font-medium leading-relaxed">
            Every day, we experience a rush of ideas, feelings, and anxieties that shape who we are. But where do they go?
          </p>

          <p>
            Most of us try journaling, but let’s be honest: traditional journaling is a one-way street. You pour your heart into an app, and it goes into a void. Notes apps become graveyards of thoughts you never revisit.
          </p>

          <p>
            Plus, it just takes too much effort. At the end of a long day, typing out a diary entry feels like a chore. And if you ever want to find a memory—say, <em>"What was I feeling right before my trip last year?"</em>—keyword search completely fails because you don't remember the exact words you used.
          </p>

          <div className="py-8">
            <hr className="border-gray-200" />
          </div>

          <p>
            <strong className="text-gray-900 font-bold">Trace</strong> isn't just a journal; it's a low-friction, high-reward <strong className="text-blue-600 font-bold">second brain</strong>. It acts as a digital extension of your mind—organizing your chaos and remembering everything you inevitably forget.
          </p>

          <p>
            It starts before you even speak. Trace immerses you in a calming, ambient environment—like the gentle sound of rain—creating a safe space to decompress and reflect. When you're ready, you just tap a button and speak your mind natively. Whether you speak in perfect English or mix it up with Hinglish, Trace understands the <em>meaning</em> and <em>emotion</em> of what you say, allowing you to trace your own life by concepts, not just keywords.
          </p>

          <p className="text-2xl font-semibold text-gray-900 py-4">
            But a second brain shouldn't just be a silent database—it should talk back.
          </p>

          <p>
            Meet <strong className="text-gray-900 font-bold">Doobie</strong>. Doobie is your personal AI companion who remembers every single thing you’ve ever told Trace. He’s not a generic chatbot; he’s a friend with a perfect memory of <em>your</em> life.
          </p>

          <p>
            Feeling lost? Just ask him out loud: <em>"Doobie, maine pichle mahine kya goals set kiye the?"</em> Doobie searches the meaning behind your words, connects the dots of your past, and answers you instantly, out loud, in a natural, conversational voice. He reminds you of who you are when you forget.
          </p>

          <div className="mt-20 p-10 bg-white rounded-3xl shadow-sm border border-gray-100 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
              Don't shout your thoughts into the void. Speak them to a friend who remembers.
            </h2>
            <p className="text-blue-600 font-extrabold text-xl tracking-wide uppercase">
              Trace. Your journal, alive.
            </p>
          </div>
        </article>
      </main>
    </div>
  );
}
