// DEVELOPMENT ONLY: synthetic "before" photos for testing the photo workflow.
// Draws an existing (old) bathroom - cream 4" tile up to 72", a white tub,
// optionally a curtain or glass doors - with a camera anywhere, and returns the
// picture with the exact corners a person should mark. Nothing here is used by
// the customer Studio; the dev hook in useStudioEngine loads it locally only.
import * as THREE from "three";
import { project, cameraCenter } from "./geometry.js";
import { roomScene, threeCamera } from "./room.js";
import { suggestMarks } from "./detect.js";
import { solveCamera } from "./geometry.js";

/** OpenCV-style camera at C looking at target (world y up, no roll). */
export function lookAtCamera(C, target, f, w, h) {
  const fwd = [target[0] - C[0], target[1] - C[1], target[2] - C[2]];
  const n = Math.hypot(...fwd); const z = fwd.map((v) => v / n);
  let x = [z[1] * 0 - z[2] * 1, z[2] * 0 - z[0] * 0, z[0] * 1 - z[1] * 0]; // z × up(0,1,0)
  const xn = Math.hypot(...x); x = x.map((v) => v / xn);
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]; // z × x (down)
  const R = [...x, ...y, ...z];
  const t = [-(R[0] * C[0] + R[1] * C[1] + R[2] * C[2]), -(R[3] * C[0] + R[4] * C[1] + R[5] * C[2]), -(R[6] * C[0] + R[7] * C[1] + R[8] * C[2])];
  const cam = { f, cx: w / 2, cy: h / 2, R, t };
  cam.position = cameraCenter(cam);
  cam.fovY = (2 * Math.atan(h / 2 / f) * 180) / Math.PI;
  return cam;
}

function tileTexture(color = "#efe0bf", grout = "#d9c9a6", size = 4.25) {
  const PX = 16, c = document.createElement("canvas");
  c.width = c.height = Math.round(size * PX);
  const g = c.getContext("2d");
  g.fillStyle = grout; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = color; g.fillRect(1.5, 1.5, c.width - 3, c.height - 3);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return { t, size };
}
function texturedQuad(corners, mat, size) {
  const [a, b, c, d] = corners.map((p) => new THREE.Vector3(...p));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray()], 3));
  const u = a.distanceTo(b) / size, v = a.distanceTo(d) / size;
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, v], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

/**
 * opts: { measure, camera: { x, y, z, tx, ty, tz, fovY }, width, height, curtain, door, tileTop, tileColor }
 * Returns { image: ImageData, truth: marks, cam }.
 */
