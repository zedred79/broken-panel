"use client";

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearReadingProgress, saveReadingProgress } from "@/lib/reading-progress";

type Point = { x: number; y: number };
type ReaderPanel = { points: Point[] };
type ReaderPage = {
  id: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  width: number;
  height: number;
  chapterTitle: string | null;
  panels: ReaderPanel[];
};

const TRANSITION_MS = 550;

function bboxOf(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

export function ComicReader({
  slug,
  title,
  pages,
  initialPageIndex = 0,
}: {
  slug: string;
  title: string;
  pages: ReaderPage[];
  initialPageIndex?: number;
}) {
  const maskId = useId();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [pageIndex, setPageIndex] = useState(() =>
    Math.min(Math.max(initialPageIndex, 0), pages.length - 1)
  );
  const [panelIndex, setPanelIndex] = useState(-1);
  const [hintVisible, setHintVisible] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () =>
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Alla prima pagina non c'è nessun progresso da ricordare: salvarlo
    // (cosa che succedeva anche solo al mount, con pageIndex = 0) faceva
    // comparire "Continue from page 1" sulla scheda del fumetto appena lo si
    // apriva. Tornare indietro fino alla prima pagina cancella invece un
    // progresso più avanti salvato prima, altrimenti resterebbe stantio.
    if (pageIndex === 0) {
      clearReadingProgress(slug);
      return;
    }
    saveReadingProgress(slug, pageIndex);
  }, [slug, pageIndex]);

  const currentPage = pages[pageIndex];
  const panels = currentPage?.panels ?? [];
  const hasChapters = useMemo(
    () => pages.some((p) => p.chapterTitle !== null),
    [pages]
  );

  const goNext = useCallback(() => {
    setHintVisible(false);
    if (panelIndex === -1) {
      if (panels.length > 0) {
        setPanelIndex(0);
        return;
      }
    } else if (panelIndex < panels.length - 1) {
      setPanelIndex(panelIndex + 1);
      return;
    }
    if (pageIndex >= pages.length - 1) {
      clearReadingProgress(slug);
      router.push(`/comics/${slug}`);
      return;
    }
    setPanelIndex(-1);
    setPageIndex((pi) => pi + 1);
  }, [panelIndex, panels.length, pageIndex, pages.length, router, slug]);

  const goPrev = useCallback(() => {
    setHintVisible(false);
    if (panelIndex > 0) {
      setPanelIndex(panelIndex - 1);
      return;
    }
    if (panelIndex === 0) {
      setPanelIndex(-1);
      return;
    }
    setPageIndex((pi) => {
      if (pi > 0) {
        const prevPanels = pages[pi - 1].panels;
        setPanelIndex(prevPanels.length > 0 ? prevPanels.length - 1 : -1);
        return pi - 1;
      }
      return pi;
    });
  }, [panelIndex, pages]);

  const jumpToPage = useCallback((index: number) => {
    setHintVisible(false);
    setPageIndex(index);
    setPanelIndex(-1);
    setPickerOpen(false);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && pickerOpen) {
        setPickerOpen(false);
        return;
      }
      if (pickerOpen) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, pickerOpen]);

  const layout = useMemo(() => {
    const { w: containerW, h: containerH } = containerSize;
    if (!currentPage || containerW === 0 || containerH === 0) return null;

    const fit = Math.min(
      containerW / currentPage.width,
      containerH / currentPage.height
    );
    const displayedW = currentPage.width * fit;
    const displayedH = currentPage.height * fit;
    const offsetX0 = (containerW - displayedW) / 2;
    const offsetY0 = (containerH - displayedH) / 2;

    let scale = 1;
    let tx = 0;
    let ty = 0;

    if (panelIndex >= 0 && panels[panelIndex]) {
      const { minX, minY, maxX, maxY } = bboxOf(panels[panelIndex].points);
      const bboxXpx = (minX / 100) * displayedW;
      const bboxYpx = (minY / 100) * displayedH;
      const bboxWpx = ((maxX - minX) / 100) * displayedW;
      const bboxHpx = ((maxY - minY) / 100) * displayedH;

      const rawScale = Math.min(
        containerW / bboxWpx,
        containerH / bboxHpx
      ) * 0.92;
      scale = Math.min(Math.max(rawScale, 1), 6);

      const cx = bboxXpx + bboxWpx / 2;
      const cy = bboxYpx + bboxHpx / 2;

      tx = containerW / 2 - offsetX0 - cx * scale;
      ty = containerH / 2 - offsetY0 - cy * scale;
    }

    return { displayedW, displayedH, offsetX0, offsetY0, scale, tx, ty };
  }, [containerSize, currentPage, panelIndex, panels]);

  const totalSteps = pages.reduce((sum, p) => sum + Math.max(p.panels.length, 1) + 1, 0);
  const stepsBefore = pages
    .slice(0, pageIndex)
    .reduce((sum, p) => sum + Math.max(p.panels.length, 1) + 1, 0);
  const currentStep = stepsBefore + (panelIndex + 2);
  const progressPct = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  const darkOpacity = panelIndex === -1 ? 0 : 0.87;

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-4 py-3">
        <Link
          href={`/comics/${slug}`}
          className="rounded border border-white/20 bg-black/40 px-3 py-1.5 text-sm text-white/80 backdrop-blur hover:text-white"
        >
          ← Close
        </Link>
        <span className="font-display truncate px-4 text-sm tracking-wide text-white/70">
          {title}
          {currentPage?.chapterTitle && (
            <span className="ml-2 text-white/40">— {currentPage.chapterTitle}</span>
          )}
        </span>
        <button
          onClick={() => setPickerOpen(true)}
          className="rounded border border-white/20 bg-black/40 px-3 py-1.5 text-xs text-white/70 backdrop-blur transition hover:text-white"
        >
          Page {pageIndex + 1}/{pages.length} ▾
        </button>
      </div>

      <div className="absolute inset-x-0 top-0 z-20 h-1 bg-white/10">
        <div
          className="h-full bg-accent transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        {currentPage && layout && (
          <div
            style={{
              position: "absolute",
              left: layout.offsetX0,
              top: layout.offsetY0,
              width: layout.displayedW,
              height: layout.displayedH,
              transform: `translate(${layout.tx}px, ${layout.ty}px) scale(${layout.scale})`,
              transformOrigin: "0 0",
              transition: `transform ${TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentPage.imageUrl}
              alt={`Page ${pageIndex + 1}`}
              className="block h-full w-full"
              draggable={false}
            />
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
            >
              <defs>
                <mask id={maskId}>
                  <rect width="100" height="100" fill="white" />
                  {panelIndex >= 0 && panels[panelIndex] && (
                    <polygon
                      points={panels[panelIndex].points
                        .map((p) => `${p.x},${p.y}`)
                        .join(" ")}
                      fill="black"
                    />
                  )}
                </mask>
              </defs>
              <rect
                width="100"
                height="100"
                fill="black"
                mask={`url(#${maskId})`}
                style={{
                  opacity: darkOpacity,
                  transition: `opacity ${TRANSITION_MS}ms ease`,
                }}
              />
            </svg>
          </div>
        )}

        <button
          aria-label="Previous panel"
          onClick={goPrev}
          className="absolute inset-y-0 left-0 z-10 w-2/5 cursor-w-resize"
        />
        <button
          aria-label="Next panel"
          onClick={goNext}
          className="absolute inset-y-0 right-0 z-10 w-3/5 cursor-e-resize"
        />

        {hintVisible && (
          <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex justify-center">
            <span className="rounded-full border border-white/20 bg-black/60 px-4 py-2 text-sm text-white/70 backdrop-blur">
              Click or use ← → to browse
            </span>
          </div>
        )}
      </div>

      {panels.length > 0 && (
        <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center gap-1.5">
          <span
            className={`h-1.5 w-4 rounded-full transition ${
              panelIndex === -1 ? "bg-accent" : "bg-white/25"
            }`}
          />
          {panels.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-4 rounded-full transition ${
                panelIndex === i ? "bg-accent" : "bg-white/25"
              }`}
            />
          ))}
        </div>
      )}

      {pickerOpen && (
        <div
          className="fixed inset-0 z-30 flex flex-col bg-black/95 backdrop-blur"
          onClick={() => setPickerOpen(false)}
        >
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="font-display text-lg tracking-wide text-white">
              Go to a page
            </h2>
            <button
              onClick={() => setPickerOpen(false)}
              aria-label="Close"
              className="rounded border border-white/20 px-3 py-1.5 text-sm text-white/70 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div
            className="grid flex-1 auto-rows-max grid-cols-3 gap-4 overflow-y-auto px-6 pb-8 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8"
            onClick={(e) => e.stopPropagation()}
          >
            {pages.map((page, i) => {
              const showHeader =
                hasChapters &&
                (i === 0 || pages[i - 1].chapterTitle !== page.chapterTitle);

              return (
                <Fragment key={page.id}>
                  {showHeader && (
                    <h3 className="col-span-full mt-2 first:mt-0 font-display text-sm tracking-wide text-white/60">
                      {page.chapterTitle ?? "No chapter"}
                    </h3>
                  )}
                  <button
                    onClick={() => jumpToPage(i)}
                    className={`overflow-hidden rounded border-2 text-left transition ${
                      i === pageIndex
                        ? "border-accent"
                        : "border-transparent hover:border-white/30"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={page.thumbnailUrl ?? page.imageUrl}
                      alt={`Page ${i + 1}`}
                      loading="lazy"
                      className="aspect-[3/4] w-full bg-white/5 object-cover"
                    />
                    <span className="block bg-black/60 py-1 text-center text-xs text-white/70">
                      {i + 1}
                    </span>
                  </button>
                </Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
