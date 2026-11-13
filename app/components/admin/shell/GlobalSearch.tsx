"use client";

import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { announceHandoff, handOffQuery } from "@/lib/admin/handoff";
import { isFieldFixter, SECTIONS, type SectionId } from "@/lib/admin/sections";
import { IconButton, SearchField, Sheet } from "@/app/components/admin/ui";
import { useAdmin } from "./AdminContext";
import { SectionGlyph } from "./icons";

/* Where a search can go, in order. Each destination searches its own list. */
const TARGETS: { id: SectionId; what: string }[] = [
  { id: "customers", what: "names, phones, emails, addresses" },
  { id: "jobs", what: "customers, addresses, booking numbers" },
  { id: "projects", what: "project customers" },
  { id: "leads", what: "names, phones, emails, messages" },
];

/**
 * The header search. Until the server-side people/jobs/projects search exists
 * (audit C-05), it sends the query to the section's own search field, out of
 * the URL (sessionStorage hand-off), and that section shows the matches.
 */
export function GlobalSearch() {
  const { canOpen, user } = useAdmin();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const targets = TARGETS.filter((t) => canOpen(t.id) && !(t.id === "jobs" && isFieldFixter(user)));
  if (!targets.length) return null;

  const go = (id: SectionId) => {
    const query = q.trim();
    if (!query) return;
    handOffQuery(id, query);
    setOpen(false);
    setQ("");
    router.push(SECTIONS[id].href);
    // Already on that section: it picks the query up now.
    window.setTimeout(() => announceHandoff(id), 0);
  };

  return (
    <>
      <IconButton label="Search" icon={<MagnifyingGlassIcon />} onClick={() => setOpen(true)} data-global-search="" />
      <Sheet open={open} onClose={() => setOpen(false)} title="Search" variant="dialog">
        <SearchField label="Search Profixter" value={q} onChange={setQ} onSubmit={() => go(targets[0].id)} autoFocus />
        <ul role="list" className="mt-3 flex flex-col">
          {targets.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                disabled={!q.trim()}
                onClick={() => go(t.id)}
                className="adm-menu-item disabled:opacity-50"
              >
                <SectionGlyph icon={SECTIONS[t.id].icon} className="h-5 w-5 text-adm-text-2" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">
                    {q.trim() ? (
                      <>
                        Search {SECTIONS[t.id].label.toLowerCase()} for “{q.trim()}”
                      </>
                    ) : (
                      <>Search {SECTIONS[t.id].label.toLowerCase()}</>
                    )}
                  </span>
                  <span className="text-[12px] font-normal text-adm-text-3">{t.what}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
