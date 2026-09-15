import * as THREE from "three";

/**
 * Rest-pose compensated skeletal retargeting.
 *
 * WHY THE NAIVE APPROACH FAILS
 *
 * three's SkeletonUtils.retargetClip copies a source bone's world rotation
 * onto the target bone. That is only valid when both skeletons share a rest
 * pose AND a local bone-axis convention. Ours do not, and measurement says so:
 *
 *   - Every Fixter bone runs along its own local +Y (a child's local offset is
 *     [0, len, 0] for the spine, arms and legs alike), so each bone carries a
 *     large rest rotation that turns local +Y into its world direction. The
 *     left arm's rest rotation is roughly 90 degrees.
 *   - Every BVH joint has an IDENTITY rest rotation; direction lives entirely
 *     in the OFFSET vector. Measured max rest rotation across all 78 joints:
 *     0.0000 degrees.
 *
 * Copy a ~0 degree world rotation onto a bone whose rest is ~90 degrees and you
 * destroy the rest orientation. That is the collapse.
 *
 * THE FORMULA
 *
 * Transfer the source's *change from its own rest*, and apply that change to
 * the target's own rest. In world space, per bone:
 *
 *     D(s)      = Wanim(s) · Wrest(s)⁻¹           // source delta from rest
 *     Wanim(t)  = D(s) · Wrest(t)                 // same delta, target's rest
 *     Qlocal(t) = Wanim(parent(t))⁻¹ · Wanim(t)   // back to parent space
 *
 * At rest this is the identity map: Wanim(s) = Wrest(s) gives D = I, so the
 * target stays exactly at its own bind pose. That property is what makes the
 * result independent of either skeleton's axis convention, and it is asserted
 * in the diagnostics rather than taken on trust.
 *
 * Both rest poses are measured from the live skeletons, never assumed — the
 * identity-rest fact above is a property of this BVH, not something relied on.
 *
 * Note on inverse bind matrices: for this GLB the bind pose recovered from the
 * node hierarchy and from the skin's inverseBindMatrices agree to 2.5e-6, so
 * the hierarchy rest used here is the same thing by a cheaper route.
 */

export type BoneMap = Record<string, string>;

export type RootTranslationMode = "none" | "hips";

export type RetargetOptions = {
  /** target bone name -> source bone name */
  names: BoneMap;
  /** Target bone that carries root translation. */
  hips?: string;
  rootTranslation?: RootTranslationMode;
  /**
   * Source-to-target length scale. Derived from the hip-height ratio when
   * omitted, which is what keeps feet on the floor: if the source drops its
   * hips by 10% of its own hip height, so does the target.
   */
  scale?: number;
  /**
   * Target bones whose lowest point defines the character's footing. Used for
   * the ground correction. Auto-detected from foot/toe names when omitted.
   */
  groundBones?: string[];
  /** World Y the lowest ground bone should sit at. */
  groundY?: number;
  clipName?: string;
};

export type BoneRestComparison = {
  target: string;
  source: string;
  /** Angle between the two rest bone directions, degrees. */
  restAngleDeg: number;
  targetLength: number;
  sourceLength: number;
};

export type RetargetReport = {
  clipName: string;
  sourceBones: number;
  targetBones: number;
  mappedBones: number;
  trackCount: number;
  duration: number;
  frames: number;
  fps: number;
  scale: number;
  rootTranslation: RootTranslationMode;
  unmappedTargetBones: string[];
  ignoredSourceBones: string[];
  missingInSource: string[];
  missingInTarget: string[];
  /** Max |Qlocal - rest| over all bones when the source is at its rest pose. */
  restIdentityErrorDeg: number;
  restComparison: BoneRestComparison[];
  /** Constant Y shift applied to the hips so the lowest foot rests on the floor. */
  groundCorrection: number;
  /** Lowest and highest foot world Y across the clip, after correction. */
  footYMin: number;
  footYMax: number;
};

type RestSnapshot = {
  worldQuat: Map<string, THREE.Quaternion>;
  worldPos: Map<string, THREE.Vector3>;
  localQuat: Map<string, THREE.Quaternion>;
  localPos: Map<string, THREE.Vector3>;
};

function collectBones(root: THREE.Object3D): THREE.Bone[] {
  const bones: THREE.Bone[] = [];
  root.traverse((child) => {
    if ((child as THREE.Bone).isBone) bones.push(child as THREE.Bone);
  });
  return bones;
}

/** Depth-first order guarantees a parent is solved before its children. */
function topologicalOrder(bones: THREE.Bone[]): THREE.Bone[] {
  const set = new Set<THREE.Object3D>(bones);
  const depth = (b: THREE.Object3D) => {
    let d = 0;
    let p = b.parent;
    while (p) {
      if (set.has(p)) d++;
      p = p.parent;
    }
    return d;
  };
  return [...bones].sort((a, b) => depth(a) - depth(b));
}

