/**
 * What is actually happening on the device in front of you.
 *
 * Temporary, Lab-only. The homepage experiment fails silently in every way that
 * matters: a failed chunk renders null, a dead WebGL context renders nothing, a
 * loader that never resolves sits inside a Suspense boundary with a null
 * fallback, and an error thrown inside the R3F tree does not necessarily reach
 * the DOM error boundary outside it. All four look identical — a webpage with
 * no character on it — and none of them can be told apart from a desktop.
 *
 * So the scene reports each milestone as it passes it, and the panel runs its
 * own probes that do not depend on the scene mounting at all. If the scene never
 * starts, the probes still answer.
 */

/**
 * A stamp to tell a stale device apart from a broken one.
 *
 * Bumped by hand on each diagnostic deploy. If the phone does not show the
 * value we just shipped, the phone is not running what we just shipped and
 * nothing else on the panel means anything.
 */
export const DIAG_BUILD = "diag-1";

export type DiagState = {
  /* independent probes, run by the panel */
  webgl: string;
  renderer: string;
  reducedMotion: boolean;
  viewport: string;
  chunk: string;
  glbHead: string;

  /* milestones, reported by the scene */
  canvas: string;
  model: string;
  motions: string;
  anchors: string;
  stops: string;
  tour: string;
  fixter: string;

  /* anything that blew up */
  errors: string[];
};

const state: DiagState = {
  webgl: "…",
  renderer: "…",
  reducedMotion: false,
  viewport: "…",
  chunk: "…",
  glbHead: "…",
  canvas: "not mounted",
  model: "…",
  motions: "…",
  anchors: "…",
  stops: "…",
  tour: "…",
  fixter: "…",
  errors: [],
};

let version = 0;
const listeners = new Set<() => void>();

function publish() {
  version += 1;
  for (const listener of listeners) listener();
}

export function setDiag(patch: Partial<DiagState>) {
  let changed = false;
  for (const [key, value] of Object.entries(patch)) {
    const current = state[key as keyof DiagState];
    if (current !== value) {
      (state as Record<string, unknown>)[key] = value;
      changed = true;
    }
  }
  if (changed) publish();
}

export function addDiagError(message: string) {
  const line = message.slice(0, 220);
  if (state.errors.includes(line)) return;
  state.errors = [...state.errors, line].slice(-6);
  publish();
}

export function getDiag() {
  return state;
}

export function getDiagVersion() {
  return version;
}

export function subscribeDiag(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The probes that do not need the scene.
 *
 * Deliberately crude and synchronous where it can be: the whole point is to get
 * an answer out of a device that is currently showing nothing.
 */
export function runDiagProbes(glbUrl: string) {
  if (typeof window === "undefined") return;

  setDiag({
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    viewport:
      `${window.innerWidth}x${window.innerHeight} dpr${window.devicePixelRatio}` +
      (window.visualViewport
        ? ` vv${Math.round(window.visualViewport.width)}x${Math.round(window.visualViewport.height)}`
        : ""),
  });

  /* Can this device make a context at all, with the flags the scene asks for? */
  try {
    const probe = document.createElement("canvas");
    probe.width = 2;
    probe.height = 2;
    const attrs: WebGLContextAttributes = {
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const gl =
      (probe.getContext("webgl2", attrs) as WebGL2RenderingContext | null) ??
      (probe.getContext("webgl", attrs) as WebGLRenderingContext | null);
    if (!gl) {
      setDiag({ webgl: "NO CONTEXT", renderer: "—" });
    } else {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const name = ext
        ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
        : String(gl.getParameter(gl.RENDERER));
      setDiag({
        webgl:
          ("drawingBufferWidth" in gl ? "ok" : "ok") +
          ` · maxTex ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`,
        renderer: name.slice(0, 60),
      });
      const lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
    }
  } catch (error) {
    setDiag({ webgl: "THREW", renderer: String(error).slice(0, 60) });
  }

  /* Is the model actually reachable from this network? */
  fetch(glbUrl, { method: "HEAD" })
    .then((r) => setDiag({ glbHead: `${r.status} ${r.headers.get("content-length") ?? "?"}b` }))
    .catch((e) => setDiag({ glbHead: "FETCH FAILED " + String(e).slice(0, 60) }));

  /* Anything that escapes React entirely. */
  window.addEventListener("error", (e) =>
    addDiagError("window.error: " + (e.message || String(e.error)))
  );
  window.addEventListener("unhandledrejection", (e) =>
    addDiagError("unhandled: " + String(e.reason))
  );
}
