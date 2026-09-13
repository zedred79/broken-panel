export function readerProgressPercent(
  pages: readonly { panels: readonly unknown[] }[],
  pageIndex: number,
  panelIndex: number
): number {
  // Una tappa per la tavola intera, più una per ogni vignetta effettiva.
  const totalSteps = pages.reduce((sum, page) => sum + page.panels.length + 1, 0);
  const stepsBefore = pages.slice(0, pageIndex)
    .reduce((sum, page) => sum + page.panels.length + 1, 0);
  return totalSteps > 0 ? ((stepsBefore + panelIndex + 2) / totalSteps) * 100 : 0;
}
