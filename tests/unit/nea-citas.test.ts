import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ NEA_BASE_URL: "https://nea.test/", NEA_API_SECRET: "s3creto" }),
}));

import { isNeaConfigured, listarCitasPendientes, NeaError, resolverCita } from "@/server/nea-citas";

const fetchMock = vi.fn();

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => fetchMock.mockReset());

function responde(status: number, cuerpo: unknown) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(cuerpo), { status }));
}

describe("nea-citas", () => {
  it("está configurada con URL y secreto", () => {
    expect(isNeaConfigured()).toBe(true);
  });

  it("lista las citas de una conversación mandando el secreto", async () => {
    responde(200, { citas: [{ id: 7 }] });
    const citas = await listarCitasPendientes("cv_1");
    expect(citas).toEqual([{ id: 7 }]);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://nea.test/vocero/citas-pendientes?conversationId=cv_1");
    expect((init as RequestInit).headers).toMatchObject({ "x-vocero-secret": "s3creto" });
  });

  it("aprobar pide el texto de vuelta y lo regresa", async () => {
    responde(200, { ok: true, estado: "aprobado", textoCliente: "¡Confirmado! ✅" });
    const r = await resolverCita(7, "aprobar", { devolverTexto: true });
    expect(r.textoCliente).toBe("¡Confirmado! ✅");
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).toMatchObject({ accion: "aprobar", devolverTexto: true });
  });

  it("una cita ya resuelta por otra vía es un 409 claro", async () => {
    responde(409, { error: "ya_resuelta" });
    await expect(resolverCita(7, "aprobar")).rejects.toMatchObject({ status: 409, codigo: "ya_resuelta" });
  });

  it("si Nea no responde, 502 y no se cuelga", async () => {
    fetchMock.mockRejectedValueOnce(new Error("boom"));
    await expect(listarCitasPendientes()).rejects.toBeInstanceOf(NeaError);
  });
});
