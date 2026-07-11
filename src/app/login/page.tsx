"use client";
import React from 'react';
import Link from 'next/link';
import AuthLayout from '@/components/AuthLayout';
import AuthInput from '@/components/AuthInput';

export default function Login() {
  return (
    <AuthLayout>
      <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-4">
          <AuthInput type="email" placeholder="EMAIL ADDRESS" />
          <AuthInput type="password" placeholder="PASSWORD" />
        </div>

        <div className="space-y-3 pt-6 flex flex-col items-center">
          <Link href="/" className="block">
            <button className="bg-transparent border-0 text-black text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-70 transition-opacity">
              Initialize Session
            </button>
          </Link>
          <Link href="/signup">
            <button type="button" className="bg-transparent text-gray-400 text-[9px] font-bold uppercase tracking-widest hover:text-black transition-colors mt-2">
              Create New Trace Identity
            </button>
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
