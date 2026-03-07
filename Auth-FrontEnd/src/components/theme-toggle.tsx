"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="border-blue-500 bg-background text-blue-600 hover:bg-background/80 dark:text-blue-400"
        aria-label="Toggle theme"
        title="Toggle theme"
      />
    );
  }

  const isDark = resolvedTheme === "dark";
  const hintText = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      className="border-blue-500 bg-background text-blue-600 hover:bg-background/80 dark:text-blue-400"
      aria-label={hintText}
      title={hintText}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
