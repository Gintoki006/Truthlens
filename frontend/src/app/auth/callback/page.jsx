"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";

/**
 * OAuth callback handler.
 * Exchanges the auth code for a session and redirects to home.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    // The URL contains the auth code after OAuth redirect
    const handleCallback = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (error) {
        console.error("OAuth callback error:", error);
      }

      // Redirect to home regardless
      router.push("/");
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-bright)]">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-3 border-[#b7211f]/20 border-t-[#b7211f] rounded-full animate-spin mx-auto" />
        <p
          className="text-sm text-[var(--text-secondary)]"
          style={{ fontFamily: "'Work Sans', sans-serif" }}
        >
          Completing sign-in...
        </p>
      </div>
    </div>
  );
}
