"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { useAuth } from "@/lib/useAuth";

const MEMBERSHIP_PLANS_HREF = "/membership#plans";
const MEMBERSHIP_SIGNUP_HREF = "/signup?redirect=%2Fmembership%23plans";

type MembershipCtaLinkProps = {
  children: ReactNode;
} & Pick<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "aria-label" | "className" | "onClick" | "style"
>;

export default function MembershipCtaLink({
  children,
  className,
  onClick,
  style,
  ...anchorProps
}: MembershipCtaLinkProps) {
  const { isAuthenticated } = useAuth();

  return (
    <Link
      href={isAuthenticated ? MEMBERSHIP_PLANS_HREF : MEMBERSHIP_SIGNUP_HREF}
      className={className}
      onClick={onClick}
      style={style}
      {...anchorProps}
    >
      {isAuthenticated ? children : "Create Account"}
    </Link>
  );
}
