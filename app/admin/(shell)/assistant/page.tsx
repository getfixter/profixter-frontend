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
 * someone chooses it.
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
        office ? null : (
          <Button variant="secondary" onClick={() => choose("office")}>
            Open the 3D office
          </Button>
        )
      }
    >
      {office ? <GrowthOffice onClassic={() => choose("classic")} /> : <GrowthModule />}
    </MountedSection>
  );
}
