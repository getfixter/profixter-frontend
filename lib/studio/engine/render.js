// The controlled ("exact") layer: new walls, base and trim drawn at real size
// from the recovered camera, shaded with light measured from the photo, and
// composited over the untouched original.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { makeFinishTexture } from "./textures.js";

// Surface ids written to the id pass (red channel).
export const SURF = { NONE: 0, WALL_FACING: 1, WALL_LEFT: 2, WALL_RIGHT: 3, PAN: 4, TRIM: 5, FIXTURE: 6, PAINT: 7, DOOR: 8, ACCESSORY: 9 };

const vert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

// albedo(uv) x photo illumination(screen) x small geometric terms + gloss.
const frag = /* glsl */ `
  uniform sampler2D albedoMap;
  uniform vec2 repeatInches;
  uniform bool useMap;
  uniform vec3 albedo;
  uniform sampler2D illumMap;
  uniform bool useIllumMap;
  uniform vec3 illumConst;
  uniform vec2 viewport;
  uniform float whiteAlbedo;
  uniform float exposure;
  uniform vec3 camPos;
  uniform vec3 keyDir;
  uniform float gloss;
  uniform float shadeAmt;
  uniform vec4 aoPlanes[4];
  uniform int aoCount;
  uniform float grain;
  uniform float surfaceId;
  uniform bool idPass;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
  vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

  void main() {
    if (idPass) { gl_FragColor = vec4(surfaceId / 255.0, 0.0, 0.0, 1.0); return; }
    vec3 a = useMap ? toLinear(texture2D(albedoMap, vUv / repeatInches).rgb) : albedo;
    vec2 suv = gl_FragCoord.xy / viewport;
    suv.y = 1.0 - suv.y;
    vec3 E = illumConst;
    if (useIllumMap) { vec3 e = texture2D(illumMap, suv).rgb; E = e * e; } // stored as sqrt for 8-bit precision

    // Soft contact shadow in inside corners and where walls meet the base.
    float ao = 1.0;
    for (int i = 0; i < 4; i++) {
      if (i >= aoCount) break;
      float d = abs(dot(vec4(vWorld, 1.0), vec4(aoPlanes[i].xyz, -aoPlanes[i].w)));
      ao *= 1.0 - 0.22 * exp(-d / 2.5);
    }
    vec3 n = normalize(vNormal);
    float lambert = (1.0 - shadeAmt) + shadeAmt * max(dot(n, normalize(keyDir)), 0.0);

    vec3 col = a / whiteAlbedo * E * ao * lambert * exposure;

    // Gloss: Fresnel-weighted reflection of the room plus a soft highlight.
    vec3 v = normalize(camPos - vWorld);
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
    vec3 h = normalize(normalize(keyDir) + v);
    float spec = pow(max(dot(n, h), 0.0), 60.0);
    // Reflected room: brighter toward the ceiling light, dimmer toward the floor.
    vec3 rdir = reflect(-v, n);
    float sky = smoothstep(-0.6, 0.9, rdir.y);
    vec3 room = E * (0.35 + 0.9 * sky);
    col += gloss * (fres * room + spec * 0.45 * E) * exposure;

    vec3 s = toSrgb(clamp(col, 0.0, 1.0));
    s += (hash(gl_FragCoord.xy) - 0.5) * grain;
    gl_FragColor = vec4(s, 1.0);
  }
`;

function makeSurfaceMaterial(opts) {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      albedoMap: { value: opts.map || null },
      repeatInches: { value: new THREE.Vector2(opts.repeatW || 1, opts.repeatH || 1) },
      useMap: { value: !!opts.map },
      albedo: { value: new THREE.Color(opts.albedo || "#f4f4f0").convertSRGBToLinear() },
      illumMap: { value: opts.illumMap || null },
      useIllumMap: { value: !!opts.illumMap },
      illumConst: { value: new THREE.Vector3(...(opts.illumConst || [0.7, 0.7, 0.7])) },
      viewport: { value: new THREE.Vector2(1, 1) },
      whiteAlbedo: { value: 0.82 },
      exposure: { value: 1 },
      camPos: { value: new THREE.Vector3() },
      keyDir: { value: new THREE.Vector3(0.2, 1, 0.6) },
      gloss: { value: opts.gloss ?? 0.5 },
      shadeAmt: { value: opts.shadeAmt ?? 0.14 },
      aoPlanes: { value: (opts.aoPlanes || []).concat(Array(4).fill(new THREE.Vector4())).slice(0, 4) },
      aoCount: { value: (opts.aoPlanes || []).length },
      grain: { value: 0.012 },
      surfaceId: { value: opts.id },
      idPass: { value: false },
    },
    side: THREE.DoubleSide,
  });
}

// Plane spanning a rectangle in world inches, with UVs in inches.
function rectMesh(corners, material) {
  // corners: [p00, p10, p11, p01] where u runs p00->p10 and v runs p00->p01.
  const [a, b, c, d] = corners.map((p) => new THREE.Vector3(...p));
  const g = new THREE.BufferGeometry();
  const uLen = a.distanceTo(b), vLen = a.distanceTo(d);
  g.setAttribute("position", new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray()], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, uLen, 0, uLen, vLen, 0, vLen], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

/** Which side of the alcove is open: the threshold, apron and door go there. */
export function openSideOf(layout) {
  if (layout.openSide) return layout.openSide;
  if (!layout.rightWall) return "right";
  if (!layout.leftWall) return "left";
  return "front";
}

