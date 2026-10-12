import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { NeaError, resolverCita } from "@/server/nea-citas";

export const dynamic = "force-dynamic";

const schema = z.object({
  accion: z.enum(["aprobar", "rechazar", "proponer"]),
  texto: z.string().trim().max(200).optional(),
  devolverTexto: z.boolean().optional(),
});

/** Aprueba, rechaza o propone otra hora para una cita por aprobar. */
export const POST = withAuth(
  async (_session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const citaId = Number(id);
    if (!Number.isInteger(citaId) || citaId <= 0) {
      return apiError(422, "invalid_id", "Folio de cita inválido");
    }
    const body = await parseBody(req, schema);
    if (!body.ok) return body.response;
    if (body.data.accion === "proponer" && !body.data.texto) {
      return apiError(422, "texto_requerido", "Escribe el día y la hora, por ejemplo «jueves 10 am»");
    }
    try {
      const r = await resolverCita(citaId, body.data.accion, {
        texto: body.data.texto,
        devolverTexto: body.data.devolverTexto,
      });
      return Response.json(r);
    } catch (e) {
      if (e instanceof NeaError) return apiError(e.status, e.codigo, e.message);
      throw e;
    }
  }
);
