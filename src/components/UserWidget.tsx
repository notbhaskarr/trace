"use client";
import React, { useState } from 'react';
import Link from 'next/link';

export default function UserWidget() {
  const [showLogout, setShowLogout] = useState(false);

  return (
    <div className="absolute bottom-6 left-8 z-50">
      {showLogout && (
        <Link href="/login">
          <div className="absolute bottom-full left-0 mb-2 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-200 cursor-pointer">
            Sign Out
          </div>
        </Link>
      )}
      <div 
        onClick={() => setShowLogout(!showLogout)}
        className="text-xs font-bold text-gray-400 hover:text-black cursor-pointer transition-colors uppercase tracking-wider select-none"
      >
        Guest User
      </div>
    </div>
  );
}
