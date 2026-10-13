// The modelled example bathroom: an original, fully drawn room around a tub or
// shower alcove of any size, seen from the front with a level "architectural"
// camera (vertical lines stay vertical). No photo is involved.
//
// Two renders of the same room are made once per size:
//   - the "beauty" image: what the customer sees around the new work
//     (painted walls, floor tile, ceiling, baseboards);
//   - a "white" image: the same room with every surface white and matte. Its
//     brightness IS the light falling on each point, which the product renderer
//     uses exactly like the light it measures from a real photo, so the new
//     walls, base and trim are lit like the room around them.
// World units are inches, axes as in geometry.js: the back (facing) wall is
// z = 0, x runs left to right along it, y is up, the alcove opening is z = D.
import * as THREE from "three";
import { project, cameraCenter } from "./geometry.js";

export const ROOM = { ceiling: 96, eye: 47, width: 1080, height: 1350 };

/** OpenCV-style camera at C looking straight along -z (level, no roll). */
export function levelCamera(C, f, w, h) {
  // camera x = world +x, camera y = world -y, camera z (forward) = world -z
  const R = [1, 0, 0, 0, -1, 0, 0, 0, -1];
  const t = [-(R[0] * C[0] + R[1] * C[1] + R[2] * C[2]), -(R[3] * C[0] + R[4] * C[1] + R[5] * C[2]), -(R[6] * C[0] + R[7] * C[1] + R[8] * C[2])];
  const cam = { f, cx: w / 2, cy: h / 2, R, t };
  cam.position = cameraCenter(cam);
  cam.fovY = (2 * Math.atan(h / 2 / f) * 180) / Math.PI;
  cam.rmsPx = 0;
  return cam;
}

/**
 * A camera that frames the whole alcove (floor to ceiling, both side walls)
 * with a little of the room around it. Level, centred on the opening.
 */
export function modelCamera(m, w = ROOM.width, h = ROOM.height) {
  const W = m.facingWidth, D = m.sideLength;
  const f = 0.86 * h; // a phone's main camera in portrait (~60° vertical)
  const midY = ROOM.ceiling / 2 - 2;
  // distance from the opening so the opening plus a margin fits both ways
  const needH = (f * (W / 2 + 14)) / (0.47 * w);
  const needV = (f * (ROOM.ceiling / 2 + 4)) / (0.48 * h);
  const dist = Math.max(needH, needV, 60);
  const cam = levelCamera([W / 2, midY, D + dist], f, w, h);
  cam.highHeight = Number.isFinite(m.markHeight) ? m.markHeight : 72;
  cam.model = true;
  return cam;
}

/** The marks a person would have tapped, computed from the known camera (kept for saved-design compatibility). */
export function modelMarks(cam, m) {
  const W = m.facingWidth, D = m.sideLength, lo = m.rimHeight, hi = cam.highHeight;
  const p = (x, y, z) => { const q = project(cam, [x, y, z]); return [q[0], q[1]]; };
  return {
    wallTL: p(0, hi, 0), wallTR: p(W, hi, 0), wallBL: p(0, lo, 0), wallBR: p(W, lo, 0),
    ...(m.leftWall ? { leftRim: [p(0, lo, 4), p(0, lo, D - 2)], leftTop: [p(0, hi, 4), p(0, hi, D - 2)] } : {}),
    ...(m.rightWall ? { rightRim: [p(W, lo, 4), p(W, lo, D - 2)], rightTop: [p(W, hi, 4), p(W, hi, D - 2)] } : {}),
  };
}

