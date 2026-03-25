import React from 'react';

export default function AuraLogo({ className = "" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="40" fill="url(#sun-gradient)" />
        <path d="M25 60 L45 40 L60 55 L85 25" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className="text-slate-900" />
        <path d="M25 60 L45 40 L60 55 L85 25" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        
        <defs>
          <linearGradient id="sun-gradient" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F59E0B" />
            <stop offset="1" stopColor="#D97706" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-2xl font-bold tracking-tight text-white font-sans">
        Aura<span className="text-amber-500">Sol</span>
      </span>
    </div>
  );
}
