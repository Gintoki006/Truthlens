"use client";

import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/**
 * Hook to fetch the current user's analysis history with real-time updates.
 */
export function useHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    async function fetchHistory() {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from("analysis")
          .select(
            "id, article_title, verdict, score_final, source_domain, created_at"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (fetchError) throw fetchError;
        setHistory(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();

    // Real-time subscription for new analyses
    const channel = supabase
      .channel("user-history")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "analysis",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setHistory((prev) => [payload.new, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { history, loading, error };
}
