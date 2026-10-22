/**
 * Cliente Web Interactivo ExpressMart - Sistema de Diseño Stitch "Aura Commerce" (Precios en MXN)
 * Conecta los flujos de Catálogo (RF-03), Ficha de Producto y Reseñas (RF-08),
 * Cesta y Checkout en 3 pasos (RF-04, RF-05, RNF-11), Cuentas y MFA (RF-01 / RF-02),
 * Pedidos y Devoluciones LFPC (RF-07), Notificaciones (RF-09), Reportes (RF-10)
 * y Centro de Auditoría ECTA-01.
 */

const state = {
  token: localStorage.getItem('em_token') || '',
  user: JSON.parse(localStorage.getItem('em_user') || 'null'),
  cart: JSON.parse(localStorage.getItem('em_cart') || '[]'),
  coupon: '',
  calculatedTotals: null,
  recommendationsHealthy: true
};

function formatMxn(amount) {
  return `$${Number(amount || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} MXN`;
}

function showAlert(msg, isError = false) {
  const el = document.getElementById('global-alert');
  if (!el) return;
  el.textContent = msg;
  el.className = `alert ${isError ? 'alert-error' : 'alert-info'}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 6000);
}

async function apiFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Error HTTP ${res.status}`);
  }
  return data;
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach((b) => {
    const isTarget = b.dataset.tab === tabId;
    b.classList.toggle('active', isTarget);
    b.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });
  document.querySelectorAll('.tab-view').forEach((v) => {
    v.classList.toggle('hidden', v.id !== tabId);
  });

  if (tabId === 'view-orders') loadOrders();
  if (tabId === 'view-profile') loadProfile();
  if (tabId === 'view-admin') loadAdminReports();
  if (tabId === 'view-audit') loadAuditCenter();
}

function updateSessionUI() {
  const statusEl = document.getElementById('user-status');
  const btnLogout = document.getElementById('btn-logout');

  if (state.user && state.token) {
    const firstName = state.user.nombre.split(' ')[0];
    statusEl.textContent = `Hola, ${firstName} (${state.user.rol.toUpperCase()})`;
    btnLogout.classList.remove('hidden');
    const addrInput = document.getElementById('checkout-address');
    if (addrInput && state.user.direccion && !addrInput.value) {
      addrInput.value = state.user.direccion;
    }
  } else {
    statusEl.textContent = 'Hola, Identifícate';
    btnLogout.classList.add('hidden');
  }

  const totalItems = state.cart.reduce((acc, i) => acc + i.cantidad, 0);
  const countEl = document.getElementById('cart-count');
  if (countEl) countEl.textContent = String(totalItems);
}

function saveCart() {
  localStorage.setItem('em_cart', JSON.stringify(state.cart));
  updateSessionUI();
}

