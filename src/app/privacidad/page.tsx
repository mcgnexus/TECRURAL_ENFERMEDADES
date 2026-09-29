import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Información sobre el tratamiento de datos personales en TecRural.",
};

const p = "text-tr-muted leading-relaxed";
const h2 = "mt-8 mb-3 font-heading font-semibold text-tr-forest text-xl";

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-tr-paper px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-[var(--tr-radius-card)] border border-tr-line bg-tr-surface p-6 shadow-[var(--tr-shadow-card)] sm:p-10">
        <h1 className="font-heading text-3xl font-bold text-tr-forest">Política de privacidad</h1>
        <p className={`${p} mt-2`}>Última actualización: 29 de septiembre de 2026</p>
        <h2 className={h2}>1. Responsable del tratamiento</h2>
        <p className={p}>Responsable: <strong>Manuel Carrasco García</strong>. NIF: <strong>76143911L</strong>. Domicilio: <strong>Barrio Los Reyes 113, 18830 Huéscar (Granada), España</strong>. Contacto: <a className="underline" href="mailto:mcgnexus@gmail.com">mcgnexus@gmail.com</a>. No consta designación de delegado de protección de datos.</p>
        <h2 className={h2}>2. Datos tratados y procedencia</h2>
        <p className={p}>Cuando solicitas una revisión podemos tratar nombre (si lo facilitas), teléfono, municipio, cultivo, síntomas y mensajes; la forma de contacto elegida; fotografías que adjuntes al solicitar la revisión; y datos asociados al diagnóstico y a la navegación/campaña (por ejemplo, parámetros UTM). Los datos los proporciona la persona usuaria; los datos técnicos de uso se generan al utilizar el sitio.</p>
        <h2 className={h2}>3. Finalidades y base jurídica</h2>
        <p className={p}>Usamos los datos para recibir y gestionar la solicitud, revisar el caso agronómico y responder por el canal elegido. La base indicada para esta gestión es atender las medidas solicitadas por la persona interesada antes de una posible relación contractual. El envío de comunicaciones comerciales por WhatsApp es opcional y se basa en el consentimiento separado; retirarlo no afecta a la solicitud de revisión.</p>
        <h2 className={h2}>4. Fotografías y contexto del cultivo</h2>
        <p className={p}>Las imágenes del análisis solo se envían al servicio cuando se presenta una solicitud de revisión que las adjunta, para que el técnico pueda revisar ese caso. Pueden mostrar información del estado y ubicación aproximada de una explotación o cultivo; evita incluir personas, documentos u otros datos que no sean necesarios. Las imágenes adjuntas se guardan junto al registro de la solicitud en la base de datos y se eliminarán como máximo a los 12 meses desde el envío. El responsable debe revisar mensualmente los registros vencidos y borrar las imágenes de la base de datos. También puedes pedir su supresión anticipada escribiendo a <a className="underline" href="mailto:mcgnexus@gmail.com">mcgnexus@gmail.com</a>; se tramitará dentro del plazo legal aplicable.</p>
        <h2 className={h2}>5. Conservación</h2>
        <p className={p}>Las fotografías adjuntas se conservarán un máximo de 12 meses desde la fecha de envío de la solicitud. El responsable revisará mensualmente los registros vencidos y eliminará las imágenes de la base de datos; hasta completar esa revisión podrían permanecer almacenadas brevemente después del plazo. El resto de datos de la solicitud se conservará mientras sea necesario para atenderla y, posteriormente, durante los plazos necesarios para cumplir obligaciones legales o atender responsabilidades. Puedes solicitar acceso, rectificación o supresión escribiendo a <a className="underline" href="mailto:mcgnexus@gmail.com">mcgnexus@gmail.com</a>.</p>
        <h2 className={h2}>6. Destinatarios y proveedores</h2>
        <p className={p}>Para prestar el servicio se utilizan proveedores tecnológicos: Neon (base de datos), Vercel (alojamiento/despliegue, si la aplicación se sirve desde esa plataforma), Google (Google Analytics cuando se configura y Google Gemini para análisis) y DeepSeek (análisis alternativo). Cuando se realiza un análisis, las imágenes y el contexto agronómico necesario pueden comunicarse al proveedor de inteligencia artificial que procese la solicitud. Estos proveedores pueden tratar datos desde fuera del Espacio Económico Europeo; en ese caso se aplicarán las garantías previstas por la normativa, como las cláusulas contractuales tipo cuando corresponda. El servicio también puede apoyarse en proveedores de correo o notificaciones configurados para la aplicación.</p>
        <h2 className={h2}>7. Derechos</h2>
        <p className={p}>Puedes solicitar acceso, rectificación, supresión, oposición, limitación o portabilidad, así como retirar el consentimiento comercial, escribiendo a <a className="underline" href="mailto:mcgnexus@gmail.com">mcgnexus@gmail.com</a>. También puedes reclamar ante la Agencia Española de Protección de Datos. Para tramitar la solicitud podremos pedir información razonable para verificar tu identidad.</p>
        <h2 className={h2}>8. Comunicaciones comerciales</h2>
        <p className={p}>Solo se enviarán novedades comerciales si marcas la casilla opcional correspondiente. Puedes darte de baja en cualquier momento desde <Link className="underline" href="/baja">la página de baja</Link>.</p>
        <p className={`${p} mt-10 border-t border-tr-line pt-5 text-small`}><Link className="underline" href="/aviso-legal">Aviso legal</Link> · <Link className="underline" href="/cookies">Cookies</Link> · <Link className="underline" href="/contacto">Contacto</Link>.</p>
      </article>
    </main>
  );
}
