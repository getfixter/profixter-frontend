import * as THREE from "three";

/**
 * One shared palette for every object in the scene.
 *
 * Shared instances, not per-object copies: each distinct material compiles its
 * own shader program, and a scene of six props that each mint their own greys
 * pays for a dozen programs to render what is visually four surfaces. Reusing
 * them also keeps the look coherent, which matters more here than it would in a
 * game — these props sit on a white page next to real UI, so they have to read
 * as one family of objects rather than six separate art experiments.
 *
 * Kept deliberately narrow: two metals, a wood, an off-white, the brand blue,
 * and a lamp that can light up.
 */

const std = (options: THREE.MeshStandardMaterialParameters) =>
  new THREE.MeshStandardMaterial(options);

export const M = {
  /** Faceplates, cabinet fronts — the off-white that reads against the page. */
  shell: std({ color: "#f2f0ec", roughness: 0.58, metalness: 0.02 }),
  /** Brushed steel: faucets, brackets, shafts. */
  metal: std({ color: "#b9c0cb", roughness: 0.28, metalness: 0.82 }),
  /** Darker hardware: screws, hinges, sockets. */
  hardware: std({ color: "#6b7686", roughness: 0.42, metalness: 0.55 }),
  /** Near-black details — socket slots, cord, lamp interior. */
  dark: std({ color: "#2b3242", roughness: 0.75, metalness: 0.05 }),
  /** Warm wood for the shelf and the dresser. */
  wood: std({ color: "#c89a68", roughness: 0.72, metalness: 0.0 }),
  woodDark: std({ color: "#a87c4e", roughness: 0.74, metalness: 0.0 }),
  /** Profixter blue, used once per object as an accent so nothing shouts. */
  accent: std({ color: "#306EEC", roughness: 0.45, metalness: 0.1 }),
  /**
   * Brass, for door hardware.
   *
   * A hinge in the same grey as every bracket and screw is a grey block at a
   * hundred pixels, and a grey block is not a recognisable household object.
   * Brass is what door hardware actually is, and it is the one colour on the
   * page that says "door" on its own.
   */
  brass: std({ color: "#c9a227", roughness: 0.34, metalness: 0.78 }),
  /** Tool handle red. */
  toolGrip: std({ color: "#c8362f", roughness: 0.45, metalness: 0.05 }),
};

/**
 * The lamp shade is the one material that changes at runtime, so it is its own
 * instance rather than a shared one — turning the light on must not tint every
 * other off-white surface in the scene.
 */
export function createLampMaterial() {
  return new THREE.MeshStandardMaterial({
    color: "#f2f0ec",
    roughness: 0.5,
    metalness: 0.05,
    emissive: new THREE.Color("#ffb347"),
    emissiveIntensity: 0,
  });
}

/** Free the one material that is not shared. */
export function disposeMaterial(material: THREE.Material | null) {
  material?.dispose();
}

/**
 * A soft contact shadow, as a texture.
 *
 * The one thing that decides whether a 3D figure looks placed on a page or
 * pasted over it. Drawn rather than rendered: a real shadow needs a light, a
 * surface and a shadow map, and the surface here is a webpage.
 *
 * It lives in the page plane, not on a notional floor — under a camera this
 * close to head-on a horizontal ellipse would be edge-on and invisible. So it
 * is a squashed vertical ellipse under his boots, which is what a soft shadow
 * looks like from the front anyway.
 */
