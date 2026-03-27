"use client";

import { useState, useEffect, useCallback } from "react";

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  updatedAt: string | null;
}

export function useApi<T>(
  endpoint: string,
  params: Record<string, string | null | undefined>,
  refreshKey?: number
): ApiState<T> & { refetch: () => void } {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: true,
    error: null,
    updatedAt: null,
  });

  const fetchData = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const url = new URL(endpoint, window.location.origin);
      Object.entries(params).forEach(([k, v]) => {
        if (v != null) url.searchParams.set(k, v);
      });

      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || `API error ${res.status}`);
      }

      setState({
        data: json,
        loading: false,
        error: null,
        updatedAt: json.updatedAt || new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setState(s => ({ ...s, loading: false, error: msg, updatedAt: null }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, JSON.stringify(params), refreshKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}
