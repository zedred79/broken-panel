import assert from "node:assert/strict";
import { test } from "node:test";
import { adminRequest } from "../src/lib/admin-request";

test("accepts successful mutations without requiring a response body", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 204 }));
  const init = { method: "DELETE" };
  await adminRequest("/api/pages/example", init);
  assert.deepEqual(fetchMock.mock.calls[0].arguments, ["/api/pages/example", init]);
});

test("reports API errors, including an expired session", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "Unauthorized" }, { status: 401 }));
  await assert.rejects(adminRequest("/api/pages/example", { method: "PATCH" }), /Unauthorized/);
});

test("reports proxy HTML errors without masking them with a JSON parse failure", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("<html>Bad gateway</html>", { status: 502 }));
  await assert.rejects(adminRequest("/api/pages/example", { method: "PATCH" }), /Request failed \(502\)/);
});

test("propagates a network failure so the form can display it and reset pending state", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(adminRequest("/api/pages/example", { method: "PATCH" }), /Failed to fetch/);
});
