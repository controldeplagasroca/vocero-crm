import { describe, expect, it } from "vitest";
import {
  colorParaTecnico,
  descripcionConTecnico,
  PALETA_COLORES,
  tituloConTecnico,
  ultimos10,
} from "@/lib/technician-label";

describe("technician-label", () => {
  it("pone el nombre en el título sin duplicarlo al reasignar", () => {
    const uno = tituloConTecnico("Fumigación — Chinches — Ethel", "Juan");
    expect(uno).toBe("Fumigación — Chinches — Ethel · 👷 Juan");
    expect(tituloConTecnico(uno, "Pedro")).toBe("Fumigación — Chinches — Ethel · 👷 Pedro");
    expect(tituloConTecnico(uno, null)).toBe("Fumigación — Chinches — Ethel");
  });

  it("pone «Técnico:» arriba de la descripción y respeta el bloque de OPS", () => {
    const base = 'Agendado por Nea (aprobado).\n\n---ROCA-OPS-DATA---\n{"plaga":"chinches"}';
    const con = descripcionConTecnico(base, "Juan");
    expect(con.startsWith("Técnico: Juan\n")).toBe(true);
    expect(con).toContain('---ROCA-OPS-DATA---\n{"plaga":"chinches"}');
    expect(descripcionConTecnico(con, "Pedro").match(/Técnico:/g)).toHaveLength(1);
    expect(descripcionConTecnico(con, null)).toBe(base);
    expect(descripcionConTecnico(null, "Juan")).toBe("Técnico: Juan\n");
  });

  it("cada técnico tiene su color y no se repite con menos de 10", () => {
    const ids = ["a", "b", "c", "d"];
    const colores = ids.map((id) => colorParaTecnico(id, ids));
    expect(new Set(colores).size).toBe(4);
    expect(colorParaTecnico("b", ids)).toBe(colores[1]);
    expect(PALETA_COLORES).not.toContain("8");
  });

  it("empareja teléfonos con distinto formato", () => {
    expect(ultimos10("+52 1 55 1234 5678")).toBe("5512345678");
    expect(ultimos10("5512345678")).toBe(ultimos10("525512345678"));
    expect(ultimos10(null)).toBe("");
  });
});
