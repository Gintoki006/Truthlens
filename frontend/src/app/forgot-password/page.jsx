"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-bright)]">
      <header className="border-b border-[var(--border-color)] px-6 py-3">
        <Link
          href="/"
          className="text-xl font-bold text-[var(--text-primary)]"
          style={{ fontFamily: "'Newsreader', serif" }}
        >
          TruthLens
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm mx-auto">
          <h2
            className="text-3xl font-bold mb-2 text-center text-[var(--text-primary)]"
            style={{ fontFamily: "'Newsreader', serif" }}
          >
            Reset password
          </h2>
          <p
            className="text-sm text-center text-[var(--text-secondary)] mb-8"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            Enter your email and we&apos;ll send a magic link to reset your password.
          </p>

          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#EAF3DE] flex items-center justify-center">
                <span className="text-2xl">✉️</span>
              </div>
              <p
                className="text-sm text-[#639922] font-medium"
                style={{ fontFamily: "'Work Sans', sans-serif" }}
              >
                Check your email for a password reset link.
              </p>
              <p
                className="text-xs text-[var(--text-secondary)]"
                style={{ fontFamily: "'Work Sans', sans-serif" }}
              >
                Didn&apos;t receive it? Check your spam folder or try again.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-sm text-[#b7211f] font-semibold hover:underline"
                style={{ fontFamily: "'Work Sans', sans-serif" }}
              >
                Try again
              </button>
            </div>
          ) : (
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

              {error && (
                <p className="text-sm text-[#E24B4A]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                  ⚠ {error}
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
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          )}

          <p
            className="mt-6 text-center text-sm text-[var(--text-secondary)]"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            Remember your password?{" "}
            <Link href="/login" className="text-[#b7211f] font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
