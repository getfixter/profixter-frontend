"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS, sectionForPath, type Section, type SectionId } from "@/lib/admin/sections";
import { CountBadge } from "@/app/components/admin/ui";
import { useAdmin } from "./AdminContext";
import { SectionGlyph } from "./icons";
import { HAMMER_MARK } from "./BrandedLoader";

function useBadgeFor() {
  const { badges } = useAdmin();
  return (id: SectionId): number => {
    if (!badges) return 0;
    if (id === "jobs" || id === "my-day") return badges.bookings;
    if (id === "customers") return badges.members;
    if (id === "projects") return badges.projects;
    return 0;
  };
}

/** Which nav item is current: the section of the path, or More for any section listed under More. */
function useCurrent(more: Section[]) {
  const pathname = usePathname() || "";
  const section = sectionForPath(pathname);
  return (id: SectionId) => {
    if (section === id) return true;
    if (id === "more") return section === "more" || more.some((s) => s.id === section);
    return false;
  };
}

/**
 * Phone bottom navigation (K.1): up to four sections plus More, 24px icon and
 * 12px label, active = ink with a 2px top indicator, red count badges. Fixed,
 * 56px + safe-area-bottom, hidden while the keyboard is open (admin.css).
 */
export function BottomNav() {
  const { nav } = useAdmin();
  const badge = useBadgeFor();
  const isCurrent = useCurrent(nav.more);
  const items = nav.more.length ? [...nav.primary, SECTIONS.more] : nav.primary;
  return (
    <nav className="adm-bottomnav" aria-label="Sections" data-adm-bottomnav="">
      {items.map((s) => {
        const count = badge(s.id);
        return (
          <Link key={s.id} href={s.href} aria-current={isCurrent(s.id) ? "page" : undefined} data-nav={s.id}>
            <span className="relative">
              <SectionGlyph icon={s.icon} />
              {count > 0 && <CountBadge value={count} className="absolute -right-2.5 -top-1.5" />}
            </span>
            <span className="adm-bottomnav-label" data-nav-label="">{s.label}</span>
            {count > 0 && <span className="sr-only">, {count} need action</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** Desktop sidebar: the same order, then every More section, one level. */
export function Sidebar() {
  const { nav } = useAdmin();
  const badge = useBadgeFor();
  const pathname = usePathname() || "";
  const section = sectionForPath(pathname);
  const row = (s: Section) => {
    const count = badge(s.id);
    return (
      <li key={s.id}>
        <Link
          href={s.href}
          aria-current={section === s.id ? "page" : undefined}
          data-nav={s.id}
          className="flex min-h-[40px] items-center gap-3 rounded-adm-sm px-3 text-[14px] font-medium text-adm-text-2 hover:bg-adm-bg hover:text-adm-ink"
        >
          <SectionGlyph icon={s.icon} className="h-5 w-5" />
          <span className="flex-1 truncate">{s.label}</span>
          {count > 0 && <CountBadge value={count} />}
        </Link>
      </li>
    );
  };
  return (
    <nav className="adm-sidebar" aria-label="Sections" data-adm-sidebar="">
      <Link href="/admin" className="mb-4 flex items-center gap-2 px-2 py-1" aria-label="Profixter Admin home">
        {/* eslint-disable-next-line @next/next/no-img-element -- small local mark */}
        <img src={HAMMER_MARK} alt="" width={30} height={30} className="h-[30px] w-[30px] object-contain" />
        <span className="text-[17px] font-semibold tracking-[-0.01em] text-adm-ink">Profixter</span>
      </Link>
      <ul role="list" className="flex flex-col gap-0.5">
        {nav.primary.map(row)}
      </ul>
      {nav.more.length > 0 && (
        <>
          <p className="mb-1 mt-5 px-3 text-[12px] font-semibold text-adm-text-3">More</p>
          <ul role="list" className="flex flex-col gap-0.5">
            {nav.more.map(row)}
          </ul>
        </>
      )}
    </nav>
  );
}
