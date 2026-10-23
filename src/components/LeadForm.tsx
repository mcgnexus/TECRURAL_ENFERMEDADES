"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { urlWhatsApp, whatsappDisponible } from "@/lib/contacto";
import { trackEvento } from "@/lib/analitica";
import { trackMeta } from "@/components/MetaPixel";
import { obtenerUtm } from "@/lib/utm";
import { textosLead, avisoFotos } from "@/lib/textos-lead";
import { LIMITE_AMPLIADO } from "@/lib/textos-publicos";
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
  /** Se llama cuando el lead se ha guardado: permite revelar el informe completo. */
  onEnviado?: () => void;
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
  prefill,
  mensajeInicial = "",
  adjuntarFotos,
  onEnviado,
}: LeadFormProps) {
  const [estado, setEstado] = useState<EstadoEnvio>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<{ telefono?: string; email?: string; contacto?: string; solicitud?: string; autorizacion?: string }>({});
  const [form, setForm] = useState({
    nombre: "",
    telefono: "",
    email: "",
    municipio: prefill?.municipio ?? "",
    cultivo: prefill?.cultivo ?? "",
    sintoma: "",
    canalContacto: "llamada",
    mensaje: mensajeInicial,
    // En "contacto_directo" es la casilla obligatoria de la solicitud. En el
    // flujo posterior al diagnóstico es la opción aparte y opcional de pedir
    // que un técnico revise el caso: quien solo quiere el informe no la marca
    // y su envío no registra una solicitud de contacto.
    solicitudRespuesta: false,
    consentimientoComercial: false, // siempre desmarcado por defecto
    // Solo en el flujo posterior al diagnóstico: autorización obligatoria para
    // usar el contacto en el informe y en el límite semanal, separada de la
    // revisión técnica.
    autorizoInforme: false,
    // Novedades comerciales por correo: opt-in voluntario y desmarcado, separado
    // de la autorización del informe. Da igual el teléfono: por eso se guarda
    // con su propio canal (correo) en el servidor.
    consentimientoCorreo: false,
    web: "",
  });

  const set = (campo: string, valor: string | boolean) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const esDirecto = origen === "contacto_directo";
  const TELEFONO_REGEX = /^[+]?[\d\s().-]{9,20}$/;
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const telefono = form.telefono.trim();
  const correo = form.email.trim();
  /** Solo se pidió correo: no tiene sentido ofrecer llamada ni WhatsApp. */
  const soloCorreo = !telefono && Boolean(correo);

  /**
   * En el flujo posterior al diagnóstico las fotos solo viajan con la revisión
   * técnica: quien únicamente desbloquea el informe no las comparte con nadie.
   */
  const fotosAdjuntas = adjuntarFotos && adjuntarFotos.length > 0 ? adjuntarFotos : null;
  const comparteFotos = esDirecto || form.solicitudRespuesta;
  const numFotos = fotosAdjuntas?.length ?? 0;
  const numFotosEnviadas = comparteFotos ? numFotos : 0;
  const fotosParaEnviar = comparteFotos && fotosAdjuntas ? fotosAdjuntas.slice(0, 3) : undefined;

  // Los textos viven en src/lib/textos-lead.ts, que es puro y por tanto
  // verificable: la variante posterior al diagnóstico no se renderiza sin
  // completar un análisis, así que la única forma de comprobarla es aislarla.
  const textos = textosLead(origen, numFotosEnviadas, esDirecto || form.solicitudRespuesta);
  const aviso = avisoFotos(numFotosEnviadas);

  const validar = (): boolean => {
    const nuevos: { telefono?: string; email?: string; contacto?: string; solicitud?: string; autorizacion?: string } = {};
    if (telefono && !TELEFONO_REGEX.test(telefono)) {
      nuevos.telefono = "Introduce un teléfono válido (9-15 dígitos).";
    }
    if (correo && !EMAIL_REGEX.test(correo)) {
      nuevos.email = "Introduce un correo válido (por ejemplo: nombre@dominio.com).";
    }
    // Informe completo y revisión: basta con UNO de los dos canales.
    if (!telefono && !correo) {
      nuevos.contacto = esDirecto
        ? "Déjanos tu teléfono o tu correo: con uno de los dos basta para responder a tu solicitud."
        : "Escribe tu correo para recibir el informe completo.";
    }
    if (!esDirecto && !form.autorizoInforme) {
      nuevos.autorizacion = "Confirma el uso del contacto para recibir el informe.";
    }
    if (form.solicitudRespuesta) {
      // Con revisión pedida y canal de llamada o WhatsApp, sin teléfono no hay
      // forma de contactar: se pide el número o el cambio a correo.
      if (!telefono && form.canalContacto !== "correo") {
        nuevos.telefono = "Para la revisión, deja un teléfono (o elige que te escriban al correo).";
      }
    } else if (esDirecto) {
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

    try {
      const utm = obtenerUtm();
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim() || undefined,
          telefono: form.telefono.trim() || undefined,
          email: form.email.trim() || undefined,
          municipio: form.municipio.trim() || undefined,
          cultivo: form.cultivo.trim() || undefined,
          sintoma: sintomaFinal,
          // Sin revisión pedida no hay mensaje: el envío no es una solicitud
          // de contacto y no necesita notas para el técnico.
          mensaje: form.solicitudRespuesta ? (form.mensaje.trim() || undefined) : undefined,
          diagnostico_id: diagnosticoId,
          origen,
          // Sin teléfono no se puede llamar ni escribir por WhatsApp: el canal
          // efectivo pasa a ser el correo. Sin revisión pedida no hay canal.
          canal_contacto: form.solicitudRespuesta ? (soloCorreo ? "correo" : form.canalContacto) : undefined,
          solicitud_respuesta: form.solicitudRespuesta,
          // Consentimiento comercial: en "contacto_directo" es la casilla de
          // WhatsApp (solo con teléfono); en el informe es la casilla de correo.
          consentimiento_comercial: esDirecto
            ? form.consentimientoComercial && Boolean(form.telefono.trim())
            : form.consentimientoCorreo,
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
      trackEvento("lead_enviado", { origen, cultivo: form.cultivo || undefined });
      // Conversiones de Meta, separadas por valor comercial: Lead cubre el
      // contacto; los eventos personalizados matizan quién pide revisión y
      // quién autoriza novedades. Se disparan una sola vez, al confirmarse el
      // guardado, y sin datos personales en los parámetros.
      trackMeta("Lead", { origen });
      if (form.solicitudRespuesta) trackMeta("RevisionTecnica", { origen });
      if (!esDirecto && form.consentimientoCorreo) trackMeta("SuscripcionCorreo", { origen });
      onEnviado?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      setEstado("error");
      trackEvento("lead_error", { origen });
    }
  };

  /** Paso de embudo: primera interacción con el formulario tras el resultado. */
  const interaccionRegistrada = useRef(false);
  const registrarInteraccion = () => {
    if (esDirecto || interaccionRegistrada.current) return;
    interaccionRegistrada.current = true;
    trackEvento("cta_revision_abierto", {
      gravedad: contexto?.gravedad,
      requiere_experto: contexto?.requiere_experto,
      tipo: contexto?.tipo,
    });
  };

  if (estado === "ok") {
    const conRevision = form.solicitudRespuesta;
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
            {conRevision && whatsappDisponible && (
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
      ) : (
        <FormularioInforme
          origen={origen}
          form={form}
          set={set}
          errores={errores}
          setErrores={setErrores}
          estado={estado}
          textos={textos}
          numFotos={numFotos}
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
    consentimientoComercial: boolean;
    consentimientoCorreo: boolean;
    autorizoInforme: boolean;
    web: string;
  };
  set: (campo: string, valor: string | boolean) => void;
  errores: { telefono?: string; email?: string; contacto?: string; solicitud?: string; autorizacion?: string };
  setErrores: React.Dispatch<React.SetStateAction<{ telefono?: string; email?: string; contacto?: string; solicitud?: string; autorizacion?: string }>>;
  estado: EstadoEnvio;
}

interface CamposProps extends CampoBaseProps {
  textos: { datosTratados: string };
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
          if (errores.email || errores.contacto) {
            setErrores((x) => ({ ...x, email: undefined, contacto: undefined }));
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
          if (errores.telefono || errores.contacto) {
            setErrores((x) => ({ ...x, telefono: undefined, contacto: undefined }));
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
/* Flujo posterior al diagnóstico: informe con correo, revisión aparte        */
/* ------------------------------------------------------------------------- */

function FormularioInforme({ origen, form, set, errores, setErrores, estado, textos, numFotos }: CamposProps & { numFotos: number }) {
  return (
    <div className="grid gap-4 mt-4">
      <CampoCorreo origen={origen} form={form} set={set} errores={errores} setErrores={setErrores} estado={estado} conTelefono={false} />

      {/* Sin ningún contacto no hay forma de entregar el informe. */}
      {errores.contacto && (
        <p className="text-small text-tr-warning-text" role="alert">
          {errores.contacto}
        </p>
      )}

      {/* Autorización de uso del contacto, separada de la revisión técnica:
          desbloquear el informe no implica que un técnico vaya a contactar. */}
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
              Entiendo que TecRural usará mi correo para mostrarme el informe y aplicar el límite de {LIMITE_AMPLIADO}, no para contactarme ni para publicidad. *
            </span>
            <span className="mt-1 block text-tr-muted">
              El informe se muestra en pantalla y puedes descargarlo en PDF; no se envía por correo.
              Trataremos {textos.datosTratados} para estas dos finalidades. Lee la <Link href="/privacidad" className="font-semibold text-tr-green-strong underline hover:no-underline">política de privacidad</Link>.
            </span>
          </label>
          {errores.autorizacion && (
            <p id={`lead-autorizacion-error-${origen}`} className="mt-1 text-small text-tr-warning-text" role="alert">
              {errores.autorizacion}
            </p>
          )}
        </div>
      </div>

      {/* Intención aparte: la revisión técnica. Es opcional y es la única que
          registra una solicitud de contacto con el técnico. */}
      <div className="flex items-start gap-3 p-4 bg-tr-paper rounded-[var(--tr-radius-control)] border border-tr-line">
        <input
          id={`lead-solicitud-${origen}`}
          type="checkbox"
          checked={form.solicitudRespuesta}
          onChange={(e) => set("solicitudRespuesta", e.target.checked)}
          disabled={estado === "enviando"}
          className="mt-1 h-5 w-5 flex-shrink-0 accent-[var(--tr-brand-green)]"
        />
        <label htmlFor={`lead-solicitud-${origen}`} className="text-small text-tr-ink leading-relaxed">
          <span className="block font-semibold">Además, quiero que un técnico revise mi caso</span>
          <span className="mt-1 block text-tr-muted">
            Opcional. Si lo marcas, un técnico responde en un máximo de 48 horas por el canal que elijas.
            La foto se comparte solo entonces. Sin coste ni compromiso de contratación.
          </span>
        </label>
      </div>

      {form.solicitudRespuesta && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-tr-paper rounded-[var(--tr-radius-control)] border border-tr-line">
          <CampoTelefono origen={origen} form={form} set={set} errores={errores} setErrores={setErrores} estado={estado} etiquetaOpcional="necesario salvo si eliges correo" />
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
              <option value="correo">Correo electrónico</option>
            </select>
          </div>
          {numFotos > 0 && (
            <p className="sm:col-span-2 text-caption text-tr-muted">
              Al enviar, {numFotos === 1 ? "la foto del análisis se adjuntará" : `las ${numFotos} fotos del análisis se adjuntarán`} para la revisión. No se usan para ningún otro fin.
            </p>
          )}
        </div>
      )}

      {/* Opt-in comercial de correo: voluntario, desmarcado y separado de la
          autorización del informe. Puedes recibir el informe sin marcarlo. */}
      <div className="flex items-start gap-3 p-4 bg-tr-paper rounded-[var(--tr-radius-control)] border border-tr-line">
        <input
          id={`lead-correo-comercial-${origen}`}
          type="checkbox"
          checked={form.consentimientoCorreo}
          onChange={(e) => set("consentimientoCorreo", e.target.checked)}
          disabled={estado === "enviando"}
          className="mt-1 h-5 w-5 flex-shrink-0 accent-[var(--tr-brand-green)]"
        />
        <label htmlFor={`lead-correo-comercial-${origen}`} className="text-small text-tr-ink leading-relaxed">
          Quiero recibir consejos y novedades por correo
          <span className="mt-1 block text-tr-muted">
            Opcional y desmarcado: no influye en el acceso al informe. Puedes retirarlo cuando
            quiera desde <Link href="/baja" className="font-semibold text-tr-green-strong underline hover:no-underline">la página de baja</Link>.
          </span>
        </label>
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
        ) : form.solicitudRespuesta ? (
          "Ver mi informe y solicitar la revisión"
        ) : (
          "Ver mi informe completo"
        )}
      </button>

      <p className="text-caption text-tr-muted text-center">
        El informe se abre al momento en pantalla. Enviarlo no implica contratación ni coste.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Contacto directo: formulario completo de la página /contacto              */
/* ------------------------------------------------------------------------- */

function FormularioDirecto({ origen, form, set, errores, setErrores, estado, textos }: CamposProps) {
  const telefonoLleno = Boolean(form.telefono.trim());
  const soloCorreo = !form.telefono.trim() && Boolean(form.email.trim());
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
          <label htmlFor={`lead-canal-${origen}`} className={labelCls}>¿Cómo prefieres que te contactemos?</label>
          <select
            id={`lead-canal-${origen}`}
            value={soloCorreo ? "correo" : form.canalContacto}
            onChange={(e) => set("canalContacto", e.target.value)}
            disabled={estado === "enviando"}
            className={inputCls}
          >
            <option value="llamada" disabled={soloCorreo}>Llamada telefónica</option>
            <option value="whatsapp" disabled={soloCorreo}>WhatsApp</option>
            <option value="correo">Correo electrónico</option>
          </select>
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
            checked={form.consentimientoComercial}
            onChange={(e) => set("consentimientoComercial", e.target.checked)}
            disabled={estado === "enviando"}
            className="mt-1 h-5 w-5 flex-shrink-0 accent-[var(--tr-brand-green)]"
          />
          <label htmlFor={`lead-comercial-${origen}`} className="text-small text-tr-ink leading-relaxed">
            Quiero recibir por WhatsApp consejos y novedades comerciales de TecRural.
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
