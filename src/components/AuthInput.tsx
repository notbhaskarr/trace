import React from 'react';

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  placeholder: string;
}

export default function AuthInput({ placeholder, ...props }: AuthInputProps) {
  return (
    <div>
      <input 
        placeholder={placeholder}
        className="w-full bg-transparent border-0 border-b border-gray-200 text-[11px] font-semibold py-2 focus:outline-none focus:ring-0 focus:border-black transition-colors placeholder:text-gray-300 placeholder:font-bold placeholder:tracking-widest"
        {...props}
      />
    </div>
  );
}
