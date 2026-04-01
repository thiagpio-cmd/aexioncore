"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useOrg } from "@/lib/org-context";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

const STORAGE_KEY = "aexion-theme";

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(176, 172, 165, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

function getRelativeLuminance(hex: string): number {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { org } = useOrg();
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage or org default
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const defaultTheme = (org as Record<string, unknown>).brandThemeDefault as string | undefined;
    const resolved = stored || (defaultTheme === "light" ? "light" : "dark");
    setThemeState(resolved);
    setMounted(true);
  }, [org]);

  // Apply theme attribute
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme, mounted]);

  // Apply tenant accent color
  useEffect(() => {
    if (!mounted) return;
    const accent = (org as Record<string, unknown>).brandAccentColor as string | undefined
      || org.primaryColor
      || "#B0ACA5";

    if (!isValidHex(accent)) return;

    const root = document.documentElement;
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-text", accent);
    root.style.setProperty("--accent-muted", hexToRgba(accent, 0.08));
    root.style.setProperty("--accent-border", hexToRgba(accent, 0.12));
    root.style.setProperty("--accent-glow", hexToRgba(accent, 0.06));
  }, [org, mounted]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { hexToRgba, isValidHex, getRelativeLuminance };
