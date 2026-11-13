import type { ReactNode } from "react";

/* A row that opens the customer's record when the viewer may, and is plain text otherwise. */
export default function MaybeLink({ href, className, children, onClick }: { href: string | null; className: string; children: ReactNode; onClick?: () => void }) {
  return href ? (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ) : (
    <div className={className}>{children}</div>
  );
}
