"use client";

// Progresso di lettura salvato lato client (localStorage), non sul server:
// non ci sono account lettore in questo sito (un solo admin, vedi
// PROJECT.md), quindi non c'è a chi legare un progresso lato server.
// Vive per browser/dispositivo, non sincronizzato tra dispositivi diversi.
const STORAGE_KEY = "broken-panel:reading-progress";

type ProgressMap = Record<string, { pageIndex: number; savedAt: number }>;

function readAll(): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

function writeAll(map: ProgressMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage non disponibile (modalità privata, quota piena, ecc.):
    // il progresso semplicemente non viene salvato, nessun errore da mostrare.
  }
}

export function getReadingProgress(slug: string): number | null {
  const entry = readAll()[slug];
  return entry ? entry.pageIndex : null;
}

export function saveReadingProgress(slug: string, pageIndex: number): void {
  const all = readAll();
  all[slug] = { pageIndex, savedAt: Date.now() };
  writeAll(all);
}

export function clearReadingProgress(slug: string): void {
  const all = readAll();
  delete all[slug];
  writeAll(all);
}
