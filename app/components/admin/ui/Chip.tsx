"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./Button";

export type ChipProps = {
  children: ReactNode;
  /** Selected: ink fill, white text. */
  selected?: boolean;
  /** A count in tabular figures after the label. */
  count?: number;
  /** "attention": amber when not selected, for views that exist because a human is needed. */
  tone?: "default" | "attention";
  icon?: ReactNode;
  className?: string;
} & ({ href: string; onClick?: never; replace?: boolean } | { href?: never; onClick: () => void; replace?: never });

/**
 * A filter chip: 36px visual, 44px hit area, pill. With `href` it is a link
 * that replaces the history entry (filters never stack up Back presses);
 * with `onClick` a toggle button (aria-pressed).
 *
 *   <Chip href="/admin/customers?filter=members" selected={filter === "members"} count={42}>Members</Chip>
 *   <Chip onClick={() => setView("today")} selected={view === "today"}>Today</Chip>
 */
export function Chip(props: ChipProps) {
  const { children, selected, count, tone = "default", icon, className } = props;
  const cls = cx("adm-chip", tone === "attention" && "adm-chip--attn", className);
  const inner = (
    <>
      {icon}
      <span>{children}</span>
      {typeof count === "number" && <span className="adm-num opacity-80">{count}</span>}
    </>
  );
  if (props.href !== undefined) {
    return (
      <Link href={props.href} replace={props.replace !== false} scroll={false} aria-current={selected ? "page" : undefined} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" aria-pressed={Boolean(selected)} onClick={props.onClick} className={cls}>
      {inner}
    </button>
  );
}

/**
 * One row of chips that scrolls sideways on phones; sticky under the header
 * when `sticky` (J.4: the 44px filter bar). Never wraps to a second row.
 */
export function FilterBar({ children, sticky = true, label = "Filters", className }: { children: ReactNode; sticky?: boolean; label?: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cx("adm-filterbar", sticky && "adm-sticky", className)}>
      {children}
    </div>
  );
}
