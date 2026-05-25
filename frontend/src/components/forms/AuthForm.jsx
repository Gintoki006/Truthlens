"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function AuthForm({ mode: initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const { signIn, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await signIn(email, password);
        router.push("/");
      } else {
        await signUp(email, password);
        setMessage("Check your email for a confirmation link.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Decorative dash */}
      <div className="w-16 h-[3px] bg-[#1c1b1b] mb-8" />
      
      <h2
        className="text-5xl md:text-6xl font-bold mb-10 text-[#1c1b1b] dark:text-stone-100 leading-[1.1]"
        style={{ fontFamily: "'Newsreader', serif", letterSpacing: '-0.02em' }}
      >
        {mode === "login" ? (
          <>Verify the <br/> Truth</>
        ) : (
          <>Join the <br/> Network</>
        )}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <label className="block font-label text-[9px] font-bold uppercase tracking-[0.15em] text-[#5b6a7a] dark:text-stone-400 mb-3">
            USER IDENTIFICATION (EMAIL)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="
              w-full py-2 bg-transparent border-b-[1.5px] border-[#a0aab5] dark:border-stone-600
              text-[#5b6a7a] dark:text-stone-300 font-sans text-base
              focus:outline-none focus:border-[#1c1b1b] dark:focus:border-stone-300 transition-colors rounded-none
            "
            placeholder="j.doe@archives.gov"
            disabled={loading}
          />
        </div>

        <div className="relative">
          <label className="block font-label text-[9px] font-bold uppercase tracking-[0.15em] text-[#5b6a7a] dark:text-stone-400 mb-3">
            CIPHER KEY (PASSWORD)
          </label>
          <div className="relative flex items-center border-b-[1.5px] border-[#a0aab5] dark:border-stone-600 focus-within:border-[#1c1b1b] dark:focus-within:border-stone-300 transition-colors">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="
                w-full py-2 bg-transparent
                text-[#5b6a7a] dark:text-stone-300 font-sans text-base tracking-widest
                focus:outline-none rounded-none
              "
              placeholder={showPassword ? "min 6 characters" : "••••••••••••"}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 p-2 text-[#a0aab5] hover:text-[#1c1b1b] dark:hover:text-stone-300 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="py-2 text-left">
            <p className="font-label text-[9px] uppercase tracking-[0.1em] text-[#b7211f] font-bold">
              ERROR: {error}
            </p>
          </div>
        )}
        {message && (
          <div className="py-2 text-left">
            <p className="font-label text-[9px] uppercase tracking-[0.1em] text-[#00c853] font-bold">
              STATUS: {message}
            </p>
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="
              w-full py-4
              bg-[#0a0a0a] text-white font-label text-[11px] font-bold uppercase tracking-[0.2em]
              hover:bg-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
            "
          >
            {loading ? "PROCESSING..." : mode === "login" ? "AUTHENTICATE" : "REGISTER"}
          </button>
        </div>

        {/* Action Links */}
        <div className="flex justify-between items-center pt-2">
          {mode === "login" && (
            <a
              href="/forgot-password"
              className="font-label text-[9px] text-[#5b6a7a] font-bold uppercase tracking-[0.1em] border-b border-[#5b6a7a] pb-0.5 hover:text-[#1c1b1b] hover:border-[#1c1b1b] transition-colors"
            >
              FORGOT CREDENTIALS?
            </a>
          )}
          {mode !== "login" && (
            <div /> // Spacer
          )}
          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setMessage(null); }}
            className="font-label text-[9px] text-[#5b6a7a] font-bold uppercase tracking-[0.1em] border-b border-[#5b6a7a] pb-0.5 hover:text-[#1c1b1b] hover:border-[#1c1b1b] transition-colors"
          >
            {mode === "login" ? "REQUEST ACCESS" : "AUTHENTICATE"}
          </button>
        </div>
      </form>

      <div className="flex items-center gap-4 my-10">
        <div className="flex-1 h-[1px] bg-[#d4d4d4] dark:bg-stone-700" />
      </div>

      {/* Google OAuth (Secondary) */}
      <button
        onClick={handleGoogleLogin}
        className="
          w-full py-3.5 border border-[#d4d4d4] dark:border-stone-700
          bg-transparent text-[#5b6a7a] dark:text-stone-400
          font-label text-[9px] font-bold uppercase tracking-[0.15em]
          hover:bg-[#f0f0f0] dark:hover:bg-stone-800 hover:text-[#1c1b1b] dark:hover:text-stone-100
          transition-colors duration-200 flex items-center justify-center gap-3
        "
      >
        <svg width="14" height="14" viewBox="0 0 24 24" className="mr-1">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="currentColor" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor" />
        </svg>
        USE EXTERNAL PROVIDER (GOOGLE)
      </button>
    </div>
  );
}
