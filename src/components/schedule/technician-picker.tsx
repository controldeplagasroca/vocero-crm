"use client";

import { useEffect, useState } from "react";
import { Plus, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type TechnicianDto = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
};

let cachedTechnicians: TechnicianDto[] | null = null;
const listeners = new Set<(t: TechnicianDto[]) => void>();

async function fetchTechnicians(): Promise<TechnicianDto[]> {
  const res = await fetch("/api/technicians").catch(() => null);
  if (!res?.ok) return cachedTechnicians ?? [];
  const data = (await res.json()) as { technicians: TechnicianDto[] };
  cachedTechnicians = data.technicians;
  listeners.forEach((l) => l(data.technicians));
  return data.technicians;
}

/** Roster de técnicos, compartido entre todos los widgets que lo usan en la
 * pantalla (evita pedirlo por evento cuando se renderiza una semana entera). */
export function useTechnicians() {
  const [technicians, setTechnicians] = useState<TechnicianDto[]>(cachedTechnicians ?? []);
  useEffect(() => {
    listeners.add(setTechnicians);
    if (!cachedTechnicians) void fetchTechnicians();
    return () => {
      listeners.delete(setTechnicians);
    };
  }, []);
  return { technicians, refetch: fetchTechnicians };
}

/**
 * Selector de técnico(s) para una cita — multi-selección con chips, más un
 * alta rápida cuando el roster todavía está vacío o falta alguien.
 */
export function TechnicianPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { technicians, refetch } = useTechnicians();
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  }

  async function crearTecnico() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    const res = await fetch("/api/technicians", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, phone: newPhone.trim() || undefined }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return;
    const data = (await res.json()) as { technician: TechnicianDto };
    await refetch();
    onChange([...selectedIds, data.technician.id]);
    setNewName("");
    setNewPhone("");
    setAddingNew(false);
  }

  const active = technicians.filter((t) => t.active);

  return (
    <div>
      {active.length === 0 && !addingNew && (
        <p className="mb-2 text-xs text-text-3">
          Todavía no tienes técnicos registrados.
        </p>
      )}
      {active.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {active.map((t) => {
            const on = selectedIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                aria-pressed={on}
                className={
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors " +
                  (on
                    ? "border-transparent bg-brand text-brand-fg"
                    : "bg-secondary text-text-2 hover:bg-accent")
                }
              >
                {t.name}
              </button>
            );
          })}
        </div>
      )}

      {!addingNew ? (
        <button
          type="button"
          onClick={() => setAddingNew(true)}
          className="mt-2 flex items-center gap-1 text-xs text-text-3 hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Agregar técnico nuevo
        </button>
      ) : (
        <div className="mt-2 space-y-1.5 rounded-md border bg-secondary/40 p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-text-2">
            <UserCog className="h-3.5 w-3.5" /> Nuevo técnico
          </div>
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre"
            className="h-8 text-xs"
          />
          <Input
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="WhatsApp (opcional)"
            className="h-8 text-xs"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              disabled={!newName.trim() || saving}
              onClick={() => void crearTecnico()}
            >
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAddingNew(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
