"use client";

import { useEffect, useState } from "react";
import { subscribeRetargetReport } from "./lab-telemetry";
import type { RetargetReport } from "./lab-retarget";

/**
 * Proof that the bone mapping is right, rather than a screenshot and a hope.
 *
 * The number that matters most is the rest-identity error: hold the source at
 * its own rest pose, run the real solver, and the target must land on its bind
 * pose. Anything past a fraction of a degree means the rest/axis compensation
 * is wrong, whatever the animation happens to look like.
 *
 * Lab-only. Nothing here is imported by the rest of the app.
 */
export default function RetargetDiagnostics() {
  const [reports, setReports] = useState<RetargetReport[]>([]);
  const [openClip, setOpenClip] = useState<string | null>(null);

  useEffect(() => subscribeRetargetReport(setReports), []);

  if (!reports.length) {
    return <p className="text-[12px] text-slate-400">No retarget has run yet.</p>;
  }

  return (
    <div className="space-y-4">
      {reports.map((report) => {
        const restOk = report.restIdentityErrorDeg < 0.5;
        const footOk = report.footYMin > -0.02 && report.footYMin < 0.12;
        const mapOk =
          report.missingInSource.length + report.missingInTarget.length === 0;
        const open = openClip === report.clipName;

        const rows: [string, string, boolean | null][] = [
          ["Rest identity", `${report.restIdentityErrorDeg.toFixed(4)}°`, restOk],
          ["Bones mapped", `${report.mappedBones} / ${report.targetBones}`, null],
          ["Source bones", String(report.sourceBones), null],
          ["Ignored (src)", String(report.ignoredSourceBones.length), null],
          ["Tracks", String(report.trackCount), null],
          [
            "Clip",
            `${report.duration.toFixed(1)}s @ ${report.fps.toFixed(0)}fps`,
            null,
          ],
          ["Scale", report.scale.toExponential(2), null],
          ["Ground fix", `${report.groundCorrection.toFixed(3)} m`, null],
          [
            "Foot Y",
            `${report.footYMin.toFixed(3)} .. ${report.footYMax.toFixed(3)}`,
            footOk,
          ],
          ["Map gaps", String(report.missingInSource.length + report.missingInTarget.length), mapOk],
        ];

        return (
          <div key={report.clipName} className="space-y-2">
            <p className="text-[12px] font-bold text-slate-700">{report.clipName}</p>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
              {rows.map(([label, value, ok]) => (
                <div key={label} className="contents">
                  <dt className="text-slate-500">{label}</dt>
                  <dd
                    className={`text-right font-mono font-semibold tabular-nums ${
                      ok === null
                        ? "text-slate-800"
                        : ok
                          ? "text-emerald-600"
                          : "text-rose-600"
                    }`}
                  >
                    {ok === null ? "" : ok ? "✓ " : "✗ "}
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <button
              type="button"
              onClick={() => setOpenClip(open ? null : report.clipName)}
              className="text-[12px] font-semibold text-[#306EEC] hover:underline"
            >
              {open ? "Hide" : "Show"} per-bone rest alignment
            </button>

            {open && (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1 text-left font-semibold">target</th>
                      <th className="px-2 py-1 text-left font-semibold">source</th>
                      <th className="px-2 py-1 text-right font-semibold">rest ∠</th>
                      <th className="px-2 py-1 text-right font-semibold">len t/s</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {[...report.restComparison]
                      .sort((a, b) => b.restAngleDeg - a.restAngleDeg)
                      .map((row) => (
                        <tr key={row.target} className="border-t border-slate-100">
                          <td className="px-2 py-1">{row.target}</td>
                          <td className="px-2 py-1 text-slate-500">{row.source}</td>
                          <td className="px-2 py-1 text-right tabular-nums">
                            {row.restAngleDeg.toFixed(1)}°
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums text-slate-500">
                            {row.targetLength.toFixed(2)}/{row.sourceLength.toFixed(0)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <p className="border-t border-slate-100 bg-slate-50 px-2 py-1.5 text-[10px] leading-snug text-slate-500">
                  Rest ∠ is the angle between the two skeletons&apos; rest bone
                  directions — a proportion difference, not an error; the math
                  compensates for it. Hands read high because the first bone
                  child of the BVH hand is a thumb, which points across the palm.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
