import React from 'react';
import Link from 'next/link';
import AuthLayout from '@/components/AuthLayout';
import AuthInput from '@/components/AuthInput';
import { signup } from '@/app/login/actions';

export default async function SignUp({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const { error, message } = await searchParams;

  return (
    <AuthLayout>
      <form className="space-y-8" action={signup}>
        <div className="space-y-4">
          <AuthInput 
            name="name"
            type="text" 
            placeholder="FULL NAME" 
            required
          />
          <AuthInput 
            name="username"
            type="text" 
            placeholder="USERNAME" 
            required
          />
          <AuthInput 
            name="email"
            type="email" 
            placeholder="EMAIL ADDRESS" 
            required
          />
          <AuthInput 
            name="password"
            type="password" 
            placeholder="PASSWORD" 
            required
          />
        </div>

        {error && <p className="text-red-500 text-[10px] font-bold text-center uppercase">{error}</p>}
        {message && <p className="text-green-500 text-[10px] font-bold text-center uppercase">{message}</p>}

        <div className="space-y-3 pt-6 flex flex-col items-center">
          <button type="submit" className="bg-transparent border-0 text-black text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-70 transition-opacity cursor-pointer">
            Create Identity
          </button>
          <Link href="/login">
            <button type="button" className="bg-transparent text-gray-400 text-[9px] font-bold uppercase tracking-widest hover:text-black transition-colors mt-2 cursor-pointer">
              Authenticate Existing Identity
            </button>
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
