import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Nothing but metadata now.
 *
 * This layout used to paint the auth background itself - a near-black gradient,
 * two blurred colour glows, a dot texture and a mobile-only logo - and every
 * page under it then drew its own card on top. The shell is now one component
 * the pages mount themselves (AuthScreen), which is what stopped sign in, sign
 * up and password reset from each having a different header and a different
 * idea of where a heading goes.
 *
 * The noindex stays. /signup re-opens itself in its own layout, for the A2P
 * reviewer reason documented there.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
