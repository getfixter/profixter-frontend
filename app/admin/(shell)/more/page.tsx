"use client";

import { ListRow, PageHeader, Section } from "@/app/components/admin/ui";
import { useAdmin } from "@/app/components/admin/shell/AdminContext";
import { SectionGlyph } from "@/app/components/admin/shell/icons";

/* More (K.1): one level, only the sections this person may open. Monthly and configuration work. */
export default function Page() {
  const { nav } = useAdmin();
  return (
    <div data-section="more">
      <PageHeader title="More" />
      {nav.more.length ? (
        <Section>
          <ul role="list">
            {nav.more.map((s) => (
              <ListRow key={s.id} href={s.href} title={s.label} subtitle={s.description} leading={<SectionGlyph icon={s.icon} className="h-6 w-6" />} />
            ))}
          </ul>
        </Section>
      ) : (
        <p className="text-[14px] text-adm-text-2">Everything you can open is in the navigation.</p>
      )}
    </div>
  );
}
