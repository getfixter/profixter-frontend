"use client";

import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { announceHandoff, handOffQuery } from "@/lib/admin/handoff";
import { isFieldFixter, SECTIONS, type SectionId } from "@/lib/admin/sections";
import { GLOBAL_SEARCH_MIN, searchEverything, type GlobalSearchResult } from "@/lib/admin/global-search";
import { planChip } from "@/lib/admin/customers";
import { dayLabel, nyYMD, timeNY } from "@/lib/admin/jobs";
import { errorMessage, useAdminQuery } from "@/lib/admin/query";
import { EmptyState, ErrorState, IconButton, ListRow, SearchField, Section, Sheet, SkeletonRows, StatusBadge, bookingStatusTone } from "@/app/components/admin/ui";
import { useAdmin } from "./AdminContext";
import { SectionGlyph } from "./icons";

/* Sections that can take the text into their own search (Leads is not in the server search). */
const HANDOFF: SectionId[] = ["customers", "jobs", "projects", "leads"];

const DEBOUNCE_MS = 250;

const humanize = (s: string) => {
  const t = s.replace(/[_-]+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
};

/** A job's status in the short words the job lists use ("Confirm", "Review"); the full wording is its title. */
function JobStatusPill({ status }: { status: string }) {
  const { tone, label } = bookingStatusTone(status);
  const s = status.trim().toLowerCase();
  const short = s === "pending" ? "Confirm" : s === "pending confirmation" ? "Review" : "";
  return short ? (
    <StatusBadge tone={tone} title={label}>
      {short}
    </StatusBadge>
  ) : (
    <StatusBadge status={status} />
  );
}

function jobWhen(date: string | null): string {
  if (!date) return "";
  const ymd = nyYMD(date);
  return [ymd ? dayLabel(ymd, { year: ymd.slice(0, 4) !== nyYMD(new Date()).slice(0, 4) }) : "", timeNY(date)].filter(Boolean).join(" · ");
}

/**
 * The header search (audit C-05, E.3). One field over customers, jobs and
 * projects through POST /api/admin/search: the text is only ever in the POST
 * body, never in a URL. Results sit grouped directly under the field, inside
 * a full-height sheet whose height follows the keyboard; Enter closes the
 * keyboard so every result shows. The server scopes the answer (a field
 * Fixter gets only their own jobs, no customers), and only the groups it
 * allows are drawn. A section can still take the text into its own search.
 */
export function GlobalSearch() {
  const { canOpen, user } = useAdmin();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const field = isFieldFixter(user);
  const handoff = HANDOFF.filter((id) => canOpen(id) && !(id === "jobs" && field));
  const searchable = field ? canOpen("my-day") : canOpen("customers") || canOpen("jobs") || canOpen("projects");

  // Debounce: the server sees settled text only.
  useEffect(() => {
    const next = q.trim();
    const timer = window.setTimeout(() => setTerm(next), next ? DEBOUNCE_MS : 0);
    return () => window.clearTimeout(timer);
  }, [q]);

  const ready = term.length >= GLOBAL_SEARCH_MIN;
  const result = useAdminQuery<GlobalSearchResult>(["global-search", term], (signal) => searchEverything(term, signal), {
    enabled: open && searchable && ready,
    staleTime: 15_000,
    refetchOnFocus: false,
  });

  const close = () => {
    setOpen(false);
    setQ("");
    setTerm("");
  };

  // Every result is a link: once one is followed, the search sheet goes away.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest?.("[data-sheet='global-search'] a[href]");
      if (!link) return;
      window.setTimeout(() => {
        setOpen(false);
        setQ("");
        setTerm("");
      }, 0);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  if (!searchable && !handoff.length) return null;

  const go = (id: SectionId) => {
    const query = q.trim();
    if (!query) return;
    handOffQuery(id, query);
    close();
    router.push(SECTIONS[id].href);
    // Already on that section: it picks the query up now.
    window.setTimeout(() => announceHandoff(id), 0);
  };

  const data = ready ? result.data ?? null : null;
  const settled = q.trim() === term;
  const total = data ? data.customers.length + data.jobs.length + data.projects.length : 0;
  const jobHref = (id: string, href: string) => (field ? `/admin/my-day/${encodeURIComponent(id)}` : href);

  return (
    <>
      <IconButton label="Search" icon={<MagnifyingGlassIcon />} onClick={() => setOpen(true)} data-global-search="" />
      <Sheet open={open} onClose={close} title="Search" variant="dialog" size="full" data-sheet="global-search" initialFocusRef={inputRef}>
        <div className="sticky top-0 z-[1] -mx-4 bg-adm-surface px-4 pb-2">
          <SearchField
            label={field ? "Search your jobs" : "Search customers, jobs, projects"}
            placeholder={field ? "Name, address or booking number" : "Name, phone, email, address, #number"}
            value={q}
            onChange={setQ}
            ref={inputRef}
            data-global-search-field=""
          />
        </div>

        <div aria-live="polite" data-global-search-results="">
          {!q.trim() ? (
            <p className="px-1 py-3 text-[13px] text-adm-text-3">
              {field ? "Only jobs assigned to you are searched." : "Type at least 2 characters. Results are grouped by customers, jobs and projects."}
            </p>
          ) : q.trim().length < GLOBAL_SEARCH_MIN ? (
            <p className="px-1 py-3 text-[13px] text-adm-text-3">Type at least 2 characters.</p>
          ) : !searchable ? null : result.error && !data ? (
            <ErrorState message={errorMessage(result.error, "Search did not answer. Nothing was changed.")} onRetry={() => void result.refetch()} />
          ) : !data || (!settled && !total) ? (
            <SkeletonRows count={3} label="Searching" />
          ) : total === 0 ? (
            <EmptyState message={`Nothing matches “${term}”`} detail={field ? "Only jobs assigned to you are searched." : "Try a phone number, an email, a street or a booking number."} />
          ) : (
            <div className="flex flex-col gap-3 pb-2">
              {data.customers.length > 0 && (
                <Section title="Customers" count={data.customers.length} flush id="gs-customers">
                  <ul role="list" data-global-search-group="customers">
                    {data.customers.map((c) => {
                      const chip = c.addresses.map(planChip).find(Boolean) || null;
                      return (
                        <ListRow
                          key={`c-${c.id}`}
                          href={c.href}
                          title={c.name || c.email || "Customer"}
                          subtitle={[c.phone, c.town].filter(Boolean).join(" · ") || c.email}
                          trailing={
                            c.blocked ? <StatusBadge tone="problem">Blocked</StatusBadge> : chip ? <StatusBadge tone={chip.tone}>{chip.text.split(" · ")[0]}</StatusBadge> : null
                          }
                          label={`Customer ${c.name}`}
                        />
                      );
                    })}
                  </ul>
                </Section>
              )}
              {data.jobs.length > 0 && (
                <Section title={data.scopes.jobs === "assigned" ? "Your jobs" : "Jobs"} count={data.jobs.length} flush id="gs-jobs">
                  <ul role="list" data-global-search-group="jobs">
                    {data.jobs.map((j) => (
                      <ListRow
                        key={`j-${j.id}`}
                        href={jobHref(j.id, j.href)}
                        title={j.customerName || (j.bookingNumber ? `#${j.bookingNumber}` : "Job")}
                        subtitle={[jobWhen(j.date), j.address].filter(Boolean).join(" · ")}
                        meta={j.bookingNumber ? `#${j.bookingNumber}` : undefined}
                        trailing={j.status ? <JobStatusPill status={j.status} /> : null}
                        label={`Job ${j.bookingNumber ? `#${j.bookingNumber} ` : ""}${j.customerName}`}
                      />
                    ))}
                  </ul>
                </Section>
              )}
              {data.projects.length > 0 && (
                <Section title="Projects" count={data.projects.length} flush id="gs-projects">
                  <ul role="list" data-global-search-group="projects">
                    {data.projects.map((p) => (
                      <ListRow
                        key={`p-${p.id}`}
                        href={p.href}
                        title={p.customerName || p.projectNumber || "Project"}
                        subtitle={[p.projectNumber, p.projectType, p.address].filter(Boolean).join(" · ")}
                        trailing={p.status ? <StatusBadge tone="neutral">{humanize(p.status)}</StatusBadge> : null}
                        label={`Project ${p.projectNumber} ${p.customerName}`}
                      />
                    ))}
                  </ul>
                </Section>
              )}
              {total >= 8 && <p className="px-1 text-[12px] text-adm-text-3">Showing the first matches in each group. Type more to narrow, or search a whole section below.</p>}
            </div>
          )}

          {q.trim().length >= GLOBAL_SEARCH_MIN && handoff.length > 0 && (
            <Section title="Search a whole section" flush id="gs-sections">
              <ul role="list" className="flex flex-col">
                {handoff.map((id) => (
                  <li key={id}>
                    <button type="button" onClick={() => go(id)} className="adm-menu-item" data-global-search-handoff={id}>
                      <SectionGlyph icon={SECTIONS[id].icon} className="h-5 w-5 text-adm-text-2" />
                      <span className="truncate">
                        {SECTIONS[id].label} for “{q.trim()}”
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </Sheet>
    </>
  );
}
