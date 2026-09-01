"use client";

import { useEffect, useState } from "react";
import { BellRing, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SendReminderDialog } from "@/components/reminders/send-reminder-dialog";
import { cn } from "@/lib/utils";

type ReminderClient = {
  clientId: string;
  fullName: string;
  phone: string;
  nextTreatmentDate: string | null;
  status: string;
};

type TemplateDto = { id: string; name: string; body: string };

type Data = {
  overdue: ReminderClient[];
  upcoming: ReminderClient[];
  settings: { autoSend: boolean; templateId: string | null };
  approvedTemplates: TemplateDto[];
};

export function RemindersClient() {
  const [data, setData] = useState<Data | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<ReminderClient | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  async function refetch() {
    setError(null);
    const res = await fetch("/api/reminders").catch(() => null);
    if (!res) {
      setError("No se pudo conectar con el servidor.");
      return;
    }
    if (res.status === 503) {
      setNotConfigured(true);
      return;
    }
    if (!res.ok) {
      setError("No se pudieron cargar los recordatorios.");
      return;
    }
    setData((await res.json()) as Data);
  }

  useEffect(() => {
    void refetch();
  }, []);

  async function updateSettings(next: { autoSend: boolean; templateId: string | null }) {
    if (!data) return;
    setSavingSettings(true);
    setError(null);
    const res = await fetch("/api/reminders/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => null);
    setSavingSettings(false);
    if (!res?.ok) {
      const body = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "No se pudo guardar el ajuste");
      return;
    }
    setData({ ...data, settings: next });
  }

  if (notConfigured) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <BellRing className="h-10 w-10 text-text-3" strokeWidth={1.5} />
        <h1 className="text-lg font-semibold">Recordatorios sin configurar</h1>
        <p className="max-w-md text-sm text-text-3">
          Falta <code>ROCA_OPS_BASE_URL</code> y <code>REMINDERS_API_SECRET</code> en las
          variables de entorno — la conexión con el panel de operaciones (roca-ops-backend) que
          sabe qué cliente está por vencer.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Recordatorios</h1>
          <p className="text-xs text-text-3">
            Clientes por vencer o vencidos en roca-ops-backend.
          </p>
        </div>

        {data && (
          <div className="flex items-center gap-2">
            <select
              value={data.settings.templateId ?? ""}
              onChange={(e) =>
                void updateSettings({ ...data.settings, templateId: e.target.value || null })
              }
              disabled={savingSettings}
              className="h-9 rounded-md border border-input bg-card px-2 text-sm"
            >
              <option value="">Sin plantilla para automático</option>
              {data.approvedTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={savingSettings || !data.settings.templateId}
              onClick={() =>
                void updateSettings({ ...data.settings, autoSend: !data.settings.autoSend })
              }
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                data.settings.autoSend
                  ? "border-transparent bg-brand text-brand-fg"
                  : "text-text-2 hover:bg-accent"
              )}
              title={
                data.settings.templateId
                  ? undefined
                  : "Elige una plantilla para poder activar el envío automático"
              }
            >
              Automático: {data.settings.autoSend ? "Encendido" : "Apagado"}
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {error && <p className="mb-4 text-sm text-danger-text">{error}</p>}
        {!data && !error && <p className="text-sm text-text-3">Cargando…</p>}

        {data && (
          <div className="space-y-8">
            <Section
              title="Vencidos"
              variant="destructive"
              clients={data.overdue}
              onSend={setSending}
            />
            <Section
              title="Por vencer (próximos 7 días)"
              variant="warning"
              clients={data.upcoming}
              onSend={setSending}
            />
          </div>
        )}
      </div>

      {sending && data && (
        <SendReminderDialog
          client={sending}
          templates={data.approvedTemplates}
          onClose={() => setSending(null)}
          onSent={() => {
            setSending(null);
            void refetch();
          }}
        />
      )}
    </div>
  );
}

function Section({
  title,
  variant,
  clients,
  onSend,
}: {
  title: string;
  variant: "destructive" | "warning";
  clients: ReminderClient[];
  onSend: (c: ReminderClient) => void;
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {clients.length === 0 ? (
        <p className="text-sm text-text-3">Ninguno.</p>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <div
              key={c.clientId}
              className="flex items-center justify-between gap-3 rounded-md border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.fullName}</p>
                <p className="text-xs text-text-3">
                  {c.phone}
                  {c.nextTreatmentDate ? ` · próximo servicio: ${c.nextTreatmentDate}` : ""}
                </p>
                <Badge className="mt-1.5" variant={variant}>
                  {c.status}
                </Badge>
              </div>
              <Button size="sm" variant="secondary" onClick={() => onSend(c)}>
                <Send className="h-4 w-4" /> Enviar recordatorio
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
