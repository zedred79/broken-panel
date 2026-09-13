export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body !== null && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

type PanelInput = { points: { x: number; y: number }[] };

export function isValidPanel(panel: unknown): panel is PanelInput {
  if (panel === null || typeof panel !== "object" || !("points" in panel)) return false;
  return Array.isArray(panel.points) && panel.points.length >= 3 &&
    panel.points.every((point: unknown) =>
      point !== null && typeof point === "object" &&
      "x" in point && "y" in point &&
      typeof point.x === "number" && typeof point.y === "number" &&
      Number.isFinite(point.x) && Number.isFinite(point.y) &&
      point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100
    );
}
