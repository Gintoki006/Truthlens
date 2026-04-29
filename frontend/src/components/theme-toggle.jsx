"use client"

import * as React from "react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-stone-800 transition-colors flex items-center justify-center text-slate-900 dark:text-stone-100"
      aria-label="Toggle theme"
      suppressHydrationWarning
    >
      {resolvedTheme === "dark" ? (
        <span className="material-symbols-outlined" suppressHydrationWarning>light_mode</span>
      ) : (
        <span className="material-symbols-outlined" suppressHydrationWarning>dark_mode</span>
      )}
    </button>
  )
}
