"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { useAuth } from "@/lib/useAuth";
import { hasActiveMembership } from "@/lib/auth-routing";

/*
 * The plan comparison, which is a public page. It used to be /membership#plans,
 * which shows the member dashboard once you subscribe, so a member following a
 * "see the plans" link never reached any plans.
 */
const MEMBERSHIP_PLANS_HREF = "/membership/plans";

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
  const { isAuthenticated, user } = useAuth();
  const isMember = hasActiveMembership(user);

  /*
   * A member is not a prospect. Sending one to "Become a Member" is the site
   * admitting it does not know who is reading, so they get the comparison and
   * the label that matches what it will do.
   *
   * A stranger used to get "Create Account" pointing at signup, which put a
   * registration form in front of four prices that are on a public page
   * anyway. On a page about mounting a television that is a bureaucratic ask
   * for something the visitor did not come for, so they now get the plans
   * themselves and can decide before being asked for anything.
   */
  return (
    <Link
      href={MEMBERSHIP_PLANS_HREF}
      className={className}
      onClick={onClick}
      style={style}
      {...anchorProps}
    >
      {isMember ? "Compare plans" : isAuthenticated ? children : "See plans"}
    </Link>
  );
}
