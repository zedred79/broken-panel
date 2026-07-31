import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import imageSize from "image-size";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// Deliberately outside `public/`: `next start` indexes the public folder once
// at process startup, so files written there at runtime 404 until the server
// restarts. Uploaded content is served instead via src/app/uploads/[filename].
export const UPLOADS_ROOT =
  process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");

// Stesso pattern usato da src/app/uploads/[filename]/route.ts per servire i
// file: unica fonte di verità su cosa sia un nome file valido, per evitare
// path traversal sia in lettura che in cancellazione.
export const UPLOAD_FILENAME_PATTERN = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/;

// Rimuove un file precedentemente salvato in UPLOADS_ROOT dato il suo URL
// pubblico (es. "/uploads/xxx.png"). Ignora silenziosamente URL che non
// puntano a uploads/ (es. i loghi di default bundlati in public/) e file già
// assenti sul disco.
export async function deleteUploadedFile(
  url: string | null | undefined
): Promise<void> {
  if (!url || !url.startsWith("/uploads/")) return;

  const filename = url.slice("/uploads/".length);
  if (!UPLOAD_FILENAME_PATTERN.test(filename)) return;

  try {
    await unlink(path.join(UPLOADS_ROOT, filename));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

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
