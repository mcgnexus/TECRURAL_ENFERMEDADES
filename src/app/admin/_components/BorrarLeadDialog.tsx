"use client";

import { useEffect, useState } from "react";
import type { LeadFila } from "@/types/lead";
import { btnDanger, btnSecondary, cardStyles } from "./ui";

const PALABRA = "BORRAR";

/**
 * Confirmación de borrado definitivo.
 *
 * Borrar un lead es irreversible e incluye las fotos de la revisión, así que no
 * basta un "¿seguro?". Se exige escribir la palabra BORRAR y se muestra qué se
 * va a borrar (personas y número de fotos) para que el gesto sea deliberado.
 */
export function BorrarLeadDialog({
  leads,
  onCancelar,
  onConfirmar,
  borrando,
}: {
  /** Leads seleccionados para borrar. Si está vacío, el diálogo no se muestra. */
  leads: LeadFila[];
  onCancelar: () => void;
  onConfirmar: () => void;
  borrando: boolean;
}) {
  const [texto, setTexto] = useState("");
  const abierto = leads.length > 0;

  useEffect(() => {
    if (abierto) setTexto("");
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !borrando) onCancelar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [abierto, borrando, onCancelar]);

  if (!abierto) return null;

  const totalFotos = leads.reduce((suma, l) => suma + l.num_imagenes, 0);
  const puedeBorrar = texto.trim().toUpperCase() === PALABRA && !borrando;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-borrar"
      onClick={() => !borrando && onCancelar()}
    >
      <div
        className={`${cardStyles} w-full max-w-md p-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="titulo-borrar" className="font-heading font-bold text-tr-forest">
          {leads.length === 1 ? "Borrar lead" : `Borrar ${leads.length} leads`}
        </h2>
        <p className="text-small text-tr-ink mt-2">
          Esta acción es <strong>definitiva e irreversible</strong>. Se eliminarán el registro
          comercial, las notas
          {totalFotos > 0 && (
            <>
              {" "}
              y <strong>{totalFotos} foto{totalFotos === 1 ? "" : "s"}</strong>
            </>
          )}
          . No se puede deshacer.
        </p>

        <ul className="mt-3 max-h-40 overflow-y-auto text-small text-tr-muted border border-tr-line rounded-[var(--tr-radius-control)] divide-y divide-tr-line">
          {leads.slice(0, 20).map((l) => (
            <li key={l.id} className="px-3 py-1.5 flex justify-between gap-2">
              <span className="text-tr-ink truncate">{l.nombre}</span>
              <span className="whitespace-nowrap">{l.telefono || l.email || "sin contacto"}</span>
            </li>
          ))}
          {leads.length > 20 && (
            <li className="px-3 py-1.5 text-caption">y {leads.length - 20} más…</li>
          )}
        </ul>

        <label className="block font-body font-semibold text-tr-forest text-small mt-4 mb-1.5" htmlFor="confirmar-borrado">
          Escribe <span className="font-mono">{PALABRA}</span> para confirmar
        </label>
        <input
          id="confirmar-borrado"
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoComplete="off"
          autoFocus
          className="w-full px-3 py-2.5 rounded-[var(--tr-radius-control)] border border-tr-line bg-tr-paper text-tr-ink font-body focus:border-red-500"
          placeholder={PALABRA}
        />

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onCancelar} disabled={borrando} className={btnSecondary}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={!puedeBorrar}
            className={btnDanger}
          >
            {borrando ? "Borrando…" : "Borrar definitivamente"}
          </button>
        </div>
      </div>
    </div>
  );
}