// ------------------------------------------------------------------ textures
function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Large-format porcelain floor tile (24" × 12", soft warm grey, faint veining), one 48" × 24" repeat. */
function floorTexture() {
  const PX = 10, W = 48, H = 24;
  const c = canvas(W * PX, H * PX), g = c.getContext("2d");
  const r = rng(7);
  g.fillStyle = "#c3c0ba"; g.fillRect(0, 0, c.width, c.height); // grout
  for (let row = 0; row < 2; row++) {
    for (let col = -1; col < 3; col++) {
      const x = (col * 24 + (row ? 12 : 0)) * PX, y = row * 12 * PX, gw = 0.12 * PX;
      const tone = 222 + Math.round((r() - 0.5) * 6);
      g.fillStyle = `rgb(${tone},${tone - 2},${tone - 5})`;
      g.fillRect(x + gw, y + gw, 24 * PX - 2 * gw, 12 * PX - 2 * gw);
      // faint cloudy veins
      g.save();
      g.beginPath(); g.rect(x + gw, y + gw, 24 * PX - 2 * gw, 12 * PX - 2 * gw); g.clip();
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = `rgba(170,166,160,${0.03 + r() * 0.04})`;
        g.lineWidth = 1 + r() * 2;
        g.beginPath();
        let px = x + r() * 24 * PX, py = y;
        g.moveTo(px, py);
        for (let s = 0; s < 6; s++) { px += (r() - 0.5) * 60; py += 12 * PX / 5; g.lineTo(px, py); }
        g.stroke();
      }
      g.restore();
    }
  }
  const img = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) { const n = (r() - 0.5) * 6; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { tex: t, repeatW: W, repeatH: H };
}

// Plane spanning a rectangle (corners p00, p10, p11, p01) with UVs in inches / repeat.
function quad(corners, material, repeat = null) {
  const [a, b, c, d] = corners.map((p) => new THREE.Vector3(...p));
  const g = new THREE.BufferGeometry();
  const uL = a.distanceTo(b), vL = a.distanceTo(d);
  const ru = repeat ? repeat[0] : 1, rv = repeat ? repeat[1] : 1;
  g.setAttribute("position", new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray()], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, uL / ru, 0, uL / ru, vL / rv, 0, vL / rv], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}
function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

/**
 * The room as three.js meshes. white = every surface white and matte (the light pass).
 * Alcove interior walls are included (painted); the new panels and base cover them.
 */
