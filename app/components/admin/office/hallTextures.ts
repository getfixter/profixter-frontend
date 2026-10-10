/**
 * Canvas-drawn textures for the knight hall: flagstones, ashlar walls, the
 * arched windows' sky, banners, the parchment map and the crest rug.
 * No image files, nothing to download. Callers own (and dispose) them.
 */
import * as THREE from "three";
import { skyTexture } from "./textures";

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function finish(c: HTMLCanvasElement, repeat?: [number, number]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/** A small deterministic random, so every render draws the same stones. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Warm limestone flagstones. */
export function flagstoneTexture() {
  const c = canvas(512, 512);
  const g = c.getContext("2d")!;
  const r = rng(7);
  g.fillStyle = "#B9A68C";
  g.fillRect(0, 0, 512, 512);
  const rows = 6;
  const h = 512 / rows;
  for (let y = 0; y < rows; y++) {
    let x = y % 2 ? -40 : 0;
    while (x < 512) {
      const w = 110 + r() * 80;
      const tone = 196 + Math.floor(r() * 26);
      g.fillStyle = `rgb(${tone + 14},${tone + 2},${tone - 22})`;
      g.fillRect(x + 3, y * h + 3, w - 6, h - 6);
      // gentle speckle
      for (let i = 0; i < 18; i++) {
        g.fillStyle = `rgba(90,70,50,${0.04 + r() * 0.05})`;
        g.fillRect(x + 6 + r() * (w - 12), y * h + 6 + r() * (h - 12), 2 + r() * 4, 2 + r() * 3);
      }
      x += w;
    }
  }
  return finish(c, [2.5, 2.5]);
}

/** Ashlar stone blocks for the walls. */
export function ashlarTexture(base = "#E9DDC8") {
  const c = canvas(512, 512);
  const g = c.getContext("2d")!;
  const r = rng(13);
  g.fillStyle = "#CDBDA3";
  g.fillRect(0, 0, 512, 512);
  const rows = 8;
  const h = 512 / rows;
  for (let y = 0; y < rows; y++) {
    let x = y % 2 ? -64 : 0;
    while (x < 512) {
      const w = 128;
      const v = Math.floor(r() * 14) - 7;
      g.fillStyle = base;
      g.globalAlpha = 1;
      g.fillRect(x + 2, y * h + 2, w - 4, h - 4);
      g.fillStyle = v > 0 ? `rgba(255,255,255,${v / 90})` : `rgba(120,95,60,${-v / 90})`;
      g.fillRect(x + 2, y * h + 2, w - 4, h - 4);
      x += w;
    }
  }
  return finish(c, [3, 1.6]);
}

/** The New York sky for the hour, cut to a pointed (gothic) arch. */
export function archSkyTexture(hour: number) {
  const sky = skyTexture(hour);
  const src = sky.image as HTMLCanvasElement;
  const c = canvas(256, 384);
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0, 256, 384);
  // keep only the arch
  g.globalCompositeOperation = "destination-in";
  g.beginPath();
  g.moveTo(0, 384);
  g.lineTo(0, 150);
  g.quadraticCurveTo(0, 30, 128, 0);
  g.quadraticCurveTo(256, 30, 256, 150);
  g.lineTo(256, 384);
  g.closePath();
  g.fill();
  sky.dispose();
  return finish(c);
}

/** A royal banner with the Profixter emblem. */
export function bannerTexture(field = "#2F5BEA", trim = "#E8C15A") {
  const c = canvas(256, 512);
  const g = c.getContext("2d")!;
  g.fillStyle = field;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(256, 0);
  g.lineTo(256, 440);
  g.lineTo(128, 512);
  g.lineTo(0, 440);
  g.closePath();
  g.fill();
  g.strokeStyle = trim;
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(14, 8);
  g.lineTo(14, 432);
  g.lineTo(128, 496);
  g.lineTo(242, 432);
  g.lineTo(242, 8);
  g.stroke();
  // the emblem: a shield with a little house and the P
  g.fillStyle = trim;
  g.beginPath();
  g.moveTo(68, 150);
  g.lineTo(188, 150);
  g.lineTo(188, 250);
  g.quadraticCurveTo(188, 320, 128, 350);
  g.quadraticCurveTo(68, 320, 68, 250);
  g.closePath();
  g.fill();
  g.fillStyle = field;
  g.beginPath();
  g.moveTo(128, 182);
  g.lineTo(166, 214);
  g.lineTo(158, 214);
  g.lineTo(158, 262);
  g.lineTo(98, 262);
  g.lineTo(98, 214);
  g.lineTo(90, 214);
  g.closePath();
  g.fill();
  g.fillStyle = trim;
  g.font = "700 40px Georgia, 'Times New Roman', serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("P", 128, 240);
  g.font = "700 22px Georgia, 'Times New Roman', serif";
  g.fillText("PROFIXTER", 128, 400);
  return finish(c);
}

/** Parchment with Long Island drawn on it, for Rover's map table. */
export function mapTexture() {
  const c = canvas(512, 320);
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(256, 160, 40, 256, 160, 300);
  grad.addColorStop(0, "#F6EBCF");
  grad.addColorStop(1, "#DCC596");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 320);
  // the sea
  g.fillStyle = "rgba(110,160,190,0.25)";
  g.fillRect(0, 0, 512, 320);
  // Long Island, roughly: a long fish shape pointing east
  g.fillStyle = "#B9D49A";
  g.strokeStyle = "#7E6A45";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(40, 170);
  g.bezierCurveTo(90, 120, 200, 115, 300, 128);
  g.bezierCurveTo(380, 136, 440, 110, 490, 82);
  g.bezierCurveTo(470, 120, 430, 150, 470, 160);
  g.bezierCurveTo(400, 190, 300, 205, 200, 210);
  g.bezierCurveTo(120, 214, 60, 205, 40, 170);
  g.closePath();
  g.fill();
  g.stroke();
  // the county line
  g.setLineDash([6, 6]);
  g.beginPath();
  g.moveTo(205, 120);
  g.lineTo(200, 210);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = "#7E6A45";
  g.font = "700 18px Georgia, serif";
  g.fillText("NASSAU", 100, 180);
  g.fillText("SUFFOLK", 300, 175);
  // a compass rose
  g.translate(450, 255);
  g.fillStyle = "#9C3B2E";
  g.beginPath();
  g.moveTo(0, -28);
  g.lineTo(7, 0);
  g.lineTo(0, 28);
  g.lineTo(-7, 0);
  g.closePath();
  g.fill();
  g.setTransform(1, 0, 0, 1, 0, 0);
  return finish(c);
}

/** A round rug with a gold ring and a quiet crest. */
export function rugTexture() {
  const c = canvas(512, 512);
  const g = c.getContext("2d")!;
  g.fillStyle = "#7A2430";
  g.beginPath();
  g.arc(256, 256, 250, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#E8C15A";
  g.lineWidth = 12;
  g.beginPath();
  g.arc(256, 256, 225, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 3;
  g.beginPath();
  g.arc(256, 256, 200, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.fillStyle = "#E8C15A";
    g.beginPath();
    g.arc(256 + Math.cos(a) * 212, 256 + Math.sin(a) * 212, 5, 0, Math.PI * 2);
    g.fill();
  }
  return finish(c);
}

/** A soft vertical gradient used for the sunbeams through the windows. */
export function beamTexture() {
  const c = canvas(64, 256);
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "rgba(255,236,190,0.55)");
  grad.addColorStop(1, "rgba(255,236,190,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  return finish(c);
}