function snapshotRest(root: THREE.Object3D, bones: THREE.Bone[]): RestSnapshot {
  root.updateMatrixWorld(true);
  const snap: RestSnapshot = {
    worldQuat: new Map(),
    worldPos: new Map(),
    localQuat: new Map(),
    localPos: new Map(),
  };
  for (const bone of bones) {
    snap.worldQuat.set(bone.name, bone.getWorldQuaternion(new THREE.Quaternion()));
    snap.worldPos.set(bone.name, bone.getWorldPosition(new THREE.Vector3()));
    snap.localQuat.set(bone.name, bone.quaternion.clone());
    snap.localPos.set(bone.name, bone.position.clone());
  }
  return snap;
}

/**
 * Retarget one clip from a source skeleton onto a target skeleton.
 *
 * `targetRoot` should be a throwaway clone: this samples the clip by posing
 * both skeletons frame by frame, and the caller's on-screen character must not
 * be dragged through that.
 */
export function retargetClipRestCompensated(
  targetRoot: THREE.Object3D,
  sourceRoot: THREE.Object3D,
  sourceClip: THREE.AnimationClip,
  options: RetargetOptions
): { clip: THREE.AnimationClip | null; report: RetargetReport } {
  const names = options.names;
  const hipsName = options.hips ?? "Hips";
  const rootTranslation = options.rootTranslation ?? "hips";
  const clipName = options.clipName ?? sourceClip.name;

  const targetBones = collectBones(targetRoot);
  const sourceBones = collectBones(sourceRoot);
  const targetByName = new Map(targetBones.map((b) => [b.name, b]));
  const sourceByName = new Map(sourceBones.map((b) => [b.name, b]));

  const missingInTarget = Object.keys(names).filter((n) => !targetByName.has(n));
  const missingInSource = Object.values(names).filter((n) => !sourceByName.has(n));
  const mappedSourceNames = new Set(Object.values(names));

  const report: RetargetReport = {
    clipName,
    sourceBones: sourceBones.length,
    targetBones: targetBones.length,
    mappedBones: 0,
    trackCount: 0,
    duration: 0,
    frames: 0,
    fps: 0,
    scale: 0,
    rootTranslation,
    unmappedTargetBones: targetBones.map((b) => b.name).filter((n) => !(n in names)),
    ignoredSourceBones: sourceBones.map((b) => b.name).filter((n) => !mappedSourceNames.has(n)),
    missingInSource,
    missingInTarget,
    restIdentityErrorDeg: 0,
    restComparison: [],
    groundCorrection: 0,
    footYMin: 0,
    footYMax: 0,
  };

  // ---- rest snapshots, taken before anything is posed ----
  const targetRest = snapshotRest(targetRoot, targetBones);
  const sourceRest = snapshotRest(sourceRoot, sourceBones);

  const pairs = Object.entries(names).filter(
    ([t, s]) => targetByName.has(t) && sourceByName.has(s)
  );
  report.mappedBones = pairs.length;
  if (!pairs.length) return { clip: null, report };

  // ---- scale, from hip height ----
  const targetHipsRest = targetRest.worldPos.get(hipsName);
  const sourceHipsName = names[hipsName];
  const sourceHipsRest = sourceHipsName ? sourceRest.worldPos.get(sourceHipsName) : undefined;
  const scale =
    options.scale ??
    (targetHipsRest && sourceHipsRest && Math.abs(sourceHipsRest.y) > 1e-6
      ? targetHipsRest.y / sourceHipsRest.y
      : 1);
  report.scale = scale;

  // ---- rest geometry comparison, for the diagnostics panel ----
  for (const [t, s] of pairs) {
    const tBone = targetByName.get(t)!;
    const sBone = sourceByName.get(s)!;
    const tChild = tBone.children.find((c) => (c as THREE.Bone).isBone);
    const sChild = sBone.children.find((c) => (c as THREE.Bone).isBone);
    if (!tChild || !sChild) continue;
    const tDir = targetRest.worldPos
      .get(tChild.name)!
      .clone()
      .sub(targetRest.worldPos.get(t)!);
    const sDir = sourceRest.worldPos
      .get(sChild.name)!
      .clone()
      .sub(sourceRest.worldPos.get(s)!);
    const tLen = tDir.length();
    const sLen = sDir.length();
    if (tLen < 1e-9 || sLen < 1e-9) continue;
    report.restComparison.push({
      target: t,
      source: s,
      restAngleDeg: THREE.MathUtils.radToDeg(
        Math.acos(THREE.MathUtils.clamp(tDir.normalize().dot(sDir.normalize()), -1, 1))
      ),
      targetLength: tLen,
      sourceLength: sLen,
    });
  }

  // ---- sample the source ----
  const trackLengths = sourceClip.tracks.map((t) => t.times.length);
  const fps = trackLengths.length
    ? Math.max(...trackLengths) / Math.max(sourceClip.duration, 1e-6)
    : 30;
  const frames = Math.max(2, Math.round(sourceClip.duration * fps) + 1);
  const delta = sourceClip.duration / (frames - 1);
  report.fps = fps;
  report.frames = frames;

  const mixer = new THREE.AnimationMixer(sourceRoot);
  mixer.clipAction(sourceClip).play();

  const order = topologicalOrder(targetBones);
  const times = new Float32Array(frames);
  const quatValues = new Map<string, Float32Array>();
  for (const bone of targetBones) quatValues.set(bone.name, new Float32Array(frames * 4));
  const hipsPosValues = new Float32Array(frames * 3);

  const worldNow = new Map<string, THREE.Quaternion>();
  const dParent = new THREE.Quaternion();
  const dWorld = new THREE.Quaternion();
  const dLocal = new THREE.Quaternion();
  const srcWorldQ = new THREE.Quaternion();
  const srcWorldP = new THREE.Vector3();
  const hipsOffset = new THREE.Vector3();
  const sourceHipsRef = new THREE.Vector3();

  let restIdentityErrorDeg = 0;

  const IDENTITY = new THREE.Quaternion();

  /**
   * Solve one whole target pose from whatever pose the source is in right now.
   *
   * Shared by the self-check below and the sampling loop, so the thing being
   * verified is literally the thing that runs.
   */
  const solvePose = (
    onBone: (bone: THREE.Bone, local: THREE.Quaternion) => void
  ) => {
    for (const bone of order) {
      const sourceName = names[bone.name];
      const sourceBone = sourceName ? sourceByName.get(sourceName) : undefined;

      if (sourceBone) {
        sourceBone.getWorldQuaternion(srcWorldQ);
        // D = Wanim(s) · Wrest(s)⁻¹
        dWorld
          .copy(srcWorldQ)
          .multiply(sourceRest.worldQuat.get(sourceName!)!.clone().invert());
        // Wanim(t) = D · Wrest(t)
        dWorld.multiply(targetRest.worldQuat.get(bone.name)!);
      } else {
        // Unmapped: hold the rest pose relative to whatever the parent does.
        const parentWorld = bone.parent && worldNow.get(bone.parent.name);
        dWorld
          .copy(parentWorld ?? IDENTITY)
          .multiply(targetRest.localQuat.get(bone.name)!);
      }

      const parentWorld = bone.parent ? worldNow.get(bone.parent.name) : undefined;
      dParent.copy(parentWorld ?? IDENTITY).invert();
      dLocal.copy(dParent).multiply(dWorld);

      worldNow.set(bone.name, dWorld.clone());
      onBone(bone, dLocal);
    }
  };

  /*
   * Self-check: with the source standing at its own rest pose, this must
   * reproduce the target's bind pose exactly.
   *
   * It is the one assertion that catches a wrong rest/axis compensation
   * regardless of what the animation happens to look like, and it runs through
   * the real solver, so it also covers parent ordering and the unmapped-bone
   * path. Anything above a fraction of a degree is a genuine failure; float32
   * quaternions in the GLB leave a few hundredths.
   */
  sourceRoot.updateMatrixWorld(true);
  solvePose((bone, local) => {
    restIdentityErrorDeg = Math.max(
      restIdentityErrorDeg,
      THREE.MathUtils.radToDeg(local.angleTo(targetRest.localQuat.get(bone.name)!))
    );
  });

  for (let frame = 0; frame < frames; frame++) {
    const time = frame * delta;
    mixer.setTime(time);
    sourceRoot.updateMatrixWorld(true);
    times[frame] = time;

    solvePose((bone, local) => {
      local.toArray(quatValues.get(bone.name)!, frame * 4);
    });

    /*
     * Root translation, measured against the source's OWN first frame rather
     * than against its skeleton rest.
     *
     * This BVH stores an absolute hip position in the channel (99.95) while
     * also carrying a non-zero OFFSET (100.0) on the same joint, and BVHLoader
     * adds the two — so the animated hips sit at ~200 against a rest of ~100
     * and a rest-relative delta doubles the character's height. Differencing
     * against frame 0 cancels any such constant bias, whatever convention a
     * given exporter chose, because the bias is present in both terms.
     */
    if (rootTranslation === "hips" && sourceHipsName && targetHipsRest) {
      const srcHips = sourceByName.get(sourceHipsName)!;
      srcHips.getWorldPosition(srcWorldP);
      if (frame === 0) sourceHipsRef.copy(srcWorldP);
      hipsOffset.copy(srcWorldP).sub(sourceHipsRef).multiplyScalar(scale);
      const hipsBone = targetByName.get(hipsName)!;
      const parentRestQuat = hipsBone.parent
        ? (targetRest.worldQuat.get(hipsBone.parent.name) ?? new THREE.Quaternion())
        : new THREE.Quaternion();
      // Express the world-space hip delta in the hips' parent space.
      hipsOffset.applyQuaternion(parentRestQuat.clone().invert());
      hipsOffset.add(targetRest.localPos.get(hipsName)!);
      hipsOffset.toArray(hipsPosValues, frame * 3);
    } else {
      targetRest.localPos.get(hipsName)?.toArray(hipsPosValues, frame * 3);
    }
  }

  mixer.uncacheAction(sourceClip);

  /*
   * Put the source skeleton back the way we found it.
   *
   * The loader caches by URL, so the very same skeleton object is handed to the
   * next retarget — a second clip, or a remount. Left posed on its final frame,
   * that next call would snapshot a pose and treat it as the rest, and every
   * bone would then be compensated against the wrong reference. Restoring here
   * is what makes this function safe to call more than once.
   */
  for (const bone of sourceBones) {
    bone.quaternion.copy(sourceRest.localQuat.get(bone.name)!);
    bone.position.copy(sourceRest.localPos.get(bone.name)!);
  }
  sourceRoot.updateMatrixWorld(true);

  report.restIdentityErrorDeg = restIdentityErrorDeg;

  /*
   * Ground correction.
   *
   * Pose the target through every frame, find the lowest point any foot bone
   * reaches, and shift the hips by ONE constant so that minimum matches where
   * the feet sit in the bind pose. Matching the bind pose rather than y=0 is
   * the point: a foot bone is the ankle or toe joint, not the sole, so forcing
   * it to zero would bury the character to his ankles.
   *
   * The correction is constant on purpose. Clamping per frame would flatten
   * real vertical motion — a crouch would stop being a crouch — and make the
   * character bob against his own animation.
   */
  const groundBones = (
    options.groundBones ??
    targetBones.map((b) => b.name).filter((n) => /toe|foot/i.test(n))
  )
    .map((n) => targetByName.get(n))
    .filter((b): b is THREE.Bone => Boolean(b));

  let footYMin = Infinity;
  let footYMax = -Infinity;

  if (groundBones.length) {
    const scratch = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const hipsBone = targetByName.get(hipsName);
    for (let frame = 0; frame < frames; frame++) {
      for (const bone of targetBones) {
        q.fromArray(quatValues.get(bone.name)!, frame * 4);
        bone.quaternion.copy(q);
      }
      if (hipsBone && rootTranslation === "hips") {
        hipsBone.position.fromArray(hipsPosValues, frame * 3);
      }
      targetRoot.updateMatrixWorld(true);
      for (const bone of groundBones) {
        bone.getWorldPosition(scratch);
        footYMin = Math.min(footYMin, scratch.y);
        footYMax = Math.max(footYMax, scratch.y);
      }
    }
  }

  const bindFootYMin = groundBones.length
    ? Math.min(...groundBones.map((b) => targetRest.worldPos.get(b.name)!.y))
    : 0;
  const groundTarget = options.groundY ?? bindFootYMin;
  const groundCorrection =
    rootTranslation === "hips" && Number.isFinite(footYMin) ? groundTarget - footYMin : 0;

  if (groundCorrection !== 0) {
    for (let frame = 0; frame < frames; frame++) {
      hipsPosValues[frame * 3 + 1] += groundCorrection;
    }
    footYMin += groundCorrection;
    footYMax += groundCorrection;
  }

  report.groundCorrection = groundCorrection;
  report.footYMin = Number.isFinite(footYMin) ? footYMin : 0;
  report.footYMax = Number.isFinite(footYMax) ? footYMax : 0;

  // ---- build tracks ----
  const tracks: THREE.KeyframeTrack[] = [];
  for (const bone of targetBones) {
    // Leaf helpers that never move add nothing but binding cost.
    if (!(bone.name in names)) continue;
    tracks.push(
      new THREE.QuaternionKeyframeTrack(
        `${bone.name}.quaternion`,
        times as unknown as number[],
        quatValues.get(bone.name)! as unknown as number[]
      )
    );
  }
  if (rootTranslation === "hips" && targetByName.has(hipsName)) {
    tracks.push(
      new THREE.VectorKeyframeTrack(
        `${hipsName}.position`,
        times as unknown as number[],
        hipsPosValues as unknown as number[]
      )
    );
  }

  const clip = new THREE.AnimationClip(clipName, -1, tracks);
  clip.resetDuration();
  report.trackCount = tracks.length;
  report.duration = clip.duration;

  return { clip, report };
}
