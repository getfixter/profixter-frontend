"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

/*
 * Signed in with an Admin-issued temporary password: the only page is
 * /set-password, wherever the session was restored. The server enforces the
 * same thing; this just avoids showing screens whose requests it would refuse.
 */
export default function TemporaryPasswordGate() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (user?.mustChangePassword && user.temporaryPassword && pathname !== "/set-password") {
      router.replace("/set-password");
    }
  }, [pathname, router, user]);
  return null;
}