// ============================================================================
// CATÁLOGO Y BÚSQUEDA CON TARJETAS STITCH "AURA COMMERCE" EN MXN (RF-03)
// ============================================================================
async function loadCatalog() {
  const q = document.getElementById('search-input').value.trim();
  const categoria = document.getElementById('filter-category').value;
  const marca = document.getElementById('filter-brand').value;
  const maxPrecio = document.getElementById('filter-max-price').value;
  const orden = document.getElementById('filter-sort').value;

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (categoria) params.set('categoria', categoria);
  if (marca) params.set('marca', marca);
  if (maxPrecio) params.set('maxPrecio', maxPrecio);
  if (orden) params.set('orden', orden);

  const data = await apiFetch(`/api/products?${params.toString()}`);
  document.getElementById('search-latency-pill').textContent =
    `Tiempo de búsqueda: ${data.responseTimeMs} ms (${data.total} productos en MXN · SLA < 2000 ms ✅)`;

  const recBanner = document.getElementById('recommendations-banner');
  if (data.recommendations && data.recommendations.degradedMode) {
    recBanner.textContent = `⚠️ ${data.recommendations.message}`;
    recBanner.classList.remove('hidden');
  } else {
    recBanner.classList.add('hidden');
  }

  const grid = document.getElementById('products-grid');
  grid.innerHTML = '';

  for (const p of data.products) {
    const precioNum = Number(p.precio);
    const precioAnterior = Math.round(precioNum * 1.18);
    const mensualidadMsi = (precioNum / 12).toFixed(2);
    const imgUrl = p.imagen_url || '/assets/logo.png';

    const card = document.createElement('article');
    card.className =
      'bg-surface-container-lowest rounded-xl p-space-md shadow-[0_8px_24px_rgba(11,28,48,0.06)] hover:shadow-[0_14px_32px_rgba(11,28,48,0.12)] transition-all flex flex-col justify-between border border-surface-container';

    card.innerHTML = `
      <div>
        <div class="relative aspect-square rounded-xl bg-surface-container-low mb-space-sm p-4 flex items-center justify-center overflow-hidden group cursor-pointer open-detail-trigger" data-id="${p.id}">
          <span class="absolute top-2.5 left-2.5 bg-primary text-on-primary font-label-xs text-label-xs px-2 py-0.5 rounded-full font-bold uppercase">
            ${p.categoria} · ${p.marca}
          </span>
          <span class="absolute top-2.5 right-2.5 bg-surface-container-highest text-on-surface font-label-xs text-label-xs px-2 py-0.5 rounded-full font-bold">
            ${p.sku}
          </span>
          <img
            src="${imgUrl}"
            alt="Imagen del producto ${p.nombre}"
            class="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
            onerror="this.src='/assets/logo.png'"
          />
        </div>

        <div class="flex items-center gap-1.5 text-amber-500 text-xs font-bold mb-1">
          <span>★ ${p.calificacion_promedio}</span>
          <span class="text-secondary font-normal">(${p.total_resenas} reseñas verificadas)</span>
        </div>

        <h3 class="font-headline-sm text-[16px] leading-snug text-on-surface font-bold line-clamp-2 mb-1 cursor-pointer hover:text-primary open-detail-trigger" data-id="${p.id}">
          ${p.nombre}
        </h3>
        <p class="font-body-sm text-body-sm text-secondary line-clamp-2 mb-space-sm">
          ${p.descripcion}
        </p>
      </div>

      <div class="pt-space-xs border-t border-surface-container">
        <div class="flex items-baseline gap-2">
          <span class="font-price-card text-price-card text-on-surface font-extrabold">${formatMxn(precioNum)}</span>
          <span class="font-body-sm text-xs text-secondary line-through">${formatMxn(precioAnterior)}</span>
        </div>
        <div class="text-xs text-secondary mb-1">
          Hasta <strong>12 MSI de $${mensualidadMsi} MXN</strong> · IVA 16% incl.
        </div>
        <div class="flex items-center gap-1 text-tertiary font-label-xs text-label-xs font-bold mb-space-sm">
          <span class="material-symbols-outlined text-[15px]">verified</span>
          <span>ExpressPrime GRATIS · Stock: ${p.stock_disponible} uds.</span>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="py-2 px-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-bold transition-colors open-detail-trigger"
            data-id="${p.id}"
          >
            Ficha / Reseñas
          </button>
          <button
            type="button"
            class="py-2 px-2.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-bold transition-colors flex items-center justify-center gap-1 add-to-cart-btn"
            data-id="${p.id}"
            data-nombre="${p.nombre}"
            data-precio="${p.precio}"
          >
            <span class="material-symbols-outlined text-[16px]">add_shopping_cart</span>
            Agregar
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  }

  grid.querySelectorAll('.add-to-cart-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const productoId = Number(btn.dataset.id);
      const nombre = btn.dataset.nombre;
      const precio = Number(btn.dataset.precio);
      const existing = state.cart.find((i) => i.productoId === productoId);
      if (existing) {
        existing.cantidad += 1;
      } else {
        state.cart.push({ productoId, nombre, precio, cantidad: 1 });
      }
      saveCart();
      showAlert(`"${nombre}" agregado a tu cesta (${formatMxn(precio)}).`);
    });
  });

  grid.querySelectorAll('.open-detail-trigger').forEach((el) => {
    el.addEventListener('click', () => openProductDetailModal(Number(el.dataset.id)));
  });
}

// ============================================================================
// MODAL DETALLE DE PRODUCTO STITCH ("EXPRESSOUND PRO 900" LAYOUT) + RESEÑAS RF-08
// ============================================================================
async function openProductDetailModal(productId) {
  const dialog = document.getElementById('product-detail-dialog');
  const body = document.getElementById('product-detail-body');
  try {
    const p = await apiFetch(`/api/products/${productId}`);
    const specsEntries = Object.entries(p.especificaciones || {});

    body.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        <div class="lg:col-span-5 bg-surface-container-low rounded-2xl p-6 flex flex-col items-center justify-center">
          <img
            src="${p.imagen_url || '/assets/logo.png'}"
            alt="${p.nombre}"
            class="max-h-64 object-contain mb-3"
            onerror="this.src='/assets/logo.png'"
          />
          <span class="px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant font-label-xs text-label-xs font-bold">
            ✓ Elección Oficial ExpressMart México · ${p.sku}
          </span>
        </div>

        <div class="lg:col-span-7 space-y-3">
          <div class="font-label-md text-label-md text-primary font-bold uppercase">${p.marca} · ${p.categoria}</div>
          <h3 class="font-headline-md text-headline-md text-on-surface font-extrabold leading-tight">${p.nombre}</h3>
          <p class="font-body-md text-body-md text-secondary">${p.descripcion}</p>

          <div class="p-3.5 rounded-xl bg-surface-container-low flex flex-wrap items-center justify-between gap-2">
            <div>
              <div class="font-price-hero text-price-hero text-primary font-extrabold">${formatMxn(p.precio)}</div>
              <div class="text-xs text-secondary">IVA 16% incluido · Envío: ${p.condiciones_envio}</div>
            </div>
            <button
              type="button"
              id="detail-add-cart-btn"
              class="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-bold flex items-center gap-1.5"
            >
              <span class="material-symbols-outlined text-[18px]">shopping_cart_checkout</span>
              Añadir a la Cesta
            </button>
          </div>

          <div class="rounded-xl bg-surface-container-low p-3">
            <h4 class="font-label-lg text-label-lg font-bold mb-1.5">Especificaciones Técnicas (ISO/IEC 25012 Completitud 100%)</h4>
            <div class="grid grid-cols-2 gap-1.5 text-xs">
              ${specsEntries
                .map(
                  ([k, v]) =>
                    `<div class="text-secondary capitalize">${k}:</div><div class="font-bold text-on-surface">${v}</div>`
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>

      <hr class="my-4 border-surface-container" />

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <div class="lg:col-span-7">
          <h4 class="font-headline-sm text-headline-sm font-bold mb-2">
            Opiniones de Clientes Verificados (${(p.reviews || []).length})
          </h4>
          <div class="space-y-2 max-h-56 overflow-y-auto">
            ${
              (p.reviews || []).length
                ? p.reviews
                    .map(
                      (r) => `
                  <div class="p-3 rounded-lg bg-surface-container-low">
                    <div class="flex items-center justify-between text-xs mb-1">
                      <strong>${r.autor}</strong>
                      <span class="text-amber-600 font-bold">${'★'.repeat(r.calificacion)} (${r.calificacion}/5) · Compra Verificada</span>
                    </div>
                    <p class="text-xs text-on-surface m-0">${r.comentario}</p>
                  </div>
                `
                    )
                    .join('')
                : '<p class="muted">Aún no hay reseñas para este artículo.</p>'
            }
          </div>
        </div>

        <div class="lg:col-span-5 bg-surface-container-low p-3.5 rounded-xl">
          <h4 class="font-label-lg text-label-lg font-bold mb-2">Escribir Reseña Verificada (RF-08)</h4>
          <form id="detail-review-form" class="space-y-2.5">
            <div class="field">
              <label for="rev-rating">Calificación (1 a 5 estrellas)</label>
              <select id="rev-rating" required>
                <option value="5">★★★★★ (5 - Excelente)</option>
                <option value="4">★★★★☆ (4 - Muy bueno)</option>
                <option value="3">★★★☆☆ (3 - Regular)</option>
                <option value="2">★★☆☆☆ (2 - Malo)</option>
                <option value="1">★☆☆☆☆ (1 - Pésimo)</option>
              </select>
            </div>
            <div class="field">
              <label for="rev-comment">Comentario sobre el producto</label>
              <textarea id="rev-comment" rows="2" required minlength="4" placeholder="Comparte tu experiencia con el producto y el envío..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Publicar Reseña</button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('detail-add-cart-btn').addEventListener('click', () => {
      const existing = state.cart.find((i) => i.productoId === p.id);
      if (existing) existing.cantidad += 1;
      else state.cart.push({ productoId: p.id, nombre: p.nombre, precio: Number(p.precio), cantidad: 1 });
      saveCart();
      dialog.close();
      showAlert(`"${p.nombre}" añadido a la cesta (${formatMxn(p.precio)}).`);
    });

    document.getElementById('detail-review-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.token) {
        dialog.close();
        document.getElementById('auth-dialog').showModal();
        showAlert('Inicie sesión para registrar una reseña verificada.', true);
        return;
      }
      try {
        await apiFetch(`/api/products/${p.id}/reviews`, {
          method: 'POST',
          body: JSON.stringify({
            calificacion: Number(document.getElementById('rev-rating').value),
            comentario: document.getElementById('rev-comment').value
          })
        });
        showAlert('Reseña verificada publicada correctamente.');
        openProductDetailModal(p.id);
        loadCatalog();
      } catch (err) {
        showAlert(err.message, true);
      }
    });

    dialog.showModal();
  } catch (err) {
    showAlert(err.message, true);
  }
}

// ============================================================================
// CARRITO Y CHECKOUT EN 3 PASOS EN MXN (RF-04, RF-05, RNF-11)
// ============================================================================
function setCheckoutStep(stepNum) {
  [1, 2, 3].forEach((n) => {
    document.getElementById(`checkout-step-${n}`).classList.toggle('hidden', n !== stepNum);
    document.getElementById(`step-ind-${n}`).classList.toggle('active', n === stepNum);
  });
}

async function refreshCartModal() {
  const container = document.getElementById('cart-items-container');
  const totalsBox = document.getElementById('cart-totals-box');
  const shipMsg = document.getElementById('free-shipping-msg');

  if (state.cart.length === 0) {
    container.innerHTML =
      '<p class="muted p-3 bg-surface-container-low rounded-lg">Tu cesta está vacía. Explora el catálogo en Pesos Mexicanos ($ MXN) para agregar productos.</p>';
    totalsBox.innerHTML = '';
    state.calculatedTotals = null;
    return;
  }

  container.innerHTML = state.cart
    .map(
      (item, idx) => `
      <div class="flex items-center justify-between py-2.5 px-3 mb-2 rounded-lg bg-surface-container-low">
        <div>
          <strong class="text-on-surface">${item.nombre}</strong>
          <div class="text-xs text-secondary">Cantidad: ${item.cantidad} × ${formatMxn(item.precio)}</div>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-bold text-primary">${formatMxn(item.precio * item.cantidad)}</span>
          <button type="button" class="btn btn-sm btn-outline cart-remove-btn" data-idx="${idx}">Quitar</button>
        </div>
      </div>
    `
    )
    .join('');

  container.querySelectorAll('.cart-remove-btn').forEach((b) => {
    b.addEventListener('click', () => {
      state.cart.splice(Number(b.dataset.idx), 1);
      saveCart();
      refreshCartModal();
    });
  });

  try {
    const calc = await apiFetch('/api/cart/calculate', {
      method: 'POST',
      body: JSON.stringify({ items: state.cart, cuponCodigo: state.coupon })
    });
    state.calculatedTotals = calc;
    if (shipMsg) {
      shipMsg.textContent =
        calc.costoEnvio === 0
          ? '¡Felicidades! Tu pedido incluye Envío ExpressPrime GRATIS en México ($0.00 MXN)'
          : `Agrega ${formatMxn(Math.max(0, 999 - calc.subtotal))} más para obtener Envío ExpressPrime GRATIS`;
    }
    totalsBox.innerHTML = `
      <div class="space-y-1 text-sm">
        <div class="flex justify-between"><span>Subtotal productos:</span> <strong>${formatMxn(calc.subtotal)}</strong></div>
        <div class="flex justify-between text-tertiary"><span>Descuento (${calc.cuponAplicado || 'Sin cupón'}):</span> <strong>-${formatMxn(calc.descuento)}</strong></div>
        <div class="flex justify-between"><span>IVA trasladado (16% México):</span> <strong>${formatMxn(calc.impuestos)}</strong></div>
        <div class="flex justify-between"><span>Envío ExpressPrime DHL/FedEx:</span> <strong>${calc.costoEnvio === 0 ? 'GRATIS ($0.00 MXN)' : formatMxn(calc.costoEnvio)}</strong></div>
        <div class="flex justify-between text-lg pt-2 border-t border-surface-dim text-primary">
          <strong>Total a Pagar (MXN):</strong> <strong>${formatMxn(calc.total)}</strong>
        </div>
      </div>
    `;
  } catch (err) {
    totalsBox.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

// ============================================================================
// PEDIDOS, PERFIL, ADMIN Y AUDITORÍA EN MXN
// ============================================================================
async function loadOrders() {
  const box = document.getElementById('orders-list');
  if (!state.token) {
    box.innerHTML =
      '<p class="muted p-4 rounded-xl bg-surface-container-low">Inicie sesión para consultar sus pedidos en MXN, guías DHL/FedEx y gestionar devoluciones LFPC.</p>';
    return;
  }
  try {
    const data = await apiFetch('/api/orders');
    if (!data.orders.length) {
      box.innerHTML = '<p class="muted p-4 rounded-xl bg-surface-container-low">Aún no tienes pedidos registrados.</p>';
      return;
    }
    box.innerHTML = data.orders
      .map(
        (o) => `
        <div class="p-space-lg rounded-xl bg-surface-container-low border border-surface-container-highest flex flex-col gap-2">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-surface-dim">
            <div>
              <span class="font-label-xs text-label-xs uppercase text-secondary block">Folio Oficial ExpressMart</span>
              <strong class="font-headline-sm text-headline-sm text-on-surface">${o.folio} · Estado: ${o.estado.toUpperCase()}</strong>
            </div>
            <span class="px-3 py-1 rounded-full bg-primary text-on-primary font-label-md text-label-md font-bold">
              Total: ${formatMxn(o.total)}
            </span>
          </div>
          <div class="text-sm text-on-surface">
            <strong>Dirección de Entrega:</strong> ${o.direccion_envio} |
            <strong>Pago PCI DSS:</strong> ${o.pago ? `${o.pago.tarjeta_enmascarada} (${o.pago.referencia_pasarela})` : o.metodo_pago}
          </div>
          <div class="text-sm text-tertiary font-semibold">
            🚚 Guía Paquetería: ${o.envio ? `${o.envio.numero_guia} (${o.envio.proveedor_paqueteria} · ${o.envio.estado_envio})` : 'Asignando guía'}
          </div>
          <div class="text-xs text-secondary font-mono">
            Hash Integridad SHA-256 (RNF-09): ${o.hash_integridad}
          </div>
          <div class="pt-1">
            ${
              o.estado !== 'devuelto' && o.estado !== 'cancelado'
                ? `<button type="button" class="btn btn-sm btn-outline return-order-btn" data-id="${o.id}">Solicitar Devolución y Reembolso en MXN (LFPC)</button>`
                : '<span class="badge badge-ok">✓ Reembolsado en MXN / Devuelto conforme a LFPC</span>'
            }
          </div>
        </div>
      `
      )
      .join('');

    box.querySelectorAll('.return-order-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await apiFetch(`/api/orders/${btn.dataset.id}/return`, {
            method: 'POST',
            body: JSON.stringify({ motivo: 'Devolución en línea sin costo conforme a LFPC México' })
          });
          showAlert('Devolución autorizada y reembolso en MXN procesado.');
          loadOrders();
        } catch (err) {
          showAlert(err.message, true);
        }
      });
    });
  } catch (err) {
    box.innerHTML = `<p class="alert alert-error">${err.message}</p>`;
  }
}

async function loadProfile() {
  if (!state.token) return;
  try {
    const data = await apiFetch('/api/auth/profile');
    document.getElementById('prof-nombre').value = data.user.nombre || '';
    document.getElementById('prof-direccion').value = data.user.direccion || '';
    document.getElementById('prof-telefono').value = data.user.telefono || '';
    document.getElementById('prof-mfa').checked = Boolean(data.user.mfaEnabled);

    const notifList = document.getElementById('notifications-list');
    notifList.innerHTML = (data.notifications || [])
      .map(
        (n) => `
        <div class="p-3 rounded-lg bg-surface-container-low border border-surface-container">
          <div class="flex items-center justify-between gap-2 mb-1">
            <strong class="text-xs text-on-surface">${n.asunto}</strong>
            <span class="badge badge-ok">${n.acuse_recibo}</span>
          </div>
          <div class="text-xs text-secondary">${n.mensaje}</div>
        </div>
      `
      )
      .join('');
  } catch (err) {
    showAlert(err.message, true);
  }
}

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
      <h4 class="font-label-lg text-label-lg font-bold mb-1">Conciliación de Inventario en Almacén D3 (CEDIS CDMX Norte)</h4>
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

// ============================================================================
// INICIALIZACIÓN DE EVENTOS DOM
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  updateSessionUI();
  loadCatalog();

  // Navegación por pestañas
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Accesos rápidos del header Stitch
  const btnHeaderOrders = document.getElementById('btn-header-orders');
  if (btnHeaderOrders) {
    btnHeaderOrders.addEventListener('click', () => switchTab('view-orders'));
  }

  const brandHome = document.getElementById('brand-home-link');
  if (brandHome) {
    brandHome.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('view-catalog');
    });
  }

  // Selector de departamento en el buscador compuesto Stitch
  const deptSelect = document.getElementById('header-dept-select');
  if (deptSelect) {
    deptSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      const label = e.target.options[e.target.selectedIndex].text;
      document.getElementById('header-dept-label').textContent = label;
      document.getElementById('filter-category').value = val;
      switchTab('view-catalog');
      loadCatalog();
    });
  }

  // Botones de tarjetas promocionales Stitch
  document.querySelectorAll('.promo-filter-trigger').forEach((el) => {
    el.addEventListener('click', () => {
      document.getElementById('filter-category').value = el.dataset.cat || '';
      loadCatalog();
      document.getElementById('products-grid').scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Botones de cupones promocionales en Hero y ExpressPrime
  const heroCouponBtn = document.getElementById('btn-hero-coupon');
  if (heroCouponBtn) {
    heroCouponBtn.addEventListener('click', () => {
      state.coupon = 'BIENVENIDA10';
      document.getElementById('cart-coupon').value = 'BIENVENIDA10';
      showAlert('Cupón BIENVENIDA10 (-10% en MXN) activado para tu compra.');
    });
  }

  const primeCouponBtn = document.getElementById('btn-prime-coupon');
  if (primeCouponBtn) {
    primeCouponBtn.addEventListener('click', () => {
      state.coupon = 'ENVIOGRATIS';
      document.getElementById('cart-coupon').value = 'ENVIOGRATIS';
      showAlert('Cupón ENVIOGRATIS ExpressPrime activado en tu cesta.');
    });
  }

  // Filtros de búsqueda
  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    switchTab('view-catalog');
    loadCatalog();
  });
  ['filter-category', 'filter-brand', 'filter-max-price', 'filter-sort'].forEach((id) => {
    document.getElementById(id).addEventListener('change', loadCatalog);
  });

  // Modal Detalle de Producto
  const detailDialog = document.getElementById('product-detail-dialog');
  document.getElementById('btn-close-detail').addEventListener('click', () => detailDialog.close());

  // Modal de Autenticación
  const authDialog = document.getElementById('auth-dialog');
  document.getElementById('btn-open-auth').addEventListener('click', () => authDialog.showModal());
  document.getElementById('btn-close-auth').addEventListener('click', () => authDialog.close());

  // Botones de acceso rápido para demostración de roles y MFA
  document.querySelectorAll('.demo-login-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      document.getElementById('login-email').value = btn.dataset.email;
      document.getElementById('login-password').value = btn.dataset.pass;
      document.getElementById('login-mfa').value = '';
      try {
        const res = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: btn.dataset.email, password: btn.dataset.pass })
        });
        if (res.mfaRequired) {
          document.getElementById('mfa-field-group').classList.remove('hidden');
          document.getElementById('login-mfa').value = res.demoHintCode || '';
          const verified = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
              email: btn.dataset.email,
              password: btn.dataset.pass,
              mfaCode: res.demoHintCode
            })
          });
          state.token = verified.token;
          state.user = verified.user;
        } else {
          state.token = res.token;
          state.user = res.user;
        }
        localStorage.setItem('em_token', state.token);
        localStorage.setItem('em_user', JSON.stringify(state.user));
        updateSessionUI();
        authDialog.close();
        showAlert(`Sesión iniciada como ${state.user.nombre} (${state.user.rol.toUpperCase()})`);
      } catch (err) {
        showAlert(err.message, true);
      }
    });
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const mfaCode = document.getElementById('login-mfa').value.trim();
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, mfaCode: mfaCode || undefined })
      });
      if (res.mfaRequired) {
        document.getElementById('mfa-field-group').classList.remove('hidden');
        document.getElementById('login-mfa').value = res.demoHintCode || '';
        showAlert(`Ingrese el código MFA de 6 dígitos (Código TOTP actual: ${res.demoHintCode})`);
        return;
      }
      state.token = res.token;
      state.user = res.user;
      localStorage.setItem('em_token', state.token);
      localStorage.setItem('em_user', JSON.stringify(state.user));
      updateSessionUI();
      authDialog.close();
      showAlert(`Bienvenido a ExpressMart México, ${state.user.nombre}`);
    } catch (err) {
      showAlert(err.message, true);
    }
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          nombre: document.getElementById('reg-nombre').value,
          email: document.getElementById('reg-email').value,
          password: document.getElementById('reg-password').value,
          direccion: document.getElementById('reg-direccion').value,
          consentimientoPrivacidad: document.getElementById('reg-privacy').checked
        })
      });
      state.token = res.token;
      state.user = res.user;
      localStorage.setItem('em_token', state.token);
      localStorage.setItem('em_user', JSON.stringify(state.user));
      updateSessionUI();
      authDialog.close();
      showAlert('Cuenta creada y sesión iniciada correctamente.');
    } catch (err) {
      showAlert(err.message, true);
    }
  });

  document.getElementById('btn-logout').addEventListener('click', async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {
      // Continuar limpieza local
    }
    state.token = '';
    state.user = null;
    localStorage.removeItem('em_token');
    localStorage.removeItem('em_user');
    updateSessionUI();
    showAlert('Sesión cerrada de forma segura.');
  });

  // Modal de Carrito y Checkout en 3 pasos
  const cartDialog = document.getElementById('cart-dialog');
  document.getElementById('btn-open-cart').addEventListener('click', () => {
    setCheckoutStep(1);
    refreshCartModal();
    cartDialog.showModal();
  });
  document.getElementById('btn-close-cart').addEventListener('click', () => cartDialog.close());

  document.getElementById('btn-apply-coupon').addEventListener('click', () => {
    state.coupon = document.getElementById('cart-coupon').value.trim();
    refreshCartModal();
  });

  document.getElementById('payment-method').addEventListener('change', (e) => {
    document.getElementById('msi-group').classList.toggle('hidden', e.target.value !== 'msi');
  });

  document.getElementById('btn-to-step-2').addEventListener('click', () => {
    if (!state.cart.length) {
      showAlert('Agregue al menos un artículo a la cesta.', true);
      return;
    }
    if (!state.token) {
      cartDialog.close();
      authDialog.showModal();
      showAlert('Inicie sesión antes de continuar al pago seguro.', true);
      return;
    }
    setCheckoutStep(2);
  });

  document.getElementById('btn-back-step-1').addEventListener('click', () => setCheckoutStep(1));
  document.getElementById('btn-back-step-2').addEventListener('click', () => setCheckoutStep(2));

  document.getElementById('btn-to-step-3').addEventListener('click', () => {
    if (!state.calculatedTotals) return;
    const summaryEl = document.getElementById('checkout-final-summary');
    const addr = document.getElementById('checkout-address').value.trim();
    const method = document.getElementById('payment-method').value;
    summaryEl.innerHTML = `
      <div class="space-y-1 text-sm">
        <div><strong>Dirección de Entrega en México:</strong> ${addr}</div>
        <div><strong>Método de Pago Certificado PCI DSS:</strong> ${method.toUpperCase()}</div>
        <div><strong>Subtotal:</strong> ${formatMxn(state.calculatedTotals.subtotal)}</div>
        <div><strong>Descuento:</strong> -${formatMxn(state.calculatedTotals.descuento)}</div>
        <div><strong>IVA (16%):</strong> ${formatMxn(state.calculatedTotals.impuestos)}</div>
        <div><strong>Envío ExpressPrime:</strong> ${formatMxn(state.calculatedTotals.costoEnvio)}</div>
        <div class="text-lg pt-2 border-t border-surface-dim text-primary">
          <strong>Total Confirmado a Pagar: ${formatMxn(state.calculatedTotals.total)}</strong>
        </div>
      </div>
    `;
    document.getElementById('checkout-result-box').innerHTML = '';
    setCheckoutStep(3);
  });

  document.getElementById('btn-confirm-order').addEventListener('click', async () => {
    const resultBox = document.getElementById('checkout-result-box');
    try {
      const res = await apiFetch('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: state.cart,
          cuponCodigo: state.coupon,
          direccionEnvio: document.getElementById('checkout-address').value.trim(),
          metodoPago: document.getElementById('payment-method').value,
          mesesSinIntereses: Number(document.getElementById('payment-msi').value || 1),
          cardHolder: document.getElementById('card-holder').value,
          cardNumber: document.getElementById('card-number').value,
          expiry: document.getElementById('card-expiry').value,
          pasosCheckout: 3
        })
      });
      state.cart = [];
      state.coupon = '';
      saveCart();
      loadCatalog();
      resultBox.innerHTML = `
        <div class="alert alert-info flex-col items-start">
          <div>✅ <strong>${res.message}</strong></div>
          <div>Folio: <strong>${res.order.folio}</strong> | Total: <strong>${formatMxn(res.order.total)}</strong></div>
          <div>Guía ExpressPrime: <strong>${res.order.envio.numeroGuia}</strong> (${res.order.envio.proveedorPaqueteria})</div>
          <div>Token PCI DSS: <code>${res.order.pago.tokenPci}</code> | Latencia: ${res.responseTimeMs} ms</div>
        </div>
      `;
    } catch (err) {
      resultBox.innerHTML = `<div class="alert alert-error">❌ ${err.message}</div>`;
    }
  });

  // Formularios de perfil, ARCO y administración
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          nombre: document.getElementById('prof-nombre').value,
          direccion: document.getElementById('prof-direccion').value,
          telefono: document.getElementById('prof-telefono').value,
          enableMfa: document.getElementById('prof-mfa').checked
        })
      });
      state.user = res.user;
      localStorage.setItem('em_user', JSON.stringify(state.user));
      updateSessionUI();
      showAlert(res.message);
    } catch (err) {
      showAlert(err.message, true);
    }
  });

  document.getElementById('arco-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/privacy/arco', {
        method: 'POST',
        body: JSON.stringify({
          tipo: document.getElementById('arco-tipo').value,
          descripcion: document.getElementById('arco-desc').value
        })
      });
      document.getElementById('arco-result').innerHTML =
        `<div class="alert alert-info">Folio ARCO LFPDPPP: <strong>${res.folio}</strong> — ${res.respuesta}</div>`;
    } catch (err) {
      showAlert(err.message, true);
    }
  });

  document.getElementById('admin-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          sku: document.getElementById('prod-sku').value,
          nombre: document.getElementById('prod-nombre').value,
          categoria: document.getElementById('prod-cat').value,
          marca: document.getElementById('prod-marca').value,
          precio: Number(document.getElementById('prod-precio').value),
          stock: Number(document.getElementById('prod-stock').value),
          descripcion: document.getElementById('prod-desc').value,
          condiciones_envio: document.getElementById('prod-envio').value,
          especificaciones: { origen: 'Panel Administrativo ExpressMart México', certificadoCalidad: 'ISO-25012' }
        })
      });
      showAlert(res.message);
      loadCatalog();
      loadAdminReports();
    } catch (err) {
      showAlert(err.message, true);
    }
  });

  document.getElementById('btn-refresh-orders').addEventListener('click', loadOrders);
  document.getElementById('btn-load-reports').addEventListener('click', loadAdminReports);
  document.getElementById('btn-refresh-audit').addEventListener('click', loadAuditCenter);
  document.getElementById('btn-toggle-contingency').addEventListener('click', async () => {
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
});
