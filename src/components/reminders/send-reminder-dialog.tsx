"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TemplateDto = {
  id: string;
  name: string;
  body: string;
};

type ClientRow = {
  clientId: string;
  fullName: string;
  phone: string;
};

function countPlaceholders(body: string): number {
  const matches = body.match(/\{\{\d+\}\}/g);
  return matches ? new Set(matches).size : 0;
}

/** Envío manual de un recordatorio — elige plantilla aprobada y llena sus
 * variables (precargadas con el nombre del cliente cuando aplica). */
export function SendReminderDialog({
  client,
  templates,
  onClose,
  onSent,
}: {
  client: ClientRow;
  templates: TemplateDto[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const template = templates.find((t) => t.id === templateId) ?? null;
  const placeholderCount = template ? countPlaceholders(template.body) : 0;
  const [variables, setVariables] = useState<string[]>(
    placeholderCount > 0 ? [client.fullName, ...Array(placeholderCount - 1).fill("")] : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    const n = t ? countPlaceholders(t.body) : 0;
    setVariables(n > 0 ? [client.fullName, ...Array(n - 1).fill("")] : []);
  }

  async function enviar() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/reminders/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: client.clientId,
        phone: client.phone,
        fullName: client.fullName,
        templateId,
        variables,
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(data?.error?.message ?? "No se pudo enviar el recordatorio");
      return;
    }
    onSent();
  }

  if (templates.length === 0) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
        onClick={onClose}
      >
        <div
          role="dialog"
          className="w-full max-w-md rounded-lg border bg-card p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="mb-2 font-semibold">Sin plantillas aprobadas</h3>
          <p className="text-sm text-text-3">
            Para mandar un recordatorio por WhatsApp fuera de la ventana de 24h se necesita una
            plantilla aprobada por Meta. Crea una en Ajustes → Plantillas y espera su aprobación.
          </p>
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Enviar recordatorio"
        className="w-full max-w-md rounded-lg border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 font-semibold">Enviar recordatorio</h3>
        <p className="mb-4 text-xs text-text-3">
          A {client.fullName} ({client.phone})
        </p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sr-template">Plantilla</Label>
            <select
              id="sr-template"
              value={templateId}
              onChange={(e) => selectTemplate(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {template && <p className="text-[11px] text-text-3">{template.body}</p>}
          </div>

          {variables.map((v, i) => (
            <div className="space-y-1.5" key={i}>
              <Label htmlFor={`sr-var-${i}`}>{`Variable {{${i + 1}}}`}</Label>
              <Input
                id={`sr-var-${i}`}
                value={v}
                onChange={(e) => {
                  const next = [...variables];
                  next[i] = e.target.value;
                  setVariables(next);
                }}
              />
            </div>
          ))}
        </div>

        {error && <p className="mt-3 text-xs text-danger-text">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={saving || !templateId} onClick={() => void enviar()}>
            {saving ? "Enviando…" : "Enviar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
