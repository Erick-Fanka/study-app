// Prepara a foto de perfil no próprio navegador: recorta em quadrado, reduz para
// 256x256 e regrava como WebP (ou JPEG). Regravar descarta metadados (EXIF, GPS)
// e qualquer conteúdo que não seja a imagem em si.

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const SIZE = 256;
const MAX_OUTPUT_CHARS = 90_000; // ~65 KB de imagem

const DATA_URL = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/;

export function isSafeAvatar(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_OUTPUT_CHARS && DATA_URL.test(value);
}

export class ImageError extends Error {}

export async function toAvatarDataUrl(file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ImageError("Use uma imagem JPG, PNG ou WebP.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageError("A imagem é muito grande (máximo 15 MB).");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageError("Não foi possível ler essa imagem.");
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("Seu navegador não conseguiu processar a imagem.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();

  for (const quality of [0.85, 0.75, 0.6, 0.45]) {
    let url = canvas.toDataURL("image/webp", quality);
    if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", quality);
    if (isSafeAvatar(url)) return url;
  }
  throw new ImageError("Não foi possível reduzir a imagem o suficiente.");
}
