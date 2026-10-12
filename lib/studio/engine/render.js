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
    this.buildFixture(fixture ? { ...fixture, baseTop: H } : null, light);
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
        const a0 = L - (enc.curtain.gathered ?? 12), a1 = L - 1, ytop = y - 1.5, ybot = H + 3;
        const geo = new THREE.PlaneGeometry(a1 - a0, ytop - ybot, 64, 2);
        // fold shading baked across the width: light on the crests, shadow in the troughs
        const fc = document.createElement("canvas");
        fc.width = 256; fc.height = 4;
        const fg = fc.getContext("2d");
        const base = new THREE.Color(enc.curtain.color || "#f1f1ee");
        for (let x = 0; x < 256; x++) {
          const u = (x / 255 - 0.5) * (a1 - a0);
          const b = 0.74 + 0.26 * Math.cos((u + 20) * 1.9);
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
        const cloth = makeSurfaceMaterial({ id: SURF.DOOR, map: foldTex, repeatW: 1, repeatH: 1, illumConst: light.apron.map((v) => v * 1.15), gloss: 0.02, shadeAmt: 0.1 });
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

  buildPan(layout, pan, light) {
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
    // The threshold is the long open side: x = W when the right wall is missing.
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
    // Front apron (vertical) on the open side.
    if (thresholdAtRight) this.scene.add(rectMesh([[W, 0, 0], [W, 0, L], [W, H, L], [W, H, 0]], vertM));
    if (!layout.leftWall) this.scene.add(rectMesh([[0, 0, L], [0, 0, 0], [0, H, 0], [0, H, L]], vertM));
    if (open === "front") this.scene.add(rectMesh([[0, 0, L], [W, 0, L], [W, H, L], [0, H, L]], vertM));

    // Drain: a chrome grate disk just above the floor.
    const d = pan.drain;
    const dx = ix0 + (ix1 - ix0) * d.across, dz = iz0 + (iz1 - iz0) * d.along;
    const grate = new THREE.Mesh(
      new THREE.CircleGeometry(2.1, 40),
      new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1, roughness: 0.25, envMap: this.envMap, envMapIntensity: 0.8 }),
    );
    grate.rotation.x = -Math.PI / 2;
    grate.position.set(dx, fy + 0.05, dz);
    grate.userData.surfaceId = SURF.FIXTURE;
    this.scene.add(grate);
    const ringM = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.5, 40), makeSurfaceMaterial({ id: SURF.PAN, albedo: "#bdbdb8", illumConst: light.floor, gloss: 0.2 }));
    ringM.rotation.x = -Math.PI / 2;
    ringM.position.set(dx, fy + 0.04, dz);
    this.scene.add(ringM);
    if (pan.kind === "tub") {
      // overflow plate on the inner end wall above the drain
      const ov = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.4, 32), new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1, roughness: 0.2, envMap: this.envMap }));
      const zEnd = z0 + slope * 0.35;
      ov.rotation.x = Math.PI / 2;
      ov.position.set(dx, fy + drop * 0.55, zEnd + 0.3);
      ov.userData.surfaceId = SURF.FIXTURE;
      this.scene.add(ov);
    }
    this.panMaterials = mats;
  }

  buildFixture(fx, light) {
    if (!fx) return;
    const chrome = new THREE.MeshStandardMaterial({
      color: fx.finishColor || 0xe9e9ea, metalness: 1, roughness: fx.roughness ?? 0.12, envMap: this.envMap, envMapIntensity: 1,
    });
    this.chrome = chrome;
    const g = new THREE.Group();
    const [vx, vy] = fx.valve;
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
    const [hx, hy] = fx.head;
    const armLen = fx.armLen;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, armLen, 20), chrome);
    const angle = 0.45; // arm angled ~25 degrees below horizontal
    const armDir = new THREE.Vector3(0, -Math.sin(angle), Math.cos(angle));
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), armDir);
    arm.position.set(hx, hy, 0).addScaledVector(armDir, armLen / 2);
    g.add(arm);
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.3, 32), chrome);
    flange.rotation.x = Math.PI / 2;
    flange.position.set(hx, hy, 0.15);
    g.add(flange);
    // Head: a short round body tilted to spray down and out, ending in a dark nozzle face.
    const headR = fx.headDiameter / 2;
    const endY = hy - Math.sin(angle) * armLen, endZ = Math.cos(angle) * armLen;
    const tilt = 0.9; // radians from vertical
    const dir = new THREE.Vector3(0, -Math.cos(tilt), Math.sin(tilt));
    const body = new THREE.Mesh(new THREE.CylinderGeometry(headR, headR * 0.6, 1.5, 48), chrome);
    body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); // wide end toward the spray
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
    g.traverse((o) => { if (o.isMesh) o.userData.surfaceId = SURF.FIXTURE; });
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