export class StudioRenderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; // custom shader writes sRGB itself (no colorspace include)
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 1, 2000);
    this.camera.matrixAutoUpdate = false;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.textureCache = new Map();
    this.wallMaterials = [];
  }

  setSize(w, h) {
    this.width = w; this.height = h;
    this.renderer.setSize(w, h, false);
  }

  // OpenCV-style camera (R, t, f, principal point) -> three.js camera.
  setCamera(cam) {
    this.cam = cam;
    const R = cam.R;
    const C = cam.position;
    // Camera-to-world rotation is R^T; flip y and z for three.js' looking down -z, y up.
    const m = new THREE.Matrix4().set(
      R[0], -R[3], -R[6], C[0],
      R[1], -R[4], -R[7], C[1],
      R[2], -R[5], -R[8], C[2],
      0, 0, 0, 1,
    );
    this.camera.matrix.copy(m);
    this.camera.matrixWorld.copy(m);
    this.camera.matrixWorldInverse.copy(m).invert();
    const near = 1, far = 2000;
    const w = this.width, h = this.height, f = cam.f;
    // Off-axis frustum so the principal point can sit anywhere.
    const l = (-cam.cx / f) * near, r = ((w - cam.cx) / f) * near;
    const t = (cam.cy / f) * near, b = (-(h - cam.cy) / f) * near;
    this.camera.projectionMatrix.makePerspective(l, r, t, b, near, far);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }

  finishTexture(finish) {
    const key = finish.id + (finish.texture?.image ? ":tex" : "");
    if (!this.textureCache.has(key)) {
      const t = makeFinishTexture(finish);
      const tex = new THREE.CanvasTexture(t.canvas);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.NoColorSpace; // decoded to linear in the shader
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      this.textureCache.set(key, { tex, repeatW: t.repeatW, repeatH: t.repeatH });
    }
    return this.textureCache.get(key);
  }

  /**
   * Build the scene.
   * layout: { facingWidth, sideLength, leftWall, rightWall }   (inches)
   * pan:    { height, thresholdW, ledgeW, floorDrop, drain: { along, across } } (inches; along/across 0..1)
   * wall:   { height, finish }  height above the base
   * fixture:{ valve: [x,y], head: [x,y] } on the facing wall plane, plus style
   * light:  { facing, left, right: DataTexture|null, floor: [r,g,b], apron: [r,g,b], exposure, keyDir }
   * enclosure: null | { kind: "door", ... } | { kind: "rod", ... }   (see buildEnclosure)
   * accessories: [{ type: "grabBar" | "shelf" | "seat", ... }]        (see buildAccessories)
   */
  build({ layout, pan, wall, fixture, light, above, enclosure = null, accessories = [] }) {
    this.scene.clear();
    this.wallMaterials = [];
    const W = layout.facingWidth, L = layout.sideLength;
    const H = pan.height, top = H + wall.height;
    const ft = this.finishTexture(wall.finish);

    // Inside corners for contact shading: planes as (normal, offset).
    const corner = [new THREE.Vector4(0, 0, 1, 0), new THREE.Vector4(0, 1, 0, H)];
    if (layout.leftWall) corner.push(new THREE.Vector4(1, 0, 0, 0));
    if (layout.rightWall) corner.push(new THREE.Vector4(1, 0, 0, W));

    const wallMat = (id, illum) => {
      const m = makeSurfaceMaterial({
        id, map: ft.tex, repeatW: ft.repeatW, repeatH: ft.repeatH,
        illumMap: illum, illumConst: light.floor, gloss: wall.finish.gloss ?? 0.55, aoPlanes: corner,
      });
      this.wallMaterials.push(m);
      return m;
    };

    // Facing wall (z = 0).
    this.scene.add(rectMesh([[0, H, 0], [W, H, 0], [W, top, 0], [0, top, 0]], wallMat(SURF.WALL_FACING, light.facing)));
    // Side walls; u runs from the facing wall toward the open end so patterns meet at the corner.
    if (layout.leftWall) this.scene.add(rectMesh([[0, H, L], [0, H, 0], [0, top, 0], [0, top, L]], wallMat(SURF.WALL_LEFT, light.left)));
    if (layout.rightWall) this.scene.add(rectMesh([[W, H, 0], [W, H, L], [W, top, L], [W, top, 0]], wallMat(SURF.WALL_RIGHT, light.right)));

    // Finished edge cap on each open vertical panel edge, and along the top.
    const trimMat = makeSurfaceMaterial({ id: SURF.TRIM, albedo: wall.finish.trimColor || wall.finish.color, illumConst: light.apron, gloss: 0.6 });
    this.trimMaterials = [trimMat];
    const cap = 0.75, depth = 0.5;
    if (!layout.rightWall) this.scene.add(rectMesh([[W - cap, H, depth], [W, H, depth], [W, top, depth], [W - cap, top, depth]], trimMat));
    if (!layout.leftWall) this.scene.add(rectMesh([[0, H, depth], [cap, H, depth], [cap, top, depth], [0, top, depth]], trimMat));
    // front-open alcove: the side panels end at the opening with a finished edge
    if (openSideOf(layout) === "front") {
      if (layout.leftWall) this.scene.add(rectMesh([[depth, H, L - cap], [depth, H, L], [depth, top, L], [depth, top, L - cap]], trimMat));
      if (layout.rightWall) this.scene.add(rectMesh([[W - depth, H, L], [W - depth, H, L - cap], [W - depth, top, L - cap], [W - depth, top, L]], trimMat));
    }
    this.scene.add(rectMesh([[0, top, depth], [W, top, depth], [W, top - 0.6, depth + 0.02], [0, top - 0.6, depth + 0.02]], trimMat));

    // Old tile above the panels removed, wall patched and painted to match the room.
    if (above) {
      const paintLin = above.albedoRatio.map((v) => v * 0.82);
      const paintMat = (illum) => {
        const m = makeSurfaceMaterial({ id: SURF.PAINT, illumMap: illum, illumConst: light.floor, gloss: 0.05, aoPlanes: corner });
        m.uniforms.albedo.value.setRGB(...paintLin);
        return m;
      };
      const y0 = top, y1 = above.top;
      this.scene.add(rectMesh([[0, y0, 0], [W, y0, 0], [W, y1, 0], [0, y1, 0]], paintMat(light.facing)));
      if (layout.leftWall) this.scene.add(rectMesh([[0, y0, L], [0, y0, 0], [0, y1, 0], [0, y1, L]], paintMat(light.left)));
      if (layout.rightWall) this.scene.add(rectMesh([[W, y0, 0], [W, y0, L], [W, y1, L], [W, y1, 0]], paintMat(light.right)));
    }

    this.buildPan(layout, pan, light);
    this.buildFixture(fixture ? { ...fixture, baseTop: H } : null, light, layout);
    this.buildEnclosure(enclosure, layout, pan, light);
    this.buildAccessories(accessories, layout, pan, light);
    this.applyLightUniforms(light);
  }

  metal(color, roughness = 0.14) {
    return new THREE.MeshStandardMaterial({ color: color ?? 0xe6e8ea, metalness: 1, roughness, envMap: this.envMap, envMapIntensity: 1 });
  }

  /**
   * A wall's local frame: u along the wall, y up, n out of the wall into the shower.
   * facing: u = x;  left: u = z (from the facing wall);  right: u = z.
   */
  wallFrame(wall, layout) {
    const W = layout.facingWidth;
    if (wall === "facing") return { origin: [0, 0, 0], u: [1, 0, 0], n: [0, 0, 1] };
    // left wall: a proper rotation needs u running toward -z, so u is negated (flip: true)
    if (wall === "left") return { origin: [0, 0, 0], u: [0, 0, -1], n: [1, 0, 0], flip: true };
    return { origin: [W, 0, 0], u: [0, 0, 1], n: [-1, 0, 0] };
  }

  placeOnWall(obj, frame) {
    // local x = u, local y = up, local z = n (out of the wall)
    const [ux, uy, uz] = frame.u, [nx, ny, nz] = frame.n;
    const m = new THREE.Matrix4().set(ux, 0, nx, frame.origin[0], uy, 1, ny, frame.origin[1], uz, 0, nz, frame.origin[2], 0, 0, 0, 1);
    obj.applyMatrix4(m);
    return obj;
  }

  /**
   * Shower enclosure on the open side of the alcove.
   * door: { kind: "door", glassHeight, glassThickness, frame: "framed" | "semi" | "frameless", frameColor, panels: 2, overlap }
   * rod:  { kind: "rod", height (above the floor), diameter, finishColor, curtain: { color } | null }
   */
  /** The opening's frame: u along the opening (0..len), y up, n into the shower; origin on the threshold line. */
  openingFrame(layout, inset) {
    const W = layout.facingWidth, L = layout.sideLength, open = openSideOf(layout);
    if (open === "front") return { len: W, origin: [W, 0, L - inset], u: [-1, 0, 0], n: [0, 0, -1] };
    if (open === "left") return { len: L, origin: [inset, 0, L], u: [0, 0, -1], n: [1, 0, 0] };
    return { len: L, origin: [W - inset, 0, 0], u: [0, 0, 1], n: [-1, 0, 0] };
  }

  buildEnclosure(enc, layout, pan, light) {
    if (!enc) return;
    // Built in the opening's frame (x along the opening, z into the shower), then placed.
    const inset = enc.kind === "door" ? (pan.thresholdW || 3) / 2 : (pan.thresholdW || 3) + 1.5;
    const fr = this.openingFrame(layout, inset);
    const W = 0, L = fr.len, H = pan.height;
    const g = new THREE.Group();
    const frameMat = this.metal(enc.frameColor ?? 0xdfe2e4, 0.22);
    if (enc.kind === "door") {
      // On the threshold, centred on its width.
      const xd = 0;
      const gh = enc.glassHeight, y0 = H + 0.8, y1 = H + gh;
      const ov = enc.overlap ?? 2;
      const glass = new THREE.MeshStandardMaterial({
        color: 0xe9f2ef, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.16, envMap: this.envMap, envMapIntensity: 1.2, depthWrite: false, side: THREE.DoubleSide,
      });
      const edge = new THREE.MeshStandardMaterial({ color: 0xa9c9bd, metalness: 0, roughness: 0.2, transparent: true, opacity: 0.55, depthWrite: false });
      const t = enc.glassThickness ?? 0.25;
      // two bypass panels: one on the inside track (+n), one outside (-n)
      const panes = [
        { n: xd + 0.55, a: 0.9, b: L / 2 + ov / 2 },
        { n: xd - 0.55, a: L / 2 - ov / 2, b: L - 0.9 },
      ];
      for (const p of panes) {
        const pane = new THREE.Mesh(new THREE.BoxGeometry(p.b - p.a, y1 - y0, t), glass);
        pane.position.set((p.a + p.b) / 2, (y0 + y1) / 2, p.n);
        pane.userData.glass = true;
        g.add(pane);
        for (const a of [p.a, p.b]) {
          const e = new THREE.Mesh(new THREE.BoxGeometry(0.12, y1 - y0, t + 0.02), edge);
          e.position.set(a, (y0 + y1) / 2, p.n);
          e.userData.glass = true;
          g.add(e);
        }
        // towel-bar style handle on each panel, near its leading edge, on the outside
        const ha = p.a < L / 2 ? p.b - 4 : p.a + 4;
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 12, 16), frameMat);
        handle.position.set(ha, H + 40, p.n - 1.6);
        g.add(handle);
      }
      // rails and jambs (a frameless door still has a top rail and a bottom guide)
      const rail = enc.frame === "framed" ? 1.6 : 0.9;
      const top = new THREE.Mesh(new THREE.BoxGeometry(L, rail, 2.2), frameMat);
      top.position.set(L / 2, y1 + rail / 2, xd);
      g.add(top);
      const bottom = new THREE.Mesh(new THREE.BoxGeometry(L, 0.8, 2.0), frameMat);
      bottom.position.set(L / 2, H + 0.4, xd);
      g.add(bottom);
      for (const a of [0.45, L - 0.45]) {
        const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.9, y1 - H, 1.6), frameMat);
        jamb.position.set(a, (H + y1) / 2, xd);
        g.add(jamb);
      }
    } else if (enc.kind === "rod") {
      const y = enc.height;
      const d = enc.diameter ?? 1;
      // a curved rod bows outward (away from the shower) by `bow` at mid-span
      const bow = enc.bow || 0;
      const bowAt = (a) => -4 * bow * (a / L) * (1 - a / L);
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, y, 0), new THREE.Vector3(L / 2, y, -2 * bow), new THREE.Vector3(L, y, 0));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, d / 2, 16, false), this.metal(enc.finishColor)));
      for (const a of [0.2, L - 0.2]) {
        const fl = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.4, 24), this.metal(enc.finishColor));
        fl.rotation.z = Math.PI / 2;
        fl.position.set(a, y, 0);
        g.add(fl);
      }
      if (enc.curtain) {
        // A curtain pushed to the open end: illustrative fabric with folds.
        // gathered at the end of the opening away from the valve wall
        const gw = enc.curtain.gathered ?? 12;
        const a0 = enc.gatherAt === "start" ? 1 : L - gw, a1 = enc.gatherAt === "start" ? 1 + gw : L - 1, ytop = y - 1.5, ybot = H + 3;
        const geo = new THREE.PlaneGeometry(a1 - a0, ytop - ybot, 64, 2);
        // fold shading baked across the width: light on the crests, shadow in the troughs
        const fc = document.createElement("canvas");
        fc.width = 256; fc.height = 4;
        const fg = fc.getContext("2d");
        const base = new THREE.Color(enc.curtain.color || "#f1f1ee");
        for (let x = 0; x < 256; x++) {
          const u = (x / 255 - 0.5) * (a1 - a0);
          const b = 0.88 + 0.12 * Math.cos((u + 20) * 1.9);
          fg.fillStyle = `rgb(${Math.round(base.r * 255 * b)},${Math.round(base.g * 255 * b)},${Math.round(base.b * 255 * b)})`;
          fg.fillRect(x, 0, 1, 4);
        }
        const foldTex = new THREE.CanvasTexture(fc);
        foldTex.colorSpace = THREE.NoColorSpace;
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const u = pos.getX(i), v = pos.getY(i);
          const a = u + (a0 + a1) / 2;
          pos.setXYZ(i, a, v + (ytop + ybot) / 2, bowAt(a) + 1.3 * Math.sin((u + 20) * 1.9));
        }
        geo.computeVertexNormals();
        const cloth = makeSurfaceMaterial({ id: SURF.DOOR, map: foldTex, repeatW: 1, repeatH: 1, illumConst: light.apron.map((v) => v * 1.3), gloss: 0.0, shadeAmt: 0.05 });
        g.add(new THREE.Mesh(geo, cloth));
      }
    }
    g.traverse((o) => { if (o.isMesh && o.userData.surfaceId === undefined) o.userData.surfaceId = SURF.DOOR; });
    this.placeOnWall(g, fr);
    void W;
    this.scene.add(g);
  }

  /**
   * grabBar: { wall, u, y, length, orientation: "horizontal" | "vertical", diameter, clearance, flange, finishColor }
   *          u, y = centre of the bar on the wall (inches); clearance = wall to tube
   * shelf:   { corner: "left" | "right", y, leg, thickness, color }
   * seat:    { wall, u, y (seat top), width, depth, color, frameColor }
   */
  buildAccessories(list, layout, pan, light) {
    for (const a of list || []) {
      let obj = null;
      const frame = a.wall ? this.wallFrame(a.wall, layout) : null;
      const local = frame?.flip ? { ...a, u: -a.u } : a;
      if (a.type === "grabBar") obj = this.grabBar(local);
      if (a.type === "seat") obj = this.seat(local, light);
      if (obj) {
        this.placeOnWall(obj, frame);
      } else if (a.type === "shelf") {
        obj = this.cornerShelf(a, layout, light);
      }
      if (!obj) continue;
      obj.traverse((o) => { if (o.isMesh && o.userData.surfaceId === undefined) o.userData.surfaceId = SURF.ACCESSORY; });
      this.scene.add(obj);
    }
  }

  grabBar(a) {
    const g = new THREE.Group();
    const mat = this.metal(a.finishColor, a.roughness ?? 0.18);
    const d = a.diameter ?? 1.25, out = (a.clearance ?? 1.5) + d / 2, len = a.length;
    const vertical = a.orientation === "vertical";
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, len - d, 24), mat);
    if (!vertical) tube.rotation.z = Math.PI / 2;
    tube.position.set(a.u, a.y, out);
    g.add(tube);
    for (const s of [-1, 1]) {
      const ex = vertical ? a.u : a.u + s * (len / 2 - d / 2), ey = vertical ? a.y + s * (len / 2 - d / 2) : a.y;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, out, 20), mat);
      post.rotation.x = Math.PI / 2;
      post.position.set(ex, ey, out / 2);
      g.add(post);
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(d / 2, 20, 12), mat);
      elbow.position.set(ex, ey, out);
      g.add(elbow);
      const flange = new THREE.Mesh(new THREE.CylinderGeometry((a.flange ?? 3.125) / 2, (a.flange ?? 3.125) / 2, 0.35, 32), mat);
      flange.rotation.x = Math.PI / 2;
      flange.position.set(ex, ey, 0.18);
      g.add(flange);
    }
    return g;
  }

  seat(a, light) {
    const g = new THREE.Group();
    const top = makeSurfaceMaterial({ id: SURF.ACCESSORY, albedo: a.color || "#f2f2ee", illumConst: light.floor, gloss: 0.15, shadeAmt: 0.45 });
    const side = makeSurfaceMaterial({ id: SURF.ACCESSORY, albedo: a.color || "#f2f2ee", illumConst: light.apron, gloss: 0.15, shadeAmt: 0.45 });
    const thick = a.thickness ?? 1.25;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(a.width, thick, a.depth - 1), [side, side, top, side, side, side]);
    seat.position.set(a.u, a.y - thick / 2, 1 + (a.depth - 1) / 2);
    g.add(seat);
    const frame = this.metal(a.frameColor, 0.3);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(a.width - 1, 5, 0.8), frame);
    plate.position.set(a.u, a.y - 3.5, 0.4);
    g.add(plate);
    // folding brackets under the seat
    for (const s of [-1, 1]) {
      const len = Math.hypot(a.depth - 3, 8);
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, len), frame);
      br.position.set(a.u + s * (a.width / 2 - 1.5), a.y - thick - 4, (a.depth - 3) / 2 + 0.8);
      br.rotation.x = Math.atan2(8, a.depth - 3);
      g.add(br);
    }
    return g;
  }

  cornerShelf(a, layout, light) {
    const leg = a.leg ?? 9, t = a.thickness ?? 0.75;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(leg, 0);
    shape.quadraticCurveTo(leg * 0.62, leg * 0.62, 0, leg);
    shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 16 });
    // shape x -> along the facing wall (x), shape y -> out from it (z); extruded upward
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, 0);
    const mat = a.metal
      ? this.metal(a.color, 0.4)
      : makeSurfaceMaterial({ id: SURF.ACCESSORY, albedo: a.color || "#f2f2ee", illumConst: light.apron, gloss: 0.3, shadeAmt: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    const W = layout.facingWidth;
    if (a.corner === "right") { mesh.scale.x = -1; mesh.position.x = W; }
    mesh.position.y = a.y;
    return mesh;
  }

  /**
   * The base's own frame: X along the opening from the end on the viewer's left
   * (standing outside, facing the alcove), Z from the back wall toward the
   * opening. Returns a function (X, y, Z) -> world [x, y, z] and the frame sizes.
   */
  baseFrame(layout) {
    const W = layout.facingWidth, L = layout.sideLength, open = openSideOf(layout);
    if (open === "front") return { len: W, dep: L, at: (X, y, Z) => [X, y, Z], m: new THREE.Matrix4() };
    // open on the right (x = W): the back wall is the left wall (x = 0); the viewer's left end is the far end (z = L)
    if (open === "right") return { len: L, dep: W, at: (X, y, Z) => [Z, y, L - X], m: new THREE.Matrix4().set(0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, L, 0, 0, 0, 1) };
    // open on the left (x = 0): the back wall is the right wall (x = W); the viewer's left end is the facing wall (z = 0)
    return { len: L, dep: W, at: (X, y, Z) => [W - Z, y, X], m: new THREE.Matrix4().set(0, 0, -1, W, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1) };
  }

  /** Drain position as fractions of the base floor: fx along the opening from the viewer's left end, fz from the back. */
  drainFractions(drain) {
    const along = drain?.along ?? 0.5, across = drain?.across ?? 0.5;
    const end = Math.min(along, 1 - along);
    const fx = drain?.id === "left" ? end : drain?.id === "right" ? 1 - end : along;
    return { fx, fz: across };
  }

  buildPan(layout, pan, light) {
    if (pan.kind === "tub") { this.buildTub(layout, pan, light); return; }
    const W = layout.facingWidth, L = layout.sideLength, H = pan.height;
    const lw = pan.ledgeW, tw = pan.thresholdW, drop = pan.floorDrop, slope = pan.slope ?? 1.6;
    const panAlbedo = pan.color || "#f3f2ee";
    const ao = [new THREE.Vector4(0, 0, 1, 0)];
    if (layout.leftWall) ao.push(new THREE.Vector4(1, 0, 0, 0));
    if (layout.rightWall) ao.push(new THREE.Vector4(1, 0, 0, W));
    const horiz = makeSurfaceMaterial({ id: SURF.PAN, albedo: panAlbedo, illumConst: light.floor, gloss: 0.45, shadeAmt: 0.35, aoPlanes: ao });
    const vertM = makeSurfaceMaterial({ id: SURF.PAN, albedo: panAlbedo, illumConst: light.apron, gloss: 0.45, shadeAmt: 0.35, aoPlanes: ao });
    const mats = [horiz, vertM];

    // Which footprint edges face walls (have a ledge) and which is the open threshold.
    const open = openSideOf(layout);
    const thresholdAtRight = open === "right";
    const x0 = open === "left" ? tw : lw, x1 = thresholdAtRight ? W - tw : W - lw;
    const z0 = lw, z1 = open === "front" ? L - tw : L - lw;
    const fy = H - drop;

    // Top ledges / threshold (horizontal ring at y = H).
    const ring = [
      [[0, H, 0], [W, H, 0], [W, H, z0], [0, H, z0]],
      [[0, H, z1], [W, H, z1], [W, H, L], [0, H, L]],
      [[0, H, z0], [x0, H, z0], [x0, H, z1], [0, H, z1]],
      [[x1, H, z0], [W, H, z0], [W, H, z1], [x1, H, z1]],
    ];
    ring.forEach((q) => this.scene.add(rectMesh(q, horiz)));
    // Sloped inner sides down to the floor.
    const ix0 = x0 + slope, ix1 = x1 - slope, iz0 = z0 + slope, iz1 = z1 - slope;
    const slopes = [
      [[x0, H, z0], [x1, H, z0], [ix1, fy, iz0], [ix0, fy, iz0]],
      [[ix0, fy, iz1], [ix1, fy, iz1], [x1, H, z1], [x0, H, z1]],
      [[x0, H, z1], [x0, H, z0], [ix0, fy, iz0], [ix0, fy, iz1]],
      [[x1, H, z0], [x1, H, z1], [ix1, fy, iz1], [ix1, fy, iz0]],
    ];
    slopes.forEach((q) => this.scene.add(rectMesh(q, horiz)));
    this.scene.add(rectMesh([[ix0, fy, iz0], [ix1, fy, iz0], [ix1, fy, iz1], [ix0, fy, iz1]], horiz));
    // Front apron (vertical) on the open side, with a small rounded nose on the threshold.
    if (thresholdAtRight) this.scene.add(rectMesh([[W, 0, 0], [W, 0, L], [W, H, L], [W, H, 0]], vertM));
    if (!layout.leftWall) this.scene.add(rectMesh([[0, 0, L], [0, 0, 0], [0, H, 0], [0, H, L]], vertM));
    if (open === "front") this.scene.add(rectMesh([[0, 0, L], [W, 0, L], [W, H, L], [0, H, L]], vertM));

    // Drain: a chrome grate disk just above the floor, at the product's drain end.
    const { fx, fz } = this.drainFractions(pan.drain);
    let dx, dz;
    if (open === "front") { dx = ix0 + (ix1 - ix0) * fx; dz = iz0 + (iz1 - iz0) * fz; }
    else if (open === "right") { dz = iz1 - (iz1 - iz0) * fx; dx = ix0 + (ix1 - ix0) * fz; }
    else { dz = iz0 + (iz1 - iz0) * fx; dx = ix1 - (ix1 - ix0) * fz; }
    this.addDrain(dx, fy, dz, light);
    this.panMaterials = mats;
  }

  addDrain(x, y, z, light) {
    const grate = new THREE.Mesh(new THREE.CircleGeometry(2.1, 40), new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1, roughness: 0.25, envMap: this.envMap, envMapIntensity: 0.8 }));
    grate.rotation.x = -Math.PI / 2;
    grate.position.set(x, y + 0.05, z);
    grate.userData.surfaceId = SURF.FIXTURE;
    this.scene.add(grate);
    const slots = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.6, 40, 1), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 1, roughness: 0.4, envMap: this.envMap, envMapIntensity: 0.6 }));
    slots.rotation.x = -Math.PI / 2;
    slots.position.set(x, y + 0.06, z);
    slots.userData.surfaceId = SURF.FIXTURE;
    this.scene.add(slots);
    const ringM = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.5, 40), makeSurfaceMaterial({ id: SURF.PAN, albedo: "#bdbdb8", illumConst: light.floor, gloss: 0.2 }));
    ringM.rotation.x = -Math.PI / 2;
    ringM.position.set(x, y + 0.04, z);
    this.scene.add(ringM);
  }

  /**
   * An alcove bathtub, modelled as one: a flat deck with a rolled inner edge, a
   * basin whose walls taper to a flat floor (the end away from the drain slopes
   * more, as a backrest), a front apron with a rounded top lip and a small toe
   * recess, the drain at the drain end and an overflow plate above it.
   */
  buildTub(layout, pan, light) {
    const bf = this.baseFrame(layout);
    const len = bf.len, dep = bf.dep, H = pan.height;
    const drop = Math.min(pan.floorDrop ?? 13, H - 1.5), floorY = H - drop;
    const albedo = pan.color || "#f4f3ef";
    const { fx, fz } = this.drainFractions(pan.drain);
    const drainLeft = fx < 0.5;
    // deck widths: back, front (over the apron), the drain end and the other end
    const back = Math.max(2.5, pan.ledgeW ?? 3.5), front = Math.max(2.5, pan.thresholdW ?? 3.5);
    const eDrain = back + 1, eOther = back;
    const eL = drainLeft ? eDrain : eOther, eR = drainLeft ? eOther : eDrain;
    // inner opening at the deck and the basin floor (rounded rectangles)
    const top = { x0: eL, x1: len - eR, z0: back, z1: dep - front, r: 3.6 };
    const restIn = Math.min(10, (top.x1 - top.x0) * 0.16); // the backrest end slopes in further
    const flr = {
      x0: top.x0 + (drainLeft ? 2.2 : restIn), x1: top.x1 - (drainLeft ? restIn : 2.2),
      z0: top.z0 + 2.6, z1: top.z1 - 2.4, r: 4.5,
    };
    const N = 10; // points per rounded corner
    const rr = (q, y) => {
      const pts = [];
      const r = Math.min(q.r, (q.x1 - q.x0) / 2 - 0.1, (q.z1 - q.z0) / 2 - 0.1);
      const corners = [[q.x1 - r, q.z1 - r, 0], [q.x0 + r, q.z1 - r, Math.PI / 2], [q.x0 + r, q.z0 + r, Math.PI], [q.x1 - r, q.z0 + r, (3 * Math.PI) / 2]];
      for (const [cx, cz, a0] of corners) for (let i = 0; i <= N; i++) { const a = a0 + (i / N) * (Math.PI / 2); pts.push([cx + r * Math.cos(a), y, cz + r * Math.sin(a)]); }
      return pts;
    };
    const lerpQ = (a, b, t) => ({ x0: a.x0 + (b.x0 - a.x0) * t, x1: a.x1 + (b.x1 - a.x1) * t, z0: a.z0 + (b.z0 - a.z0) * t, z1: a.z1 + (b.z1 - a.z1) * t, r: a.r + (b.r - a.r) * t });
    const grow = (q, d) => ({ x0: q.x0 - d, x1: q.x1 + d, z0: q.z0 - d, z1: q.z1 + d, r: q.r + d });
    // profile from the deck edge down: a rolled lip, a gently curved wall, a filleted bottom
    const levels = [
      { q: top, y: H },
      { q: grow(top, -0.35), y: H - 0.45 },
      { q: grow(top, -0.55), y: H - 1.2 },
    ];
    const wallTop = grow(top, -0.6), wallBot = grow(flr, 1.6);
    for (let i = 1; i <= 6; i++) {
      const t = i / 6, e = t * t * 0.35 + t * 0.65; // walls steepen slightly toward the top
      levels.push({ q: lerpQ(wallTop, wallBot, e), y: H - 1.2 - (H - 1.2 - (floorY + 1.6)) * t });
    }
    levels.push({ q: grow(flr, 0.6), y: floorY + 0.45 }, { q: flr, y: floorY });
    const rings = levels.map((l) => rr(l.q, l.y));
    const M = rings[0].length;

    const pos = [], idx = [];
    const add = (p) => { pos.push(...bf.at(p[0], p[1], p[2])); return pos.length / 3 - 1; };
    // basin walls
    const ids = rings.map((ring) => ring.map(add));
    for (let k = 0; k < rings.length - 1; k++)
      for (let i = 0; i < M; i++) {
        const j = (i + 1) % M, a = ids[k][i], b = ids[k][j], c = ids[k + 1][j], d = ids[k + 1][i];
        idx.push(a, b, c, a, c, d);
      }
    // basin floor (convex): fan from the centre
    const last = rings[rings.length - 1];
    const cxm = last.reduce((s, p) => s + p[0], 0) / M, czm = last.reduce((s, p) => s + p[2], 0) / M;
    const ctr = add([cxm, floorY, czm]);
    for (let i = 0; i < M; i++) idx.push(ctr, ids[ids.length - 1][(i + 1) % M], ids[ids.length - 1][i]);
    const basin = new THREE.BufferGeometry();
    basin.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    basin.setIndex(idx);
    basin.computeVertexNormals();
    const [bcx, , bcz] = bf.at(cxm, floorY, czm);
    orientInward(basin, [bcx, (H + floorY) / 2 + 4, bcz]);

    // deck: outer rectangle minus the inner opening
    const contour = [new THREE.Vector2(0, 0), new THREE.Vector2(len, 0), new THREE.Vector2(len, dep), new THREE.Vector2(0, dep)];
    const hole = rings[0].map((p) => new THREE.Vector2(p[0], p[2]));
    const tris = THREE.ShapeUtils.triangulateShape(contour, [hole]);
    const all = [...contour, ...hole];
    const dpos = [], dnorm = [], didx = [];
    for (const v of all) { dpos.push(...bf.at(v.x, H, v.y)); dnorm.push(0, 1, 0); }
    for (const t of tris) didx.push(t[0], t[2], t[1]);
    const deck = new THREE.BufferGeometry();
    deck.setAttribute("position", new THREE.Float32BufferAttribute(dpos, 3));
    deck.setAttribute("normal", new THREE.Float32BufferAttribute(dnorm, 3));
    deck.setIndex(didx);

    // apron: a toe recess, the flat face, and a rounded lip up to the deck
    const lipR = 0.9, toe = 0.6, toeIn = 0.35;
    const prof = [[dep - toeIn, 0], [dep - toeIn, toe], [dep, toe + 0.05]];
    for (let i = 0; i <= 5; i++) { const a = (i / 5) * (Math.PI / 2); prof.push([dep - lipR + lipR * Math.cos(a), H - lipR + lipR * Math.sin(a)]); }
    const apos = [], aidx = [];
    for (const [z, y] of prof) { apos.push(...bf.at(0, y, z)); apos.push(...bf.at(len, y, z)); }
    for (let i = 0; i < prof.length - 1; i++) { const a = i * 2, b = a + 1, c = a + 3, d = a + 2; aidx.push(a, b, c, a, c, d); }
    const apron = new THREE.BufferGeometry();
    apron.setAttribute("position", new THREE.Float32BufferAttribute(apos, 3));
    apron.setIndex(aidx);
    apron.computeVertexNormals();
    const [ox, , oz] = bf.at(len / 2, H / 2, dep - 6);
    orientInward(apron, [ox, H / 2, oz], true);

    const ao = [new THREE.Vector4(0, 0, 1, 0)];
    if (layout.leftWall) ao.push(new THREE.Vector4(1, 0, 0, 0));
    if (layout.rightWall) ao.push(new THREE.Vector4(1, 0, 0, layout.facingWidth));
    const inner = makeSurfaceMaterial({ id: SURF.PAN, albedo, illumConst: light.floor, gloss: 0.55, shadeAmt: 0.42, aoPlanes: ao });
    const deckM = makeSurfaceMaterial({ id: SURF.PAN, albedo, illumConst: light.floor, gloss: 0.55, shadeAmt: 0.2, aoPlanes: ao });
    const apronM = makeSurfaceMaterial({ id: SURF.PAN, albedo, illumConst: light.apron, gloss: 0.6, shadeAmt: 0.3, aoPlanes: ao });
    this.scene.add(new THREE.Mesh(basin, inner), new THREE.Mesh(deck, deckM), new THREE.Mesh(apron, apronM));
    this.panMaterials = [inner, deckM, apronM];

    // drain at the drain end of the floor, overflow plate on the end wall above it
    const dX = drainLeft ? flr.x0 + 4.2 : flr.x1 - 4.2, dZ = flr.z0 + (flr.z1 - flr.z0) * fz;
    const dw = bf.at(dX, floorY, dZ);
    this.addDrain(dw[0], dw[1], dw[2], light);
    const ovY = floorY + drop * 0.62;
    const tY = (H - 1.2 - ovY) / (H - 1.2 - (floorY + 1.6));
    const endQ = lerpQ(wallTop, wallBot, Math.max(0, Math.min(1, tY)));
    const ovX = drainLeft ? endQ.x0 + 0.25 : endQ.x1 - 0.25;
    const ov = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.65, 0.45, 40), new THREE.MeshStandardMaterial({ color: 0xdadada, metalness: 1, roughness: 0.18, envMap: this.envMap }));
    const g = new THREE.Group();
    ov.rotation.z = Math.PI / 2; // disc facing along X (into the basin from the drain end)
    ov.position.set(ovX + (drainLeft ? 0.2 : -0.2), ovY, dZ);
    ov.userData.surfaceId = SURF.FIXTURE;
    g.add(ov);
    g.applyMatrix4(bf.m);
    this.scene.add(g);
  }

  buildFixture(fx, light, layout) {
    if (!fx) return;
    const chrome = new THREE.MeshStandardMaterial({
      color: fx.finishColor || 0xe9e9ea, metalness: 1, roughness: fx.roughness ?? 0.12, envMap: this.envMap, envMapIntensity: 1,
    });
    this.chrome = chrome;
    const g = new THREE.Group();
    // built in the plumbing wall's frame: x along the wall, y up, z out of the wall
    const frame = this.wallFrame(fx.wall || "facing", layout);
    const sx = frame.flip ? -1 : 1;
    const vx = sx * fx.valve[0], vy = fx.valve[1];
    // Round escutcheon plate, slightly domed.
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(fx.plateR, fx.plateR + 0.15, 0.45, 64), chrome);
    plate.rotation.x = Math.PI / 2;
    plate.position.set(vx, vy, 0.25);
    g.add(plate);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.25, 1.1, 40), chrome);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(vx, vy, 0.9);
    g.add(hub);
    // Lever handle pointing down-and-out at rest.
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.75, fx.leverLen, 0.45), chrome);
    lever.position.set(vx, vy - fx.leverLen / 2 + 0.4, 1.45);
    lever.rotation.x = -0.25;
    g.add(lever);
    // Shower arm from the wall, angled down, with the head at its end.
    const hx = sx * fx.head[0], hy = fx.head[1];
    const armLen = fx.armLen;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, armLen, 20), chrome);
    const angle = 0.45;
    const armDir = new THREE.Vector3(0, -Math.sin(angle), Math.cos(angle));
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), armDir);
    arm.position.set(hx, hy, 0).addScaledVector(armDir, armLen / 2);
    g.add(arm);
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.3, 32), chrome);
    flange.rotation.x = Math.PI / 2;
    flange.position.set(hx, hy, 0.15);
    g.add(flange);
    const headR = fx.headDiameter / 2;
    const endY = hy - Math.sin(angle) * armLen, endZ = Math.cos(angle) * armLen;
    const tilt = 0.9;
    const dir = new THREE.Vector3(0, -Math.cos(tilt), Math.sin(tilt));
    const body = new THREE.Mesh(new THREE.CylinderGeometry(headR, headR * 0.6, 1.5, 48), chrome);
    body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    body.position.set(hx, endY, endZ).addScaledVector(dir, 0.75);
    g.add(body);
    const face = new THREE.Mesh(new THREE.CircleGeometry(headR * 0.85, 48), new THREE.MeshStandardMaterial({ color: 0x2c2c2c, metalness: 0.4, roughness: 0.5 }));
    face.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    face.position.set(hx, endY, endZ).addScaledVector(dir, 1.52);
    g.add(face);
    if (fx.spout) {
      // Tub spout centred under the valve, a few inches above the tub rim.
      const sy = (fx.baseTop ?? 15) + (fx.spout.aboveRim ?? 4.5);
      const reach = fx.spout.reach;
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, reach, 32), chrome);
      sp.rotation.x = Math.PI / 2;
      sp.position.set(vx, sy, reach / 2);
      g.add(sp);
      const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.4, 32), chrome);
      nose.position.set(vx, sy - 0.5, reach - 0.4);
      g.add(nose);
      const fl = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.3, 32), chrome);
      fl.rotation.x = Math.PI / 2;
      fl.position.set(vx, sy, 0.15);
      g.add(fl);
    }
    if (fx.handheld) {
      // slide bar beside the valve with a hand shower in its holder and a hose
      const side = fx.handheld.side ?? 1, barLen = fx.handheld.barLength ?? 24;
      const bx = vx + sx * side * (fx.plateR + 5), b0 = vy + 6, b1 = b0 + barLen;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, barLen, 20), chrome);
      bar.position.set(bx, (b0 + b1) / 2, 1.6);
      g.add(bar);
      for (const y of [b0, b1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 1.6, 20), chrome);
        post.rotation.x = Math.PI / 2;
        post.position.set(bx, y, 0.8);
        g.add(post);
      }
      const hy2 = b0 + barLen * 0.72;
      const holder = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.4), chrome);
      holder.position.set(bx, hy2, 2.4);
      g.add(holder);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 7, 24), chrome);
      handle.position.set(bx, hy2 - 1.5, 3.4);
      handle.rotation.x = -0.35;
      g.add(handle);
      const hh = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.3, 1.2, 36), chrome);
      hh.position.set(bx, hy2 + 2.6, 4.6);
      hh.rotation.x = 1.0;
      g.add(hh);
      const hose = new THREE.CatmullRomCurve3([
        new THREE.Vector3(bx, hy2 - 5, 3.1), new THREE.Vector3(bx + sx * side * 1.5, vy - 10, 3.6),
        new THREE.Vector3(vx + sx * side * 2, vy - 16, 3.2), new THREE.Vector3(vx, vy - 7, 1.4),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(hose, 40, 0.3, 10, false), chrome));
    }
    g.traverse((o) => { if (o.isMesh) o.userData.surfaceId = SURF.FIXTURE; });
    this.placeOnWall(g, frame);
    this.fixtureGroup = g;
    this.scene.add(g);
  }

  applyLightUniforms(light) {
    const camPos = new THREE.Vector3(...this.cam.position);
    const key = new THREE.Vector3(...(light.keyDir || [0.25, 1, 0.7])).normalize();
    const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    this.scene.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m.isShaderMaterial) {
        m.uniforms.viewport.value.set(this.width, this.height);
        m.uniforms.exposure.value = light.exposure ?? 1;
        m.uniforms.camPos.value.copy(camPos);
        m.uniforms.keyDir.value.copy(key);
      } else if (m.isMeshStandardMaterial) {
        // Match metal reflections to the room's brightness.
        m.envMapIntensity = Math.min(1.6, 1.25 * lum(light.apron) / 0.45) * (light.exposure ?? 1);
      }
    });
  }

  setFinish(finish) {
    const ft = this.finishTexture(finish);
    for (const m of this.wallMaterials) {
      m.uniforms.albedoMap.value = ft.tex;
      m.uniforms.repeatInches.value.set(ft.repeatW, ft.repeatH);
      m.uniforms.gloss.value = finish.gloss ?? 0.55;
    }
    // Edge caps are moulded in the panel colour.
    for (const m of this.trimMaterials || []) {
      m.uniforms.albedo.value.set(finish.trimColor || finish.color).convertSRGBToLinear();
      m.uniforms.gloss.value = finish.gloss ?? 0.55;
    }
  }

  setExposure(e) {
    this.scene.traverse((o) => { if (o.isMesh && o.material.isShaderMaterial) o.material.uniforms.exposure.value = e; });
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement;
  }

  // Id pass: red channel = surface id, alpha = covered.
  renderIds() {
    const swapped = [];
    const hidden = [];
    const idMat = new Map();
    this.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.glass && o.visible) { o.visible = false; hidden.push(o); return; }
      swapped.push([o, o.material]);
      if (o.material.isShaderMaterial) {
        o.material.uniforms.idPass.value = true;
      } else {
        const id = o.userData.surfaceId ?? SURF.FIXTURE;
        // raw shader: writes the id exactly (a MeshBasicMaterial colour would be sRGB-encoded on output)
        if (!idMat.has(id)) idMat.set(id, new THREE.ShaderMaterial({
          vertexShader: "void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
          fragmentShader: `void main(){ gl_FragColor = vec4(${(id / 255).toFixed(6)}, 0.0, 0.0, 1.0); }`,
          side: THREE.DoubleSide,
        }));
        o.material = idMat.get(id);
      }
    });
    this.renderer.render(this.scene, this.camera);
    const gl = this.renderer.getContext();
    const px = new Uint8Array(this.width * this.height * 4);
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    for (const [o, m] of swapped) {
      if (m.isShaderMaterial) m.uniforms.idPass.value = false;
      o.material = m;
    }
    for (const o of hidden) o.visible = true;
    // Flip to top-down rows.
    const out = new Uint8Array(this.width * this.height);
    for (let y = 0; y < this.height; y++) {
      const src = (this.height - 1 - y) * this.width;
      for (let x = 0; x < this.width; x++) out[y * this.width + x] = px[(src + x) * 4 + 3] ? px[(src + x) * 4] : 0;
    }
    return out;
  }
}

