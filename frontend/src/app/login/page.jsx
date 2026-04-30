"use client";

import AuthForm from "@/components/forms/AuthForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-bright)]">
      {/* Header */}
      <header className="border-b border-[var(--border-color)] px-6 py-3">
        <Link
          href="/"
          className="text-xl font-bold text-[var(--text-primary)]"
          style={{ fontFamily: "'Newsreader', serif" }}
        >
          TruthLens
        </Link>
      </header>

      {/* Auth form */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <AuthForm mode="login" />
      </div>
    </div>
  );
}
