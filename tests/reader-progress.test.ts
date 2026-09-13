import assert from "node:assert/strict";
import { test } from "node:test";
import { readerProgressPercent } from "../src/lib/reader-progress";

test("a single page without panels is the final reading step", () => {
  assert.equal(readerProgressPercent([{ panels: [] }], 0, -1), 100);
});

test("mixed pages advance uniformly and finish on an uncropped page at 100%", () => {
  const pages = [{ panels: [] }, { panels: [{}, {}] }, { panels: [] }];
  const positions = [[0, -1], [1, -1], [1, 0], [1, 1], [2, -1]];
  assert.deepEqual(positions.map(([page, panel]) => readerProgressPercent(pages, page, panel)),
    [20, 40, 60, 80, 100]);
});

test("cropped pages retain full-page and individual panel steps", () => {
  const pages = [{ panels: [{}] }];
  assert.equal(readerProgressPercent(pages, 0, -1), 50);
  assert.equal(readerProgressPercent(pages, 0, 0), 100);
  assert.equal(readerProgressPercent([], 0, -1), 0);
});
