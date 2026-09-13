"use client";

import { adminRequest, adminErrorMessage } from "@/lib/admin-request";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Point = { x: number; y: number };
type Panel = { points: Point[] };

const CLOSE_THRESHOLD = 3; // percentage distance to snap-close on first point

function pointsToPath(points: Point[]) {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

function centroid(points: Point[]): Point {
  const n = points.length;
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  return { x: sum.x / n, y: sum.y / n };
}

export function PanelEditor({
  pageId,
  comicId,
  imageUrl,
  initialPanels,
}: {
  pageId: string;
  comicId: string;
  imageUrl: string;
  initialPanels: Panel[];
}) {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);

  const [panels, setPanels] = useState<Panel[]>(initialPanels);
  const [drawing, setDrawing] = useState<Point[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [dragVertex, setDragVertex] = useState<{
    panelIndex: number;
    vertexIndex: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientToPercent = useCallback((clientX: number, clientY: number): Point => {
    const rect = stageRef.current!.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }, []);

  function startDrawing() {
    setDrawing([]);
    setSelected(null);
  }

  function cancelDrawing() {
    setDrawing(null);
  }

  function finishDrawing() {
    if (!drawing || drawing.length < 3) return;
    setPanels((prev) => [...prev, { points: drawing }]);
    setDrawing(null);
    setSelected(panels.length);
  }

  function handleStageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!drawing) return;
    const pt = clientToPercent(e.clientX, e.clientY);

    if (drawing.length >= 3) {
      const first = drawing[0];
      const dist = Math.hypot(pt.x - first.x, pt.y - first.y);
      if (dist < CLOSE_THRESHOLD) {
        finishDrawing();
        return;
      }
    }
    setDrawing((prev) => [...(prev ?? []), pt]);
  }

  function handleStageDoubleClick() {
    if (drawing && drawing.length >= 3) finishDrawing();
  }

  function removePanel(index: number) {
    setPanels((prev) => prev.filter((_, i) => i !== index));
    setSelected(null);
  }

  function movePanel(index: number, direction: "up" | "down") {
    setPanels((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSelected((s) => {
      if (s === null) return s;
      const target = direction === "up" ? index - 1 : index + 1;
      if (s === index) return target;
      if (s === target) return index;
      return s;
    });
  }

  useEffect(() => {
    if (!dragVertex) return;

    function onMove(e: PointerEvent) {
      const pt = clientToPercent(e.clientX, e.clientY);
      setPanels((prev) => {
        const next = [...prev];
        const panel = { ...next[dragVertex!.panelIndex] };
        const pts = [...panel.points];
        pts[dragVertex!.vertexIndex] = pt;
        panel.points = pts;
        next[dragVertex!.panelIndex] = panel;
        return next;
      });
    }
    function onUp() {
      setDragVertex(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragVertex, clientToPercent]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawing(null);
      if (e.key === "Backspace" && drawing && drawing.length > 0) {
        setDrawing((prev) => prev!.slice(0, -1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawing]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await adminRequest(`/api/pages/${pageId}/panels`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ panels: panels.map((p) => ({ points: p.points })) }),
      });
      setSaved(true);
      router.refresh();
    } catch (error) {
      setError(adminErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {!drawing ? (
            <button
              onClick={startDrawing}
              className="rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              + New panel
            </button>
          ) : (
            <>
              <span className="text-sm text-muted">
                Click to add points ({drawing.length}). Double-click or
                click the first point to close.
              </span>
              <button
                onClick={finishDrawing}
                disabled={drawing.length < 3}
                className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground disabled:opacity-40"
              >
                Close panel
              </button>
              <button
                onClick={cancelDrawing}
                className="rounded border border-border px-3 py-1.5 text-sm hover:border-accent"
              >
                Cancel (Esc)
              </button>
            </>
          )}
        </div>

        <div
          ref={stageRef}
          onClick={handleStageClick}
          onDoubleClick={handleStageDoubleClick}
          className="relative w-full select-none overflow-hidden rounded-lg border border-border bg-black"
          style={{ cursor: drawing ? "crosshair" : "default" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Page"
            className="pointer-events-none block w-full"
            draggable={false}
          />

          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            {panels.map((panel, i) => (
              <g key={i}>
                <polygon
                  points={pointsToPath(panel.points)}
                  fill={
                    selected === i
                      ? "rgba(224,38,63,0.25)"
                      : "rgba(255,255,255,0.06)"
                  }
                  stroke={selected === i ? "#e0263f" : "#f4f4f2"}
                  strokeWidth={selected === i ? 0.6 : 0.4}
                  vectorEffect="non-scaling-stroke"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!drawing) setSelected(i);
                  }}
                  style={{ cursor: drawing ? "crosshair" : "pointer" }}
                />
                {selected === i &&
                  panel.points.map((pt, vi) => (
                    <circle
                      key={vi}
                      cx={pt.x}
                      cy={pt.y}
                      r={1.1}
                      fill="#e0263f"
                      stroke="#fff"
                      strokeWidth={0.3}
                      vectorEffect="non-scaling-stroke"
                      style={{ cursor: "grab" }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDragVertex({ panelIndex: i, vertexIndex: vi });
                      }}
                    />
                  ))}
                {(() => {
                  const c = centroid(panel.points);
                  return (
                    <text
                      x={c.x}
                      y={c.y}
                      fontSize={4}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#fff"
                      style={{ pointerEvents: "none" }}
                    >
                      {i + 1}
                    </text>
                  );
                })()}
              </g>
            ))}

            {drawing && drawing.length > 0 && (
              <g>
                <polyline
                  points={pointsToPath(drawing)}
                  fill="none"
                  stroke="#e0263f"
                  strokeWidth={0.5}
                  vectorEffect="non-scaling-stroke"
                />
                {drawing.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={1}
                    fill={i === 0 ? "#fff" : "#e0263f"}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>
            )}
          </svg>
        </div>
      </div>

      <div>
        <h3 className="font-display mb-3 text-xl tracking-wide">
          Panels ({panels.length})
        </h3>
        <p className="mb-4 text-xs text-muted">
          The order below is the reading order during zoom.
        </p>

        <ol className="mb-6 space-y-2">
          {panels.map((_, i) => (
            <li
              key={i}
              onClick={() => !drawing && setSelected(i)}
              className={`flex cursor-pointer items-center justify-between rounded border px-3 py-2 text-sm ${
                selected === i
                  ? "border-accent bg-accent/10"
                  : "border-border bg-surface"
              }`}
            >
              <span>Panel {i + 1}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    movePanel(i, "up");
                  }}
                  disabled={i === 0}
                  className="disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    movePanel(i, "down");
                  }}
                  disabled={i === panels.length - 1}
                  className="disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removePanel(i);
                  }}
                  className="text-accent hover:underline"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ol>

        {error && (
          <p className="mb-3 rounded border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
            {error}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded bg-accent py-2.5 font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save panels"}
        </button>
        {saved && (
          <p className="mt-2 text-center text-sm text-green-400">
            Saved ✓
          </p>
        )}

        <a
          href={`/admin/comics/${comicId}`}
          className="mt-4 block text-center text-sm text-muted hover:text-foreground"
        >
          ← Back to comic
        </a>
      </div>
    </div>
  );
}
