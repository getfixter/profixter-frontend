"use client";

import Link from "next/link";
import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive" | "danger";

type BaseProps = {
  variant?: ButtonVariant;
  /** Show the spinner on this button and disable it. */
  busy?: boolean;
  /** Full width. */
  block?: boolean;
  /** 44px even with a mouse (sheet footers). */
  large?: boolean;
  /** Icon before the label. */
  icon?: ReactNode;
  children: ReactNode;
};

export type ButtonProps = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children"> & {
    /**
     * May return a promise: the button then shows its own spinner until it
     * settles, so the spinner is always on the button that was pressed and a
     * second tap does nothing.
     */
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => unknown;
  };

/**
 * Button (J.5). 44px on touch, 36px with a mouse. Primary = accent fill;
 * secondary = white with a line; tertiary = text; destructive = red text;
 * danger = filled red, only inside a confirmation.
 *
 *   <Button onClick={save}>Save</Button>                  // save returns a promise: auto busy
 *   <Button variant="secondary" busy={saving}>Save</Button>
 *   <Button variant="danger" onClick={cancelJob}>Cancel job</Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", busy, block, large, icon, children, className, disabled, onClick, type = "button", ...rest },
  ref
) {
  const [selfBusy, setSelfBusy] = useState(false);
  const isBusy = Boolean(busy || selfBusy);
  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      disabled={disabled || isBusy}
      aria-busy={isBusy || undefined}
      className={cx("adm-btn", `adm-btn--${variant}`, block && "adm-btn--block", large && "adm-btn--lg", className)}
      onClick={(event) => {
        if (isBusy || !onClick) return;
        const result = onClick(event);
        if (result && typeof (result as Promise<unknown>).then === "function") {
          setSelfBusy(true);
          (result as Promise<unknown>).then(
            () => setSelfBusy(false),
            () => setSelfBusy(false)
          );
        }
      }}
    >
      {isBusy && <span className="adm-spinner" aria-hidden="true" />}
      <span className="adm-btn-label inline-flex items-center gap-2" data-hidden={isBusy || undefined}>
        {icon}
        {children}
      </span>
      {isBusy && <span className="sr-only">Working…</span>}
    </button>
  );
});

/** A link that looks like a Button (navigation, never an action). */
export function ButtonLink({
  href,
  variant = "secondary",
  block,
  icon,
  children,
  className,
  ...rest
}: Omit<BaseProps, "busy" | "large"> & { href: string; className?: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const external = /^(https?:|tel:|sms:|mailto:)/.test(href);
  const cls = cx("adm-btn", `adm-btn--${variant}`, block && "adm-btn--block", className);
  const inner = (
    <span className="inline-flex items-center gap-2">
      {icon}
      {children}
    </span>
  );
  return external ? (
    <a href={href} className={cls} {...rest}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls} {...rest}>
      {inner}
    </Link>
  );
}

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** Required: the button has no visible text. */
  label: string;
  icon: ReactNode;
  /** A small count or dot on the icon. */
  badge?: number | boolean;
};

/** A 44x44 hit area with a 20px icon (J.5). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, badge, className, type = "button", ...rest },
  ref
) {
  return (
    <button ref={ref} type={type} aria-label={label} title={label} className={cx("adm-icon-btn", className)} {...rest}>
      {icon}
      {badge ? <CountBadge value={badge} className="absolute right-1.5 top-1.5" /> : null}
    </button>
  );
});

/** The red count used on navigation and icon buttons: "9+" at most. */
export function CountBadge({ value, className }: { value: number | boolean; className?: string }) {
  if (value === true) {
    return <span aria-hidden="true" className={cx("block h-2.5 w-2.5 rounded-full bg-adm-problem ring-2 ring-adm-surface", className)} />;
  }
  if (!value || value < 1) return null;
  return (
    <span
      className={cx(
        "adm-num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-adm-problem px-1 text-[12px] font-bold leading-none text-white ring-2 ring-adm-surface",
        className
      )}
    >
      {value > 9 ? "9+" : value}
    </span>
  );
}
