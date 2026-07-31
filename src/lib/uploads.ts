import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import imageSize from "image-size";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// Deliberately outside `public/`: `next start` indexes the public folder once
// at process startup, so files written there at runtime 404 until the server
// restarts. Uploaded content is served instead via src/app/uploads/[filename].
export const UPLOADS_ROOT =
  process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");

export async function savePageImage(
  file: File
): Promise<{ url: string; width: number; height: number }> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Formato immagine non supportato (usa PNG, JPEG o WebP)");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { width, height } = imageSize(buffer);
  if (!width || !height) {
    throw new Error("Impossibile leggere le dimensioni dell'immagine");
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const filename = `${randomUUID()}.${ext}`;

  await mkdir(UPLOADS_ROOT, { recursive: true });
  await writeFile(path.join(UPLOADS_ROOT, filename), buffer);

  return { url: `/uploads/${filename}`, width, height };
}

export async function saveCoverImage(file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Formato immagine non supportato (usa PNG, JPEG o WebP)");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const filename = `cover-${randomUUID()}.${ext}`;

  await mkdir(UPLOADS_ROOT, { recursive: true });
  await writeFile(path.join(UPLOADS_ROOT, filename), buffer);

  return `/uploads/${filename}`;
}

const LOGO_ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export async function saveLogoImage(file: File): Promise<string> {
  if (!LOGO_ALLOWED_TYPES.has(file.type)) {
    throw new Error("Formato immagine non supportato (usa PNG, WebP, SVG o JPEG)");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext =
    file.type === "image/svg+xml"
      ? "svg"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
  const filename = `logo-${randomUUID()}.${ext}`;

  await mkdir(UPLOADS_ROOT, { recursive: true });
  await writeFile(path.join(UPLOADS_ROOT, filename), buffer);

  return `/uploads/${filename}`;
}
