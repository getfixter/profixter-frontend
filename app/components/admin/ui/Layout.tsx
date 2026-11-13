"use client";

import { ChevronRightIcon } from "@heroicons/react/20/solid";
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./Button";

export type ListRowProps = {
  title: ReactNode;
  /** Second line: address, technician, plan. */
  subtitle?: ReactNode;
  /** Right-aligned small text above the trailing slot: time, amount, age. */
  meta?: ReactNode;
  /** Before the text: an avatar, a time, an icon. */
  leading?: ReactNode;
  /** After the text, before the chevron: a badge. */
  trailing?: ReactNode;
  /** Badges after the title (wrapping under it when they do not fit), instead of a trailing column that would squeeze the name. */
  footer?: ReactNode;
  chevron?: boolean;
  href?: string;
  onClick?: () => void;
  /** Accessible name when the visible title is not enough. */
  label?: string;
  className?: string;
  selected?: boolean;
};

/**
 * A two-line row with a full-row tap target and a chevron (J.5). The title
 * and subtitle wrap to a second line instead of being cut off (names and
 * addresses must stay readable on a 320px phone); only longer text is
 * clamped. `footer` puts badges after the title. Rows hold
 * no buttons: actions live in the detail. Use inside <ul role="list"> or a
 * <Section>.
 *
 *   <ListRow href={`/admin/jobs/${id}`} title="Maria Lopez" subtitle="12 Oak St · Taras"
 *            leading={<span className="adm-num">9:00</span>} trailing={<StatusBadge status="pending" />} />
 */
export function ListRow({ title, subtitle, meta, leading, trailing, footer, chevron = true, href, onClick, label, className, selected }: ListRowProps) {
  const body = (
    <>
      {leading && <span className="flex flex-none items-center text-adm-text-2">{leading}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {footer ? (
          // The badges follow the title on its line when they fit, and wrap under it when they do not: never squeezed, never cut.
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="adm-clamp-2 max-w-full text-[15px] font-semibold leading-5 text-adm-ink" data-row-title="">
              {title}
            </span>
            <span className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">{footer}</span>
          </span>
        ) : (
          <span className="adm-clamp-2 text-[15px] font-semibold leading-5 text-adm-ink" data-row-title="">
            {title}
          </span>
        )}
        {subtitle && (
          <span className="adm-clamp-2 text-[13px] leading-[18px] text-adm-text-2" data-row-subtitle="">
            {subtitle}
          </span>
        )}
      </span>
      {(meta || trailing) && (
        <span className="flex flex-none flex-col items-end gap-1">
          {meta && <span className="adm-num text-[13px] text-adm-text-2">{meta}</span>}
          {trailing}
        </span>
      )}
      {chevron && <ChevronRightIcon className="h-5 w-5 flex-none text-adm-text-3" aria-hidden="true" />}
    </>
  );
  const cls = cx(
    "flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-adm-bg focus-visible:bg-adm-bg",
    selected && "bg-adm-accent-soft",
    className
  );
  return (
    <li className="border-b border-adm-line last:border-b-0">
      {href ? (
        <Link href={href} scroll={false} aria-label={label} aria-current={selected ? "true" : undefined} className={cls}>
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} aria-label={label} className={cls}>
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}

/**
 * A titled group: section heading (15/600) with an optional count and action,
 * then its content on a white surface with hairline rows.
 *
 *   <Section title="Today" count={7} action={<Button variant="tertiary">Route</Button>}>
 *     <ul role="list">{rows}</ul>
 *   </Section>
 */
export function Section({
  title,
  count,
  action,
  children,
  flush = false,
  className,
  id,
}: {
  title?: ReactNode;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  /** No white surface: the content brings its own. */
  flush?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section className={cx("flex flex-col gap-2", className)} aria-labelledby={title && id ? `${id}-h` : undefined}>
      {(title || action) && (
        <div className="flex min-h-[36px] items-center justify-between gap-3 px-1">
          {title && (
            <h2 id={id ? `${id}-h` : undefined} className="text-[15px] font-semibold text-adm-ink">
              {title}
              {typeof count === "number" && <span className="adm-num font-normal text-adm-text-3"> · {count}</span>}
            </h2>
          )}
          {action}
        </div>
      )}
      {flush ? children : <div className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface">{children}</div>}
    </section>
  );
}

/** Grouped detail content (a money block, a next step): radius 14, hairline, no shadow. */
export function Card({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-adm-md border border-adm-line bg-adm-surface p-4", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h3 className="text-[15px] font-semibold text-adm-ink">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * The page header inside a section. On phones the shell header already shows
 * the section name, so the title here is for screen readers only and the
 * actions row stays; from 1024px the title shows.
 *
 *   <PageHeader title="Leads" description="Estimate and service requests" actions={<Button>New</Button>} />
 */
export function PageHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0">
        <h1 className="adm-page-title text-[22px] font-semibold tracking-[-0.01em] text-adm-ink">{title}</h1>
        {description && <p className="mt-0.5 text-[13px] text-adm-text-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
