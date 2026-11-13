"use client";

import { useEffect, useState } from "react";
import GrowthModule from "@/app/components/admin/growth/GrowthModule";
import GrowthOffice from "@/app/components/admin/office/GrowthOffice";
import { Button } from "@/app/components/admin/ui";
import { MountedSection } from "@/app/components/admin/shell/MountedSection";

const VIEW_KEY = "profixter:growth:view";

/*
 * The Assistant (formerly Growth). Owner decision Q-7: the classic panel is
 * the default and the 3D office is optional, remembered per browser only when
 * someone chooses it. Both views read the same data; the office is a visual
 * way of looking at it, never a separate set of controls.
 */
export default function Page() {
  const [office, setOffice] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only preference, read after mount
      setOffice(window.localStorage.getItem(VIEW_KEY) === "office");
    } catch {
      /* storage blocked: classic */
    }
  }, []);
  const choose = (next: "office" | "classic") => {
    setOffice(next === "office");
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* storage blocked */
    }
  };
  return (
    <MountedSection
      id="assistant"
      actions={
        office ? (
          <Button variant="secondary" onClick={() => choose("classic")} data-view-toggle="classic">
            Back to the classic panel
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => choose("office")} data-view-toggle="office">
            Open the 3D office (optional)
          </Button>
        )
      }
    >
      <p className="mb-3 text-[13px] text-adm-text-3" data-view-help>
        {office
          ? "The 3D office is a visual view of the same agents and approvals. It loads more on first open."
          : "Optional: the 3D office is a visual view of the same data; this panel stays the default."}
      </p>
      {office ? <GrowthOffice onClassic={() => choose("classic")} /> : <GrowthModule />}
    </MountedSection>
  );
}
