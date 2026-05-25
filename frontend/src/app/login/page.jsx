"use client";

import AuthForm from "@/components/forms/AuthForm";
import Link from "next/link";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

export default function LoginPage() {
  const [location, setLocation] = useState("DETECTING NODE...");

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        const parts = tz.split('/');
        const city = parts[parts.length - 1].replace(/_/g, ' ').toUpperCase();
        const region = parts.length > 1 ? parts[0].toUpperCase() : '';
        setLocation(region ? `${region} / ${city}` : city);
      } else {
        setLocation("GLOBAL NETWORK");
      }
    } catch (e) {
      setLocation("GLOBAL NETWORK");
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8f7f5] dark:bg-background text-[#1c1b1b] dark:text-stone-100">
      {/* Left side: Form */}
      <div className="w-full md:w-1/2 lg:w-[45%] flex flex-col min-h-screen">
        
        {/* Newspaper style header */}
        <header className="px-10 py-8">
          <div className="flex justify-between items-end border-b-[1.5px] border-[#d4d4d4] dark:border-stone-700 pb-4">
            <div className="flex flex-col">
              <span className="font-label text-[8px] font-bold tracking-[0.2em] text-[#5b6a7a] dark:text-stone-400 uppercase mb-1">
                HEURISTIC VERIFICATION ENGINE
              </span>
              <Link
                href="/"
                className="text-xl font-black uppercase tracking-tight text-[#1c1b1b] dark:text-stone-100"
                style={{ fontFamily: "'Newsreader', serif", letterSpacing: '-0.02em' }}
              >
                TruthLens
              </Link>
            </div>
            
            <div className="flex flex-col items-end text-right">
              <span className="font-label text-[8px] font-bold tracking-[0.2em] text-[#5b6a7a] dark:text-stone-400 uppercase mb-1">
                &copy; 2026
              </span>
              <span className="font-label text-[8px] font-bold tracking-[0.1em] text-[#5b6a7a] dark:text-stone-400 uppercase">
                {location}
              </span>
            </div>
          </div>
        </header>
        
        <div className="flex-1 flex items-center justify-center px-10 py-12">
          <div className="w-full">
            <AuthForm mode="login" />
          </div>
        </div>

      </div>

      {/* Right side: Visual Panel */}
      <div 
        className="hidden md:flex w-full md:w-1/2 lg:w-[55%] relative overflow-hidden"
        style={{
          backgroundImage: "url('/newspaper_archive_bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      >
        {/* Subtle overlay to ensure the image blends nicely if it's too bright */}
        <div className="absolute inset-0 bg-[#1c1b1b]/20 mix-blend-multiply pointer-events-none" />
        
        {/* Optional text or logo overlay in the corner if desired */}
        <div className="absolute bottom-8 right-10">
           <span className="font-label text-[8px] font-bold tracking-[0.2em] text-[#f8f7f5]/80 uppercase drop-shadow-md">
             SYSTEM ONLINE
           </span>
        </div>
      </div>
    </div>
  );
}
