/**
 * Small canvas-drawn textures: no image files, nothing to download.
 * Each returns a THREE.CanvasTexture the caller owns (dispose on unmount).
 */
import * as THREE from "three";

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function finish(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Warm oak planks. */
export function plankTexture(base: string, dark: string) {
  const c = canvas(512, 512);
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    const y = (r * 512) / rows;
    const offset = (r % 2) * 160 + (r % 3) * 40;
    for (let x = -offset; x < 512; x += 320) {
      g.fillStyle = `rgba(255,255,255,${0.03 + ((r * 7 + x) % 5) * 0.012})`;
      g.fillRect(x + 2, y + 2, 316, 512 / rows - 4);
      g.fillStyle = dark;
      g.globalAlpha = 0.55;
      g.fillRect(x, y, 3, 512 / rows);
      g.globalAlpha = 1;
    }
    g.fillStyle = dark;
    g.globalAlpha = 0.6;
    g.fillRect(0, y, 512, 3);
    g.globalAlpha = 1;
  }
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

/** A soft round shadow for things that hover or stand on the floor. */
export function blobShadowTexture() {
  const c = canvas(128, 128);
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, "rgba(40,30,20,0.55)");
  grad.addColorStop(0.6, "rgba(40,30,20,0.22)");
  grad.addColorStop(1, "rgba(40,30,20,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return finish(c);
}

/** The sky outside the window, for the real hour in New York. */
export function skyTexture(hour: number) {
  const c = canvas(256, 160);
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 160);
  const night = hour < 6 || hour >= 20;
  const dawn = hour >= 6 && hour < 8;
  const dusk = hour >= 17 && hour < 20;
  if (night) {
    grad.addColorStop(0, "#0E1838");
    grad.addColorStop(1, "#2A3B6E");
  } else if (dawn) {
    grad.addColorStop(0, "#8EB8F0");
    grad.addColorStop(1, "#FFD2B0");
  } else if (dusk) {
    grad.addColorStop(0, "#6C7FD8");
    grad.addColorStop(0.6, "#F7A78A");
    grad.addColorStop(1, "#FFD39A");
  } else {
    grad.addColorStop(0, "#7EC8FF");
    grad.addColorStop(1, "#CFEBFF");
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 160);
  if (night) {
    g.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 28; i++) {
      const x = (i * 97) % 256;
      const y = (i * 53) % 110;
      g.fillRect(x, y, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
    }
    g.fillStyle = "#FFF4CF";
    g.beginPath();
    g.arc(196, 40, 16, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = grad;
    g.beginPath();
    g.arc(204, 34, 14, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillStyle = dusk ? "#FFC36B" : "#FFE27A";
    g.beginPath();
    g.arc(dawn ? 60 : dusk ? 200 : 190, dawn || dusk ? 112 : 40, 18, 0, Math.PI * 2);
    g.fill();
  }
  // Distant Long Island treeline.
  g.fillStyle = night ? "#152447" : dusk ? "#7A5A7E" : "#6FB58A";
  g.beginPath();
  g.moveTo(0, 160);
  for (let x = 0; x <= 256; x += 16) g.lineTo(x, 132 - ((x * 37) % 13) - (x % 32 === 0 ? 8 : 0));
  g.lineTo(256, 160);
  g.fill();
  return finish(c);
}

/** Wispy clouds on a transparent strip; the scene scrolls its offset. */
export function cloudTexture(night: boolean) {
  const c = canvas(512, 160);
  const g = c.getContext("2d")!;
  g.fillStyle = night ? "rgba(200,210,255,0.18)" : "rgba(255,255,255,0.92)";
  const puff = (x: number, y: number, s: number) => {
    g.beginPath();
    g.arc(x, y, 14 * s, 0, Math.PI * 2);
    g.arc(x + 16 * s, y - 8 * s, 18 * s, 0, Math.PI * 2);
    g.arc(x + 36 * s, y, 14 * s, 0, Math.PI * 2);
    g.fill();
  };
  puff(40, 60, 1);
  puff(210, 40, 0.8);
  puff(330, 75, 1.1);
  puff(450, 50, 0.7);
  const t = finish(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export type DisplayData = {
  last7: number | null;
  prev7: number | null;
  last30: number | null;
  available: boolean;
};

/** The results wall display: the one number that matters, drawn large. */
export function drawResultsDisplay(c: HTMLCanvasElement, d: DisplayData, flash = false) {
  const g = c.getContext("2d")!;
  const W = c.width;
  const H = c.height;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, flash ? "#1F5A4A" : "#132042");
  grad.addColorStop(1, flash ? "#123C33" : "#0B1530");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // scanlines
  g.fillStyle = "rgba(255,255,255,0.025)";
  for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);
  g.fillStyle = "#8FB3FF";
  g.font = "700 30px system-ui, -apple-system, Segoe UI, sans-serif";
  g.textAlign = "left";
  g.fillText("FIRST FREE VISITS", 34, 58);
  if (!d.available) {
    g.fillStyle = "#C9D3EA";
    g.font = "800 120px system-ui, sans-serif";
    g.fillText("—", 34, 196);
    g.font = "600 26px system-ui, sans-serif";
    g.fillText("Data unavailable right now", 34, 250);
    return;
  }
  g.fillStyle = "#7DFFC8";
  g.font = "800 150px system-ui, -apple-system, Segoe UI, sans-serif";
  const big = String(d.last7 ?? "—");
  g.fillText(big, 30, 200);
  const bigW = g.measureText(big).width;
  g.fillStyle = "#D7E3FF";
  g.font = "600 30px system-ui, sans-serif";
  g.fillText("this week", 50 + bigW, 150);
  if (d.prev7 != null && d.last7 != null) {
    const diff = d.last7 - d.prev7;
    g.fillStyle = diff > 0 ? "#7DFFC8" : diff < 0 ? "#FF9DA0" : "#AFC0E6";
    g.fillText(diff === 0 ? "same as last week" : `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)} vs last week`, 50 + bigW, 196);
  }
  g.fillStyle = "#AFC0E6";
  g.font = "600 28px system-ui, sans-serif";
  g.fillText(`Last 30 days: ${d.last30 ?? "—"}`, 34, 262);
  g.textAlign = "right";
  g.fillStyle = "#5E79B8";
  g.font = "600 22px system-ui, sans-serif";
  g.fillText("tap for results ›", W - 30, 262);
}

/** The floating holo-screen each robot works on. */
export function drawHolo(c: HTMLCanvasElement, kind: "visibility" | "outreach" | "conversation", color: string, t: number, active: boolean) {
  const g = c.getContext("2d")!;
  const W = c.width;
  const H = c.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = "rgba(20,40,80,0.35)";
  roundRect(g, 4, 4, W - 8, H - 8, 18);
  g.fill();
  g.strokeStyle = color;
  g.globalAlpha = 0.9;
  g.lineWidth = 4;
  roundRect(g, 4, 4, W - 8, H - 8, 18);
  g.stroke();
  g.globalAlpha = 1;
  g.fillStyle = color;
  if (kind === "visibility") {
    // a search bar and growing bars
    g.globalAlpha = 0.85;
    roundRect(g, 22, 22, W - 44, 26, 13);
    g.fill();
    g.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {
      const h = 30 + ((Math.sin(t * (active ? 1.6 : 0.4) + i) + 1) / 2) * 60 + i * 6;
      g.fillRect(28 + i * 30, H - 22 - h, 20, h);
    }
  } else if (kind === "outreach") {
    // a little map with pulsing pins
    g.globalAlpha = 0.5;
    g.beginPath();
    g.ellipse(W / 2, H / 2 + 6, W / 2.6, H / 4.4, -0.15, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    const pins = [
      [0.3, 0.55],
      [0.48, 0.45],
      [0.62, 0.6],
      [0.75, 0.48],
    ];
    pins.forEach(([x, y], i) => {
      const r = 6 + (active ? Math.max(0, Math.sin(t * 2 + i * 1.3)) * 6 : 0);
      g.beginPath();
      g.arc(x * W, y * H, r, 0, Math.PI * 2);
      g.fill();
    });
  } else {
    // chat bubbles
    const bubbles = [
      [24, 28, 120],
      [W - 24 - 100, 72, 100],
      [24, 116, 140],
    ];
    bubbles.forEach(([x, y, w], i) => {
      g.globalAlpha = i === Math.floor(t * (active ? 1.2 : 0.3)) % 3 ? 1 : 0.55;
      roundRect(g, x, y, w, 30, 15);
      g.fill();
    });
    g.globalAlpha = 1;
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
