import React from "react";

/**
 * The design-system card (ui-card in app/ui.css).
 *
 *   default  white with a hairline border
 *   raised   white with a soft shadow, no border
 *   soft     warm stone, no border
 *   dark     navy
 */
type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "raised" | "soft" | "dark";
};

export function Card({ variant = "default", className = "", ...props }: CardProps) {
  return <div className={["ui-card", variant !== "default" ? `ui-card--${variant}` : "", className].filter(Boolean).join(" ")} {...props} />;
}

export default Card;
