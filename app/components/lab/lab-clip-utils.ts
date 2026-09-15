import * as THREE from "three";

/**
 * Cutting generated motion into usable pieces.
 *
 * Text-to-Motion returns one long take — the outlet arc came back as 50 seconds
 * from a 10-second request — so the choreography is assembled from slices of
 * it rather than from one clip per beat. Slices of a single take also blend
 * far better than separately generated clips, because they already agree about
 * where the body is.
 */

type TrackCtor = new (
  name: string,
  times: ArrayLike<number>,
  values: ArrayLike<number>
) => THREE.KeyframeTrack;

/**
 * Extract [start, end] seconds as a new clip.
 *
 * Re-samples rather than filtering keyframes. AnimationUtils.subclip keeps only
 * the keys that fall inside the window, which can leave a track with one key or
 * none at all and silently drop that bone; sampling guarantees every track has
 * keys at both boundaries and that the cut lands exactly where asked.
 */
export function subclipByTime(
  clip: THREE.AnimationClip,
  name: string,
  start: number,
  end: number,
  fps = 30
): THREE.AnimationClip {
  const from = Math.max(0, Math.min(start, clip.duration));
  const to = Math.max(from + 1 / fps, Math.min(end, clip.duration));
  const frames = Math.max(2, Math.round((to - from) * fps) + 1);
  const dt = (to - from) / (frames - 1);

  const tracks = clip.tracks.map((track) => {
    /*
     * createInterpolant is assigned per-instance by KeyframeTrack's constructor
     * and is not on the published type, so it needs a cast. Using it is the
     * point: it is the same interpolation the mixer would apply (slerp for
     * quaternion tracks), which is what makes a re-sampled cut identical to
     * what playback would have produced at those times.
     */
    const interpolant = (
      track as unknown as {
        createInterpolant: () => { evaluate: (time: number) => ArrayLike<number> };
      }
    ).createInterpolant();
    const stride = track.getValueSize();
    const times = new Float32Array(frames);
    const values = new Float32Array(frames * stride);

    for (let i = 0; i < frames; i++) {
      const sampled = interpolant.evaluate(from + i * dt) as ArrayLike<number>;
      times[i] = i * dt;
      values.set(sampled, i * stride);
    }

    const Ctor = track.constructor as TrackCtor;
    return new Ctor(track.name, times, values);
  });

  const out = new THREE.AnimationClip(name, to - from, tracks);
  out.resetDuration();
  return out;
}

/**
 * Play a clip backwards.
 *
 * Used to build "stand up" from "crouch down" instead of generating a second
 * motion. A squat and its reverse really are near time-mirrors, and taking the
 * reverse of the entry guarantees the exit starts in exactly the pose the entry
 * ended in — continuity a separately generated clip could not promise.
 */
export function reverseClip(
  clip: THREE.AnimationClip,
  name: string
): THREE.AnimationClip {
  const tracks = clip.tracks.map((track) => {
    const stride = track.getValueSize();
    const count = track.times.length;
    const times = new Float32Array(count);
    const values = new Float32Array(count * stride);

    for (let i = 0; i < count; i++) {
      const mirrored = count - 1 - i;
      times[i] = clip.duration - track.times[mirrored];
      for (let k = 0; k < stride; k++) {
        values[i * stride + k] = track.values[mirrored * stride + k];
      }
    }

    const Ctor = track.constructor as TrackCtor;
    return new Ctor(track.name, times, values);
  });

  const out = new THREE.AnimationClip(name, clip.duration, tracks);
  out.resetDuration();
  return out;
}
