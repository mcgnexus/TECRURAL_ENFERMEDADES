"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { urlWhatsApp, whatsappDisponible } from "@/lib/contacto";
import { trackEvento } from "@/lib/analitica";
import { trackMeta } from "@/components/MetaPixel";
import { obtenerUtm } from "@/lib/utm";
import { textosLead, avisoFotos } from "@/lib/textos-lead";
import type { ModoLead } from "@/lib/textos-lead";
import { LIMITE_AMPLIADO } from "@/lib/textos-publicos";
import { TEXTOS_COMERCIALES } from "@/lib/consentimiento-comercial";
import type {
  ContextoDiagnosticoLead,
  OrigenLead,
} from "@/types/lead";

interface LeadFormProps {
  origen: OrigenLead;
  diagnosticoId?: string;
  contexto?: ContextoDiagnosticoLead;
  /** Intención tras el diagnóstico: guardar el informe o pedir revisión. */
  modo?: ModoLead;
  prefill?: {
    cultivo?: string;
    municipio?: string;
    variedad?: string;
    sintoma?: string;
  };
  mensajeInicial?: string;
  /** Fotos del análisis como data URL completo (WebP o JPEG) para adjuntar a la revisión */
  adjuntarFotos?: string[];
  /** La entrega del enlace está configurada: los textos pueden mencionarla. */
  envioCorreoActivo?: boolean;
  /**
   * Se llama cuando el lead se ha guardado. `canal` indica si la persona dejó
   * un correo (y por tanto se le puede enviar el enlace) o solo un teléfono.
   */
  onEnviado?: (datos: { canal: "correo" | "telefono" }) => void;
}

