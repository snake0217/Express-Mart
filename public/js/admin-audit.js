/**
 * Módulo de Administración, Métricas de Calidad ISO 25012 y Centro de Auditoría D8.
 * Conforme a SGC MC-001 v1.0.
 */
async function loadAdminReports() {
  const box = document.getElementById('admin-reports-box');
  try {
    const rep = await apiFetch('/api/reports/summary');
    box.innerHTML = `
      <div class="kpis-grid mb-3">
        <div class="kpi-card"><div>Pedidos Activos</div><div class="kpi-val">${rep.ventas.totalPedidos}</div></div>
        <div class="kpi-card"><div>Ingresos (MXN)</div><div class="kpi-val">${formatMxn(rep.ventas.ingresosTotalesMxn)}</div></div>
        <div class="kpi-card"><div>Ticket Promedio</div><div class="kpi-val">${formatMxn(rep.ventas.ticketPromedioMxn)}</div></div>
        <div class="kpi-card"><div>SKUs en Catálogo</div><div class="kpi-val">${rep.inventario.totalProductosActivos}</div></div>
      </div>
      <h4 class="font-label-lg text-label-lg font-bold mb-1">Conciliación de Inventario en Almacén (CEDIS CDMX Norte)</h4>
      <pre class="code-box">${JSON.stringify(rep.inventario.detalleInventario, null, 2)}</pre>
    `;
  } catch (err) {
    box.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

async function loadAuditCenter() {
  const kpiGrid = document.getElementById('audit-kpis-grid');
  try {
    const metrics = await apiFetch('/api/metrics');
    const k = metrics.kpisApartado7;
    kpiGrid.innerHTML = `
      <div class="kpi-card"><div>Disponibilidad (Meta ≥99.9%)</div><div class="kpi-val">${k.disponibilidadServicioPorcentaje}%</div></div>
      <div class="kpi-card"><div>Latencia Checkout (Meta ≤2000ms)</div><div class="kpi-val">${k.rendimientoCheckoutPromedioMs} ms</div></div>
      <div class="kpi-card"><div>Cobertura Pruebas (Meta ≥80%)</div><div class="kpi-val">${k.coberturaPruebasAutomatizadasPorcentaje}%</div></div>
      <div class="kpi-card"><div>Vulnerabilidades Críticas (Meta 0)</div><div class="kpi-val">${k.vulnerabilidadesCriticasAbiertas}</div></div>
      <div class="kpi-card"><div>Satisfacción Cliente (Meta ≥4.5)</div><div class="kpi-val">${k.satisfaccionClientePromedio} / 5</div></div>
    `;

    const dbPolicy = await apiFetch('/api/quality/database-policy');
    const policyEl = document.getElementById('db-policy-box');
    if (policyEl) {
      policyEl.textContent = JSON.stringify(dbPolicy, null, 2);
    }

    if (state.token && state.user && ['administrador', 'auditor'].includes(state.user.rol)) {
      const dq = await apiFetch('/api/quality/data-audit');
      document.getElementById('data-quality-box').textContent = JSON.stringify(dq, null, 2);

      const logs = await apiFetch('/api/audit-logs');
      document.getElementById('audit-logs-box').textContent = JSON.stringify(
        { cadenaIntegraSHA256: logs.chainIntact, totalRegistros: logs.totalEntries, ultimosEventos: logs.logs.slice(0, 8) },
        null,
        2
      );
    }
  } catch (err) {
    showAlert(err.message, true);
  }
}


let sellerDashboardData = null;
let sellerSelectedPlasticColor = '#1d4ed8';

const SELLER_PLASTIC_PALETTE = [
  { id: '#1d4ed8', name: 'Azul Rey PayPal', bg: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)', text: '#ffffff', badge: '#93c5fd' },
  { id: '#22c55e', name: 'Verde Esmeralda', bg: 'linear-gradient(135deg, #14532d 0%, #16a34a 60%, #4ade80 100%)', text: '#ffffff', badge: '#bbf7d0' },
  { id: '#0f172a', name: 'Negro Obsidiana', bg: 'linear-gradient(135deg, #020617 0%, #1e293b 60%, #334155 100%)', text: '#ffffff', badge: '#cbd5e1' },
  { id: '#d97706', name: 'Dorado VIP', bg: 'linear-gradient(135deg, #78350f 0%, #d97706 60%, #fbbf24 100%)', text: '#ffffff', badge: '#fef08a' },
  { id: '#7c3aed', name: 'Morado Neón', bg: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 60%, #a855f7 100%)', text: '#ffffff', badge: '#ddd6fe' },
  { id: '#e11d48', name: 'Rojo Carmesí', bg: 'linear-gradient(135deg, #881337 0%, #e11d48 60%, #fb7185 100%)', text: '#ffffff', badge: '#fecdd3' }
];

function getSellerPlasticStyle(hexColor) {
  const normalized = (hexColor || '#1d4ed8').toLowerCase();
  return SELLER_PLASTIC_PALETTE.find((c) => c.id.toLowerCase() === normalized) || SELLER_PLASTIC_PALETTE[0];
}

function generateSellerLuhnCard(brand = 'Visa') {
  let prefix = '403203';
  if (brand === 'Mastercard') prefix = '542523';
  if (brand === 'American Express') prefix = '378282';

  const digits = prefix.split('').map(Number);
  while (digits.length < 15) {
    digits.push(Math.floor(Math.random() * 10));
  }
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = digits[14 - i];
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  digits.push(checkDigit);
  return digits.join('');
}

async function loadSellerDashboard() {
  if (!state.token || !state.user || !['administrador', 'vendedor'].includes(state.user.rol)) {
    return;
  }

  try {
    const data = await apiFetch('/api/seller/dashboard');
    sellerDashboardData = data;

    // Actualizar nombre y rol del vendedor en el encabezado
    const nameEl = document.getElementById('seller-dash-vendor-name');
    if (nameEl) nameEl.textContent = data.vendedor.nombre || data.vendedor.email;
    const badgeEl = document.getElementById('seller-dash-vendor-badge');
    if (badgeEl) badgeEl.textContent = data.vendedor.rol.toUpperCase();

    // Actualizar KPIs del Vendedor
    const kpiIngresos = document.getElementById('seller-kpi-ingresos');
    if (kpiIngresos) kpiIngresos.textContent = formatMxn(data.metricas.totalIngresos);
    const kpiUnidades = document.getElementById('seller-kpi-unidades');
    if (kpiUnidades) kpiUnidades.textContent = `${data.metricas.unidadesVendidas} uds`;
    const kpiPedidos = document.getElementById('seller-kpi-pedidos');
    if (kpiPedidos) kpiPedidos.textContent = `${data.metricas.totalPedidos} pedidos`;
    const kpiProductos = document.getElementById('seller-kpi-productos');
    if (kpiProductos) kpiProductos.textContent = `${data.metricas.totalProductos} productos`;

    const cardBalEl = document.getElementById('seller-card-balance');
    if (cardBalEl) cardBalEl.textContent = formatMxn(data.metricas.saldoRecibido);
    const cardRevEl = document.getElementById('seller-card-total-sales');
    if (cardRevEl) cardRevEl.textContent = formatMxn(data.metricas.totalIngresos);

    // Renderizar Tarjeta Receptora de Cobros
    renderSellerReceivingCard(data.receivingCard);

    // Renderizar Tablas
    renderSellerProducts(data.productos);
    renderSellerSales(data.ventas);
  } catch (err) {
    showAlert(err.message, true);
  }
}

function renderSellerReceivingCard(card) {
  const slot = document.getElementById('seller-receiving-card-slot');
  const btnText = document.getElementById('btn-receiving-card-text');
  if (!slot) return;

  if (!card) {
    slot.innerHTML = `
      <div class="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center space-y-3">
        <div class="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <span class="material-symbols-outlined text-2xl">credit_card_off</span>
        </div>
        <div>
          <strong class="text-sm font-bold text-slate-800 block">Sin Tarjeta Receptora Asignada</strong>
          <p class="text-xs text-slate-500 mt-1">Vincula una tarjeta simulada para recibir los depósitos de tus ventas en MXN.</p>
        </div>
        <button type="button" id="btn-seller-add-first-card" class="px-4 py-2 rounded-xl bg-[#003087] hover:bg-[#002266] text-white text-xs font-bold cursor-pointer shadow-xs">
          + Agregar Tarjeta de Cobro
        </button>
      </div>
    `;
    const addFirstBtn = document.getElementById('btn-seller-add-first-card');
    if (addFirstBtn) addFirstBtn.addEventListener('click', openSellerReceivingCardModal);
    if (btnText) btnText.textContent = '+ Vincular Tarjeta de Cobro';
    return;
  }

  if (btnText) btnText.textContent = '💳 Cambiar Tarjeta de Cobro';

  const style = getSellerPlasticStyle(card.color_plastico);
  const cleanNum = String(card.numero_tarjeta || '').replace(/[\s-]/g, '');
  const last4 = cleanNum.slice(-4) || '0000';

  slot.innerHTML = `
    <div class="rounded-2xl p-6 text-white shadow-xl relative overflow-hidden transition-all duration-300 border border-white/10" style="background: ${style.bg};">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="w-10 h-7 rounded bg-amber-300/80 border border-amber-400 inline-block shadow-inner"></span>
          <span class="material-symbols-outlined text-[20px] opacity-80">contactless</span>
        </div>
        <div class="text-right">
          <span class="font-headline-md text-lg font-black tracking-wider italic uppercase">${card.marca || 'VISA'}</span>
          <span class="block text-[9px] uppercase tracking-widest opacity-85">RECEPTORA DE VENTAS</span>
        </div>
      </div>
      <div class="mt-5 font-mono text-lg sm:text-xl font-extrabold tracking-[3px] drop-shadow">
        •••• •••• •••• ${last4}
      </div>
      <div class="mt-4 flex items-end justify-between text-xs">
        <div>
          <span class="text-[9px] uppercase tracking-wider opacity-75 block">Titular</span>
          <span class="font-bold uppercase tracking-wide text-xs sm:text-sm drop-shadow-sm">${card.titular || 'VENDEDOR'}</span>
        </div>
        <div class="text-right">
          <span class="text-[9px] uppercase tracking-wider opacity-75 block">Expira</span>
          <span class="font-mono text-xs font-bold">${card.expiracion || '12/29'}</span>
        </div>
      </div>
      <div class="mt-3 pt-2 border-t border-white/20 flex items-center justify-between text-[11px]">
        <span>Saldo Disponible en Tarjeta:</span>
        <strong class="text-sm font-black text-amber-200">${formatMxn(card.saldo)}</strong>
      </div>
    </div>
  `;
}

function renderSellerProducts(products) {
  const container = document.getElementById('seller-products-container');
  if (!container) return;

  const filterVal = (document.getElementById('seller-products-search')?.value || '').toLowerCase().trim();
  const filtered = (products || []).filter((p) => {
    if (!filterVal) return true;
    return (
      (p.nombre && p.nombre.toLowerCase().includes(filterVal)) ||
      (p.sku && p.sku.toLowerCase().includes(filterVal)) ||
      (p.marca && p.marca.toLowerCase().includes(filterVal)) ||
      (p.categoria && p.categoria.toLowerCase().includes(filterVal))
    );
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="text-center py-10 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-3">
        <span class="material-symbols-outlined text-4xl text-slate-400">inventory_2</span>
        <div>
          <p class="text-sm font-bold text-slate-700">No hay productos que coincidan</p>
          <p class="text-xs text-slate-500 mt-0.5">Sube tus productos con el botón "+ Subir Producto" para que aparezcan aquí.</p>
        </div>
        <button type="button" id="btn-seller-empty-add-prod" class="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container cursor-pointer shadow-xs">
          + Subir mi Primer Producto
        </button>
      </div>
    `;
    const emptyBtn = document.getElementById('btn-seller-empty-add-prod');
    if (emptyBtn) emptyBtn.addEventListener('click', openSellerProductModal);
    return;
  }

  container.innerHTML = `
    <table class="w-full text-left text-xs border-collapse">
      <thead>
        <tr class="border-b border-surface-container text-secondary uppercase font-bold text-[11px]">
          <th class="py-3 px-3">Producto</th>
          <th class="py-3 px-3">Categoría</th>
          <th class="py-3 px-3">Precio</th>
          <th class="py-3 px-3 text-center">Stock</th>
          <th class="py-3 px-3 text-center">Ventas</th>
          <th class="py-3 px-3 text-center">Estado</th>
          <th class="py-3 px-3 text-right">Acciones</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-surface-container">
        ${filtered.map((p) => {
          const lowStock = (p.stock_disponible || 0) <= 3;
          const isActive = Boolean(p.activo);
          return `
            <tr class="hover:bg-surface-container-low transition-colors">
              <td class="py-3 px-3">
                <div class="flex items-center gap-3">
                  <img src="${p.imagen_url || '/assets/logo.png'}" alt="${p.nombre}" class="w-10 h-10 object-cover rounded-lg border border-slate-200 bg-white shrink-0" onerror="this.src='/assets/logo.png'" />
                  <div>
                    <strong class="text-xs text-on-surface block font-bold line-clamp-1">${p.nombre}</strong>
                    <span class="font-mono text-[10px] text-secondary">${p.sku}</span>
                  </div>
                </div>
              </td>
              <td class="py-3 px-3">
                <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">${p.categoria}</span>
                <span class="block text-[10px] text-secondary mt-0.5">${p.marca}</span>
              </td>
              <td class="py-3 px-3 font-bold text-on-surface">${formatMxn(p.precio)}</td>
              <td class="py-3 px-3 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${lowStock ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}">
                  ${p.stock_disponible} en almacén
                </span>
              </td>
              <td class="py-3 px-3 text-center">
                <span class="font-bold text-slate-800 text-xs">${p.total_vendido_unidades || 0} uds</span>
                <span class="block text-[10px] text-secondary font-mono">${formatMxn(p.total_vendido_monto || 0)}</span>
              </td>
              <td class="py-3 px-3 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}">
                  ${isActive ? 'Activo' : 'Pausado'}
                </span>
              </td>
              <td class="py-3 px-3 text-right">
                <button type="button" class="btn-seller-edit-stock px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-primary hover:text-white text-on-surface text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1" data-id="${p.id}">
                  <span class="material-symbols-outlined text-[14px]">edit</span>
                  <span>Editar</span>
                </button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  container.querySelectorAll('.btn-seller-edit-stock').forEach((btn) => {
    btn.addEventListener('click', () => {
      openSellerStockEditModal(Number(btn.dataset.id));
    });
  });
}

function renderSellerSales(sales) {
  const container = document.getElementById('seller-sales-container');
  if (!container) return;

  const filterVal = (document.getElementById('seller-sales-search')?.value || '').toLowerCase().trim();
  const filtered = (sales || []).filter((s) => {
    if (!filterVal) return true;
    return (
      (s.folio && s.folio.toLowerCase().includes(filterVal)) ||
      (s.nombre_producto && s.nombre_producto.toLowerCase().includes(filterVal)) ||
      (s.comprador_nombre && s.comprador_nombre.toLowerCase().includes(filterVal)) ||
      (s.estado && s.estado.toLowerCase().includes(filterVal))
    );
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="text-center py-10 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-2">
        <span class="material-symbols-outlined text-4xl text-slate-400">receipt</span>
        <p class="text-sm font-bold text-slate-700">Sin compras registradas aún</p>
        <p class="text-xs text-slate-500">En cuanto un cliente compre uno de tus productos, la orden y su abono aparecerán aquí.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <table class="w-full text-left text-xs border-collapse">
      <thead>
        <tr class="border-b border-surface-container text-secondary uppercase font-bold text-[11px]">
          <th class="py-3 px-3">Folio</th>
          <th class="py-3 px-3">Fecha</th>
          <th class="py-3 px-3">Producto Vendido</th>
          <th class="py-3 px-3 text-center">Cantidad</th>
          <th class="py-3 px-3 text-right">Precio Unit.</th>
          <th class="py-3 px-3 text-right">Subtotal MXN</th>
          <th class="py-3 px-3">Comprador</th>
          <th class="py-3 px-3 text-center">Estado</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-surface-container">
        ${filtered.map((s) => {
          let badgeClass = 'bg-blue-100 text-blue-800';
          if (s.estado === 'entregado') badgeClass = 'bg-emerald-100 text-emerald-800';
          if (s.estado === 'cancelado') badgeClass = 'bg-red-100 text-red-800';
          if (s.estado === 'en_ruta') badgeClass = 'bg-amber-100 text-amber-800';

          const dateStr = s.created_at ? new Date(s.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

          return `
            <tr class="hover:bg-surface-container-low transition-colors">
              <td class="py-3 px-3 font-mono font-bold text-primary">${s.folio || 'EM-ORD'}</td>
              <td class="py-3 px-3 text-secondary text-[11px]">${dateStr}</td>
              <td class="py-3 px-3 font-bold text-on-surface">${s.nombre_producto}</td>
              <td class="py-3 px-3 text-center font-bold">${s.cantidad}</td>
              <td class="py-3 px-3 text-right text-secondary">${formatMxn(s.precio_unitario)}</td>
              <td class="py-3 px-3 text-right font-extrabold text-emerald-700">${formatMxn(s.subtotal)}</td>
              <td class="py-3 px-3">
                <span class="font-bold text-on-surface block text-[11px]">${s.comprador_nombre || 'Cliente'}</span>
                <span class="text-[10px] text-secondary font-mono">${s.comprador_email || ''}</span>
              </td>
              <td class="py-3 px-3 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeClass}">
                  ${s.estado || 'pagado'}
                </span>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function openSellerProductModal() {
  const dlg = document.getElementById('seller-product-dialog');
  if (!dlg) return;

  const skuInput = document.getElementById('prod-sku');
  if (skuInput && (!skuInput.value || skuInput.value.startsWith('EM-VEN-'))) {
    skuInput.value = `EM-VEN-${Math.floor(100 + Math.random() * 900)}`;
  }

  if (typeof dlg.showModal === 'function') {
    if (!dlg.open) dlg.showModal();
  } else {
    dlg.setAttribute('open', 'open');
  }
}

function updateSellerCardPreview() {
  const preview = document.getElementById('seller-modal-card-preview');
  if (!preview) return;

  const style = getSellerPlasticStyle(sellerSelectedPlasticColor);
  preview.style.background = style.bg;

  const brand = document.getElementById('seller-card-brand-select')?.value || 'Visa';
  const brandEl = document.getElementById('seller-preview-brand');
  if (brandEl) brandEl.textContent = brand.toUpperCase();

  const num = document.getElementById('seller-card-num-input')?.value || '4032 0377 9923 0187';
  const numEl = document.getElementById('seller-preview-number');
  if (numEl) numEl.textContent = num;

  const holder = document.getElementById('seller-card-holder-input')?.value || 'VENDEDOR EXPRESSMART';
  const holderEl = document.getElementById('seller-preview-holder');
  if (holderEl) holderEl.textContent = holder.toUpperCase();

  const exp = document.getElementById('seller-card-exp-input')?.value || '12/29';
  const expEl = document.getElementById('seller-preview-exp');
  if (expEl) expEl.textContent = exp;

  const saldo = Number(document.getElementById('seller-card-saldo-input')?.value) || 0;
  const balEl = document.getElementById('seller-preview-balance');
  if (balEl) balEl.textContent = formatMxn(saldo);
}

function openSellerReceivingCardModal() {
  const dlg = document.getElementById('seller-receiving-card-dialog');
  if (!dlg) return;

  const userCards = (sellerDashboardData && Array.isArray(sellerDashboardData.userCards)) ? sellerDashboardData.userCards : [];
  const existingContainer = document.getElementById('seller-existing-cards-container');

  if (existingContainer) {
    if (!userCards.length) {
      existingContainer.innerHTML = `
        <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
          <p class="text-xs text-slate-600 font-semibold">No tienes tarjetas registradas en tu cuenta.</p>
          <button type="button" id="btn-seller-switch-new-mode" class="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-container cursor-pointer">
            ✨ Crear Nueva Tarjeta de Cobro
          </button>
        </div>
      `;
      const switchBtn = document.getElementById('btn-seller-switch-new-mode');
      if (switchBtn) {
        switchBtn.addEventListener('click', () => {
          document.getElementById('tab-btn-seller-card-new')?.click();
        });
      }
    } else {
      existingContainer.innerHTML = userCards.map((c) => {
        const style = getSellerPlasticStyle(c.color_plastico);
        const last4 = String(c.numero_tarjeta || '').replace(/[\s-]/g, '').slice(-4);
        const isCurrent = Boolean(c.es_receptora);
        return `
          <div class="p-3.5 rounded-xl border ${isCurrent ? 'border-primary ring-2 ring-primary/20 bg-blue-50/50' : 'border-slate-200 bg-white'} flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-12 h-8 rounded-lg shadow-sm flex items-center justify-center text-white text-[9px] font-black uppercase tracking-wider" style="background: ${style.bg};">
                ${c.marca}
              </div>
              <div>
                <strong class="text-xs text-slate-800 block font-mono">•••• •••• •••• ${last4}</strong>
                <span class="text-[11px] text-slate-500">${c.titular} · Saldo: <strong class="text-emerald-700">${formatMxn(c.saldo)}</strong></span>
              </div>
            </div>
            <div>
              ${isCurrent
                ? '<span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">Receptora Activa</span>'
                : `<button type="button" class="btn-seller-pick-card px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-white text-xs font-bold cursor-pointer" data-id="${c.id}">
                     Seleccionar
                   </button>`
              }
            </div>
          </div>
        `;
      }).join('');

      existingContainer.querySelectorAll('.btn-seller-pick-card').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            const cardId = Number(b.dataset.id);
            const res = await apiFetch('/api/seller/receiving-card', {
              method: 'POST',
              body: JSON.stringify({ cardId })
            });
            showAlert(res.message);
            dlg.close();
            loadSellerDashboard();
          } catch (err) {
            showAlert(err.message, true);
          }
        });
      });
    }
  }

  // Prellenar nombre del titular con el nombre del usuario
  const holderInput = document.getElementById('seller-card-holder-input');
  if (holderInput && state.user && state.user.nombre) {
    holderInput.value = state.user.nombre.toUpperCase();
  }

  // Renderizar Swatches de color
  const swatchesEl = document.getElementById('seller-plastic-color-swatches');
  if (swatchesEl) {
    swatchesEl.innerHTML = SELLER_PLASTIC_PALETTE.map((p) => `
      <button type="button" class="seller-plastic-swatch w-7 h-7 rounded-full transition-transform cursor-pointer border-2 ${p.id.toLowerCase() === sellerSelectedPlasticColor.toLowerCase() ? 'scale-125 border-white ring-2 ring-primary shadow-md' : 'border-transparent hover:scale-110'}" style="background: ${p.bg};" data-color="${p.id}" data-name="${p.name}" title="${p.name}"></button>
    `).join('');

    swatchesEl.querySelectorAll('.seller-plastic-swatch').forEach((sw) => {
      sw.addEventListener('click', () => {
        sellerSelectedPlasticColor = sw.dataset.color;
        const nameEl = document.getElementById('seller-selected-color-name');
        if (nameEl) nameEl.textContent = sw.dataset.name;
        swatchesEl.querySelectorAll('.seller-plastic-swatch').forEach((s) => {
          const match = s.dataset.color.toLowerCase() === sellerSelectedPlasticColor.toLowerCase();
          s.classList.toggle('scale-125', match);
          s.classList.toggle('border-white', match);
          s.classList.toggle('ring-2', match);
          s.classList.toggle('ring-primary', match);
        });
        updateSellerCardPreview();
      });
    });
  }

  updateSellerCardPreview();

  if (typeof dlg.showModal === 'function') {
    if (!dlg.open) dlg.showModal();
  } else {
    dlg.setAttribute('open', 'open');
  }
}

function openSellerStockEditModal(prodId) {
  const dlg = document.getElementById('seller-stock-dialog');
  if (!dlg || !sellerDashboardData) return;

  const prod = (sellerDashboardData.productos || []).find((p) => Number(p.id) === Number(prodId));
  if (!prod) {
    showAlert('Producto no encontrado.', true);
    return;
  }

  document.getElementById('seller-edit-product-id').value = prod.id;
  document.getElementById('seller-edit-product-name').textContent = prod.nombre;
  document.getElementById('seller-edit-product-sku').textContent = prod.sku;
  document.getElementById('seller-edit-stock-amount').value = prod.stock_disponible || 0;
  document.getElementById('seller-edit-stock-price').value = prod.precio || 1;
  document.getElementById('seller-edit-stock-active').value = prod.activo ? '1' : '0';

  if (typeof dlg.showModal === 'function') {
    if (!dlg.open) dlg.showModal();
  } else {
    dlg.setAttribute('open', 'open');
  }
}

function initAdminAuditEvents() {
  // Alta de Producto en Panel Administrativo / Vendedor
  const productForm = document.getElementById('admin-product-form');
  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const imgVal = document.getElementById('prod-imagen')?.value?.trim();
        const res = await apiFetch('/api/products', {
          method: 'POST',
          body: JSON.stringify({
            sku: document.getElementById('prod-sku').value,
            nombre: document.getElementById('prod-nombre').value,
            categoria: document.getElementById('prod-cat').value,
            marca: document.getElementById('prod-marca').value,
            precio: Number(document.getElementById('prod-precio').value),
            stock: Number(document.getElementById('prod-stock').value),
            imagen_url: imgVal || '/assets/logo.png',
            descripcion: document.getElementById('prod-desc').value,
            condiciones_envio: document.getElementById('prod-envio').value,
            especificaciones: { origen: 'Panel Oficial ExpressMart México' }
          })
        });
        showAlert(res.message);
        productForm.reset();
        const productModal = document.getElementById('seller-product-dialog');
        if (productModal && typeof productModal.close === 'function') productModal.close();
        loadCatalog();
        loadSellerDashboard();
        loadAdminReports();
      } catch (err) {
        showAlert(err.message, true);
      }
    });
  }

  // Botones para abrir modal de alta de producto
  document.getElementById('btn-open-seller-product-modal')?.addEventListener('click', openSellerProductModal);
  document.getElementById('btn-seller-add-prod-inline')?.addEventListener('click', openSellerProductModal);
  document.getElementById('btn-close-seller-product-modal')?.addEventListener('click', () => {
    document.getElementById('seller-product-dialog')?.close();
  });
  document.getElementById('btn-cancel-seller-product-modal')?.addEventListener('click', () => {
    document.getElementById('seller-product-dialog')?.close();
  });

  // Botón refrescar dashboard de vendedor
  document.getElementById('btn-refresh-seller-dash')?.addEventListener('click', loadSellerDashboard);

  // Botones para tarjeta receptora
  document.getElementById('btn-open-receiving-card-modal')?.addEventListener('click', openSellerReceivingCardModal);
  document.getElementById('btn-close-seller-card-modal')?.addEventListener('click', () => {
    document.getElementById('seller-receiving-card-dialog')?.close();
  });

  // Tabs dentro del modal de tarjeta receptora
  const tabExisting = document.getElementById('tab-btn-seller-card-existing');
  const tabNew = document.getElementById('tab-btn-seller-card-new');
  const secExisting = document.getElementById('seller-card-mode-existing');
  const secNew = document.getElementById('seller-card-mode-new');

  if (tabExisting && tabNew && secExisting && secNew) {
    tabExisting.addEventListener('click', () => {
      tabExisting.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition-all text-on-surface bg-white shadow-xs';
      tabNew.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition-all text-secondary hover:text-on-surface';
      secExisting.classList.remove('hidden');
      secNew.classList.add('hidden');
    });

    tabNew.addEventListener('click', () => {
      tabNew.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition-all text-on-surface bg-white shadow-xs';
      tabExisting.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition-all text-secondary hover:text-on-surface';
      secNew.classList.remove('hidden');
      secExisting.classList.add('hidden');
      updateSellerCardPreview();
    });
  }

  // Generador de número Luhn simulado para nueva tarjeta
  document.getElementById('btn-seller-randomize-card')?.addEventListener('click', () => {
    const brand = document.getElementById('seller-card-brand-select')?.value || 'Visa';
    const num = generateSellerLuhnCard(brand);
    const formatted = num.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    const numInput = document.getElementById('seller-card-num-input');
    if (numInput) numInput.value = formatted;
    updateSellerCardPreview();
  });

  // Escuchar inputs en vivo para actualizar preview
  ['seller-card-holder-input', 'seller-card-num-input', 'seller-card-brand-select', 'seller-card-exp-input', 'seller-card-saldo-input'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateSellerCardPreview);
    document.getElementById(id)?.addEventListener('change', updateSellerCardPreview);
  });

  // Formulario de creación de nueva tarjeta receptora
  document.getElementById('seller-new-card-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const rawNum = document.getElementById('seller-card-num-input').value.replace(/\s+/g, '');
      const holder = document.getElementById('seller-card-holder-input').value.trim();
      const brand = document.getElementById('seller-card-brand-select').value;
      const exp = document.getElementById('seller-card-exp-input').value.trim();
      const cvv = document.getElementById('seller-card-cvv-input').value.trim();
      const saldo = Number(document.getElementById('seller-card-saldo-input').value) || 0;

      const res = await apiFetch('/api/seller/receiving-card', {
        method: 'POST',
        body: JSON.stringify({
          numeroTarjeta: rawNum,
          titular: holder,
          marca: brand,
          expiracion: exp,
          cvv: cvv,
          colorPlastico: sellerSelectedPlasticColor,
          saldoInicial: saldo
        })
      });

      showAlert(res.message);
      document.getElementById('seller-receiving-card-dialog')?.close();
      loadSellerDashboard();
    } catch (err) {
      showAlert(err.message, true);
    }
  });

  // Botón acreditar / cobrar ventas a mi tarjeta
  document.getElementById('btn-credit-seller-sales')?.addEventListener('click', async () => {
    try {
      const res = await apiFetch('/api/seller/credit-sales', { method: 'POST', body: JSON.stringify({}) });
      showAlert(res.message);
      loadSellerDashboard();
    } catch (err) {
      showAlert(err.message, true);
    }
  });

  // Búsqueda en vivo de productos y ventas del vendedor
  document.getElementById('seller-products-search')?.addEventListener('input', () => {
    if (sellerDashboardData) renderSellerProducts(sellerDashboardData.productos);
  });
  document.getElementById('seller-sales-search')?.addEventListener('input', () => {
    if (sellerDashboardData) renderSellerSales(sellerDashboardData.ventas);
  });

  // Modal de edición rápida de stock y precio
  document.getElementById('btn-close-seller-stock-modal')?.addEventListener('click', () => {
    document.getElementById('seller-stock-dialog')?.close();
  });
  document.getElementById('btn-cancel-seller-stock-modal')?.addEventListener('click', () => {
    document.getElementById('seller-stock-dialog')?.close();
  });

  document.getElementById('seller-stock-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const prodId = Number(document.getElementById('seller-edit-product-id').value);
      const stock = Number(document.getElementById('seller-edit-stock-amount').value);
      const precio = Number(document.getElementById('seller-edit-stock-price').value);
      const activo = Number(document.getElementById('seller-edit-stock-active').value);

      const res = await apiFetch(`/api/seller/products/${prodId}/stock`, {
        method: 'PUT',
        body: JSON.stringify({ stock, precio, activo })
      });
      showAlert(res.message);
      document.getElementById('seller-stock-dialog')?.close();
      loadSellerDashboard();
      loadCatalog();
    } catch (err) {
      showAlert(err.message, true);
    }
  });

  document.getElementById('btn-refresh-orders')?.addEventListener('click', loadOrders);
  document.getElementById('btn-load-reports')?.addEventListener('click', loadAdminReports);
  document.getElementById('btn-refresh-audit')?.addEventListener('click', loadAuditCenter);

  document.getElementById('btn-toggle-contingency')?.addEventListener('click', async () => {
    try {
      state.recommendationsHealthy = !state.recommendationsHealthy;
      const res = await apiFetch('/api/admin/contingency/recommendations', {
        method: 'POST',
        body: JSON.stringify({ healthy: state.recommendationsHealthy })
      });
      showAlert(res.message);
      loadCatalog();
    } catch (err) {
      showAlert(err.message, true);
    }
  });
}

