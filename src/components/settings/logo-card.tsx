"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Trash2 } from "lucide-react";
import type { Branding } from "@/lib/branding";
import { LOGO_MIMES, MAX_LOGO_BYTES, logoHref } from "@/lib/logo";
import { initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Logo del lateral/encabezado — separado del icono de la pestaña
 * (`FaviconCard`): una agencia puede querer el logo completo (no
 * necesariamente cuadrado) en el lateral sin forzar ese mismo archivo como
 * favicon de 16-32px.
 */
export function LogoCard({ branding }: { branding: Branding }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [actual, setActual] = useState(branding.logo);

  const href = logoHref({ ...branding, logo: actual });
  const src = href ? `${href}&r=${rev}` : null;

  async function subir(file: File) {
    setError(null);
    if (file.size > MAX_LOGO_BYTES) {
      setError(`El logo no puede pasar de ${Math.round(MAX_LOGO_BYTES / 1024)} KB.`);
      return;
    }
    setSubiendo(true);
    const res = await fetch("/api/settings/branding/logo", {
      method: "PUT",
      headers: { "content-type": file.type || "application/octet-stream" },
      body: file,
    }).catch(() => null);
    setSubiendo(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(data?.error?.message ?? "No se pudo subir el logo");
      return;
    }
    const data = (await res.json()) as { logo: Branding["logo"] };
    setActual(data.logo);
    setRev((v) => v + 1);
    router.refresh(); // el lateral vuelve a leer la marca
  }

  async function quitar() {
    setError(null);
    setSubiendo(true);
    const res = await fetch("/api/settings/branding/logo", {
      method: "DELETE",
    }).catch(() => null);
    setSubiendo(false);
    if (!res?.ok) {
      setError("No se pudo quitar el logo");
      return;
    }
    setActual(null);
    setRev((v) => v + 1);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo del lateral</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt="Vista previa del logo"
              width={48}
              height={48}
              className="h-12 w-12 rounded-lg border bg-card object-contain"
            />
          ) : (
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand text-lg font-bold text-brand-fg"
              aria-hidden
            >
              {initials(branding.name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm">{actual ? "Logo propio" : "Inicial sobre tu color de acento"}</p>
            <p className="mt-0.5 text-xs text-text-3">
              {actual
                ? "Se usa en el lateral y el encabezado móvil. Puedes quitarlo para volver a la inicial."
                : "Sube un logo para reemplazar la inicial en el lateral y el encabezado móvil."}
            </p>
          </div>
        </div>

        <input
          ref={input}
          type="file"
          accept={LOGO_MIMES.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void subir(f);
          }}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={subiendo}
            onClick={() => input.current?.click()}
          >
            <ImageUp className="h-4 w-4" />
            {subiendo ? "Subiendo…" : actual ? "Cambiar logo" : "Subir logo"}
          </Button>
          {actual && (
            <Button variant="ghost" disabled={subiendo} onClick={() => void quitar()}>
              <Trash2 className="h-4 w-4" /> Quitar
            </Button>
          )}
        </div>

        <p className="text-xs text-text-3">
          PNG, SVG, JPEG o WebP, hasta {Math.round(MAX_LOGO_BYTES / 1024)} KB. Con fondo
          transparente se ve mejor.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
