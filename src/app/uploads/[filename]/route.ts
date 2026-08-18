import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { UPLOAD_FILENAME_PATTERN, UPLOADS_ROOT } from "@/lib/uploads";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!UPLOAD_FILENAME_PATTERN.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  try {
    const buffer = await readFile(path.join(/*turbopackIgnore: true*/ UPLOADS_ROOT, filename));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        // Difesa in profondità sull'unico endpoint che restituisce contenuto
        // caricato dall'utente. Gli SVG sono già sanificati all'upload
        // (sanitizeSvg in src/lib/uploads.ts), ma se un giorno quella
        // sanificazione dovesse lasciar passare qualcosa, questi due header
        // impediscono comunque l'esecuzione: "nosniff" blocca il MIME
        // sniffing del browser, la CSP azzera script e risorse esterne se il
        // file viene aperto direttamente come documento (non via <img>, che
        // sandboxa già di suo).
        //
        // Deliberatamente SENZA la direttiva `sandbox`: per spec si applica
        // solo alle risposte la cui destinazione è un documento, ma è l'unica
        // direttiva qui che, se un browser la interpretasse più
        // aggressivamente, potrebbe impedire il rendering delle immagini in
        // <img> — cioè rompere tutto il sito. `default-src 'none'` copre già
        // il caso che ci interessa (niente script né risorse esterne se il
        // file viene aperto come pagina) senza quel rischio.
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
