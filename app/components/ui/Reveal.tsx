"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Reveals its children once, when they first scroll into view.
 *
 * Intentionally tiny: one IntersectionObserver, a CSS transition, no library.
 * Content is always present in the DOM (it only animates opacity/translate), so
 * it stays readable for crawlers, and the effect is skipped entirely for anyone
 * who prefers reduced motion.
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  /** Stagger in ms, for sequencing siblings. */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Reduced motion is handled entirely in CSS below (motion-reduce:*), which
    // forces the visible state regardless of `shown`. No JS branch needed.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      style={shown ? { transitionDelay: `${delay}ms` } : undefined}
      className={[
        "transition-[opacity,transform] duration-[650ms] ease-[cubic-bezier(0.16,0.84,0.44,1)] motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100",
        className,
      ].join(" ")}
    >
      {children}
    </Tag>
  );
}
