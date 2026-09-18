import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireIntakeKey } from "@/server/leads/intake-auth";
import { resetRateLimit } from "@/lib/rate-limit";

/** La puerta de `/api/external/leads` — separada de BOT_API_KEY a propósito. */

const KEY = "clave-de-ingesta-larga-0123456789abcdef";

function reqWith(key?: string): Request {
  return new Request("http://localhost/api/external/leads", {
    method: "POST",
    headers: key ? { "x-api-key": key } : {},
  });
}

describe("requireIntakeKey", () => {
  beforeEach(() => {
    vi.stubEnv("LEAD_INTAKE_API_KEY", KEY);
    resetRateLimit();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("key correcta → pasa (null)", () => {
    expect(requireIntakeKey(reqWith(KEY))).toBeNull();
  });

  it("key incorrecta → 401", () => {
    const res = requireIntakeKey(reqWith("otra-clave-igual-de-larga-pero-mala!!"));
    expect(res?.status).toBe(401);
  });

  it("sin header → 401", () => {
    expect(requireIntakeKey(reqWith())?.status).toBe(401);
  });

  it("sin LEAD_INTAKE_API_KEY configurada → 401 SIEMPRE (aunque manden algo)", () => {
    vi.stubEnv("LEAD_INTAKE_API_KEY", "");
    expect(requireIntakeKey(reqWith("cualquier-cosa"))?.status).toBe(401);
  });

  it("key demasiado corta configurada → 401 (no se acepta una key débil)", () => {
    vi.stubEnv("LEAD_INTAKE_API_KEY", "corta");
    expect(requireIntakeKey(reqWith("corta"))?.status).toBe(401);
  });

  it("una BOT_API_KEY válida no sirve aquí (superficies separadas)", () => {
    vi.stubEnv("BOT_API_KEY", KEY);
    vi.stubEnv("LEAD_INTAKE_API_KEY", "otra-clave-de-ingesta-distinta-0123456789");
    expect(requireIntakeKey(reqWith(KEY))?.status).toBe(401);
  });
});
