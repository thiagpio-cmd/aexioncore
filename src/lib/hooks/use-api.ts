"use client";

import { useState, useEffect, useCallback } from "react";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

interface UseApiOptions {
  /** Don't fetch on mount */
  manual?: boolean;
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  pagination: ApiResponse<T>["pagination"] | null;
  refetch: () => Promise<void>;
}

export function useApi<T = any>(
  url: string | null,
  options?: UseApiOptions
): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!options?.manual);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<ApiResponse<T>["pagination"] | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(url);
      const json: ApiResponse<T> = await res.json();

      if (!json.success) {
        setError(json.error?.message || "An error occurred");
        setData(null);
      } else {
        setData(json.data);
        setPagination(json.pagination || null);
      }
    } catch (err: any) {
      setError(err.message || "Network error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (!options?.manual) {
      fetchData();
    }
  }, [fetchData, options?.manual]);

  return { data, loading, error, pagination, refetch: fetchData };
}

export async function apiPost<T = any>(
  url: string,
  body: any
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: ApiResponse<T> = await res.json();
    if (!json.success) {
      return { data: null, error: json.error?.message || "Error" };
    }
    return { data: json.data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Network error" };
  }
}

export async function apiPut<T = any>(
  url: string,
  body: any
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: ApiResponse<T> = await res.json();
    if (!json.success) {
      return { data: null, error: json.error?.message || "Error" };
    }
    return { data: json.data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Network error" };
  }
}

export async function apiPatch<T = any>(
  url: string,
  body: any
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: ApiResponse<T> = await res.json();
    if (!json.success) {
      return { data: null, error: json.error?.message || "Error" };
    }
    return { data: json.data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Network error" };
  }
}

export async function apiDelete(
  url: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const res = await fetch(url, { method: "DELETE" });
    const json = await res.json();
    if (!json.success) {
      return { success: false, error: json.error?.message || "Error" };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Network error" };
  }
}
