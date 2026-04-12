"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type ThemeColor = "blue" | "green" | "purple" | "orange" | "red" | "teal" | "indigo" | "rose";

interface ThemeConfig {
  primary: string;       // primary-600
  primaryLight: string;  // primary-50/100
  primaryText: string;   // primary-700
  primaryDark: string;   // primary-800
  gradientFrom: string;  // gradient start
  gradientTo: string;    // gradient end
}

const themeConfigs: Record<ThemeColor, ThemeConfig> = {
  blue: {
    primary: "59 130 246",         // blue-500
    primaryLight: "239 246 255",   // blue-50
    primaryText: "29 78 216",      // blue-700
    primaryDark: "30 64 175",      // blue-800
    gradientFrom: "37 99 235",     // blue-600
    gradientTo: "22 163 74",       // green-600
  },
  green: {
    primary: "34 197 94",          // green-500
    primaryLight: "240 253 244",   // green-50
    primaryText: "21 128 61",      // green-700
    primaryDark: "22 101 52",      // green-800
    gradientFrom: "22 163 74",     // green-600
    gradientTo: "13 148 136",      // teal-600
  },
  purple: {
    primary: "168 85 247",         // purple-500
    primaryLight: "250 245 255",   // purple-50
    primaryText: "126 34 206",     // purple-700
    primaryDark: "107 33 168",     // purple-800
    gradientFrom: "147 51 234",    // purple-600
    gradientTo: "219 39 119",      // pink-600
  },
  orange: {
    primary: "249 115 22",         // orange-500
    primaryLight: "255 247 237",   // orange-50
    primaryText: "194 65 12",      // orange-700
    primaryDark: "154 52 18",      // orange-800
    gradientFrom: "234 88 12",     // orange-600
    gradientTo: "202 138 4",       // yellow-600
  },
  red: {
    primary: "239 68 68",          // red-500
    primaryLight: "254 242 242",   // red-50
    primaryText: "185 28 28",      // red-700
    primaryDark: "153 27 27",      // red-800
    gradientFrom: "220 38 38",     // red-600
    gradientTo: "219 39 119",      // pink-600
  },
  teal: {
    primary: "20 184 166",         // teal-500
    primaryLight: "240 253 250",   // teal-50
    primaryText: "15 118 110",     // teal-700
    primaryDark: "17 94 89",       // teal-800
    gradientFrom: "13 148 136",    // teal-600
    gradientTo: "2 132 199",       // sky-600
  },
  indigo: {
    primary: "99 102 241",         // indigo-500
    primaryLight: "238 242 255",   // indigo-50
    primaryText: "67 56 202",      // indigo-700
    primaryDark: "55 48 163",      // indigo-800
    gradientFrom: "79 70 229",     // indigo-600
    gradientTo: "147 51 234",      // purple-600
  },
  rose: {
    primary: "244 63 94",          // rose-500
    primaryLight: "255 241 242",   // rose-50
    primaryText: "190 18 60",      // rose-700
    primaryDark: "159 18 57",      // rose-800
    gradientFrom: "225 29 72",     // rose-600
    gradientTo: "249 115 22",      // orange-600
  },
};

export const themeLabels: Record<ThemeColor, string> = {
  blue: "Biru",
  green: "Hijau",
  purple: "Ungu",
  orange: "Oranye",
  red: "Merah",
  teal: "Teal",
  indigo: "Indigo",
  rose: "Rose",
};

// Tailwind color classes for preview circles
export const themePreviewColors: Record<ThemeColor, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  teal: "bg-teal-500",
  indigo: "bg-indigo-500",
  rose: "bg-rose-500",
};

interface ThemeContextType {
  theme: ThemeColor;
  setTheme: (theme: ThemeColor) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "blue",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyTheme(color: ThemeColor) {
  const config = themeConfigs[color];
  const root = document.documentElement;
  root.style.setProperty("--theme-primary", config.primary);
  root.style.setProperty("--theme-primary-light", config.primaryLight);
  root.style.setProperty("--theme-primary-text", config.primaryText);
  root.style.setProperty("--theme-primary-dark", config.primaryDark);
  root.style.setProperty("--theme-gradient-from", config.gradientFrom);
  root.style.setProperty("--theme-gradient-to", config.gradientTo);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeColor>("blue");

  useEffect(() => {
    const saved = localStorage.getItem("cbt-theme") as ThemeColor | null;
    if (saved && themeConfigs[saved]) {
      setThemeState(saved);
      applyTheme(saved);
    } else {
      applyTheme("blue");
    }
  }, []);

  const setTheme = useCallback((color: ThemeColor) => {
    setThemeState(color);
    localStorage.setItem("cbt-theme", color);
    applyTheme(color);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
