import type * as THREE from "three";

/**
 * Where the Fixter is, right now.
 *
 * The character writes it every frame and the camera reads it every frame.
 * Neither end wants React involved: a prop or state would re-render the scene
 * sixty times a second to move one camera, and a mutable passed through a hook
 * is exactly what React's immutability rules exist to catch. A module store is
 * the honest shape for a value that is genuinely shared and genuinely mutable.
 */
const pose = { x: 0, y: 0, z: 0, yaw: 0 };

export function setFixterPose(position: THREE.Vector3, yaw: number) {
  pose.x = position.x;
  pose.y = position.y;
  pose.z = position.z;
  pose.yaw = yaw;
}

export function getFixterPose() {
  return pose;
}