export function syntheticPhoto(opts) {
  const m = { facingWidth: 60, sideLength: 30, rimHeight: 15, leftWall: true, rightWall: true, ...(opts.measure || {}) };
  const W = m.facingWidth, D = m.sideLength, rim = m.rimHeight, top = opts.tileTop ?? 72;
  const w = opts.width ?? 900, h = opts.height ?? 1200;
  const c = opts.camera;
  const f = (h / 2) / Math.tan(((c.fovY ?? 62) * Math.PI) / 360);
  const cam = lookAtCamera([c.x, c.y, c.z], [c.tx ?? W / 2, c.ty ?? 42, c.tz ?? 0], f, w, h);
  const S = roomScene(m);
  const tile = tileTexture(opts.tileColor);
  const tm = new THREE.MeshStandardMaterial({ map: tile.t, roughness: 0.4 });
  S.add(texturedQuad([[0, rim, 0.05], [W, rim, 0.05], [W, top, 0.05], [0, top, 0.05]], tm, tile.size));
  if (m.leftWall) S.add(texturedQuad([[0.05, rim, D], [0.05, rim, 0], [0.05, top, 0], [0.05, top, D]], tm, tile.size));
  if (m.rightWall) S.add(texturedQuad([[W - 0.05, rim, 0], [W - 0.05, rim, D], [W - 0.05, top, D], [W - 0.05, top, 0]], tm, tile.size));
  // the old tub: a white box with a darker basin opening on top
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f5f1, roughness: 0.25 });
  const tub = new THREE.Mesh(new THREE.BoxGeometry(W, rim, D), white);
  tub.position.set(W / 2, rim / 2, D / 2); S.add(tub);
  const basin = new THREE.Mesh(new THREE.PlaneGeometry(W - 9, D - 7), new THREE.MeshStandardMaterial({ color: 0xe4e2dc, roughness: 0.3 }));
  basin.rotation.x = -Math.PI / 2; basin.position.set(W / 2, rim + 0.02, D / 2 - 0.5); S.add(basin);
  if (opts.curtain) {
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.42, 70), new THREE.MeshStandardMaterial({ color: 0xe9e7e2, roughness: 0.9, side: THREE.DoubleSide }));
    cl.position.set(opts.curtain === "left" ? W * 0.21 : W * 0.79, rim + 39, D - 1.5); S.add(cl);
  }
  if (opts.door) {
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(W - 2, 58), new THREE.MeshStandardMaterial({ color: 0xdfeeea, roughness: 0.05, transparent: true, opacity: 0.22 }));
    gl.position.set(W / 2, rim + 30, D - 1); S.add(gl);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(W, 1.2, 1.5), new THREE.MeshStandardMaterial({ color: 0xcfd2d4, metalness: 0.9, roughness: 0.2 }));
    rail.position.set(W / 2, rim + 59, D - 1); S.add(rail);
  }
  const cvs = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true, preserveDrawingBuffer: true });
  try {
    renderer.setPixelRatio(1); renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
    renderer.render(S, threeCamera(cam, w, h));
    const c2 = document.createElement("canvas"); c2.width = w; c2.height = h;
    const g = c2.getContext("2d", { willReadFrequently: true });
    g.drawImage(cvs, 0, 0);
    const image = g.getImageData(0, 0, w, h);
    const P = (x, y, z) => { const q = project(cam, [x, y, z]); return [q[0], q[1]]; };
    const truth = { wallTL: P(0, top, 0), wallTR: P(W, top, 0), wallBL: P(0, rim, 0), wallBR: P(W, rim, 0) };
    return { image, truth, cam, dataUrl: c2.toDataURL("image/jpeg", 0.9), measure: m, tileTop: top };
  } finally { renderer.dispose(); renderer.forceContextLoss(); }
}

/** Detection on a synthetic photo, scored against the truth. */
export function evaluate(ph) {
  const t0 = performance.now();
  const s = suggestMarks(ph.image);
  const ms = performance.now() - t0;
  const diag = Math.hypot(ph.image.width, ph.image.height);
  if (!s) return { found: false, ms };
  const err = {};
  for (const k of ["wallBL", "wallBR", "wallTR", "wallTL"]) err[k] = Math.hypot(s.marks[k][0] - ph.truth[k][0], s.marks[k][1] - ph.truth[k][1]) / diag;
  let cam = null;
  try {
    const c = solveCamera(s.marks, { wallWidth: ph.measure.facingWidth, lowHeight: ph.measure.rimHeight }, ph.image);
    cam = { fovY: c.fovY, pos: c.position, top: c.highHeight, rms: c.rmsPx };
  } catch { /* unsolvable */ }
  const posErr = cam ? Math.hypot(cam.pos[0] - ph.cam.position[0], cam.pos[1] - ph.cam.position[1], cam.pos[2] - ph.cam.position[2]) : null;
  return { found: true, ms, marks: s.marks, posErr, confidence: s.confidence, walls: s.walls, topFound: s.topFound, errBottom: Math.max(err.wallBL, err.wallBR), errTop: Math.max(err.wallTL, err.wallTR), cam, truthCam: { fovY: ph.cam.fovY, pos: ph.cam.position } };
}