function requireWebPanelAuth(panelTitle, allowedRoles, onAuthenticated) {
  let dlg = document.getElementById('web-panel-auth-dialog');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'web-panel-auth-dialog';
    dlg.className = 'modal rounded-2xl p-0 max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden';
    dlg.innerHTML = `
      <div class="bg-[#0a2540] text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h3 id="web-panel-auth-title" class="text-base font-extrabold tracking-tight">🔐 Control de Acceso al Panel</h3>
          <p class="text-[11px] text-slate-300 mt-0.5">Ingrese usuario y contraseña cada vez que abra este panel</p>
        </div>
        <button type="button" id="btn-close-web-panel-auth" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold cursor-pointer">✕</button>
      </div>
      <form id="form-web-panel-auth" class="p-6 bg-white space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Usuario / Correo Electrónico</label>
          <input type="text" id="web-panel-auth-email" required placeholder="admin@expressmart.mx" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Contraseña</label>
          <input type="password" id="web-panel-auth-pass" required placeholder="••••••••••••" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:border-primary" />
        </div>
        <div id="web-panel-auth-error" class="hidden p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold"></div>
        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div class="text-[11px] font-bold text-slate-500 mb-1.5">Autocompletar credenciales autorizadas:</div>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" data-u="admin@expressmart.mx" data-p="AdminPassword123!" class="web-panel-quick-cred px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-[11px] font-bold text-slate-800 cursor-pointer">⚡ Admin</button>
            <button type="button" data-u="vendedor@expressmart.mx" data-p="VendedorPassword123!" class="web-panel-quick-cred px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-[11px] font-bold text-slate-800 cursor-pointer">📦 Vendedor</button>
            <button type="button" data-u="auditor@expressmart.mx" data-p="AuditorPassword123!" class="web-panel-quick-cred px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-[11px] font-bold text-slate-800 cursor-pointer">🔍 Auditor</button>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="btn-cancel-web-panel-auth" class="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-primary text-white text-xs font-extrabold hover:bg-primary-container cursor-pointer">🔓 Acceder al Panel</button>
        </div>
      </form>
    `;
    document.body.appendChild(dlg);

    dlg.querySelectorAll('.web-panel-quick-cred').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('web-panel-auth-email').value = btn.dataset.u || '';
        document.getElementById('web-panel-auth-pass').value = btn.dataset.p || '';
        document.getElementById('web-panel-auth-error').classList.add('hidden');
      });
    });

    const closeFn = () => dlg.close();
    document.getElementById('btn-close-web-panel-auth').addEventListener('click', closeFn);
    document.getElementById('btn-cancel-web-panel-auth').addEventListener('click', closeFn);
  }

  const titleEl = document.getElementById('web-panel-auth-title');
  if (titleEl) titleEl.textContent = `🔐 Acceso — ${panelTitle}`;
  const errEl = document.getElementById('web-panel-auth-error');
  if (errEl) errEl.classList.add('hidden');

  const emailInput = document.getElementById('web-panel-auth-email');
  const passInput = document.getElementById('web-panel-auth-pass');
  if (emailInput) emailInput.value = state.user?.email || '';
  if (passInput) passInput.value = '';

  const form = document.getElementById('form-web-panel-auth');
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (errEl) errEl.classList.add('hidden');
    try {
      const email = emailInput.value.trim();
      const password = passInput.value;
      const res = await fetch('/api/logistics/panel-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Credenciales inválidas.');
      }
      if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(data.user.rol)) {
        throw new Error(`Tu rol (${data.user.rol}) no tiene permisos para abrir ${panelTitle}.`);
      }
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('em_token', data.token);
      localStorage.setItem('em_user', JSON.stringify(data.user));
      updateSessionUI();
      dlg.close();
      if (typeof onAuthenticated === 'function') onAuthenticated();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    }
  };

  if (typeof dlg.showModal === 'function') {
    if (!dlg.open) dlg.showModal();
  } else {
    dlg.setAttribute('open', 'open');
  }
}

window.loadAdminReports = loadAdminReports;
window.loadAuditCenter = loadAuditCenter;
window.initAdminAuditEvents = initAdminAuditEvents;
window.requireWebPanelAuth = requireWebPanelAuth;
window.loadSellerDashboard = loadSellerDashboard;
window.openSellerProductModal = openSellerProductModal;
window.openSellerReceivingCardModal = openSellerReceivingCardModal;
window.openSellerStockEditModal = openSellerStockEditModal;

