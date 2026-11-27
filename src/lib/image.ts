"use client";

/** Shrinks a picture so it travels fast to every phone. Returns a JPEG/PNG data URL and its aspect ratio. */
export async function loadImage(file: File, maxSide = 1280): Promise<{ src: string; aspect: number }> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't a picture. Use a JPG, PNG or WebP.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That picture couldn't be opened. Try another file."));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const src = canvas.toDataURL("image/jpeg", 0.82);
    return { src, aspect: w / h };
  } finally {
    URL.revokeObjectURL(url);
  }
}
