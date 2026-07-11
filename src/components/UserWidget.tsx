"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';

export default function UserWidget() {
  const [showLogout, setShowLogout] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, [supabase]);

  if (!user) return null;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="absolute bottom-6 left-8 z-50">
      {showLogout && (
        <div 
          onClick={handleSignOut}
          className="absolute bottom-full left-0 mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-200 cursor-pointer"
        >
          Sign Out
        </div>
      )}
      <div 
        onClick={() => setShowLogout(!showLogout)}
        className="text-[10px] font-bold text-gray-400 hover:text-black cursor-pointer transition-colors uppercase tracking-wider select-none"
      >
        {user.user_metadata?.first_name || user.email || "GUEST"}
      </div>
    </div>
  );
}
