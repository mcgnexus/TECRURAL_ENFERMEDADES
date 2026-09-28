"use client";

import { useState } from "react";
import Link from "next/link";
import { urlWhatsApp, whatsappDisponible } from "@/lib/contacto";
import { trackEvento } from "@/lib/analitica";
import { obtenerUtm } from "@/lib/utm";
import { textosLead, avisoFotos } from "@/lib/textos-lead";
import type {
  ContextoDiagnosticoLead,
  OrigenLead,
} from "@/types/lead";

interface LeadFormProps {
  origen: OrigenLead;
  diagnosticoId?: string;
  contexto?: ContextoDiagnosticoLead;
  prefill?: {
    cultivo?: string;
    municipio?: string;
    variedad?: string;
    sintoma?: string;
  };
  mensajeInicial?: string;
  /** Fotos del análisis como data URL completo (WebP o JPEG) para adjuntar a la revisión */
  adjuntarFotos?: string[];
}

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold text-[var(--tr-text-body)] transition-all duration-200 ";
const btnPrimary = `${btnBase} bg-tr-green-strong text-white hover:bg-tr-forest active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;
const btnSecondary = `${btnBase} bg-tr-surface text-tr-ink border border-tr-line hover:bg-tr-paper active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`;
const cardStyles = "bg-tr-surface rounded-[var(--tr-radius-card)] border border-tr-line shadow-[var(--tr-shadow-card)]";
const inputCls = "w-full px-3 py-2.5 rounded-[var(--tr-radius-control)] border border-tr-line bg-tr-paper text-tr-ink font-body text-body placeholder:text-tr-muted focus:border-tr-brand-green focus:bg-tr-surface disabled:opacity-50";
const labelCls = "block font-body font-semibold text-tr-forest text-small mb-1.5";

type EstadoEnvio = "idle" | "enviando" | "ok" | "error";

export function LeadForm({
  origen,
  diagnosticoId,
  contexto,
  prefill,
  mensajeInicial = "",
  adjuntarFotos,
}: LeadFormProps) {
  const [estado, setEstado] = useState<EstadoEnvio>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<{ telefono?: string; solicitud?: string }>({});
  const [form, setForm] = useState({
    nombre: "",
    telefono: "",
    municipio: prefill?.municipio ?? "",
    cultivo: prefill?.cultivo ?? "",
    sintoma: "",
    canalContacto: "llamada",
    mensaje: mensajeInicial,
    solicitudRespuesta: false,
    consentimientoComercial: false, // siempre desmarcado por defecto
    web: "",
  });

  const set = (campo: string, valor: string | boolean) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const TELEFONO_REGEX = /^[+]?[\d\s().-]{9,20}$/;

  const validar = (): boolean => {
    const nuevos: { telefono?: string; solicitud?: string } = {};
    if (!TELEFONO_REGEX.test(form.telefono.trim())) {
      nuevos.telefono = "Introduce un teléfono válido (9-15 dígitos).";
    }
    if (!form.solicitudRespuesta) {
      nuevos.solicitud = "Confirma que solicitas una respuesta sobre este caso.";
    }
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const esDirecto = origen === "contacto_directo";
  const fotosAdjuntas = adjuntarFotos && adjuntarFotos.length > 0 ? adjuntarFotos : null;
  const numFotos = fotosAdjuntas?.length ?? 0;

  // Los textos viven en src/lib/textos-lead.ts, que es puro y por tanto
  // verificable: la variante posterior al diagnóstico no se renderiza sin
  // completar un análisis, así que la única forma de comprobarla es aislarla.
  const textos = textosLead(origen, numFotos);
  const aviso = avisoFotos(numFotos);

  const mensajeWhatsApp = (() => {
    const partes = ["Hola, he usado la app de diagnóstico de TecRural"];
    if (contexto?.especie) partes.push(`sobre ${contexto.especie}`);
    else if (form.cultivo.trim()) partes.push(`sobre ${form.cultivo.trim()}`);
    if (contexto?.gravedad && contexto.gravedad !== "leve") partes.push(`con un problema de gravedad ${contexto.gravedad}`);
    partes.push("y me gustaría que revisaran mi caso.");
    return partes.join(" ");
  })();

  /**
   * El contexto que se envía al servidor. Tras un diagnóstico ya viene montado
   * con especie, gravedad y tipo. Sin diagnóstico (página de contacto) hay que
   * construirlo con lo que la persona escribe, porque si se envía vacío el
   * servidor no tiene con qué cualificar el lead y lo deja siempre en "baja".
   */
  const contextoFinal: ContextoDiagnosticoLead | undefined = (() => {
    if (contexto) return contexto;
    const propio: ContextoDiagnosticoLead = {};
    if (form.municipio.trim()) propio.municipio = form.municipio.trim();
    if (form.cultivo.trim()) propio.cultivo = form.cultivo.trim();
    const sintoma = form.sintoma.trim();
    if (sintoma) propio.sintoma = sintoma;
    return Object.keys(propio).length > 0 ? propio : undefined;
  })();

  const sintomaFinal = prefill?.sintoma || contexto?.sintoma || form.sintoma.trim() || undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (estado === "enviando") return;
    if (!validar()) return;

    setEstado("enviando");
    setError(null);

    try {
      const utm = obtenerUtm();
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim() || undefined,
          telefono: form.telefono.trim(),
          municipio: form.municipio.trim() || undefined,
          cultivo: form.cultivo.trim() || undefined,
          sintoma: sintomaFinal,
          mensaje: form.mensaje.trim() || undefined,
          diagnostico_id: diagnosticoId,
          origen,
          canal_contacto: form.canalContacto,
          solicitud_respuesta: form.solicitudRespuesta,
          consentimiento_comercial: form.consentimientoComercial,
          web: form.web,
          contexto: contextoFinal,
          utm: Object.keys(utm).length > 0 ? utm : undefined,
          imagenes: fotosAdjuntas ? fotosAdjuntas.slice(0, 3) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo enviar la solicitud");
      }

      setEstado("ok");
      trackEvento("lead_enviado", { origen, cultivo: form.cultivo || undefined });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      setEstado("error");
      trackEvento("lead_error", { origen });
    }
  };

  if (estado === "ok") {
    return (
      <div className={`p-5 ${cardStyles}`} aria-live="polite">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-tr-green-strong flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="font-heading font-semibold text-tr-forest">{textos.encabezadoExito}</p>
            <p className="mt-1 text-body text-tr-muted">{textos.cuerpoExito}</p>
            <p className="mt-2 text-small text-tr-muted">
              No podemos comprometer un plazo concreto de respuesta; depende de la demanda del
              servicio.
            </p>
            {whatsappDisponible && (
              <a
                href={urlWhatsApp(mensajeWhatsApp)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvento("whatsapp_click", { origen, momento: "post_lead" })}
                className={`${btnSecondary} mt-4`}
              >
                <svg className="w-5 h-5 text-tr-green-strong" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.06c-.25.69-1.45 1.32-2 1.37-.55.05-1.05.24-3.53-.74-2.99-1.18-4.86-4.28-5.01-4.48-.15-.2-1.19-1.59-1.19-3.03 0-1.44.75-2.15 1.02-2.44.27-.3.59-.37.79-.37.2 0 .39 0 .57.01.18.01.43-.07.67.51.25.6.84 2.06.91 2.21.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.61.17.3.76 1.26 1.64 2.04 1.13 1 2.07 1.31 2.37 1.46.3.15.47.12.65-.07.17-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.71.81 2 .95.3.15.5.22.57.35.07.12.07.72-.18 1.41z" />
                </svg>
                ¿Prefieres WhatsApp? Escríbenos ahora
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`p-5 ${cardStyles}`} noValidate>
      <h3 className="font-heading font-semibold text-tr-forest">{textos.cabecera}</h3>
      <p className="mt-1 text-small text-tr-muted">{textos.intro}</p>

      {aviso && (
        <p className="mt-3 p-3 bg-tr-paper border border-tr-line rounded-[var(--tr-radius-control)] text-caption text-tr-muted">
          {aviso}
        </p>
      )}

      {estado === "error" && error && (
        <div className="mt-4 p-3 border-l-4 border-tr-warning bg-tr-warning/5 text-tr-warning-text text-small rounded-[var(--tr-radius-control)]" role="alert">
          {error}
          {whatsappDisponible && (
            <>
              {" "}
              <a
                href={urlWhatsApp(mensajeWhatsApp)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvento("whatsapp_click", { origen, momento: "error" })}
                className="font-semibold underline hover:no-underline"
              >
                También puedes escribirnos por WhatsApp.
              </a>
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 mt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor={`lead-nombre-${origen}`} className={labelCls}>
              Nombre <span className="font-normal text-tr-muted">(opcional)</span>
            </label>
            <input
              id={`lead-nombre-${origen}`}
              type="text"
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              disabled={estado === "enviando"}
              autoComplete="name"
              className={inputCls}
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <label htmlFor={`lead-telefono-${origen}`} className={labelCls}>Teléfono / WhatsApp *</label>
            <input
              id={`lead-telefono-${origen}`}
              type="tel"
              required
              inputMode="tel"
              value={form.telefono}
              onChange={(e) => {
                set("telefono", e.target.value);
                if (errores.telefono) setErrores((x) => ({ ...x, telefono: undefined }));
              }}
              disabled={estado === "enviando"}
              autoComplete="tel"
              aria-invalid={errores.telefono ? "true" : undefined}
              aria-describedby={errores.telefono ? `lead-telefono-error-${origen}` : undefined}
              className={`${inputCls} ${errores.telefono ? "border-tr-warning-text" : ""}`}
              placeholder="Ej: 600 123 456"
            />
            {errores.telefono && (
              <p id={`lead-telefono-error-${origen}`} className="mt-1 text-small text-tr-warning-text" role="alert">
                {errores.telefono}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor={`lead-municipio-${origen}`} className={labelCls}>Municipio</label>
            <input
              id={`lead-municipio-${origen}`}
              type="text"
              value={form.municipio}
              onChange={(e) => set("municipio", e.target.value)}
              disabled={estado === "enviando"}
              className={inputCls}
              placeholder="Tu zona"
            />
          </div>
          <div>
            <label htmlFor={`lead-cultivo-${origen}`} className={labelCls}>Cultivo</label>
            <input
              id={`lead-cultivo-${origen}`}
              type="text"
              value={form.cultivo}
              onChange={(e) => set("cultivo", e.target.value)}
              disabled={estado === "enviando"}
              className={inputCls}
              placeholder="Tu cultivo"
            />
          </div>
        </div>

        <div>
          <label htmlFor={`lead-canal-${origen}`} className={labelCls}>¿Cómo prefieres que te contactemos?</label>
          <select
            id={`lead-canal-${origen}`}
            value={form.canalContacto}
            onChange={(e) => set("canalContacto", e.target.value)}
            disabled={estado === "enviando"}
            className={inputCls}
          >
            <option value="llamada">Llamada telefónica</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>

        {/* Sin diagnóstico detrás (página de contacto) el técnico no sabe qué
            le pasa al cultivo. Este campo sustituye a las hectáreas: es lo que
            el pequeño agricultor sí sabe describir. */}
        {!contexto?.sintoma && !prefill?.sintoma && (
          <div>
            <label htmlFor={`lead-sintoma-${origen}`} className={labelCls}>
              ¿Qué has observado en el cultivo? <span className="font-normal text-tr-muted">(opcional)</span>
            </label>
            <textarea
              id={`lead-sintoma-${origen}`}
              rows={2}
              value={form.sintoma}
              onChange={(e) => set("sintoma", e.target.value)}
              disabled={estado === "enviando"}
              className={`${inputCls} resize-none`}
              placeholder="Por ejemplo: hojas con manchas marrones desde hace dos semanas"
            />
          </div>
        )}

        <div>
          <label htmlFor={`lead-mensaje-${origen}`} className={labelCls}>
            ¿Algo más que debamos saber? <span className="font-normal text-tr-muted">(opcional)</span>
          </label>
          <textarea
            id={`lead-mensaje-${origen}`}
            rows={2}
            value={form.mensaje}
            onChange={(e) => set("mensaje", e.target.value)}
            disabled={estado === "enviando"}
            className={`${inputCls} resize-none`}
            placeholder="Opcional: cuéntanos brevemente el problema"
          />
        </div>

        {/* Honeypot anti-spam: oculto para personas */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor={`lead-web-${origen}`}>Web</label>
          <input
            id={`lead-web-${origen}`}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={form.web}
            onChange={(e) => set("web", e.target.value)}
          />
        </div>

        {/* Confirmación de solicitud: separada del consentimiento comercial */}
        <div className="flex items-start gap-2.5 p-3 bg-tr-paper rounded-[var(--tr-radius-control)] border border-tr-line">
          <input
            id={`lead-solicitud-${origen}`}
            type="checkbox"
            required
            checked={form.solicitudRespuesta}
            onChange={(e) => {
              set("solicitudRespuesta", e.target.checked);
              if (errores.solicitud) setErrores((x) => ({ ...x, solicitud: undefined }));
            }}
            disabled={estado === "enviando"}
            aria-invalid={errores.solicitud ? "true" : undefined}
            aria-describedby={errores.solicitud ? `lead-solicitud-error-${origen}` : undefined}
            className="mt-1 h-4 w-4 flex-shrink-0 accent-[var(--tr-brand-green)]"
          />
          <div className="flex-1">
            <label htmlFor={`lead-solicitud-${origen}`} className="text-caption text-tr-muted leading-relaxed">
              Confirmo que solicito que TecRural revise este caso y me responda al teléfono
              indicado. Trataremos tus datos ({textos.datosTratados})
              para gestionar esta solicitud y no los cederemos con fines publicitarios. *
            </label>
            {errores.solicitud && (
              <p id={`lead-solicitud-error-${origen}`} className="mt-1 text-small text-tr-warning-text" role="alert">
                {errores.solicitud}
              </p>
            )}
          </div>
        </div>

        {/* Consentimiento comercial: opcional, desmarcado por defecto */}
        <div className="flex items-start gap-2.5 p-3 bg-tr-paper rounded-[var(--tr-radius-control)] border border-tr-line">
          <input
            id={`lead-comercial-${origen}`}
            type="checkbox"
            checked={form.consentimientoComercial}
            onChange={(e) => set("consentimientoComercial", e.target.checked)}
            disabled={estado === "enviando"}
            className="mt-1 h-4 w-4 flex-shrink-0 accent-[var(--tr-brand-green)]"
          />
          <label htmlFor={`lead-comercial-${origen}`} className="text-caption text-tr-muted leading-relaxed">
            Quiero recibir por WhatsApp consejos y novedades comerciales de TecRural. Puedo
            retirar este consentimiento cuando quiera
            {" "}(<Link href="/baja" className="underline hover:no-underline">darse de baja</Link>).
          </label>
        </div>

        <button
          type="submit"
          disabled={estado === "enviando" || !form.solicitudRespuesta}
          className={`${btnPrimary} w-full py-3`}
        >
          {estado === "enviando" ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              Enviando...
            </>
          ) : (
            "Enviar solicitud de revisión"
          )}
        </button>

        <p className="text-caption text-tr-muted text-center">
          Enviar esta solicitud no implica ninguna contratación ni coste.
        </p>
      </div>
    </form>
  );
}
