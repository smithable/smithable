/** Refuse proxy sign-in HTML and incomplete host snapshots without replacing a draft. */
export async function readHostJson(response: Response): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error(
      "The editor host did not return project data. Check your connection or sign in, then retry.",
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("The editor host returned incomplete project data. Retry opening the look.");
  const data = value as Record<string, unknown>;
  if (!response.ok)
    throw new Error(
      typeof data.error === "string" ? data.error : "The project could not be opened.",
    );
  return data;
}

export function assertHostContext(value: Record<string, unknown>): void {
  if (
    typeof value.preview !== "string" ||
    !/^https?:$/.test(new URL(value.preview).protocol) ||
    !Array.isArray(value.frames) ||
    !value.frames.every(
      (f: unknown) =>
        !!f && typeof f === "object" && typeof (f as { label?: unknown }).label === "string",
    ) ||
    !Array.isArray(value.starters) ||
    !Array.isArray(value.themes) ||
    typeof value.project !== "boolean" ||
    typeof value.target !== "string"
  )
    throw new Error("The editor host returned incomplete project data. Retry opening the look.");
}
