import { apiError, withAuth } from "@/lib/api";
import { isNeaConfigured, listarCitasPendientes, NeaError } from "@/server/nea-citas";

export const dynamic = "force-dynamic";

/** Citas por aprobar de una conversación (lo que Nea espera que alguien confirme). */
export const GET = withAuth(async (_session, req: Request) => {
  // Sin Nea conectada no es un error: simplemente no hay citas que mostrar.
  if (!isNeaConfigured()) return Response.json({ citas: [], conectada: false });
  const conversationId = new URL(req.url).searchParams.get("conversationId") ?? undefined;
  try {
    return Response.json({ citas: await listarCitasPendientes(conversationId), conectada: true });
  } catch (e) {
    if (e instanceof NeaError) return apiError(e.status, e.codigo, e.message);
    throw e;
  }
});
