import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PanelEditor } from "../src/components/admin/PanelEditor";
import { ChapterManager } from "../src/components/admin/ChapterManager";

async function render(t: TestContext, element: ReactNode) {
  const dom = new JSDOM("<div id='root'></div>", { url: "http://localhost" });
  const globals = { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  const router = {
    back() {}, forward() {}, refresh: t.mock.fn(),
    push() {}, replace() {}, prefetch() {}, bfcacheId: "test",
  } satisfies AppRouterInstance;
  t.after(async () => {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  await act(async () => root.render(createElement(AppRouterContext.Provider, { value: router }, element)));
  return { container, router };
}

test("panel editor unlocks after a network failure and allows retrying the same panels", async (t) => {
  let rejectRequest!: (error: Error) => void;
  const pending = new Promise<Response>((_resolve, reject) => { rejectRequest = reject; });
  const fetchMock = t.mock.method(globalThis, "fetch", () => pending);
  const panels = [{ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] }];
  const { container } = await render(t, createElement(PanelEditor, {
    pageId: "page", comicId: "comic", imageUrl: "/page.png", initialPanels: panels,
  }));
  const button = [...container.querySelectorAll("button")].find((button) => button.textContent === "Save panels")!;
  await act(async () => button.click());
  assert.equal(button.disabled, true);
  await act(async () => rejectRequest(new TypeError("Network unavailable")));
  assert.equal(button.disabled, false);
  assert.match(container.textContent!, /Network unavailable/);
  assert.doesNotMatch(container.textContent!, /Saved ✓/);

  fetchMock.mock.mockImplementation(async () => Response.json({ ok: true }));
  await act(async () => button.click());
  assert.equal(button.disabled, false);
  assert.match(container.textContent!, /Saved ✓/);
  assert.doesNotMatch(container.textContent!, /Network unavailable/);
  const init = fetchMock.mock.calls[1].arguments[1] as RequestInit;
  assert.deepEqual(JSON.parse(init.body as string), { panels });
});

test("chapter operations display HTTP errors instead of refreshing as if successful", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "Session expired" }, { status: 401 }));
  const { container, router } = await render(t, createElement(ChapterManager, {
    comicId: "comic", chapters: [{ id: "one", title: "One" }, { id: "two", title: "Two" }],
  }));
  const button = [...container.querySelectorAll("button")].find((button) => button.textContent === "↓")!;
  await act(async () => button.click());
  assert.equal(button.disabled, false);
  assert.match(container.textContent!, /Session expired/);
  assert.equal(router.refresh.mock.callCount(), 0);
});
