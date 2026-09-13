import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";

let folder: string;
let uploads: typeof import("../src/lib/uploads");
const previousRoot = process.env.UPLOADS_DIR;

before(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "broken-panel-test-"));
  process.env.UPLOADS_DIR = folder;
  uploads = await import("../src/lib/uploads");
});

after(async () => {
  if (previousRoot === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = previousRoot;
  if (folder) await rm(folder, { recursive: true, force: true });
});

function corruptPng() {
  // Enough header bytes for image-size, but no valid image for sharp.
  const buffer = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12);
  buffer.writeUInt32BE(10, 16);
  buffer.writeUInt32BE(10, 20);
  return new File([buffer], "corrupt.png", { type: "image/png" });
}

test("failed page and cover thumbnail generation leaves no orphan files", async () => {
  for (const save of [uploads.savePageImage, uploads.saveCoverImage]) {
    await assert.rejects(save(corruptPng()));
    assert.deepEqual(await readdir(folder), []);
  }
});

test("valid pages and covers retain their original and a usable WebP thumbnail", async () => {
  const buffer = await sharp({ create: { width: 600, height: 800, channels: 3, background: "white" } }).png().toBuffer();
  for (const save of [uploads.savePageImage, uploads.saveCoverImage]) {
    const saved = await save(new File([new Uint8Array(buffer)], "page.png", { type: "image/png" }));
    assert.deepEqual(await readFile(path.join(folder, path.basename(saved.url))), buffer);
    const metadata = await sharp(path.join(folder, path.basename(saved.thumbnailUrl))).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 480);
    assert.equal(metadata.height, 640);
    await uploads.deleteUploadedFile(saved.url);
    await uploads.deleteUploadedFile(saved.thumbnailUrl);
  }
  assert.deepEqual(await readdir(folder), []);
});

test("a spoofed MIME type is rejected before any file is written", async () => {
  await assert.rejects(uploads.savePageImage(new File(["not a PNG"], "fake.png", { type: "image/png" })));
  assert.deepEqual(await readdir(folder), []);
});
