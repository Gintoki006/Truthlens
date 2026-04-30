"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

/**
 * Authentication form — email + password login/signup with Google OAuth.
 */
export default function AuthForm({ mode: initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="w-full max-w-sm mx-auto">
      <h2
        className="text-3xl font-bold mb-2 text-center text-[var(--text-primary)]"
        style={{ fontFamily: "'Newsreader', serif" }}
      >
        {mode === "login" ? "Welcome back" : "Create account"}
      </h2>
      <p
        className="text-sm text-center text-[var(--text-secondary)] mb-8"
        style={{ fontFamily: "'Work Sans', sans-serif" }}
      >
        {mode === "login"
          ? "Sign in to access your analysis history"
          : "Join TruthLens to save your analyses"}
      </p>

      {/* Google OAuth */}
      <button
        onClick={handleGoogleLogin}
        className="
          w-full py-3 rounded-xl border border-[var(--border-color)]
          bg-[var(--surface-bright)] text-[var(--text-primary)]
          font-medium text-sm
          hover:bg-[var(--surface-dim)] transition-all duration-200
          flex items-center justify-center gap-3
        "
        style={{ fontFamily: "'Work Sans', sans-serif" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-[var(--border-color)]" />
        <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider" style={{ fontFamily: "'Work Sans', sans-serif" }}>
          or
        </span>
        <div className="flex-1 h-px bg-[var(--border-color)]" />
      </div>

      {/* Email/Password form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            className="block text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] mb-1.5"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="
              w-full px-4 py-3 rounded-lg
              bg-[var(--surface-bright)] border border-[var(--border-color)]
              text-[var(--text-primary)] text-sm
              focus:outline-none focus:ring-2 focus:ring-[#b7211f]/30 focus:border-[#b7211f]/50
              transition-all duration-200
            "
            style={{ fontFamily: "'Work Sans', sans-serif" }}
            placeholder="you@example.com"
            disabled={loading}
          />
        </div>

        <div>
          <label
            className="block text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] mb-1.5"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="
              w-full px-4 py-3 rounded-lg
              bg-[var(--surface-bright)] border border-[var(--border-color)]
              text-[var(--text-primary)] text-sm
              focus:outline-none focus:ring-2 focus:ring-[#b7211f]/30 focus:border-[#b7211f]/50
              transition-all duration-200
            "
            style={{ fontFamily: "'Work Sans', sans-serif" }}
            placeholder="Min. 6 characters"
            disabled={loading}
          />
        </div>

        {error && (
          <p className="text-sm text-[#E24B4A]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
            ⚠ {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-[#639922]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
            ✓ {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="
            w-full py-3 rounded-xl
            bg-[#b7211f] text-white font-semibold text-sm
            hover:bg-[#9a1b19] disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
            shadow-lg shadow-[#b7211f]/20
          "
          style={{ fontFamily: "'Work Sans', sans-serif" }}
        >
          {loading ? "Processing..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>
      </form>

      {/* Toggle login/signup */}
      <p
        className="mt-6 text-center text-sm text-[var(--text-secondary)]"
        style={{ fontFamily: "'Work Sans', sans-serif" }}
      >
        {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
        <button
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setMessage(null); }}
          className="text-[#b7211f] font-semibold hover:underline"
        >
          {mode === "login" ? "Sign up" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
