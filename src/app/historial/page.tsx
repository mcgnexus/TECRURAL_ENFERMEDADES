import { obtenerHistorial } from "@/lib/database";
import type { DiagnosticoWithMeta } from "@/types/diagnostico";
import Link from "next/link";

export const metadata = {
  title: "Historial | TECRURAL Diagnóstico",
  description: "Historial de diagnósticos fitosanitarios",
};

async function getHistorial(): Promise<DiagnosticoWithMeta[]> {
  try {
    return await obtenerHistorial("usuario_demo", 50);
  } catch {
    return [];
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getGravedadColor(gravedad: string): string {
  switch (gravedad) {
    case "leve":
      return "bg-green-100 text-green-800";
    case "moderada":
      return "bg-yellow-100 text-yellow-800";
    case "severa":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getTipoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    enfermedad: "Enfermedad",
    deficiencia_nutricional: "Deficiencia",
    plaga: "Plaga",
    sano: "Sano",
  };
  return labels[tipo] || tipo;
}

export default async function HistorialPage() {
  const historial = await getHistorial();

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Historial de diagnósticos</h1>
            <p className="text-gray-500 mt-1">{historial.length} registros</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            Nuevo diagnóstico
          </Link>
        </header>

        {historial.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="mt-4 text-lg font-medium text-gray-900">No hay diagnósticos aún</h2>
            <p className="mt-2 text-gray-500">Realiza tu primer análisis para ver el historial aquí</p>
            <Link
              href="/"
              className="mt-6 inline-block px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Hacer diagnóstico
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {historial.map((item) => (
              <article
                key={item.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {item.organo_detectado}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                        {item.especie_identificada}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${getGravedadColor(item.diagnostico.gravedad)}`}>
                        {getTipoLabel(item.diagnostico.tipo)}: {item.diagnostico.nombre}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{item.recomendacion}</p>
                    <p className="mt-2 text-xs text-gray-400">{item.created_at ? formatDate(item.created_at) : "Fecha desconocida"}</p>
                  </div>
                  {item.imagen_url && (
                    <img
                      src={item.imagen_url}
                      alt={`Diagnóstico ${item.especie_identificada}`}
                      className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                    />
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}