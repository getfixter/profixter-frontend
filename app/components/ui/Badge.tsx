import React from "react";

/** A small pill label (ui-tag in app/ui.css). `accent` tints it ProFixter blue. */
type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "accent";
  dot?: boolean;
};

export function Badge({ tone = "neutral", dot = false, className = "", children, ...props }: BadgeProps) {
  return (
    <span className={["ui-tag", tone === "accent" ? "ui-tag--accent" : "", className].filter(Boolean).join(" ")} {...props}>
      {dot ? <span className="ui-tag__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export default Badge;
