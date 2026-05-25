"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import ArchiveView from "@/components/ui/ArchiveView";
import Link from "next/link";

export default function HistoryRedirectPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [hasNoData, setHasNoData] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    async function checkLatestAnalysis() {
      const supabase = getSupabaseBrowserClient();
      let query = supabase
        .from("analysis")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (user) {
        query = query.eq("user_id", user.id);
      }
      
      const { data, error } = await query;
      
      if (data && data.length > 0) {
        // Redirect to the latest analysis with the archive view activated
        router.replace(`/results/${data[0].id}?view=archive`);
      } else {
        setHasNoData(true);
      }
    }
    
    checkLatestAnalysis();
  }, [user, authLoading, router]);

  if (hasNoData) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--surface-bright)]">
        <header className="border-b border-[var(--border-color)] px-6 py-3 flex items-center justify-between shrink-0">
          <Link href="/" className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "'Newsreader', serif" }}>
            TruthLens
          </Link>
          <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
            {user ? "Personal History" : "Archive Ledger"}
          </span>
        </header>
        <ArchiveView />
      </div>
    );
  }

  // Loading state while checking latest analysis
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-bright)]">
      <div className="w-8 h-8 border-3 border-[#b7211f]/20 border-t-[#b7211f] rounded-full animate-spin" />
    </div>
  );
}