export function roomScene(m, { white = false } = {}) {
  const W = m.facingWidth, D = m.sideLength, C = ROOM.ceiling;
  const side = 70, front = 140; // room around the alcove
  const S = new THREE.Scene();
  const mat = (opts) => (white ? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 }) : new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...opts }));
  const paint = mat({ color: new THREE.Color("#efebe5") });
  const alcovePaint = mat({ color: new THREE.Color("#f1eee9") });
  const ceil = mat({ color: new THREE.Color("#fbfaf8") });
  const trim = mat({ color: new THREE.Color("#f4f3ef"), roughness: 0.45 });
  const fl = floorTexture();
  const floor = white ? mat({}) : new THREE.MeshStandardMaterial({ map: fl.tex, roughness: 0.55, metalness: 0 });

  // alcove: back wall and the two end walls, to the ceiling
  S.add(quad([[0, 0, 0], [W, 0, 0], [W, C, 0], [0, C, 0]], alcovePaint));
  if (m.leftWall) S.add(quad([[0, 0, D], [0, 0, 0], [0, C, 0], [0, C, D]], alcovePaint));
  if (m.rightWall) S.add(quad([[W, 0, 0], [W, 0, D], [W, C, D], [W, C, 0]], alcovePaint));
  // alcove floor (under the tub / base) and ceiling
  S.add(quad([[0, 0, D], [W, 0, D], [W, 0, 0], [0, 0, 0]], floor, [fl.repeatW, fl.repeatH]));
  S.add(quad([[0, C, 0], [W, C, 0], [W, C, D], [0, C, D]], ceil));
  // the bathroom wall the alcove is set into (plane z = D), left and right of the opening
  const l0 = m.leftWall ? 0 : -1, r0 = m.rightWall ? W : W + 1;
  S.add(quad([[-side, 0, D], [l0, 0, D], [l0, C, D], [-side, C, D]], paint));
  S.add(quad([[r0, 0, D], [W + side, 0, D], [W + side, C, D], [r0, C, D]], paint));
  // the room's side walls and floor/ceiling in front of the alcove
  S.add(quad([[-side, 0, D + front], [-side, 0, D], [-side, C, D], [-side, C, D + front]], paint));
  S.add(quad([[W + side, 0, D], [W + side, 0, D + front], [W + side, C, D + front], [W + side, C, D]], paint));
  S.add(quad([[-side, 0, D + front], [W + side, 0, D + front], [W + side, 0, D], [-side, 0, D]], floor, [fl.repeatW, fl.repeatH]));
  S.add(quad([[-side, C, D], [W + side, C, D], [W + side, C, D + front], [-side, C, D + front]], ceil));
  // baseboards beside the opening, a finished corner bead on the opening edges, and crown line
  const bb = 4.25, bd = 0.6;
  S.add(box(side + l0, bb, bd, trim, (-side + l0) / 2, bb / 2, D + bd / 2));
  S.add(box(W + side - r0, bb, bd, trim, (r0 + W + side) / 2, bb / 2, D + bd / 2));
  if (m.leftWall) S.add(box(0.8, C, 0.8, mat({ color: new THREE.Color("#ebe7e0") }), -0.4, C / 2, D + 0.4));
  if (m.rightWall) S.add(box(0.8, C, 0.8, mat({ color: new THREE.Color("#ebe7e0") }), W + 0.4, C / 2, D + 0.4));
  // recessed light trims in the ceiling (purely visual)
  if (!white) {
    const lamp = new THREE.MeshBasicMaterial({ color: 0xfffdf6 });
    for (const [x, z] of [[W / 2, D / 2], [W / 2, D + 46]]) {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), lamp);
      disc.rotation.x = Math.PI / 2;
      disc.position.set(x, C - 0.05, z);
      S.add(disc);
    }
  }

  // soft contact shadows where surfaces meet (a gradient darkening, like ambient occlusion)
  if (!white) {
    // strongest along the first edge (p00-p10), fading toward p01-p11
    const ao = (corners, strength = 0.16) => {
      const p = corners.map((q) => new THREE.Vector3(...q));
      S.add(quad(corners, shadowMat(strength), [p[0].distanceTo(p[1]), p[0].distanceTo(p[3])]));
    };
    ao([[-side, 0.02, D], [l0, 0.02, D], [l0, 0.02, D + 7], [-side, 0.02, D + 7]]);
    ao([[r0, 0.02, D], [W + side, 0.02, D], [W + side, 0.02, D + 7], [r0, 0.02, D + 7]]);
    ao([[l0, 0.03, D], [r0, 0.03, D], [r0, 0.03, D + 9], [l0, 0.03, D + 9]], 0.3); // under the front of the tub / base
    ao([[-side, C, D + 0.05], [W + side, C, D + 0.05], [W + side, C - 6, D + 0.05], [-side, C - 6, D + 0.05]], 0.06);
    ao([[0, C, 0.05], [W, C, 0.05], [W, C - 8, 0.05], [0, C - 8, 0.05]], 0.08);
  }

  // light: a soft sky/bounce fill, a recessed shower light over the alcove, the room's ceiling light
  S.add(new THREE.HemisphereLight(0xfffcf8, 0xe7e3dc, 1.85));
  S.add(new THREE.AmbientLight(0xffffff, 0.22));
  const shower = new THREE.SpotLight(0xfffaf2, 0.85, 0, Math.PI / 2.4, 1, 0);
  shower.position.set(W / 2, C - 1, D / 2);
  shower.target.position.set(W / 2, 0, D / 2);
  S.add(shower, shower.target);
  const roomLight = new THREE.PointLight(0xfff8ee, 0.55, 0, 0);
  roomLight.position.set(W / 2, C - 2, D + 46);
  S.add(roomLight);
  const fill = new THREE.DirectionalLight(0xfffaf3, 0.35);
  fill.position.set(W / 2 + 30, 60, D + 200);
  fill.target.position.set(W / 2, 40, 0);
  S.add(fill, fill.target);
  return S;
}