const btnBase = "inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-[var(--tr-radius-control)] font-[var(--tr-font-body)] font-semibold transition-all duration-200 ";
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
  modo = "informe",
  prefill,
  mensajeInicial = "",
  adjuntarFotos,
  envioCorreoActivo = false,
  onEnviado,
}: LeadFormProps) {
  const [estado, setEstado] = useState<EstadoEnvio>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<{ telefono?: string; email?: string; contacto?: string; canal?: string; solicitud?: string; autorizacion?: string }>({});
  const [form, setForm] = useState({
    nombre: "",
    telefono: "",
    email: "",
    municipio: prefill?.municipio ?? "",
    cultivo: prefill?.cultivo ?? "",
    sintoma: "",
    // Sin preselección: el canal lo elige la persona. "llamada" como valor
    // inicial era una preferencia implícita que nadie había pedido.
    canalContacto: "",
    mensaje: mensajeInicial,
    // En "contacto_directo" es la casilla obligatoria de la solicitud. En el
    // flujo posterior al diagnóstico la intención la fija `modo`: solo la
    // revisión registra una solicitud de contacto.
    solicitudRespuesta: false,
    consentimientoWhatsapp: false, // siempre desmarcado por defecto
    // Modo informe: autorización obligatoria para usar el correo en el informe
    // y en el límite semanal, separada de las novedades comerciales.
    autorizoInforme: false,
    // Modo revisión: autorización obligatoria para gestionar la solicitud.
    autorizoRevision: false,
    // Novedades comerciales por correo: opt-in voluntario y desmarcado, separado
    // de la autorización del servicio. Solo se ofrece donde hay correo.
    consentimientoCorreo: false,
    web: "",
  });

  const set = (campo: string, valor: string | boolean) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const esDirecto = origen === "contacto_directo";
  /** Solo la revisión (o el contacto directo) registra una solicitud. */
  const esRevision = !esDirecto && modo === "revision";
  const solicitud = esDirecto || esRevision;
  const TELEFONO_REGEX = /^[+]?[\d\s().-]{9,20}$/;
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const telefono = form.telefono.trim();
  const correo = form.email.trim();

  /**
   * En el flujo posterior al diagnóstico las fotos solo viajan con la revisión
   * técnica: quien únicamente abre el informe no las comparte con nadie.
   */
  const fotosAdjuntas = adjuntarFotos && adjuntarFotos.length > 0 ? adjuntarFotos : null;
  const comparteFotos = esDirecto || esRevision;
  const numFotos = fotosAdjuntas?.length ?? 0;
  const numFotosEnviadas = comparteFotos ? numFotos : 0;
  const fotosParaEnviar = comparteFotos && fotosAdjuntas ? fotosAdjuntas.slice(0, 3) : undefined;

  // Los textos viven en src/lib/textos-lead.ts, que es puro y por tanto
  // verificable: la variante posterior al diagnóstico no se renderiza sin
  // completar un análisis, así que la única forma de comprobarla es aislarla.
  const textos = textosLead(
    origen,
    numFotosEnviadas,
    esDirecto ? "revision" : modo,
    envioCorreoActivo
  );
  const aviso = avisoFotos(numFotosEnviadas);

  const validar = (): boolean => {
    const nuevos: { telefono?: string; email?: string; contacto?: string; canal?: string; solicitud?: string; autorizacion?: string } = {};
    if (telefono && !TELEFONO_REGEX.test(telefono)) {
      nuevos.telefono = "Introduce un teléfono válido (9-15 dígitos).";
    }
    if (correo && !EMAIL_REGEX.test(correo)) {
      nuevos.email = "Introduce un correo válido (por ejemplo: nombre@dominio.com).";
    }

    if (esDirecto || esRevision) {
      // El canal se elige siempre; nada de llamada por defecto.
      if (!form.canalContacto) {
        nuevos.canal = "Elige cómo prefieres que te contactemos.";
      } else if (form.canalContacto === "correo") {
        if (!correo) nuevos.email = "Escribe el correo al que quieres que te respondamos.";
      } else if (!telefono) {
        nuevos.telefono = "Para llamada o WhatsApp, deja un teléfono (o elige que te escriban al correo).";
      }
    } else if (!correo) {
      nuevos.contacto = "Escribe tu correo para abrir el informe completo.";
    }

    if (esRevision && !form.autorizoRevision) {
      nuevos.autorizacion = "Confirma el uso de tus datos para gestionar la solicitud de revisión.";
    }
    if (!esDirecto && modo === "informe" && !form.autorizoInforme) {
      nuevos.autorizacion = "Confirma el uso del contacto para recibir el informe.";
    }
    if (esDirecto && !form.solicitudRespuesta) {
      nuevos.solicitud = "Confirma que solicitas una respuesta sobre este caso.";
    }

    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

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

    const utm = obtenerUtm();

    // Solo viaja el contacto del canal elegido. En el formulario de revisión,
    // elegir WhatsApp o llamada no debe guardar un correo escrito antes.
    const revisionSoloTelefono = esRevision && form.canalContacto !== "correo";
    const telefonoEnviar = revisionSoloTelefono
      ? undefined
      : form.telefono.trim() || undefined;
    const emailEnviar = revisionSoloTelefono
      ? undefined
      : form.email.trim() || undefined;

    // Canales comerciales explícitos: solo se envía el que se mostró y se
    // marcó. El canal de revisión (`canal_contacto`) no interviene aquí.
    const consentimientosComerciales: Array<{
      canal: "correo" | "whatsapp";
      texto_version: string;
    }> = [];
    if (esDirecto && form.consentimientoWhatsapp && telefono) {
      consentimientosComerciales.push({
        canal: "whatsapp",
        texto_version: TEXTOS_COMERCIALES.whatsapp.version,
      });
    }
    if (
      !esDirecto &&
      form.consentimientoCorreo &&
      correo &&
      (!esRevision || form.canalContacto === "correo")
    ) {
      consentimientosComerciales.push({
        canal: "correo",
        texto_version: TEXTOS_COMERCIALES.correo.version,
      });
    }

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim() || undefined,
          telefono: telefonoEnviar,
          email: emailEnviar,
          municipio: form.municipio.trim() || undefined,
          cultivo: form.cultivo.trim() || undefined,
          sintoma: sintomaFinal,
          // Sin revisión pedida no hay mensaje: el envío no es una solicitud
          // de contacto y no necesita notas para el técnico.
          mensaje: solicitud ? (form.mensaje.trim() || undefined) : undefined,
          diagnostico_id: diagnosticoId,
          origen,
          // Sin revisión pedida no hay canal: guardar el informe no es una
          // solicitud de contacto. El canal nunca se infiere del contacto.
          canal_contacto: solicitud ? (form.canalContacto || undefined) : undefined,
          solicitud_respuesta: solicitud,
          // Solo se envía el canal comercial que se mostró y se marcó.
          consentimientos_comerciales:
            consentimientosComerciales.length > 0
              ? consentimientosComerciales
              : undefined,
          web: form.web,
          contexto: contextoFinal,
          utm: Object.keys(utm).length > 0 ? utm : undefined,
          imagenes: fotosParaEnviar,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo enviar la solicitud");
      }

      setEstado("ok");
      trackEvento("lead_enviado", {
        origen,
        cultivo: form.cultivo || undefined,
        intencion: esDirecto ? "revision" : modo,
      });
      // Conversiones de Meta, separadas por valor comercial: Lead cubre el
      // contacto; los eventos personalizados matizan quién pide revisión y
      // quién autoriza novedades. Se disparan una sola vez, al confirmarse el
      // guardado, y sin datos personales en los parámetros.
      trackMeta("Lead", { origen });
      if (solicitud) trackMeta("RevisionTecnica", { origen });
      if (!esDirecto && form.consentimientoCorreo && Boolean(correo)) {
        trackMeta("SuscripcionCorreo", { origen });
      }
      const canalEntrega: "correo" | "telefono" =
        !esDirecto && (modo === "informe" || form.canalContacto === "correo")
          ? "correo"
          : "telefono";
      onEnviado?.({ canal: canalEntrega });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      setEstado("error");
      trackEvento("lead_error", { origen, intencion: esDirecto ? "revision" : modo });
    }
  };

  /** Paso de embudo: primera interacción con el formulario tras el resultado. */
  const interaccionRegistrada = useRef(false);
  const registrarInteraccion = () => {
    if (esDirecto || interaccionRegistrada.current) return;
    interaccionRegistrada.current = true;
    trackEvento("cta_revision_abierto", {
      intencion: modo,
      gravedad: contexto?.gravedad,
      requiere_experto: contexto?.requiere_experto,
      tipo: contexto?.tipo,
    });
  };

  if (estado === "ok") {
    const conRevision = solicitud;
    const ofrecerWhatsApp = conRevision && (esDirecto || form.canalContacto === "correo");
    return (
      <div className={`p-5 ${cardStyles}`} aria-live="polite">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-tr-green-strong flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="font-heading font-semibold text-tr-forest">{textos.encabezadoExito}</p>
            <p className="mt-1 text-body text-tr-muted">{textos.cuerpoExito}</p>
            {conRevision && (
              <p className="mt-2 text-small text-tr-muted">
                Un técnico de TecRural responderá en un plazo máximo de 48 horas por el canal que elegiste.
              </p>
            )}
            {ofrecerWhatsApp && whatsappDisponible && (
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
    <form onSubmit={handleSubmit} onFocusCapture={registrarInteraccion} className={`p-5 ${cardStyles}`} noValidate>
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

      {esDirecto ? (
        <FormularioDirecto
          origen={origen}
          form={form}
          set={set}
          errores={errores}
          setErrores={setErrores}
          estado={estado}
          textos={textos}
        />
      ) : modo === "revision" ? (
        <FormularioRevision
          origen={origen}
          form={form}
          set={set}
          errores={errores}
          setErrores={setErrores}
          estado={estado}
          textos={textos}
          envioCorreoActivo={envioCorreoActivo}
        />
      ) : (
        <FormularioInforme
          origen={origen}
          form={form}
          set={set}
          errores={errores}
          setErrores={setErrores}
          estado={estado}
          textos={textos}
          envioCorreoActivo={envioCorreoActivo}
        />
      )}
    </form>
  );
}

/* ------------------------------------------------------------------------- */
/* Campos comunes                                                            */
/* ------------------------------------------------------------------------- */

interface CampoBaseProps {
  origen: OrigenLead;
  form: {
    nombre: string;
    telefono: string;
    email: string;
    municipio: string;
    cultivo: string;
    sintoma: string;
    canalContacto: string;
    mensaje: string;
    solicitudRespuesta: boolean;
    consentimientoWhatsapp: boolean;
    consentimientoCorreo: boolean;
    autorizoInforme: boolean;
    autorizoRevision: boolean;
    web: string;
  };
  set: (campo: string, valor: string | boolean) => void;
  errores: { telefono?: string; email?: string; contacto?: string; canal?: string; solicitud?: string; autorizacion?: string };
  setErrores: React.Dispatch<React.SetStateAction<{ telefono?: string; email?: string; contacto?: string; canal?: string; solicitud?: string; autorizacion?: string }>>;
  estado: EstadoEnvio;
}

interface CamposProps extends CampoBaseProps {
  textos: { datosTratados: string };
  envioCorreoActivo?: boolean;
}

function CampoCorreo({ origen, form, set, errores, setErrores, estado, conTelefono }: CampoBaseProps & { conTelefono: boolean }) {
  return (
    <div>
      <label htmlFor={`lead-email-${origen}`} className={labelCls}>
        Correo electrónico {conTelefono && <span className="font-normal text-tr-muted">(opcional si dejas el teléfono)</span>}
      </label>
      <input
        id={`lead-email-${origen}`}
        type="email"
        inputMode="email"
        value={form.email}
        onChange={(e) => {
          set("email", e.target.value);
          // Sin correo no hay dirección a la que enviar novedades: la casilla
          // no puede quedar marcada y el servidor la rechazaría.
          if (!e.target.value.trim() && form.consentimientoCorreo) {
            set("consentimientoCorreo", false);
          }
          if (errores.email || errores.contacto || errores.canal) {
            setErrores((x) => ({ ...x, email: undefined, contacto: undefined, canal: undefined }));
          }
        }}
        disabled={estado === "enviando"}
        autoComplete="email"
        aria-invalid={errores.email ? "true" : undefined}
        aria-describedby={errores.email ? `lead-email-error-${origen}` : undefined}
        className={`${inputCls} ${errores.email ? "border-tr-warning-text" : ""}`}
        placeholder="Ej: nombre@correo.com"
      />
      {errores.email && (
        <p id={`lead-email-error-${origen}`} className="mt-1 text-small text-tr-warning-text" role="alert">
          {errores.email}
        </p>
      )}
    </div>
  );
}

function CampoTelefono({ origen, form, set, errores, setErrores, estado, etiquetaOpcional }: CampoBaseProps & { etiquetaOpcional: string }) {
  return (
    <div>
      <label htmlFor={`lead-telefono-${origen}`} className={labelCls}>
        Teléfono / WhatsApp <span className="font-normal text-tr-muted">({etiquetaOpcional})</span>
      </label>
      <input
        id={`lead-telefono-${origen}`}
        type="tel"
        inputMode="tel"
        value={form.telefono}
        onChange={(e) => {
          set("telefono", e.target.value);
          if (errores.telefono || errores.contacto || errores.canal) {
            setErrores((x) => ({ ...x, telefono: undefined, contacto: undefined, canal: undefined }));
          }
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
  );
}

/* ------------------------------------------------------------------------- */
/* Flujo posterior al diagnóstico: dos intenciones separadas                  */
/* ------------------------------------------------------------------------- */

function FormularioInforme({ origen, form, set, errores, setErrores, estado, textos, envioCorreoActivo = false }: CamposProps) {
  const correo = form.email.trim();
  return (
    <div className="grid gap-4 mt-4">
      <CampoCorreo origen={origen} form={form} set={set} errores={errores} setErrores={setErrores} estado={estado} conTelefono={false} />

      {/* Sin correo no hay forma de abrir el informe ni de ampliar el límite. */}
      {errores.contacto && (
        <p className="text-small text-tr-warning-text" role="alert">
          {errores.contacto}
        </p>
      )}

      {/* Autorización de uso del correo, separada de la revisión técnica y de
          las novedades: abrir el informe no implica que un técnico contacte. */}
      <div className="flex items-start gap-3 p-4 bg-tr-paper rounded-[var(--tr-radius-control)] border border-tr-line">
        <input
          id={`lead-autorizacion-${origen}`}
          type="checkbox"
          required
          checked={form.autorizoInforme}
          onChange={(e) => {
            set("autorizoInforme", e.target.checked);
            if (errores.autorizacion) setErrores((x) => ({ ...x, autorizacion: undefined }));
          }}
          disabled={estado === "enviando"}
          aria-invalid={errores.autorizacion ? "true" : undefined}
          aria-describedby={errores.autorizacion ? `lead-autorizacion-error-${origen}` : undefined}
          className="mt-1 h-5 w-5 flex-shrink-0 accent-[var(--tr-brand-green)]"
        />
        <div className="flex-1">
          <label htmlFor={`lead-autorizacion-${origen}`} className="block text-small text-tr-ink leading-relaxed">
            <span className="block font-semibold">
              {envioCorreoActivo
                ? `Entiendo que TecRural usará mi correo para mostrarme el informe, ampliar el límite a ${LIMITE_AMPLIADO} y enviarme el enlace de recuperación; no para contactarme ni para publicidad. *`
                : `Entiendo que TecRural usará mi correo para mostrarme el informe y aplicar el límite de ${LIMITE_AMPLIADO}, no para contactarme ni para publicidad. *`}
            </span>
            <span className="mt-1 block text-tr-muted">
              {envioCorreoActivo
                ? "El informe se muestra en pantalla y puedes descargarlo en PDF. También te enviaremos al correo un enlace para recuperarlo, válido 90 días; el informe no se adjunta. "
                : "El informe se muestra en pantalla y puedes descargarlo en PDF; no se envía por correo. "}
              Trataremos {textos.datosTratados} para estas finalidades. Lee la <Link href="/privacidad" className="font-semibold text-tr-green-strong underline hover:no-underline">política de privacidad</Link>.
            </span>
          </label>
          {errores.autorizacion && (
            <p id={`lead-autorizacion-error-${origen}`} className="mt-1 text-small text-tr-warning-text" role="alert">
              {errores.autorizacion}
            </p>
          )}
        </div>
      </div>

      {/* Opt-in comercial de correo: voluntario, desmarcado y separado de la
          autorización del informe. Puedes abrir el informe sin marcarlo. */}
      <div className="flex items-start gap-3 p-4 bg-tr-paper rounded-[var(--tr-radius-control)] border border-tr-line">
        <input
          id={`lead-correo-comercial-${origen}`}
          type="checkbox"
          checked={form.consentimientoCorreo}
          onChange={(e) => set("consentimientoCorreo", e.target.checked)}
          disabled={estado === "enviando" || !correo}
          className="mt-1 h-5 w-5 flex-shrink-0 accent-[var(--tr-brand-green)]"
        />
        <label htmlFor={`lead-correo-comercial-${origen}`} className="text-small text-tr-ink leading-relaxed">
          {TEXTOS_COMERCIALES.correo.texto}
          <span className="mt-1 block text-tr-muted">
            {!correo ? (
              "Escribe tu correo arriba para recibir novedades."
            ) : (
              <>
                Opcional y desmarcado: no influye en el acceso al informe. Puedes retirarlo
                cuando quiera desde{" "}
                <Link href="/baja" className="font-semibold text-tr-green-strong underline hover:no-underline">
                  la página de baja
                </Link>.
              </>
            )}
          </span>
        </label>
      </div>

      <Honeypot origen={origen} form={form} set={set} />

      <button
        type="submit"
        disabled={estado === "enviando"}
        className={`${btnPrimary} w-full py-3`}
      >
        {estado === "enviando" ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
            Enviando...
          </>
        ) : (
          "Abrir mi informe"
        )}
      </button>

      <p className="text-caption text-tr-muted text-center">
        El informe se abre al momento en pantalla.{" "}
        {envioCorreoActivo
          ? "El enlace se envía aparte y verás en esta pantalla si se ha aceptado; si falla, podrás reintentarlo."
          : "No se envía por correo."}{" "}
        No registra ninguna solicitud de revisión ni implica coste.
      </p>
    </div>
  );
}

const CANALES_REVISION = [
  { valor: "whatsapp", etiqueta: "WhatsApp" },
  { valor: "correo", etiqueta: "Correo electrónico" },
  { valor: "llamada", etiqueta: "Llamada telefónica" },
] as const;

function FormularioRevision({ origen, form, set, errores, setErrores, estado, textos, envioCorreoActivo = false }: CamposProps) {
  const correo = form.email.trim();
  const canal = form.canalContacto;

  const elegirCanal = (valor: string) => {
    set("canalContacto", valor);
    // Al cambiar de canal no puede quedar el contacto del canal anterior:
    // guardarlo en el lead permitiría enviar el informe o publicidad a una
    // dirección que la persona ya había descartado.
    if (valor === "correo") {
      set("telefono", "");
    } else {
      set("email", "");
      set("consentimientoCorreo", false);
    }
    setErrores((x) => ({ ...x, canal: undefined, telefono: undefined, email: undefined }));
  };

  return (
    <div className="grid gap-4 mt-4">
      <p className="text-small text-tr-muted leading-relaxed">
        Usaremos el cultivo, el municipio y el síntoma que ya nos diste en el análisis: no tienes
        que repetirlos.
      </p>

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

      {/* Canal explícito: sin preselección y sin dar por hecha una llamada. */}
      <fieldset>
        <legend className={labelCls}>¿Cómo prefieres que te respondamos? *</legend>
        <div className="grid gap-2">
          {CANALES_REVISION.map((opcion) => (
            <label
              key={opcion.valor}
              htmlFor={`lead-canal-${origen}-${opcion.valor}`}
              className={`flex cursor-pointer items-center gap-3 rounded-[var(--tr-radius-control)] border px-3 py-2.5 text-small ${
                canal === opcion.valor
                  ? "border-tr-brand-green bg-tr-leaf/10 font-semibold text-tr-forest"
                  : "border-tr-line bg-tr-paper text-tr-ink"
              }`}
            >
              <input
                id={`lead-canal-${origen}-${opcion.valor}`}
                type="radio"
                name={`lead-canal-${origen}`}
                value={opcion.valor}
                checked={canal === opcion.valor}
                onChange={() => elegirCanal(opcion.valor)}
                disabled={estado === "enviando"}
                className="h-4 w-4 accent-[var(--tr-brand-green)]"
              />
              {opcion.etiqueta}
            </label>
          ))}
        </div>
        {errores.canal && (
          <p className="mt-1 text-small text-tr-warning-text" role="alert">
            {errores.canal}
          </p>
        )}
      </fieldset>

      {/* Solo el dato del canal elegido: WhatsApp o llamada piden teléfono;
          correo pide correo. Nunca los dos por si acaso. */}
      {canal === "correo" ? (
        <CampoCorreo origen={origen} form={form} set={set} errores={errores} setErrores={setErrores} estado={estado} conTelefono={false} />
      ) : canal ? (
        <CampoTelefono
          origen={origen}
          form={form}
          set={set}
          errores={errores}
          setErrores={setErrores}
          estado={estado}
          etiquetaOpcional={canal === "whatsapp" ? "obligatorio para WhatsApp" : "obligatorio para la llamada"}
        />
      ) : null}

      <div>
        <label htmlFor={`lead-mensaje-${origen}`} className={labelCls}>
          ¿Algo más que deba saber el técnico? <span className="font-normal text-tr-muted">(opcional)</span>
        </label>
        <textarea
          id={`lead-mensaje-${origen}`}
          rows={2}
          value={form.mensaje}
          onChange={(e) => set("mensaje", e.target.value)}
          disabled={estado === "enviando"}
          className={`${inputCls} resize-none`}
          placeholder="Por ejemplo: el daño empezó hace dos semanas y avanza"
        />
      </div>

      {/* Autorización de la solicitud: es la única que registra una petición de
          contacto con el técnico. */}
      <div className="flex items-start gap-3 p-4 bg-tr-paper rounded-[var(--tr-radius-control)] border border-tr-line">
        <input
          id={`lead-autorizacion-revision-${origen}`}
          type="checkbox"
          required
          checked={form.autorizoRevision}
          onChange={(e) => {
            set("autorizoRevision", e.target.checked);
            if (errores.autorizacion) setErrores((x) => ({ ...x, autorizacion: undefined }));
          }}
          disabled={estado === "enviando"}
          aria-invalid={errores.autorizacion ? "true" : undefined}
          aria-describedby={errores.autorizacion ? `lead-autorizacion-revision-error-${origen}` : undefined}
          className="mt-1 h-5 w-5 flex-shrink-0 accent-[var(--tr-brand-green)]"
        />
        <div className="flex-1">
          <label htmlFor={`lead-autorizacion-revision-${origen}`} className="block text-small text-tr-ink leading-relaxed">
            <span className="block font-semibold">
              Solicito que TecRural revise este caso y me responda por el canal elegido. *
            </span>
            <span className="mt-1 block text-tr-muted">
              Usaremos {textos.datosTratados} para gestionar la solicitud. Lee la{" "}
              <Link href="/privacidad" className="font-semibold text-tr-green-strong underline hover:no-underline">
                política de privacidad
              </Link>.
            </span>
          </label>
          {errores.autorizacion && (
            <p id={`lead-autorizacion-revision-error-${origen}`} className="mt-1 text-small text-tr-warning-text" role="alert">
              {errores.autorizacion}
            </p>
          )}
        </div>
      </div>

      {/* Novedades comerciales: independientes y voluntarias. Solo se ofrecen
          donde hay correo; el teléfono de la revisión no autoriza publicidad. */}
      {canal === "correo" ? (
        <div className="flex items-start gap-3 p-4 bg-tr-paper rounded-[var(--tr-radius-control)] border border-tr-line">
          <input
            id={`lead-correo-comercial-${origen}`}
            type="checkbox"
            checked={form.consentimientoCorreo}
            onChange={(e) => set("consentimientoCorreo", e.target.checked)}
            disabled={estado === "enviando" || !correo}
            className="mt-1 h-5 w-5 flex-shrink-0 accent-[var(--tr-brand-green)]"
          />
          <label htmlFor={`lead-correo-comercial-${origen}`} className="text-small text-tr-ink leading-relaxed">
            {TEXTOS_COMERCIALES.correo.texto}
            <span className="mt-1 block text-tr-muted">
              Opcional y desmarcado: no influye en la revisión. Puedes retirarlo cuando quiera
              desde{" "}
              <Link href="/baja" className="font-semibold text-tr-green-strong underline hover:no-underline">
                la página de baja
              </Link>.
            </span>
          </label>
        </div>
      ) : canal ? (
        <p className="text-caption text-tr-muted">
          Las novedades comerciales solo se ofrecen por correo; este contacto se usa únicamente
          para responder a tu solicitud.
        </p>
      ) : null}

      <Honeypot origen={origen} form={form} set={set} />

      <button
        type="submit"
        disabled={estado === "enviando"}
        className={`${btnPrimary} w-full py-3`}
      >
        {estado === "enviando" ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
            Enviando...
          </>
        ) : (
          "Solicitar la revisión"
        )}
      </button>

      <p className="text-caption text-tr-muted text-center">
        No implica ninguna contratación ni coste. El informe completo también se abre en pantalla.
        {envioCorreoActivo && canal === "correo"
          ? " Si eliges correo, te enviaremos además un enlace de recuperación válido 90 días."
          : ""}
      </p>
    </div>
  );
}

function Honeypot({
  origen,
  form,
  set,
}: {
  origen: OrigenLead;
  form: { web: string };
  set: (campo: string, valor: string | boolean) => void;
}) {
  return (
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
  );
}

/* ------------------------------------------------------------------------- */
/* Contacto directo: formulario completo de la página /contacto              */
/* ------------------------------------------------------------------------- */

function FormularioDirecto({ origen, form, set, errores, setErrores, estado, textos }: CamposProps) {
  const telefonoLleno = Boolean(form.telefono.trim());
  return (
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
        <CampoTelefono origen={origen} form={form} set={set} errores={errores} setErrores={setErrores} estado={estado} etiquetaOpcional="opcional si dejas el correo" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CampoCorreo origen={origen} form={form} set={set} errores={errores} setErrores={setErrores} estado={estado} conTelefono />
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
      </div>

      {/* Falta el canal de contacto: se avisa aquí y no bajo un campo
          concreto, porque no es culpa del teléfono ni del correo. */}
      {errores.contacto && (
        <p className="text-small text-tr-warning-text" role="alert">
          {errores.contacto}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <div>
          <label htmlFor={`lead-canal-${origen}`} className={labelCls}>¿Cómo prefieres que te contactemos? *</label>
          <select
            id={`lead-canal-${origen}`}
            value={form.canalContacto}
            onChange={(e) => {
              set("canalContacto", e.target.value);
              if (errores.canal) setErrores((x) => ({ ...x, canal: undefined }));
            }}
            disabled={estado === "enviando"}
            aria-invalid={errores.canal ? "true" : undefined}
            aria-describedby={errores.canal ? `lead-canal-error-${origen}` : undefined}
            className={`${inputCls} ${errores.canal ? "border-tr-warning-text" : ""}`}
          >
            <option value="" disabled>Elige un canal</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="correo">Correo electrónico</option>
            <option value="llamada">Llamada telefónica</option>
          </select>
          {errores.canal && (
            <p id={`lead-canal-error-${origen}`} className="mt-1 text-small text-tr-warning-text" role="alert">
              {errores.canal}
            </p>
          )}
        </div>
      </div>

      {/* Sin diagnóstico detrás (página de contacto) el técnico no sabe qué
          le pasa al cultivo. Este campo sustituye a las hectáreas: es lo que
          el pequeño agricultor sí sabe describir. */}
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
      <div className="flex items-start gap-3 p-4 bg-tr-paper rounded-[var(--tr-radius-control)] border border-tr-line">
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
          className="mt-1 h-5 w-5 flex-shrink-0 accent-[var(--tr-brand-green)]"
        />
        <div className="flex-1">
          <label htmlFor={`lead-solicitud-${origen}`} className="block text-small text-tr-ink leading-relaxed">
            <span className="block font-semibold">
              Solicito que TecRural revise este caso y me responda al teléfono o correo indicado. *
            </span>
            <span className="mt-1 block text-tr-muted">Usaremos tus datos ({textos.datosTratados}) para gestionar la solicitud. Lee la <Link href="/privacidad" className="font-semibold text-tr-green-strong underline hover:no-underline">política de privacidad</Link>.</span>
          </label>
          {errores.solicitud && (
            <p id={`lead-solicitud-error-${origen}`} className="mt-1 text-small text-tr-warning-text" role="alert">
              {errores.solicitud}
            </p>
          )}
        </div>
      </div>

      {/* Consentimiento comercial: opcional, desmarcado por defecto. Solo se
          ofrece cuando hay teléfono: es un consentimiento para WhatsApp y,
          sin número, no hay nada que enviar. */}
      {telefonoLleno && (
        <div className="flex items-start gap-3 p-4 bg-tr-paper rounded-[var(--tr-radius-control)] border border-tr-line">
          <input
            id={`lead-comercial-${origen}`}
            type="checkbox"
            checked={form.consentimientoWhatsapp}
            onChange={(e) => set("consentimientoWhatsapp", e.target.checked)}
            disabled={estado === "enviando"}
            className="mt-1 h-5 w-5 flex-shrink-0 accent-[var(--tr-brand-green)]"
          />
          <label htmlFor={`lead-comercial-${origen}`} className="text-small text-tr-ink leading-relaxed">
            {TEXTOS_COMERCIALES.whatsapp.texto}.
            <span className="mt-1 block text-tr-muted">Es opcional y puedo retirar el consentimiento cuando quiera: <Link href="/baja" className="font-semibold text-tr-green-strong underline hover:no-underline">darme de baja</Link>.</span>
          </label>
        </div>
      )}

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
  );
}
