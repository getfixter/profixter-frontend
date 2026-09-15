# Moving the Fixter onto the real homepage

Design notes, not instructions to follow yet. The Lab's homepage experiment runs
against a duplicated mock (`LabHomepage.tsx`) so that nothing here can reach
production. This is what it would take to point the same machinery at the real
marketing page **without copying it**.

## What already transfers unchanged

Everything except the page itself. The 3D layer never imports the page, and the
page never imports the 3D layer — they meet at one string key per element.

| Piece | Transfers as-is |
|---|---|
| `lab-page-anchors.ts` | yes — it only knows element ids and rects |
| `lab-projection.ts` | yes — pure maths against the camera |
| `lab-choreography.ts` | yes |
| `lab-page-jobs.ts` | yes, but the anchor ids become real ones |
| `HomepageScene.tsx` | yes |
| `LabHomepage.tsx` | **no** — this is the throwaway |

## The one thing the real page has to do

Register the elements that can host a job. That is a ref callback and nothing
else:

```tsx
// app/components/sections/HomeMarketing.tsx — the only production change
<li ref={useFixterAnchor("row-cabinet")}>…</li>
```

`useFixterAnchor` would live in a tiny module that no-ops when the 3D layer is
absent, so the marketing page carries a few bytes and no behaviour when the
experience is switched off. Three properties matter:

1. **It cannot fail loudly.** A missing anchor already resolves to "this job is
   not part of the composition at this size" — `buildTour` skips it. A page that
   changes underneath the experience degrades to fewer jobs, never to a
   character walking to the origin.
2. **It must not change layout.** No wrapper elements, no extra DOM. A ref on
   the element that is already there.
3. **It must not import three.** The registry is a plain module-level `Map`.

## What would need solving that the Lab has not had to

- **Reveal-on-scroll.** The real page animates sections in with a transform
  (`Reveal`). Anchors are measured from layout, so an element that slides into
  place drags its job with it. Either measure after the reveal settles
  (a `transitionend`/`animationend` hook on anchored elements), or exclude
  anchored elements from the reveal. The mock sidesteps this by being static —
  this is the single biggest known gap between the two.
- **Live content.** `RecentWorkSection` renders nothing when no photos are
  published, and the free-visit band disappears for members. Both change the
  page's height and therefore every anchor below them. The `ResizeObserver` on
  `document.body` already covers it; it needs testing against a real member
  session, which the Lab has never run.
- **The mobile tab bar.** Production has a fixed bottom nav the mock does not.
  It would cover the bottom ~64px, so any job anchored low on a phone needs to
  clear it.
- **Loading.** See below.

## How it would load

Not implemented, deliberately. The shape:

- **Nothing on first paint.** The scene is already `dynamic(..., { ssr: false })`
  and is the only thing that pulls three/R3F/drei. Production's homepage
  currently downloads none of it, verified.
- **Idle, then visible.** Start the import from `requestIdleCallback` after the
  page is interactive, and only when the hero is actually in view. On a phone on
  a slow connection the right answer is very likely "never".
- **Gate on capability, not on width.** `navigator.hardwareConcurrency`,
  `deviceMemory` and a failed WebGL context are all cheap and honest. There is
  already an error boundary; a refusal to start should look identical to it —
  the page, with nothing on it.
- **`prefers-reduced-motion`.** Already respected: the tour does not auto-start.
  For production the honest behaviour is not to load the scene at all.
- **Progressive appearance.** He should not pop in. Fade the canvas in over
  ~600ms once the GLB and the motion files have all resolved, and start him
  walking in from off the side of the hero rather than materialising at a mark.
- **Budget.** 6.0 MB GLB + 1.7 MB of motion is fine as a deferred, idle-time,
  cached-forever payload and would be indefensible as part of first paint. Both
  are immutable and content-hashed by the filename convention already in use.

## What would be left in the Lab

The Stage experiment, the layout override pills, the retarget diagnostics and
the telemetry readout. None of it is imported by the homepage path.
