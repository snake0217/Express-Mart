/**
 * Módulo de Páginas Informativas y Legales de ExpressMart México.
 * Conforme a LFPDPPP, LFPC y Manual de Calidad SGC MC-001.
 */

// ============================================================================
// CATÁLOGO DE CONTENIDOS INFORMATIVOS Y LEGALES (INFO_PAGES)
// ============================================================================
const INFO_PAGES = {
  vender: {
    icon: 'storefront',
    title: '¿Quieres vender con nosotros en ExpressMart?',
    subtitle: 'Marketplace Oficial para Sellers y Marcas en México',
    renderHtml: () => `
      <div class="space-y-4">
        <div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <span class="material-symbols-outlined text-amber-600 text-[28px] shrink-0">workspace_premium</span>
          <div>
            <h4 class="font-bold text-on-surface text-sm">¡Comisión 0% durante tus primeros 90 días de ventas!</h4>
            <p class="text-xs text-secondary mt-0.5">
              Únete a la red de más de 1,200 comercios y fabricantes mexicanos que distribuyen sus productos a través de nuestra infraestructura logística.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="p-3.5 rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-1">
            <div class="flex items-center gap-2 font-bold text-sm text-primary">
              <span class="material-symbols-outlined text-[20px]">payments</span>
              <span>Dispersión Semanal Vía SPEI</span>
            </div>
            <p class="text-xs text-secondary leading-relaxed">
              Recibe tus liquidaciones directamente en tu cuenta CLABE cada viernes sin cobro de comisiones interbancarias ni montos mínimos de retiro.
            </p>
          </div>

          <div class="p-3.5 rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-1">
            <div class="flex items-center gap-2 font-bold text-sm text-primary">
              <span class="material-symbols-outlined text-[20px]">local_shipping</span>
              <span>Logística ExpressPrime CEDIS</span>
            </div>
            <p class="text-xs text-secondary leading-relaxed">
              Almacena tu inventario en nuestro CEDIS CDMX Norte y nos encargamos de empaque, recolección y entrega con garantía en 24 a 48 horas.
            </p>
          </div>

          <div class="p-3.5 rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-1">
            <div class="flex items-center gap-2 font-bold text-sm text-primary">
              <span class="material-symbols-outlined text-[20px]">receipt_long</span>
              <span>Facturación CFDI 4.0 SAT</span>
            </div>
            <p class="text-xs text-secondary leading-relaxed">
              Cumplimiento automático de retenciones de ISR e IVA ante el SAT y emisión automatizada de comprobantes fiscales a compradores.
            </p>
          </div>

          <div class="p-3.5 rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-1">
            <div class="flex items-center gap-2 font-bold text-sm text-primary">
              <span class="material-symbols-outlined text-[20px]">security</span>
              <span>Protección Antifraude PCI DSS</span>
            </div>
            <p class="text-xs text-secondary leading-relaxed">
              Cero riesgo de contracargos con validación 3D Secure 2.0 y tokenización bancaria respaldada por ExpressMart.
            </p>
          </div>
        </div>

        <div class="p-4 rounded-xl bg-surface border border-surface-container space-y-2">
          <h4 class="font-bold text-sm text-on-surface flex items-center gap-1.5">
            <span class="material-symbols-outlined text-primary text-[18px]">checklist</span>
            Requisitos indispensables para darte de alta
          </h4>
          <ul class="text-xs text-secondary space-y-1 list-disc list-inside">
            <li>RFC con Constancia de Situación Fiscal vigente (&lt; 3 meses) de Persona Física con Actividad Empresarial o Persona Moral.</li>
            <li>Cuenta bancaria CLABE mexicana a nombre del titular o razón social registrada.</li>
            <li>Identificación oficial vigente del representante legal (INE o Pasaporte).</li>
            <li>Garantía de satisfacción de 30 días naturales en todos los productos.</li>
          </ul>
        </div>

        <!-- Formulario o acción de alta -->
        <div class="p-4 rounded-xl bg-surface-container-low border border-surface-dim space-y-3">
          <h4 class="font-bold text-sm text-on-surface">Registro Rápido de Solicitud de Vendedor</h4>
          <form id="form-vender-express" class="space-y-2.5">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="text" id="vend-nombre" placeholder="Nombre Comercial o Empresa" required class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full" />
              <input type="text" id="vend-rfc" placeholder="RFC (12 o 13 caracteres)" required maxlength="13" class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="email" id="vend-email" placeholder="Correo electrónico de contacto" required class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full" />
              <input type="tel" id="vend-tel" placeholder="Teléfono de contacto (10 dígitos)" required maxlength="10" class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full" />
            </div>
            <select id="vend-cat" class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full">
              <option value="Electronica">Electrónica, Laptops y Telefonía</option>
              <option value="Videojuegos">Videojuegos, Consolas y Accesorios</option>
              <option value="Hogar">Hogar, Cocina y Oficina</option>
              <option value="Deportes">Deportes, Suplementos y Fitness</option>
              <option value="Automotriz">Automotriz y Maquinaria</option>
              <option value="Otros">Otras Categorías</option>
            </select>
            <div id="vender-result-box"></div>
            <button type="submit" class="w-full py-2.5 rounded-lg bg-primary text-on-primary font-bold text-xs hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5 shadow-sm cursor-pointer">
              <span class="material-symbols-outlined text-[16px]">send</span>
              <span>Enviar Solicitud de Vendedor ExpressMart</span>
            </button>
          </form>
        </div>
      </div>
    `,
    initListeners: () => {
      const form = document.getElementById('form-vender-express');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const folio = 'SELL-' + Math.floor(100000 + Math.random() * 900000);
          const resBox = document.getElementById('vender-result-box');
          if (resBox) {
            resBox.innerHTML = `
              <div class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs space-y-1">
                <div class="flex items-center gap-1.5 font-bold">
                  <span class="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>¡Solicitud de Vendedor Recibida con Éxito!</span>
                </div>
                <p>Folio Oficial: <strong class="font-mono text-emerald-900">${folio}</strong>. Nuestro equipo de Onboarding de Sellers validará tu información en menos de 24 horas.</p>
              </div>
            `;
          }
          form.reset();
        });
      }
    }
  },

  trabajar: {
    icon: 'work',
    title: 'Trabajar en ExpressMart México',
    subtitle: 'Forma parte del equipo que revoluciona el e-commerce y la tecnología en México',
    renderHtml: () => `
      <div class="space-y-4">
        <div class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
          <span class="material-symbols-outlined text-emerald-600 text-[28px] shrink-0">groups</span>
          <div>
            <h4 class="font-bold text-on-surface text-sm">Cultura de Innovación, Seguridad y Bienestar</h4>
            <p class="text-xs text-secondary mt-0.5">
              En ExpressMart creemos en el talento mexicano. Ofrecemos prestaciones superiores a la ley, esquema híbrido o 100% remoto, y crecimiento continuo.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="p-3 rounded-xl bg-surface-container-low border border-surface-container text-center">
            <span class="material-symbols-outlined text-primary text-[24px]">favorite</span>
            <h5 class="font-bold text-xs text-on-surface mt-1">Salud Integral</h5>
            <p class="text-[11px] text-secondary">SGMM familiar, seguro de vida, dental y visual desde el día 1.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface-container-low border border-surface-container text-center">
            <span class="material-symbols-outlined text-primary text-[24px]">savings</span>
            <h5 class="font-bold text-xs text-on-surface mt-1">Ahorro y Bonos</h5>
            <p class="text-[11px] text-secondary">Fondo de ahorro 13%, vales de despensa y 30 días de aguinaldo.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface-container-low border border-surface-container text-center">
            <span class="material-symbols-outlined text-primary text-[24px]">laptop_chromebook</span>
            <h5 class="font-bold text-xs text-on-surface mt-1">Flexibilidad</h5>
            <p class="text-[11px] text-secondary">Home office flexible, presupuesto para setup y cursos pagados.</p>
          </div>
        </div>

        <!-- Vacantes activas -->
        <div class="space-y-2">
          <h4 class="font-bold text-sm text-on-surface flex items-center gap-1.5">
            <span class="material-symbols-outlined text-primary text-[18px]">work_outline</span>
            Vacantes Abiertas Actualmente en México
          </h4>
          <div class="space-y-2">
            <div class="p-3 rounded-xl bg-surface border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span class="text-xs font-bold text-on-surface block">Ingeniero/a de Software Full Stack (Node.js &amp; SQLite)</span>
                <span class="text-[11px] text-secondary">Ingeniería &amp; Plataforma · Remoto México · Tiempo Completo</span>
              </div>
              <span class="px-2 py-1 rounded bg-blue-100 text-blue-900 text-[10px] font-bold w-fit">Contratación Inmediata</span>
            </div>

            <div class="p-3 rounded-xl bg-surface border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span class="text-xs font-bold text-on-surface block">Auditor/a de Ciberseguridad &amp; Cumplimiento</span>
                <span class="text-[11px] text-secondary">Seguridad de la Información · Paseo de la Reforma, CDMX (Híbrido)</span>
              </div>
              <span class="px-2 py-1 rounded bg-emerald-100 text-emerald-900 text-[10px] font-bold w-fit">Vacante Abierta</span>
            </div>

            <div class="p-3 rounded-xl bg-surface border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span class="text-xs font-bold text-on-surface block">Coordinador/a de Operaciones Logísticas CEDIS Full</span>
                <span class="text-[11px] text-secondary">Cadena de Suministro · CEDIS CDMX Norte · Tiempo Completo</span>
              </div>
              <span class="px-2 py-1 rounded bg-amber-100 text-amber-900 text-[10px] font-bold w-fit">Vacante Abierta</span>
            </div>

            <div class="p-3 rounded-xl bg-surface border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span class="text-xs font-bold text-on-surface block">Especialista en Atención al Cliente &amp; Conciliaciones</span>
                <span class="text-[11px] text-secondary">Experiencia del Cliente · Remoto / Turno Mixto · Tiempo Completo</span>
              </div>
              <span class="px-2 py-1 rounded bg-purple-100 text-purple-900 text-[10px] font-bold w-fit">Vacante Abierta</span>
            </div>
          </div>
        </div>

        <!-- Formulario de Postulación -->
        <div class="p-4 rounded-xl bg-surface-container-low border border-surface-dim space-y-3">
          <h4 class="font-bold text-sm text-on-surface">Postulación Rápida de Candidatura</h4>
          <form id="form-trabajar-express" class="space-y-2.5">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="text" id="cand-nombre" placeholder="Tu nombre completo" required class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full" />
              <input type="email" id="cand-email" placeholder="Correo electrónico" required class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="tel" id="cand-tel" placeholder="Teléfono (10 dígitos)" required maxlength="10" class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full" />
              <select id="cand-vacante" class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full">
                <option value="dev">Ingeniero/a de Software Full Stack</option>
                <option value="security">Auditor/a de Ciberseguridad y Cumplimiento</option>
                <option value="logistica">Coordinador/a Logística CEDIS</option>
                <option value="cx">Especialista en Atención y Soluciones</option>
                <option value="general">Bolsa General / Otras Áreas</option>
              </select>
            </div>
            <input type="url" id="cand-link" placeholder="Enlace a tu perfil de LinkedIn o portafolio / CV en PDF (opcional)" class="h-9 px-3 rounded-lg bg-surface border border-surface-dim text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-full" />
            <div id="trabajar-result-box"></div>
            <button type="submit" class="w-full py-2.5 rounded-lg bg-primary text-on-primary font-bold text-xs hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5 shadow-sm cursor-pointer">
              <span class="material-symbols-outlined text-[16px]">send</span>
              <span>Enviar Mi Postulación a Recursos Humanos</span>
            </button>
          </form>
        </div>
      </div>
    `,
    initListeners: () => {
      const form = document.getElementById('form-trabajar-express');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const folio = 'TALENT-' + Math.floor(100000 + Math.random() * 900000);
          const resBox = document.getElementById('trabajar-result-box');
          if (resBox) {
            resBox.innerHTML = `
              <div class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs space-y-1">
                <div class="flex items-center gap-1.5 font-bold">
                  <span class="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>¡Postulación Recibida Exitosamente!</span>
                </div>
                <p>Folio de Seguimiento: <strong class="font-mono text-emerald-900">${folio}</strong>. El equipo de Talento ExpressMart revisará tu perfil y te contactará en un plazo máximo de 48 horas hábiles.</p>
              </div>
            `;
          }
          form.reset();
        });
      }
    }
  },

  'aviso-privacidad': {
    icon: 'shield',
    title: 'Aviso de Privacidad Integral',
    subtitle: 'Compromiso de Privacidad y Protección de Datos Personales',
    renderHtml: () => `
      <div class="space-y-4 text-xs leading-relaxed text-secondary">
        <div class="p-3 rounded-xl bg-surface border border-surface-container text-on-surface">
          <p class="font-semibold">
            TiendaExpress Online, S.A. de C.V. (en lo sucesivo "ExpressMart México"), con domicilio legal en Av. Paseo de la Reforma 450, Piso 18, Col. Juárez, Alcaldía Cuauhtémoc, C.P. 06600, Ciudad de México, es el responsable del tratamiento y resguardo de sus datos personales.
          </p>
        </div>

        <div>
          <h4 class="font-bold text-sm text-on-surface mb-1 flex items-center gap-1">
            <span class="material-symbols-outlined text-primary text-[16px]">badge</span>
            1. Datos Personales Recabados
          </h4>
          <p>
            Recabamos datos de identificación y contacto (nombre completo, correo electrónico, teléfono, dirección física de entrega), datos fiscales para facturación (RFC, razón social, código postal, régimen fiscal) y huellas digitales de pago tokenizadas.
          </p>
          <div class="mt-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-950 font-medium">
            🔒 <strong>Política de Seguridad Financiera:</strong> ExpressMart México <u>nunca almacena números completos de tarjetas de crédito o débito ni códigos de seguridad CVV/CVC</u>. Todos los cobros se realizan bajo estándares internacionales de máxima seguridad bancaria mediante tokenización cifrada.
          </div>
        </div>

        <div>
          <h4 class="font-bold text-sm text-on-surface mb-1 flex items-center gap-1">
            <span class="material-symbols-outlined text-primary text-[16px]">task_alt</span>
            2. Finalidades Primarias (Necesarias para el Servicio)
          </h4>
          <ul class="list-disc list-inside space-y-1">
            <li>Gestión, procesamiento y confirmación de pedidos y transacciones en el marketplace.</li>
            <li>Emisión de facturas electrónicas con desglose del 16% de IVA conforme a disposiciones fiscales.</li>
            <li>Logística de empaque, recolección y entrega a domicilio a través de la red CEDIS.</li>
            <li>Atención de garantías de 30 días, devoluciones y resolución ágil de aclaraciones con respaldo al consumidor.</li>
            <li>Prevención de fraudes, verificación de identidad y mitigación de transacciones sospechosas.</li>
          </ul>
        </div>

        <div>
          <h4 class="font-bold text-sm text-on-surface mb-1 flex items-center gap-1">
            <span class="material-symbols-outlined text-primary text-[16px]">campaign</span>
            3. Finalidades Secundarias
          </h4>
          <p>
            Envío de ofertas comerciales, promociones exclusivas del programa ExpressPrime y encuestas de calidad de servicio. Puede rechazar el uso para estas finalidades en cualquier momento en el apartado "Cuenta y Privacidad" de su perfil.
          </p>
        </div>

        <div>
          <h4 class="font-bold text-sm text-on-surface mb-1 flex items-center gap-1">
            <span class="material-symbols-outlined text-primary text-[16px]">lock_reset</span>
            4. Medidas de Seguridad de la Información
          </h4>
          <p>
            Implementamos rigurosos controles de seguridad de la información: cifrado de datos en reposo y en tránsito (TLS 1.3, AES-256), hashing robusto con sales criptográficas y políticas de control de accesos basados en roles.
          </p>
        </div>

        <div class="pt-2 border-t border-surface-container flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Contacto de la Unidad de Privacidad: <strong>privacidad@expressmart.mx</strong></span>
          <span class="text-xs text-secondary">Atención de Lunes a Viernes de 9:00 a 18:00 hrs.</span>
        </div>
      </div>
    `
  },

  'derechos-arco': {
    icon: 'contact_page',
    title: 'Procedimiento de Ejercicio de Derechos de Privacidad',
    subtitle: 'Acceso, Rectificación, Cancelación y Oposición de Datos Personales',
    renderHtml: () => `
      <div class="space-y-4 text-xs leading-relaxed text-secondary">
        <p>
          Usted o su representante legal debidamente acreditado tienen derecho a ejercer sus derechos de privacidad en todo momento respecto a sus datos personales resguardados por ExpressMart México:
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-on-surface">
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <span class="font-bold text-primary block mb-1">A — Acceso</span>
            <p class="text-secondary text-[11px]">Conocer qué datos personales suyos poseemos, su origen y las condiciones de su tratamiento.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <span class="font-bold text-primary block mb-1">R — Rectificación</span>
            <p class="text-secondary text-[11px]">Solicitar la corrección de datos personales que sean inexactos, desactualizados o incompletos.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <span class="font-bold text-primary block mb-1">C — Cancelación</span>
            <p class="text-secondary text-[11px]">Solicitar la eliminación de sus datos de nuestros registros cuando no se requieran legalmente.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <span class="font-bold text-primary block mb-1">O — Oposición</span>
            <p class="text-secondary text-[11px]">Oponerse al tratamiento de sus datos para finalidades secundarias (mercadotecnia y perfiles).</p>
          </div>
        </div>

        <div class="p-3 rounded-xl bg-surface-container-low border border-surface-container">
          <h5 class="font-bold text-sm text-on-surface mb-1">Tiempos de Respuesta</h5>
          <p>
            Conforme a nuestras políticas de protección de datos, ExpressMart dará respuesta formal a su solicitud en un plazo máximo de <strong>20 días hábiles</strong>. De resultar procedente, se ejecutará dentro de los <strong>15 días hábiles</strong> siguientes.
          </p>
        </div>

        <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-950 flex items-center justify-between gap-3">
          <div>
            <span class="font-bold text-xs block">¿Deseas enviar una solicitud de privacidad?</span>
            <span class="text-[11px]">Comunícate directamente a nuestra unidad especializada en privacidad.</span>
          </div>
          <a href="mailto:privacidad@expressmart.mx" class="px-4 py-2 rounded-lg bg-emerald-700 text-white font-bold text-xs shrink-0 cursor-pointer hover:bg-emerald-800">
            Contactar por Correo
          </a>
        </div>
      </div>
    `
  },

  'terminos-condiciones': {
    icon: 'gavel',
    title: 'Términos y Condiciones Generales de Compraventa',
    subtitle: 'Términos de Servicio y Protección al Comprador',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <div>
          <h4 class="font-bold text-sm text-on-surface mb-1">1. Precios y Divisa Oficial</h4>
          <p>
            Todos los precios publicados en ExpressMart están expresados en <strong>Pesos Mexicanos ($ MXN)</strong> e incluyen puntualmente el 16% del Impuesto al Valor Agregado (IVA). No existen cargos ocultos ni comisiones imprevistas al momento de pagar.
          </p>
        </div>
        <div>
          <h4 class="font-bold text-sm text-on-surface mb-1">2. Inventario y Despacho</h4>
          <p>
            El stock mostrado en la plataforma se actualiza en tiempo real contra los registros de nuestro CEDIS CDMX Norte. En caso fortuito de discrepancia de stock, el cliente tiene derecho a la sustitución inmediata o reembolso total al 100%.
          </p>
        </div>
        <div>
          <h4 class="font-bold text-sm text-on-surface mb-1">3. Cancelación Sin Penalización</h4>
          <p>
            El usuario podrá cancelar cualquier orden de compra antes de que el pedido sea recolectado por la paquetería sin costo ni penalización alguna, reintegrándose los fondos inmediatamente.
          </p>
        </div>
        <div>
          <h4 class="font-bold text-sm text-on-surface mb-1">4. Jurisdicción y Competencia</h4>
          <p>
            Para la interpretación de estos términos, las partes se someten a la competencia administrativa de la Procuraduría Federal del Consumidor (PROFECO) y a las leyes federales de los Estados Unidos Mexicanos.
          </p>
        </div>
      </div>
    `
  },

  'garantias-devoluciones': {
    icon: 'assignment_return',
    title: 'Garantía Oficial de 30 Días y Devoluciones',
    subtitle: 'Garantía de Satisfacción Total ExpressMart',
    renderHtml: () => `
      <div class="space-y-4 text-xs leading-relaxed text-secondary">
        <div class="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-on-surface">
          <h4 class="font-bold text-sm text-primary mb-1">¡Cero Complicaciones en Devoluciones!</h4>
          <p>
            Todos los artículos comprados en ExpressMart México cuentan con <strong>30 días naturales de garantía directa</strong> a partir de la fecha de entrega física.
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-on-surface">
          <div class="p-2.5 rounded-lg bg-surface border border-surface-container">
            <span class="material-symbols-outlined text-primary text-[22px]">history</span>
            <span class="font-bold text-xs block mt-1">1. Solicita</span>
            <span class="text-[11px] text-secondary">Desde "Mis Pedidos" con un solo clic.</span>
          </div>
          <div class="p-2.5 rounded-lg bg-surface border border-surface-container">
            <span class="material-symbols-outlined text-primary text-[22px]">local_shipping</span>
            <span class="font-bold text-xs block mt-1">2. Envía Gratis</span>
            <span class="text-[11px] text-secondary">Guía prepagada sin costo alguno.</span>
          </div>
          <div class="p-2.5 rounded-lg bg-surface border border-surface-container">
            <span class="material-symbols-outlined text-primary text-[22px]">credit_card</span>
            <span class="font-bold text-xs block mt-1">3. Reembolso</span>
            <span class="text-[11px] text-secondary">Acreditación en 24 a 48 horas hábiles.</span>
          </div>
        </div>

        <div class="space-y-1">
          <h5 class="font-bold text-xs text-on-surface">Condiciones para devolución:</h5>
          <ul class="list-disc list-inside space-y-0.5 text-secondary">
            <li>El producto debe incluir sus empaques originales, manuales y accesorios completos.</li>
            <li>En electrónicos y consolas, no debe presentar manipulación física ni software alterado.</li>
          </ul>
        </div>
      </div>
    `
  },

  'seguridad-iso': {
    icon: 'verified',
    title: 'Estándares de Calidad y Ciberseguridad',
    subtitle: 'Calidad del Software, Integridad de Datos y Seguridad Global',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <p>
          ExpressMart implementa las mejores prácticas mundiales de ingeniería de software y seguridad de la información:
        </p>
        <div class="space-y-2">
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <h5 class="font-bold text-xs text-primary">Adecuación Funcional y Fiabilidad de Software</h5>
            <p class="text-[11px] mt-0.5">Control de cobertura de pruebas riguroso, arquitectura tolerante a fallos y verificación de integridad transaccional.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <h5 class="font-bold text-xs text-primary">Calidad e Integridad de los Datos</h5>
            <p class="text-[11px] mt-0.5">Completitud, consistencia, exactitud y credibilidad de los registros de catálogo, stock e histórico de transacciones.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <h5 class="font-bold text-xs text-primary">Sistema Integral de Gestión de Seguridad</h5>
            <p class="text-[11px] mt-0.5">Controles de cifrado, gestión de vulnerabilidades, planes de contingencia operativa y trazabilidad inmutable de accesos.</p>
          </div>
        </div>
      </div>
    `
  },

  'seguridad-owasp': {
    icon: 'security',
    title: 'Protección contra Vulnerabilidades y Amenazas Web',
    subtitle: 'Arquitectura Segura y Mitigación Integral de Riesgos',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <p>
          Nuestra plataforma cuenta con barreras activas de mitigación contra las principales amenazas web:
        </p>
        <ul class="list-disc list-inside space-y-1">
          <li><strong>Inyección SQL:</strong> Consultas 100% parametrizadas (Prepared Statements) sin interpolación directa de cadenas.</li>
          <li><strong>Cross-Site Scripting (XSS):</strong> Sanitización estricta de entradas y cabeceras de Content Security Policy (CSP).</li>
          <li><strong>Control de Acceso Robusto:</strong> Verificación de roles en cada endpoint (Cliente, Vendedor, Auditor, Admin).</li>
          <li><strong>Rate Limiting &amp; Anti-Brute Force:</strong> Protección contra ataques distribuidos de denegación de servicio y fuerza bruta.</li>
        </ul>
      </div>
    `
  },

  'seguridad-pci': {
    icon: 'lock',
    title: 'Protección Financiera y Tokenización de Pagos',
    subtitle: 'Transacciones Cifradas y Pasarelas de Pago Seguras',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <p>
          La seguridad de tus tarjetas y fondos es nuestra máxima prioridad:
        </p>
        <div class="p-3 rounded-xl bg-surface border border-surface-container space-y-2 text-on-surface">
          <div class="flex items-center gap-2 font-bold text-xs text-emerald-700">
            <span class="material-symbols-outlined text-[18px]">verified_user</span>
            <span>Entorno Seguro y Cifrado para Procesamiento de Tarjetas</span>
          </div>
          <p class="text-xs text-secondary leading-relaxed">
            ExpressMart no almacena números de tarjeta (PAN), fechas completas ni códigos CVV en su base de datos. Los datos sensibles se intercambian directamente mediante tokens criptográficos efímeros con los procesadores bancarios autorizados.
          </p>
        </div>
      </div>
    `
  },

  profeco: {
    icon: 'verified',
    title: 'Protección y Respaldo al Consumidor en México',
    subtitle: 'Lineamientos y Código de Ética en Comercio Electrónico',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <p>
          ExpressMart México opera bajo los lineamientos y principios del Código de Ética en Comercio Electrónico de la Procuraduría Federal del Consumidor:
        </p>
        <ul class="list-disc list-inside space-y-1">
          <li>Precios claros, finales y con IVA incluido en Moneda Nacional ($ MXN).</li>
          <li>Información completa sobre especificaciones, modelo, marca y origen de los productos.</li>
          <li>Procedimiento accesible de conciliación y atención inmediata a quejas de clientes.</li>
        </ul>
      </div>
    `
  },

  'pagos-tarjetas': {
    icon: 'credit_card',
    title: 'Tarjetas Bancarias y Meses Sin Intereses (MSI)',
    subtitle: 'Visa, Mastercard, American Express y Tarjetas de Débito Mexicanas',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <p>
          Aceptamos todas las tarjetas de crédito y débito emitidas en México por bancos participantes (BBVA, Banorte, Santander, Citibanamex, HSBC, Scotiabank, Nu, Hey Banco):
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-on-surface">
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <span class="font-bold text-xs text-primary block mb-1">Meses Sin Intereses (MSI)</span>
            <p class="text-[11px] text-secondary">Hasta 12 Meses Sin Intereses en compras seleccionadas de Electrónica, Consolas y Cómputo participantes.</p>
          </div>
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <span class="font-bold text-xs text-primary block mb-1">Cifrado de Extremo a Extremo</span>
            <p class="text-[11px] text-secondary">Transacciones aseguradas con protocolo TLS 1.3 y autenticación reforzada 3D Secure 2.0.</p>
          </div>
        </div>
      </div>
    `
  },

  'pagos-paypal': {
    icon: 'account_balance_wallet',
    title: 'Integración Oficial con PayPal México Sandbox',
    subtitle: 'Pagos rápidos y seguros sin compartir tus datos bancarios',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <div class="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-on-surface">
          <h4 class="font-bold text-sm text-blue-900 mb-1 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            PayPal Sandbox Oficial Integrado
          </h4>
          <p class="text-xs text-secondary leading-relaxed">
            Puedes simular y procesar pagos directos tanto en compras del catálogo como en la suscripción a ExpressPrime ingresando las credenciales de la cuenta sandbox oficial de PayPal México:
            <div class="mt-2 space-y-1 bg-white p-2.5 rounded border border-blue-200 text-blue-950 font-mono text-[11px]">
              <div><strong>Correo:</strong> bancochido@banco.com</div>
              <div><strong>Contraseña:</strong> nBBi"*d6</div>
              <div><strong>URL Sandbox:</strong> https://sandbox.paypal.com</div>
            </div>
          </p>
        </div>
        <p>
          Disfruta de la Protección al Comprador de PayPal con reembolsos automáticos en caso de incidentes de entrega.
        </p>
      </div>
    `
  },

  facturacion: {
    icon: 'receipt_long',
    title: 'Facturación Electrónica Fiscal CFDI 4.0',
    subtitle: 'Comprobantes Fiscales Digitales por Internet conformes con el SAT',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <p>
          ExpressMart México emite comprobantes fiscales digitales versión 4.0 por todas las compras realizadas:
        </p>
        <ul class="list-disc list-inside space-y-1">
          <li>Desglose exacto del 16% de IVA conforme al Código Fiscal de la Federación.</li>
          <li>Puedes registrar tu RFC, Régimen Fiscal y Uso de CFDI directamente en tu perfil antes o después de tu compra.</li>
          <li>Descarga de archivos XML y PDF timbrados ante el SAT en cualquier momento desde "Mis Pedidos".</li>
        </ul>
      </div>
    `
  },

  ayuda: {
    icon: 'support_agent',
    title: 'Centro de Ayuda al Cliente 24/7',
    subtitle: 'Soporte, Aclaraciones y Seguimiento de Envíos ExpressMart',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <p>
          Estamos disponibles para ayudarte en cualquier momento a través de nuestros canales oficiales:
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-on-surface">
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <span class="material-symbols-outlined text-primary text-[20px]">call</span>
            <span class="font-bold text-xs block mt-1">Línea Telefónica Gratuita</span>
            <span class="text-[11px] text-secondary">800-EXPRESS (800-397-7377) · Lunes a Domingo 24h</span>
          </div>
          <div class="p-3 rounded-xl bg-surface border border-surface-container">
            <span class="material-symbols-outlined text-primary text-[20px]">mail</span>
            <span class="font-bold text-xs block mt-1">Atención por Correo</span>
            <span class="text-[11px] text-secondary">soporte@expressmart.mx · Respuesta en &lt; 2 horas</span>
          </div>
        </div>
      </div>
    `
  },

  afiliados: {
    icon: 'handshake',
    title: 'Programa de Afiliados y Creadores ExpressMart',
    subtitle: 'Monetiza tu contenido recomendando los mejores productos de México',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <p>
          Gana hasta un <strong>8% de comisión</strong> por cada compra referida a través de tus enlaces personalizados en redes sociales, blogs o canales de streaming.
        </p>
        <ul class="list-disc list-inside space-y-1">
          <li>Panel de analítica de clics y conversiones en tiempo real.</li>
          <li>Depósitos mensuales directos vía SPEI a tu cuenta bancaria.</li>
          <li>Herramientas para generación rápida de banners y enlaces de producto.</li>
        </ul>
      </div>
    `
  },

  cedis: {
    icon: 'warehouse',
    title: 'Red Logística y Centro de Distribución CEDIS CDMX',
    subtitle: 'Infraestructura de Última Milla ExpressPrime México',
    renderHtml: () => `
      <div class="space-y-3 text-xs leading-relaxed text-secondary">
        <p>
          Contamos con un Centro de Distribución principal ubicado estratégicamente en CDMX Norte con más de 15,000 m² de capacidad y certificación de seguridad en cadena de suministro:
        </p>
        <ul class="list-disc list-inside space-y-1">
          <li>Entregas garantizadas el mismo día (Same-Day Delivery) en Área Metropolitana de CDMX.</li>
          <li>Cobertura nacional en 24 a 48 horas mediante convenios directos con paqueterías líderes.</li>
          <li>Trazabilidad por código de barras y monitoreo GPS de unidades en ruta.</li>
        </ul>
      </div>
    `
  }
};

function openInfoModal(key) {
  const page = INFO_PAGES[key];
  const dialog = document.getElementById('info-modal');
  if (!dialog || !page) return;

  const iconEl = document.getElementById('info-modal-icon');
  const titleEl = document.getElementById('info-modal-title');
  const subtitleEl = document.getElementById('info-modal-subtitle');
  const bodyEl = document.getElementById('info-modal-body');

  if (iconEl) iconEl.textContent = page.icon || 'info';
  if (titleEl) titleEl.textContent = page.title;
  if (subtitleEl) subtitleEl.textContent = page.subtitle || 'ExpressMart Marketplace México';
  if (bodyEl) {
    bodyEl.innerHTML = typeof page.renderHtml === 'function' ? page.renderHtml() : '<p>Información no disponible.</p>';
  }

  if (typeof page.initListeners === 'function') {
    page.initListeners();
  }

  dialog.showModal();
}


window.INFO_PAGES = INFO_PAGES;
window.openInfoModal = openInfoModal;