/** A black plane fading from `strength` at its first edge (p00-p10) to clear at the opposite edge. */
let shadowTex = null;
function shadowMat(strength) {
  if (!shadowTex) {
    const c = canvas(4, 64), g = c.getContext("2d");
    const gr = g.createLinearGradient(0, 64, 0, 0);
    gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.35, "rgba(0,0,0,0.45)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
    shadowTex = new THREE.CanvasTexture(c);
  }
  return new THREE.MeshBasicMaterial({ color: 0x1a140c, alphaMap: shadowTex, transparent: true, opacity: strength, depthWrite: false });
}

export function threeCamera(cam, w, h) {
  const R = cam.R, C = cam.position;
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 4000);
  camera.matrixAutoUpdate = false;
  const mtx = new THREE.Matrix4().set(R[0], -R[3], -R[6], C[0], R[1], -R[4], -R[7], C[1], R[2], -R[5], -R[8], C[2], 0, 0, 0, 1);
  camera.matrix.copy(mtx); camera.matrixWorld.copy(mtx); camera.matrixWorldInverse.copy(mtx).invert();
  const n = 1, l = (-cam.cx / cam.f) * n, r = ((w - cam.cx) / cam.f) * n, t = (cam.cy / cam.f) * n, b = (-(h - cam.cy) / cam.f) * n;
  camera.projectionMatrix.makePerspective(l, r, t, b, n, 4000);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  return camera;
}

/**
 * Render the example room for this alcove size.
 * Returns { cam, beauty: ImageData (w×h), light: Float32Array linear RGB (lw×lh), lw, lh, marks }.
 */
const roomCache = new Map();
export function renderRoom(m, opts = {}) {
  const key = JSON.stringify([m.facingWidth, m.sideLength, m.rimHeight, m.markHeight, m.leftWall, m.rightWall, opts.width, opts.height]);
  if (roomCache.has(key)) return roomCache.get(key);
  const room = drawRoomImages(m, opts);
  roomCache.set(key, room);
  if (roomCache.size > 4) roomCache.delete(roomCache.keys().next().value);
  return room;
}

function drawRoomImages(m, { width = ROOM.width, height = ROOM.height, lightScale = 0.35 } = {}) {
  const cam = modelCamera(m, width, height);
  const cvs = canvas(width, height);
  const renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true, preserveDrawingBuffer: true, alpha: false });
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    const camera = threeCamera(cam, width, height);
    const grab = () => {
      const c2 = canvas(width, height), g = c2.getContext("2d", { willReadFrequently: true });
      g.drawImage(cvs, 0, 0);
      return g.getImageData(0, 0, width, height);
    };
    renderer.render(roomScene(m), camera);
    const beauty = grab();
    // light map: the white room drawn straight at a reduced size (light is smooth)
    const lw = Math.max(8, Math.round(width * lightScale)), lh = Math.max(8, Math.round(height * lightScale));
    renderer.setSize(lw, lh, false);
    renderer.render(roomScene(m, { white: true }), camera);
    const small = canvas(lw, lh), sg = small.getContext("2d", { willReadFrequently: true });
    sg.drawImage(cvs, 0, 0, lw, lh);
    const px = sg.getImageData(0, 0, lw, lh).data;
    const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const light = new Float32Array(lw * lh * 3);
    for (let i = 0; i < lw * lh; i++) for (let c = 0; c < 3; c++) light[i * 3 + c] = lin(px[i * 4 + c]);
    return { cam, beauty, light, lw, lh, marks: modelMarks(cam, m) };
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}

/** Light seen by the white room at a world point (linear RGB). */
export function lightAt(room, P) {
  const q = project(room.cam, P);
  const x = Math.max(0, Math.min(room.lw - 1, Math.round((q[0] / ROOM.width) * room.lw)));
  const y = Math.max(0, Math.min(room.lh - 1, Math.round((q[1] / ROOM.height) * room.lh)));
  const i = (y * room.lw + x) * 3;
  return [room.light[i], room.light[i + 1], room.light[i + 2]];
}
