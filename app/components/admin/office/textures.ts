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

/** The results tapestry: the one number that matters, inked on parchment. */
export function drawResultsDisplay(c: HTMLCanvasElement, d: DisplayData, flash = false) {
  const g = c.getContext("2d")!;
  const W = c.width;
  const H = c.height;
  // the embroidered cloth
  g.fillStyle = flash ? "#2F5A2E" : "#6E1E24";
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "#D9B45A";
  g.lineWidth = 6;
  g.strokeRect(9, 9, W - 18, H - 18);
  // the parchment panel
  const grad = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W / 1.4);
  grad.addColorStop(0, "#F7EBCD");
  grad.addColorStop(1, "#E3CB98");
  g.fillStyle = grad;
  g.fillRect(24, 24, W - 48, H - 48);
  g.strokeStyle = "rgba(110,60,30,0.45)";
  g.lineWidth = 2;
  g.strokeRect(32, 32, W - 64, H - 64);
  const serif = "Georgia, 'Times New Roman', serif";
  g.fillStyle = "#7A1F24";
  g.font = "700 30px " + serif;
  g.textAlign = "left";
  g.fillText("FIRST FREE VISITS", 48, 74);
  if (!d.available) {
    g.fillStyle = "#4A3020";
    g.font = "700 110px " + serif;
    g.fillText("—", 48, 196);
    g.font = "italic 600 26px " + serif;
    g.fillText("Not known right now", 48, 250);
    return;
  }
  g.fillStyle = "#2E1C12";
  g.font = "700 140px " + serif;
  const big = String(d.last7 ?? "—");
  g.fillText(big, 44, 205);
  const bigW = g.measureText(big).width;
  g.fillStyle = "#5A3A22";
  g.font = "italic 600 30px " + serif;
  g.fillText("this week", 66 + bigW, 150);
  if (d.prev7 != null && d.last7 != null) {
    const diff = d.last7 - d.prev7;
    g.fillStyle = diff > 0 ? "#2F6B33" : diff < 0 ? "#8E2A26" : "#5A3A22";
    g.font = "700 28px " + serif;
    g.fillText(diff === 0 ? "same as last week" : `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)} vs last week`, 66 + bigW, 196);
  }
  g.fillStyle = "#5A3A22";
  g.font = "600 26px " + serif;
  g.fillText(`Last 30 days: ${d.last30 ?? "—"}`, 48, 256);
  g.textAlign = "right";
  g.fillStyle = "#8A6A44";
  g.font = "italic 600 22px " + serif;
  g.fillText("tap for results ›", W - 46, 256);
}
