"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@venore/plugin-sdk/ui";

// Navegação por abas que rola na horizontal sem scrollbar nativa: fade nas bordas quando há mais
// conteúdo e a aba ativa (`aria-current="page"`) é trazida para a vista ao montar. Os filhos são os
// links (altura de 44 px fica por conta de quem os desenha — ver SCROLL_TAB_CLASS).
export const SCROLL_TAB_CLASS = "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap";

export function ScrollTabs({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const max = element.scrollWidth - element.clientWidth;
    const position = Math.abs(element.scrollLeft);
    setEdges({ start: position > 1, end: position < max - 1 });
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div className="relative">
      <nav
        ref={ref}
        aria-label={label}
        onScroll={measure}
        className={cn("flex overflow-x-auto border-b text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}
      >
        {children}
      </nav>
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-y-0 start-0 w-6 bg-gradient-to-r from-background to-transparent transition-opacity rtl:bg-gradient-to-l", edges.start ? "opacity-100" : "opacity-0")}
      />
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-y-0 end-0 w-6 bg-gradient-to-l from-background to-transparent transition-opacity rtl:bg-gradient-to-r", edges.end ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}
