export type ImageSignature = {
  hash: string;
  mean: number[];
  method: "dhash64-rgb-v1";
};
/** Same deterministic 9x8 RGBA fingerprint algorithm in browser and server. */
export function fingerprint(
  pixels: ArrayLike<number>,
  channels = 4,
): ImageSignature {
  if (pixels.length !== 72 * channels)
    throw new Error("Expected a normalized 9 by 8 image");
  const mean = [0, 0, 0];
  let bits = "";
  const grey = (i: number) =>
    0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 9; x++) {
      const i = (y * 9 + x) * channels;
      for (let c = 0; c < 3; c++) mean[c] += pixels[i + c] / 72;
      if (x < 8) bits += grey(i) > grey(i + channels) ? "1" : "0";
    }
  return {
    hash: bits,
    mean: mean.map((n) => Math.round(n)),
    method: "dhash64-rgb-v1",
  };
}
export function imageSimilarity(
  a?: ImageSignature | null,
  b?: ImageSignature | null,
): number | null {
  if (
    !a ||
    !b ||
    a.method !== b.method ||
    a.hash.length !== 64 ||
    b.hash.length !== 64
  )
    return null;
  const hash = 1 - [...a.hash].filter((v, i) => v !== b.hash[i]).length / 64;
  const colour =
    1 -
    Math.sqrt(a.mean.reduce((sum, v, i) => sum + (v - b.mean[i]) ** 2, 0) / 3) /
      255;
  return Math.max(0, Math.min(1, 0.7 * hash + 0.3 * colour));
}
export async function uploadSignature(
  file: File,
): Promise<{ signature: ImageSignature; preview: string }> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 2 * 1024 * 1024
  )
    throw new Error("Choose a PNG, JPEG or WebP file smaller than 2 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 20_000_000)
      throw new Error("Image dimensions are too large.");
    const canvas = document.createElement("canvas");
    canvas.width = 9;
    canvas.height = 8;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 9, 8);
    ctx.drawImage(bitmap, 0, 0, 9, 8);
    const signature = fingerprint(ctx.getImageData(0, 0, 9, 8).data);
    canvas.width = 96;
    canvas.height = 96;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 96, 96);
    ctx.drawImage(bitmap, 0, 0, 96, 96);
    return { signature, preview: canvas.toDataURL("image/png") };
  } finally {
    bitmap.close();
  }
}
