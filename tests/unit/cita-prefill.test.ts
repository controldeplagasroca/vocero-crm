import { describe, expect, it } from "vitest";
import { duracionPorPlaga, prefillDesdeFicha } from "@/lib/cita-prefill";

const contacto = { id: "c1", name: "Ethel", phone: "525517979317" };

describe("prefillDesdeFicha", () => {
  it("toma la dirección, la plaga y la cotización que Nea dejó en la ficha", () => {
    const p = prefillDesdeFicha(contacto, {
      plaga: "Chinches de cama",
      direccion: "Vértiz 2200, Portales, Benito Juárez",
      cotizacion: "$1,500 MXN por visita (2 colchones)",
    });
    expect(p.title).toBe("Fumigación — Chinches de cama — Ethel");
    expect(p.address).toBe("Vértiz 2200, Portales, Benito Juárez");
    expect(p.durationMin).toBe(150);
    expect(p.notes).toContain("Teléfono: +525517979317");
    expect(p.notes).toContain("Cotización: $1,500 MXN por visita (2 colchones)");
    expect(p.contact).toEqual(contacto);
  });

  it("usa geo si no hay dirección y no inventa nada si la ficha está vacía", () => {
    expect(prefillDesdeFicha(contacto, { geo: "Del Valle CP 03100" }).address).toBe("Del Valle CP 03100");
    const vacio = prefillDesdeFicha(contacto, {});
    expect(vacio.address).toBe("");
    expect(vacio.title).toBe("Fumigación — Ethel");
    expect(vacio.durationMin).toBe(60);
  });
});

describe("duracionPorPlaga", () => {
  it("coincide con los minutos que bloquea Nea", () => {
    expect(duracionPorPlaga("Cucaracha alemana")).toBe(90);
    expect(duracionPorPlaga("Hormiga común")).toBe(120);
    expect(duracionPorPlaga("Pulgas")).toBe(100);
    expect(duracionPorPlaga("Alacrán")).toBe(150);
  });
});
