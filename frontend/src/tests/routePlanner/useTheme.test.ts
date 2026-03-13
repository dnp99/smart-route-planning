import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTheme } from "../../components/routePlanner/useTheme";

const installMatchMedia = (initialDarkMode: boolean) => {
  let isDarkMode = initialDarkMode;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () =>
      ({
        matches: isDarkMode,
        media: "(prefers-color-scheme: dark)",
        onchange: null,
        addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
          listeners.add(listener);
        },
        removeEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
          listeners.delete(listener);
        },
        addListener: (listener: (event: MediaQueryListEvent) => void) => {
          listeners.add(listener);
        },
        removeListener: (listener: (event: MediaQueryListEvent) => void) => {
          listeners.delete(listener);
        },
        dispatchEvent: () => true,
      }) as MediaQueryList,
  });

  return {
    setDarkMode(nextDarkMode: boolean) {
      isDarkMode = nextDarkMode;
      listeners.forEach((listener) =>
        listener(
          {
            matches: nextDarkMode,
            media: "(prefers-color-scheme: dark)",
          } as MediaQueryListEvent,
        ),
      );
    },
  };
};

describe("useTheme", () => {
  afterEach(() => {
    localStorage.removeItem("theme");
    localStorage.removeItem("themePreferenceSource");
    document.documentElement.classList.remove("dark");
    vi.restoreAllMocks();
  });

  it("defaults to system light theme when no saved theme", () => {
    installMatchMedia(false);
    localStorage.removeItem("theme");

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBeNull();
  });

  it("defaults to system dark theme when no saved theme", () => {
    installMatchMedia(true);
    localStorage.removeItem("theme");

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBeNull();
  });

  it("uses saved light theme and toggles to dark", () => {
    installMatchMedia(true);
    localStorage.setItem("theme", "light");
    localStorage.setItem("themePreferenceSource", "manual");

    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("uses saved dark theme and toggles to light", () => {
    installMatchMedia(false);
    localStorage.setItem("theme", "dark");
    localStorage.setItem("themePreferenceSource", "manual");

    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("follows system theme changes when no saved preference exists", () => {
    const matchMedia = installMatchMedia(false);
    localStorage.removeItem("theme");

    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");

    act(() => {
      matchMedia.setDarkMode(true);
    });

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBeNull();
  });

  it("ignores legacy auto-saved theme without manual preference marker", () => {
    installMatchMedia(false);
    localStorage.setItem("theme", "dark");
    localStorage.removeItem("themePreferenceSource");

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBeNull();
    expect(localStorage.getItem("themePreferenceSource")).toBeNull();
  });
});
