"use client";

import { useState } from "react";
import RecentWorkModule from "@/app/components/admin/RecentWorkModule";
import { useHandoffQuery } from "@/lib/admin/useHandoffQuery";
import { SearchField, useToast } from "@/app/components/admin/ui";
import { MountedSection } from "@/app/components/admin/shell/MountedSection";

export default function Page() {
  const toast = useToast();
  const [q, setQ] = useState("");
  useHandoffQuery("recent-work", setQ);
  return (
    <MountedSection id="recent-work">
      <SearchField label="Search photos" placeholder="Search photos by title, caption or booking #" value={q} onChange={setQ} className="mb-3" />
      <RecentWorkModule onToast={toast.show} searchQuery={q} />
    </MountedSection>
  );
}
