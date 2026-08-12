import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import imageSize from "image-size";
import sharp from "sharp";
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";

// Istanza DOMPurify server-side (via jsdom) riusata per ogni upload: un SVG
// caricato dall'admin può contenere <script>, gestori onload/onclick, o
// <foreignObject> con HTML arbitrario — se caricato per errore o con un
// account admin compromesso, verrebbe eseguito nell'origine del sito quando
// l'SVG viene aperto direttamente (non tramite <img>, che lo sandboxa già).
const domPurify = createDOMPurify(
  new JSDOM("").window as unknown as Window & typeof globalThis
);

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// Le tavole sono spesso render AI ad alta risoluzione, quindi il limite è più
// permissivo; copertine e loghi sono immagini piccole mostrate in miniatura.
const MAX_PAGE_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_COVER_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_LOGO_IMAGE_BYTES = 2 * 1024 * 1024;

function assertFileSize(file: File, maxBytes: number, label: string): void {
  if (file.size > maxBytes) {
    throw new Error(`${label} is too large (max ${maxBytes / (1024 * 1024)}MB)`);
  }
}

// image-size rileva il formato leggendo i byte reali del file (magic number),
// non il Content-Type dichiarato dal client — usato qui per verificare che il
// file caricato sia davvero un'immagine del formato che dichiara di essere,
// non un file qualsiasi rinominato con estensione/MIME falsi.
const RASTER_MIME_TO_DETECTED_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function validateRasterImage(
  buffer: Buffer,
  declaredType: string
): { width: number; height: number } {
  let result;
  try {
    result = imageSize(buffer);
  } catch {
    throw new Error("The file is not a valid image or is corrupted");
  }

  if (!result.width || !result.height) {
    throw new Error("Unable to read the image dimensions");
  }
  if (result.type !== RASTER_MIME_TO_DETECTED_TYPE[declaredType]) {
    throw new Error("The file content doesn't match the declared format");
  }

  return { width: result.width, height: result.height };
}

// Le griglie (pagine in admin, picker pagine nel reader, copertine nel
// catalogo) mostrano le immagini a ~250-300px di larghezza: 480px basta a
// coprire anche schermi retina senza scaricare l'originale a piena
// risoluzione (spesso diversi MB per un render AI ad alta definizione). Il
// reader in modalità lettura/zoom continua a usare l'originale, non il
// thumbnail, perché lo zoom arriva fino a 6x.
const THUMBNAIL_WIDTH = 480;

async function saveThumbnail(
  buffer: Buffer,
  baseFilename: string
): Promise<string> {
  const thumbFilename = `${baseFilename}-thumb.webp`;
  const thumbBuffer = await sharp(buffer)
    .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  await writeFile(path.join(UPLOADS_ROOT, thumbFilename), thumbBuffer);
  return `/uploads/${thumbFilename}`;
}

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

export async function savePageImage(file: File): Promise<{
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
}> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Unsupported image format (use PNG, JPEG or WebP)");
  }
  assertFileSize(file, MAX_PAGE_IMAGE_BYTES, "Page image");

  const buffer = Buffer.from(await file.arrayBuffer());
  const { width, height } = validateRasterImage(buffer, file.type);

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const id = randomUUID();
  const filename = `${id}.${ext}`;

  await mkdir(UPLOADS_ROOT, { recursive: true });
  await writeFile(path.join(UPLOADS_ROOT, filename), buffer);
  const thumbnailUrl = await saveThumbnail(buffer, id);

  return { url: `/uploads/${filename}`, thumbnailUrl, width, height };
}

export async function saveCoverImage(
  file: File
): Promise<{ url: string; thumbnailUrl: string }> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Unsupported image format (use PNG, JPEG or WebP)");
  }
  assertFileSize(file, MAX_COVER_IMAGE_BYTES, "Cover image");

  const buffer = Buffer.from(await file.arrayBuffer());
  validateRasterImage(buffer, file.type);
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const id = `cover-${randomUUID()}`;
  const filename = `${id}.${ext}`;

  await mkdir(UPLOADS_ROOT, { recursive: true });
  await writeFile(path.join(UPLOADS_ROOT, filename), buffer);
  const thumbnailUrl = await saveThumbnail(buffer, id);

  return { url: `/uploads/${filename}`, thumbnailUrl };
}

const LOGO_ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

function sanitizeSvg(buffer: Buffer): Buffer {
  const dirty = buffer.toString("utf-8");
  const clean = domPurify.sanitize(dirty, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["script", "foreignObject"],
  });

  if (!clean.includes("<svg")) {
    throw new Error("Invalid SVG file");
  }

  return Buffer.from(clean, "utf-8");
}

export async function saveLogoImage(file: File): Promise<string> {
  if (!LOGO_ALLOWED_TYPES.has(file.type)) {
    throw new Error("Unsupported image format (use PNG, WebP, SVG or JPEG)");
  }
  assertFileSize(file, MAX_LOGO_IMAGE_BYTES, "Logo");

  let buffer: Buffer<ArrayBufferLike> = Buffer.from(await file.arrayBuffer());
  if (file.type === "image/svg+xml") {
    buffer = sanitizeSvg(buffer);
  } else {
    validateRasterImage(buffer, file.type);
  }
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
