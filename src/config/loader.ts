import { z } from "zod";
import { FacilityConfig } from "./schema";

export type LoadResult =
  | { ok: true; config: FacilityConfig }
  | { ok: false; errors: string[]; raw?: unknown };

export async function loadConfig(tenant: string): Promise<LoadResult> {
  const safeTenant = tenant.replace(/[^a-z0-9_-]/gi, "");
  const url = `${import.meta.env.BASE_URL}config/${safeTenant}.json`;
  let raw: unknown;
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) {
      return {
        ok: false,
        errors: [`Could not load config "${safeTenant}.json" (HTTP ${res.status}).`],
      };
    }
    raw = await res.json();
  } catch (err) {
    return {
      ok: false,
      errors: [
        `Failed to fetch config "${safeTenant}.json": ${(err as Error).message}`,
      ],
    };
  }

  const parsed = FacilityConfig.safeParse(raw);
  if (parsed.success) {
    return { ok: true, config: parsed.data };
  }
  return {
    ok: false,
    errors: formatZodErrors(parsed.error).slice(0, 5),
    raw,
  };
}

function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}

export function getTenantFromQuery(): string {
  if (typeof window === "undefined") return "default";
  const params = new URLSearchParams(window.location.search);
  return params.get("tenant") ?? "default";
}
