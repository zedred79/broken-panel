import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidPanel, readJsonObject } from "../src/lib/api-input";

function request(body: string) {
  return new Request("http://localhost/api/pages/example", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

test("rejects malformed JSON and non-object bodies without throwing", async () => {
  for (const body of ["", "{", "null", "[]", '"text"', "1", "false"]) {
    assert.equal(await readJsonObject(request(body)), null, body);
  }
});

test("preserves valid mutation bodies, including clearing a chapter", async () => {
  for (const body of [{ chapterId: null }, { direction: "up" }, { panels: [] }]) {
    assert.deepEqual(await readJsonObject(request(JSON.stringify(body))), body);
  }
});

test("rejects null panels and malformed or out-of-range points", () => {
  const validPoint = { x: 10, y: 20 };
  for (const panel of [null, false, 1, "panel", {}, { points: null }, { points: [] }]) {
    assert.equal(isValidPanel(panel), false);
  }
  for (const point of [null, {}, { x: "10", y: 20 }, { x: -1, y: 0 },
    { x: 0, y: 101 }, { x: NaN, y: 0 }, { x: 0, y: Infinity }]) {
    assert.equal(isValidPanel({ points: [validPoint, validPoint, point] }), false);
  }
  assert.equal(isValidPanel({ points: [validPoint, validPoint] }), false);
});

test("accepts polygons at the image boundaries", () => {
  assert.equal(isValidPanel({ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] }), true);
});
