import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { UPLOADS_ROOT } from "@/lib/uploads";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const SAFE_FILENAME = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!SAFE_FILENAME.test(filename)) {
    return NextResponse.json({ error: "Nome file non valido" }, { status: 400 });
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return NextResponse.json({ error: "Tipo file non supportato" }, { status: 400 });
  }

  try {
    const buffer = await readFile(path.join(UPLOADS_ROOT, filename));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "File non trovato" }, { status: 404 });
  }
}
