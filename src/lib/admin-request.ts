// Mutations whose callers only need to know whether the operation succeeded.
export async function adminRequest(url: string, init: RequestInit): Promise<void> {
  const response = await fetch(url, init);
  if (response.ok) return;

  const body: unknown = await response.json().catch(() => null);
  const message =
    body !== null && typeof body === "object" && "error" in body &&
    typeof body.error === "string"
      ? body.error
      : `Request failed (${response.status}). Please try again.`;
  throw new Error(message);
}

export function adminErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to complete the request. Please try again.";
}
