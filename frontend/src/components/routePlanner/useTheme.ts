import { useEffect, useState } from "react";
import type { Theme } from "../types";

const THEME_STORAGE_KEY = "theme";
const THEME_PREFERENCE_SOURCE_KEY = "themePreferenceSource";

const isBrowser = () => typeof window !== "undefined";

const getSavedTheme = (): Theme | null => {
  if (!isBrowser()) {
    return null;
  }

  const preferenceSource = localStorage.getItem(THEME_PREFERENCE_SOURCE_KEY);
  if (preferenceSource !== "manual") {
    return null;
  }

  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return null;
};

const getSystemTheme = (): Theme => {
  if (!isBrowser() || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => getSavedTheme() ?? getSystemTheme());
  const [hasStoredPreference, setHasStoredPreference] = useState<boolean>(() => getSavedTheme() !== null);

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    if (hasStoredPreference) {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      localStorage.setItem(THEME_PREFERENCE_SOURCE_KEY, "manual");
    } else {
      localStorage.removeItem(THEME_STORAGE_KEY);
      localStorage.removeItem(THEME_PREFERENCE_SOURCE_KEY);
    }
  }, [theme, hasStoredPreference]);

  useEffect(() => {
    if (hasStoredPreference || !isBrowser() || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? "dark" : "light");
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    }

    mediaQuery.addListener(handleChange);
    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, [hasStoredPreference]);

  const toggleTheme = () => {
    setHasStoredPreference(true);
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  return {
    theme,
    toggleTheme,
  };
};
