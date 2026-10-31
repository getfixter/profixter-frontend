"use client";

import { useEffect, useMemo, useRef } from "react";
import { compressImage } from "@/lib/compressImage";

/*
 * Optional photos: take one with the camera or choose from the library.
 * Shrunk in the browser to save the customer's data; a photo the browser
 * cannot decode (HEIC outside Safari) goes as-is and the server re-encodes it.
 */
const MAX = 10;

async function shrink(file: File): Promise<File> {
  return Promise.race([compressImage(file), new Promise<File>((resolve) => setTimeout(() => resolve(file), 8000))]);
}

export default function PhotoPicker({ photos, onChange }: { photos: File[]; onChange: (next: File[]) => void }) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => photos.map((p) => URL.createObjectURL(p)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list).slice(0, Math.max(0, MAX - photos.length));
    const ready = await Promise.all(picked.map(shrink));
    onChange([...photos, ...ready].slice(0, MAX));
  };

  return (
    <div data-photo-picker>
      <div className="bk-photo-actions">
        <button type="button" className="bk-btn" onClick={() => camera.current?.click()} disabled={photos.length >= MAX}>
          Take photo
        </button>
        <button type="button" className="bk-btn" onClick={() => library.current?.click()} disabled={photos.length >= MAX}>
          Choose photos
        </button>
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden data-input="camera" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
      <input ref={library} type="file" accept="image/*" multiple hidden data-input="photos" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
      {previews.length > 0 && (
        <div className="bk-thumbs" data-photo-count={previews.length}>
          {previews.map((src, i) => (
            <div key={src} className="bk-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
              <button type="button" aria-label="Remove photo" onClick={() => onChange(photos.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
