import Link from "next/link";
import React from "react";

/**
 * The design-system button (ui-btn in app/ui.css), as a <button> or a link.
 *
 *   primary    navy, the one main action on a screen
 *   accent     ProFixter blue, for the free-visit booking action only
 *   secondary  white with a hairline border
 *   ghost      text-like, for tertiary actions
 *   light / outline-light   on a navy band
 *
 * Sizes: sm (44px on touch, 40px on a desktop pointer), md (48px), lg (52px).
 */
export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "light" | "outline-light";
export type ButtonSize = "sm" | "md" | "lg";

export function buttonClass({
  variant = "primary",
  size = "md",
  block = false,
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
} = {}) {
  return [
    "ui-btn",
    `ui-btn--${variant}`,
    size !== "md" ? `ui-btn--${size}` : "",
    block ? "ui-btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
};

export function Button({ variant = "primary", size = "md", block = false, className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, block, className })} {...props} />;
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
};

export function ButtonLink({ variant = "primary", size = "md", block = false, className = "", ...props }: ButtonLinkProps) {
  return <Link className={buttonClass({ variant, size, block, className })} {...props} />;
}

export default Button;