export function illumTexture(map) {
  // Float RGB -> RGBA8 sRGB-free linear storage scaled to [0,1] (values above 1 clipped).
  const { data, width, height } = map;
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    for (let c = 0; c < 3; c++) rgba[i * 4 + c] = Math.max(0, Math.min(255, Math.round(Math.sqrt(data[i * 3 + c]) * 255)));
    rgba[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(rgba, width, height, THREE.RGBAFormat);
  tex.flipY = false;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Make a mesh's triangles face a reference point (inward = toward it, e.g. a
 * basin's walls toward its middle), so lighting uses the visible side.
 */
function orientInward(geo, P, outward = false) {
  const pos = geo.attributes.position, idx = geo.index.array;
  let s = 0;
  const v = (i) => [pos.getX(i), pos.getY(i), pos.getZ(i)];
  for (let t = 0; t < idx.length; t += 3) {
    const a = v(idx[t]), b = v(idx[t + 1]), c = v(idx[t + 2]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    s += Math.sign(n[0] * (P[0] - m[0]) + n[1] * (P[1] - m[1]) + n[2] * (P[2] - m[2]));
  }
  if ((s < 0) !== outward) {
    const arr = Array.from(idx);
    for (let t = 0; t < arr.length; t += 3) { const k = arr[t + 1]; arr[t + 1] = arr[t + 2]; arr[t + 2] = k; }
    geo.setIndex(arr);
    geo.computeVertexNormals();
  }
}
