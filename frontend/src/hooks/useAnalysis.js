"use client";

import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

/**
 * Hook to fetch a single analysis result by ID.
 * Uses Supabase directly for client-side fetching.
 */
export function useAnalysis(id) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;

    const supabase = getSupabaseBrowserClient();

    async function fetchAnalysis() {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from("analysis")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchError) throw fetchError;
        setAnalysis(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalysis();
  }, [id]);

  return { analysis, loading, error };
}