export function createContactShadow(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    );
    g.addColorStop(0, "rgba(11,22,40,0.55)");
    g.addColorStop(0.45, "rgba(11,22,40,0.28)");
    g.addColorStop(1, "rgba(11,22,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * The glow a light throws when it comes on.
 *
 * Additive, so it only ever brightens what is behind it — which on a dark hero
 * is most of the payoff and on a white section is almost nothing, exactly as a
 * real lamp behaves against a bright wall. Warm rather than white, because a
 * white bloom on a blue page reads as a rendering artefact and a warm one reads
 * as a bulb.
 */
/**
 * A puff of smoke, drawn once into a small canvas.
 *
 * Grey rather than black and very soft at the edges, because what comes out of
 * a loose socket is a wisp, not a fire. Shared by every puff in the scene: one
 * 96px canvas is the entire cost of the smoke.
 */
let smokeTexture: THREE.Texture | null = null;
export function createSmokeTexture(): THREE.Texture {
  if (smokeTexture) return smokeTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    /*
     * Three overlapping blobs, not one clean circle.
     *
     * A single radial gradient reads as a soft dot at every size, and the
     * previous one was mostly falloff: 0.55 alpha at the centre dropping to
     * 0.22 by the halfway mark meant nine tenths of the quad was doing nothing.
     * These carry their alpha much further out and sit off-centre from each
     * other, so a puff has a lumpy edge and a dense core — which is the
     * difference between smoke and a grey smudge.
     */
    /*
     * Dark in the middle, pale at the edge — the whole grey range in one puff.
     *
     * This socket's plume rises off a white band and straight into the navy
     * hero above it, and no single value survives that trip: soot vanishes
     * against the dark, pale smoke vanishes against the page. So the colour is
     * baked here instead of tinted by the material. Over white the dark core
     * does the reading and the pale rim is invisible; over the hero the rim
     * does it and the core is invisible. Same quad, both grounds.
     */
    const blob = (cx: number, cy: number, r: number, a: number) => {
      const g = ctx.createRadialGradient(
        cx * size, cy * size, 0,
        cx * size, cy * size, r * size
      );
      g.addColorStop(0, `rgba(48,54,64,${a})`);
      g.addColorStop(0.42, `rgba(72,79,91,${a * 0.78})`);
      g.addColorStop(0.68, `rgba(148,157,172,${a * 0.52})`);
      g.addColorStop(0.86, `rgba(190,198,212,${a * 0.26})`);
      g.addColorStop(1, "rgba(198,205,218,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    };
    blob(0.5, 0.54, 0.46, 0.92);
    blob(0.37, 0.4, 0.3, 0.7);
    blob(0.64, 0.61, 0.28, 0.66);
  }
  smokeTexture = new THREE.CanvasTexture(canvas);
  return smokeTexture;
}

let sparkTexture: THREE.Texture | null = null;

/**
 * One spark: a hot head with a trail behind it.
 *
 * The sparks were bare rectangles, because a soft radial dot stretched into a
 * streak is nearly all falloff and disappears at this size. That solved the
 * disappearing and produced orange sticks instead. This is the shape itself —
 * a bright amber head at the leading edge, a body that cools along the length,
 * and an alpha that runs out before the tail does, so the far end frays rather
 * than stopping square.
 *
 * Not white-hot at the head, which is what a spark really is: this one lives on
 * a white band, where the brightest part of a real spark would be the part that
 * vanished. Saturated amber is as hot as this page allows.
 */
export function createSparkTexture(): THREE.Texture {
  if (sparkTexture) return sparkTexture;
  const w = 96;
  const h = 24;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    /*
     * A short, steep trail — most of the quad is empty.
     *
     * The first version spread the trail across the whole length with a gentle
     * ramp, which magnified beautifully and turned into an orange smudge at the
     * size a phone actually draws it. On a 40-pixel streak there is no room for
     * a gradient: what has to survive is a bright point and a hint of where it
     * came from, so the alpha is gone by the halfway mark.
     */
    const trail = ctx.createLinearGradient(w * 0.86, 0, w * 0.3, 0);
    trail.addColorStop(0, "rgba(255,146,18,0.95)");
    trail.addColorStop(0.35, "rgba(255,110,12,0.5)");
    trail.addColorStop(0.75, "rgba(245,85,10,0.13)");
    trail.addColorStop(1, "rgba(235,75,10,0)");
    ctx.fillStyle = trail;
    ctx.fillRect(0, h * 0.38, w * 0.88, h * 0.24);
    /* Softened across its width, so the streak has no straight edges. */
    const across = ctx.createLinearGradient(0, 0, 0, h);
    across.addColorStop(0, "rgba(0,0,0,1)");
    across.addColorStop(0.5, "rgba(0,0,0,0)");
    across.addColorStop(1, "rgba(0,0,0,1)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = across;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    /* The head: small, dense, and the brightest thing in the texture. */
    const head = ctx.createRadialGradient(w * 0.84, h / 2, 0, w * 0.84, h / 2, h * 0.42);
    head.addColorStop(0, "rgba(255,214,128,1)");
    head.addColorStop(0.42, "rgba(255,158,30,1)");
    head.addColorStop(0.78, "rgba(255,120,14,0.55)");
    head.addColorStop(1, "rgba(255,110,12,0)");
    ctx.fillStyle = head;
    ctx.fillRect(w * 0.62, 0, w * 0.38, h);
  }
  sparkTexture = new THREE.CanvasTexture(canvas);
  return sparkTexture;
}

export function createGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    );
    g.addColorStop(0, "rgba(255,226,160,0.95)");
    g.addColorStop(0.22, "rgba(255,206,120,0.5)");
    g.addColorStop(0.55, "rgba(255,190,96,0.16)");
    g.addColorStop(1, "rgba(255,180,90,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* ------------------------------------------------------- household context */

/**
 * The surface a repair is attached to, as a soft-edged fragment.
 *
 * Every prop until now floated unsupported, which was a deliberate choice and
 * became the loudest remaining problem: a towel rail alone in space is a metal
 * rod, and a tap with no basin under it is a piece of chrome. The brain needs
 * about one more object than we were giving it.
 *
 * The constraint that shapes all of this is that the page underneath is BOTH a
 * near-black hero and a white article, often within one scroll. A wall drawn as
 * a rectangle is a bright card on one and invisible on the other. So these are
 * drawn with the alpha falling away to nothing at the edges: there is no border
 * anywhere for the eye to catch, and what remains is a suggestion of surface
 * exactly where the object meets it, which works on either ground.
 *
 * One canvas each, generated once and shared. They are the whole cost of this
 * feature — no extra geometry beyond a quad per repair.
 */
export type PatchKind = "plaster" | "tile" | "ceiling" | "woodPanel";

const patchCache = new Map<PatchKind, THREE.Texture>();

function softEdge(ctx: CanvasRenderingContext2D, size: number) {
  /*
   * Feather a RECTANGLE, not a disc, by REMOVING the edges.
   *
   * Two things were wrong with the first attempt. It faded radially, which on
   * the dark half of the page turned every wall into a glowing oval behind the
   * object — a spotlight, not a surface; the shape does the work here, and a
   * soft-edged rectangle reads as a piece of wall while a soft oval reads as
   * light whatever is painted on it.
   *
   * And it built the mask with `destination-in`, four strips in sequence. That
   * operator applies to the WHOLE canvas every time it is used, so each strip
   * erased everything the previous one had kept and the texture came out
   * essentially blank — which is why nothing appeared at any size, at any
   * brightness, lit or unlit.
   *
   * `destination-out` accumulates: each pass removes a little more and nothing
   * is ever restored, which is what a feather actually is.
   */
  const feather = size * 0.16;
  ctx.globalCompositeOperation = "destination-out";
  const edges: [number, number, number, number, number, number, number, number][] = [
    /* x, y, w, h, and the gradient from (gx0,gy0) opaque to (gx1,gy1) clear. */
    [0, 0, size, feather, 0, 0, 0, feather],
    [0, size - feather, size, feather, 0, size, 0, size - feather],
    [0, 0, feather, size, 0, 0, feather, 0],
    [size - feather, 0, feather, size, size, 0, size - feather, 0],
  ];
  for (const [x, y, w, h, gx0, gy0, gx1, gy1] of edges) {
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalCompositeOperation = "source-over";
}

export function createPatchTexture(kind: PatchKind): THREE.Texture {
  const cached = patchCache.get(kind);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    if (kind === "tile") {
      /* Four tiles and a grout cross: the least that says "bathroom". */
      ctx.fillStyle = "#dfe7ec";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "rgba(128,146,158,0.95)";
      ctx.lineWidth = size * 0.028;
      /* Three lines each way: nine tiles, which reads as tiling. One cross
         reads as a plus sign drawn on a white card. */
      for (const t of [0.25, 0.5, 0.75]) {
        ctx.beginPath();
        ctx.moveTo(size * t, 0); ctx.lineTo(size * t, size);
        ctx.moveTo(0, size * t); ctx.lineTo(size, size * t);
        ctx.stroke();
      }
      /* A highlight along the top of each tile: glazed, rather than paper. */
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          ctx.fillRect(size * (0.045 + i * 0.25), size * (0.045 + j * 0.25), size * 0.09, size * 0.022);
        }
      }
    } else if (kind === "woodPanel") {
      ctx.fillStyle = "#c39468";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "rgba(140,98,60,0.4)";
      ctx.lineWidth = size * 0.008;
      for (let i = 0; i < 7; i++) {
        const y = size * (0.08 + i * 0.14);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(size * 0.35, y - size * 0.02, size * 0.65, y + size * 0.02, size, y);
        ctx.stroke();
      }
    } else {
      /* Plaster and ceiling: flat, faintly mottled, no pattern to pick out. */
      ctx.fillStyle = kind === "ceiling" ? "#e9ebef" : "#e3ded7";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(0,0,0,0.014)";
      for (let i = 0; i < 70; i++) {
        const r = size * (0.012 + Math.random() * 0.03);
        ctx.beginPath();
        ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    /*
     * A little light from above.
     *
     * A perfectly even panel reads as a grey smudge however well it is shaped.
     * One soft top-to-bottom gradient is the difference between a patch of
     * colour and a plane with a light source somewhere above it, which is what
     * the eye is looking for when it decides whether something is a wall.
     */
    const lit = ctx.createLinearGradient(0, 0, 0, size);
    lit.addColorStop(0, "rgba(255,255,255,0.20)");
    lit.addColorStop(0.55, "rgba(255,255,255,0.0)");
    lit.addColorStop(1, "rgba(0,0,0,0.13)");
    ctx.fillStyle = lit;
    ctx.fillRect(0, 0, size, size);

    softEdge(ctx, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  patchCache.set(kind, texture);
  return texture;
}

const patchMaterialCache = new Map<PatchKind, THREE.Material>();

/** One shared material per surface kind. */
export function patchMaterial(kind: PatchKind): THREE.Material {
  const cached = patchMaterialCache.get(kind);
  if (cached) return cached;
  /*
   * Unlit, deliberately.
   *
   * A lit backdrop is at the mercy of where the scene's lights happen to be,
   * and these fragments sit behind objects that move all over a page whose own
   * background runs from near-black to white. Lit, the same wall came out
   * bright behind an outlet and invisible behind a towel rail. Unlit, its value
   * is exactly what the canvas painted, which is the only way to tune something
   * that has to read against both ends of the page at once.
   */
  /*
   * Translucent, which is what makes one wall work on two pages.
   *
   * Unlit means the colour on screen is exactly the colour in the canvas, and
   * there is no single colour that works: a wall bright enough to read over the
   * near-black hero is a glowing panel, and a wall dark enough to read over the
   * white article is a grey card. Letting the page show through solves it —
   * over the hero the same patch settles to a dark blue-grey and over the
   * article to a warm off-white, while the contrast WITHIN it, which is what
   * carries the grout lines and the mottling, survives either way.
   */
  const material = new THREE.MeshBasicMaterial({
    map: createPatchTexture(kind),
    transparent: true,
    opacity: kind === "tile" ? 0.62 : 0.5,
    /* It is a backdrop: it must never z-fight with what is mounted on it. */
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  patchMaterialCache.set(kind, material);
  return material;
}

/**
 * The dark smudge where a mounted object meets its surface.
 *
 * Contact is most of what makes something look attached rather than laid on
 * top, and at this size a soft ellipse under the object does more for that than
 * any amount of modelled bracket.
 */
let contactTexture: THREE.Texture | null = null;
export function createContactTexture(): THREE.Texture {
  if (contactTexture) return contactTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(40,46,58,0.5)");
    g.addColorStop(0.5, "rgba(40,46,58,0.2)");
    g.addColorStop(1, "rgba(40,46,58,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  contactTexture = new THREE.CanvasTexture(canvas);
  return contactTexture;
}

let contactMat: THREE.Material | null = null;
export function contactMaterial(): THREE.Material {
  if (!contactMat) {
    contactMat = new THREE.MeshBasicMaterial({
      map: createContactTexture(),
      transparent: true,
      depthWrite: false,
    });
  }
  return contactMat;
}
