import React from "react";

/**
 * Headings on the design-system scale (app/ui.css).
 *
 * `level` is the semantic tag; `size` is how it looks, so an H2 can carry the
 * display size on a page whose H1 is elsewhere. Defaults: h1 display, h2 h2,
 * h3/h4 h3.
 */
type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> & {
  level?: 1 | 2 | 3 | 4;
  size?: "display" | "h2" | "h3";
  eyebrow?: React.ReactNode;
};

const DEFAULT_SIZE = { 1: "display", 2: "h2", 3: "h3", 4: "h3" } as const;

export function Heading({ level = 2, size, eyebrow, className = "", children, ...props }: HeadingProps) {
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
  const look = size ?? DEFAULT_SIZE[level];
  const heading = (
    <Tag className={[`ui-${look}`, className].filter(Boolean).join(" ")} {...props}>
      {children}
    </Tag>
  );
  if (!eyebrow) return heading;
  return (
    <>
      <p className="ui-eyebrow">{eyebrow}</p>
      {heading}
    </>
  );
}

export default Heading;
