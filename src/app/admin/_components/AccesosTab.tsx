import type { AccesosResumen } from "@/lib/database";
import { ETIQUETAS_EVENTO, cardStyles, formatCorto, formatNumero } from "./ui";

const ETIQUETAS: Record<string, string> = ETIQUETAS_EVENTO;

/**
 * Vista de accesos.
 *
 * Se muestran dos listas independientes y así se explica: `eventos` guarda solo
 * el UUID anónimo del visitante, y las IPs solo existen en `cuotas` como clave
 * de rate-limit. No se pueden cruzar, y el panel no debe insinuar que sí.
 */
export function AccesosTab({ accesos }: { accesos: AccesosResumen }) {
  const maxDia = Math.max(1, ...accesos.porDia.map((d) => d.visitantes));

  return (
    <div className={`${cardStyles} p-4 space-y-5`}>
      <div>
        <h2 className="font-heading font-semibold text-tr-forest text-small mb-1">Accesos</h2>
        <p className="text-caption text-tr-muted">
          Últimos {accesos.dias} días. {formatNumero(accesos.totales.visitantes)} visitantes
          anónimos, {formatNumero(accesos.totales.diagnosticos)} análisis y{" "}
          {formatNumero(accesos.totales.leads)} contactos. Las IPs van enmascaradas y proceden
          solo de la tabla de cuotas (rate-limit); no hay enlace entre visitante e IP.
        </p>
      </div>

      <div>
        <h3 className="font-heading font-semibold text-tr-forest text-small mb-2">Por día</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="border-b border-tr-line text-left text-caption text-tr-muted">
                <th className="px-2 py-1.5">Día</th>
                <th className="px-2 py-1.5">Visitas</th>
                <th className="px-2 py-1.5">Análisis</th>
                <th className="px-2 py-1.5">Contactos</th>
              </tr>
            </thead>
            <tbody>
              {accesos.porDia
                .slice()
                .reverse()
                .map((d) => (
                  <tr key={d.dia} className="border-b border-tr-line last:border-0">
                    <td className="px-2 py-1.5 text-tr-muted whitespace-nowrap">{d.dia}</td>
                    <td className="px-2 py-1.5">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-tr-ink w-6 text-right">
                          {d.visitantes}
                        </span>
                        <span className="h-2 rounded-full bg-tr-lime flex-1 max-w-[120px]">
                          <span
                            className="block h-2 rounded-full bg-tr-green-strong"
                            style={{ width: `${(d.visitantes / maxDia) * 100}%` }}
                          />
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-tr-muted">{d.diagnosticos}</td>
                    <td className="px-2 py-1.5 text-tr-muted">{d.leads}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="font-heading font-semibold text-tr-forest text-small mb-2">
          Actividad por IP
        </h3>
        {accesos.ips.length === 0 ? (
          <p className="text-caption text-tr-muted">Sin registros de IP todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead>
                <tr className="border-b border-tr-line text-left text-caption text-tr-muted">
                  <th className="px-2 py-1.5">IP</th>
                  <th className="px-2 py-1.5">Peticiones</th>
                  <th className="px-2 py-1.5">Días</th>
                  <th className="px-2 py-1.5">Primera</th>
                  <th className="px-2 py-1.5">Última</th>
                </tr>
              </thead>
              <tbody>
                {accesos.ips.map((ip) => (
                  <tr key={ip.ip} className="border-b border-tr-line last:border-0">
                    <td className="px-2 py-1.5 font-mono text-tr-ink whitespace-nowrap">
                      {ip.ip}
                      {ip.topada && (
                        <span className="ml-2 text-caption font-normal text-tr-warning-text">
                          tope
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-tr-muted">{ip.peticiones}</td>
                    <td className="px-2 py-1.5 text-tr-muted">{ip.dias}</td>
                    <td className="px-2 py-1.5 text-tr-muted whitespace-nowrap">
                      {formatCorto(ip.primera)}
                    </td>
                    <td className="px-2 py-1.5 text-tr-muted whitespace-nowrap">
                      {formatCorto(ip.ultima)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-heading font-semibold text-tr-forest text-small mb-2">
          Visitantes anónimos
        </h3>
        {accesos.visitantes.length === 0 ? (
          <p className="text-caption text-tr-muted">Sin visitantes registrados todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead>
                <tr className="border-b border-tr-line text-left text-caption text-tr-muted">
                  <th className="px-2 py-1.5">Visitante</th>
                  <th className="px-2 py-1.5">Primera</th>
                  <th className="px-2 py-1.5">Última</th>
                  <th className="px-2 py-1.5">Pasos</th>
                </tr>
              </thead>
              <tbody>
                {accesos.visitantes.map((v) => (
                  <tr key={v.id} className="border-b border-tr-line last:border-0">
                    <td className="px-2 py-1.5 font-mono text-tr-muted whitespace-nowrap">
                      {v.id.slice(0, 8)}
                    </td>
                    <td className="px-2 py-1.5 text-tr-muted whitespace-nowrap">
                      {formatCorto(v.primera)}
                    </td>
                    <td className="px-2 py-1.5 text-tr-muted whitespace-nowrap">
                      {formatCorto(v.ultima)}
                    </td>
                    <td className="px-2 py-1.5 text-tr-muted">
                      {v.pasos}
                      <span className="block text-caption">
                        {v.eventos.map((e) => ETIQUETAS[e] ?? e).join(" · ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
