"use client";

import Link from "next/link";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./Button";

export type TabItem = { id: string; label: ReactNode; count?: number; href?: string; disabled?: boolean };

/**
 * Underline tabs inside a detail (J.5): 44px, scroll sideways when needed,
 * arrow keys move between them. With `href` items they are links (a tab per
 * URL); otherwise buttons with role="tab" and `onChange`.
 *
 *   <Tabs label="Project" value={tab} onChange={setTab}
 *         items={[{ id: "overview", label: "Overview" }, { id: "invoices", label: "Invoices", count: 2 }]} />
 */
export function Tabs({ items, value, onChange, label, className }: { items: TabItem[]; value: string; onChange?: (id: string) => void; label: string; className?: string }) {
  const listRef = useRef<HTMLDivElement>(null);
  const links = items.some((t) => t.href);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const nodes = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-tab]:not([aria-disabled='true'])") || []);
    const current = nodes.findIndex((n) => n === document.activeElement);
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % nodes.length;
    if (event.key === "ArrowLeft") next = (current - 1 + nodes.length) % nodes.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = nodes.length - 1;
    event.preventDefault();
    nodes[next]?.focus();
    if (!links) nodes[next]?.click();
  };

  return (
    <div
      ref={listRef}
      role={links ? undefined : "tablist"}
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx("flex gap-1 overflow-x-auto border-b border-adm-line [scrollbar-width:none]", className)}
    >
      {items.map((item) => {
        const selected = item.id === value;
        const cls = cx(
          "relative inline-flex min-h-[44px] flex-none items-center gap-1.5 px-3 text-[14px] font-semibold whitespace-nowrap transition-colors",
          selected ? "text-adm-ink after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-adm-ink" : "text-adm-text-3 hover:text-adm-ink",
          item.disabled && "pointer-events-none opacity-50"
        );
        const inner = (
          <>
            {item.label}
            {typeof item.count === "number" && <span className="adm-num font-normal text-adm-text-3">{item.count}</span>}
          </>
        );
        return item.href ? (
          <Link key={item.id} href={item.href} replace scroll={false} data-tab="" aria-current={selected ? "page" : undefined} aria-disabled={item.disabled || undefined} className={cls}>
            {inner}
          </Link>
        ) : (
          <button
            key={item.id}
            type="button"
            role="tab"
            data-tab=""
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            aria-disabled={item.disabled || undefined}
            onClick={() => !item.disabled && onChange?.(item.id)}
            className={cls}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
