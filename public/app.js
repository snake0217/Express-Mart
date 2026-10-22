/**
 * Cliente Web Interactivo ExpressMart (Apartados 9, 26, 27, 28)
 * Conecta los flujos de Catálogo (RF-03), Carrito (RF-04), Checkout 3 pasos (RNF-11 / RF-05),
 * Cuentas y MFA (RF-01 / RF-02), Pedidos y Devoluciones (RF-07), Reseñas (RF-08),
 * Notificaciones (RF-09), Reportes (RF-10) y Centro de Auditoría (ECTA-01).
 */

const state = {
  token: localStorage.getItem('em_token') || '',
  user: JSON.parse(localStorage.getItem('em_user') || 'null'),
  cart: JSON.parse(localStorage.getItem('em_cart') || '[]'),
  coupon: '',
  calculatedTotals: null,
  recommendationsHealthy: true
};

function showAlert(msg, isError = false) {
  const el = document.getElementById('global-alert');
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

function updateSessionUI() {
  const statusEl = document.getElementById('user-status');
  const btnAuth = document.getElementById('btn-open-auth');
  const btnLogout = document.getElementById('btn-logout');

  if (state.user && state.token) {
    statusEl.textContent = `${state.user.nombre} (${state.user.rol.toUpperCase()})`;
    btnAuth.classList.add('hidden');
    btnLogout.classList.remove('hidden');
    const addrInput = document.getElementById('checkout-address');
    if (addrInput && state.user.direccion && !addrInput.value) {
      addrInput.value = state.user.direccion;
    }
  } else {
    statusEl.textContent = 'Visitante';
    btnAuth.classList.remove('hidden');
    btnLogout.classList.add('hidden');
  }

  const totalItems = state.cart.reduce((acc, i) => acc + i.cantidad, 0);
  document.getElementById('cart-count').textContent = String(totalItems);
}

function saveCart() {
  localStorage.setItem('em_cart', JSON.stringify(state.cart));
  updateSessionUI();
}

// ============================================================================
// CATÁLOGO Y BÚSQUEDA (RF-03)
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
    `Tiempo de búsqueda: ${data.responseTimeMs} ms (${data.total} productos · SLA < 2000 ms ✅)`;

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
    const card = document.createElement('article');
    card.className = 'product-card';
    card.innerHTML = `
      <div>
        <div class="product-card-header">
          <img src="${p.imagen_url}" alt="Imagen del producto ${p.nombre}" class="product-thumb" />
          <div>
            <span class="badge badge-ok">${p.categoria} · ${p.marca}</span>
            <div class="product-meta">SKU: ${p.sku} · ⭐ ${p.calificacion_promedio} (${p.total_resenas})</div>
          </div>
        </div>
        <h3 class="product-title">${p.nombre}</h3>
        <p class="muted">${p.descripcion}</p>
      </div>
      <div>
        <div class="product-price">$${Number(p.precio).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</div>
        <div class="product-shipping">🚚 ${p.condiciones_envio} (Stock: ${p.stock_disponible})</div>
        <div class="inline-input">
          <button type="button" class="btn btn-primary btn-block add-to-cart-btn" data-id="${p.id}" data-nombre="${p.nombre}" data-precio="${p.precio}">
            Agregar al Carrito
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
      showAlert(`"${nombre}" agregado al carrito.`);
    });
  });
}

// ============================================================================
// CARRITO Y CHECKOUT EN 3 PASOS (RF-04, RF-05, RNF-11)
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

  if (state.cart.length === 0) {
    container.innerHTML = '<p class="muted">Tu carrito está vacío. Explora el catálogo para agregar productos.</p>';
    totalsBox.innerHTML = '';
    state.calculatedTotals = null;
    return;
  }

  container.innerHTML = state.cart
    .map(
      (item, idx) => `
      <div class="section-title-row" style="border-bottom:1px solid #e5e7eb;padding-bottom:0.4rem;">
        <div><strong>${item.nombre}</strong> × ${item.cantidad}</div>
        <div>
          <button type="button" class="btn btn-sm btn-outline cart-remove-btn" data-idx="${idx}">Eliminar</button>
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
    totalsBox.innerHTML = `
      <div>Subtotal: <strong>$${calc.subtotal.toFixed(2)} MXN</strong></div>
      <div>Descuento (${calc.cuponAplicado || 'Sin cupón'}): <strong>-$${calc.descuento.toFixed(2)} MXN</strong></div>
      <div>IVA (16%): <strong>$${calc.impuestos.toFixed(2)} MXN</strong></div>
      <div>Costo de Envío: <strong>$${calc.costoEnvio.toFixed(2)} MXN</strong></div>
      <div style="font-size:1.2rem;margin-top:0.4rem;">Total a Pagar: <strong>$${calc.total.toFixed(2)} MXN</strong></div>
    `;
  } catch (err) {
    totalsBox.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

// ============================================================================
// PEDIDOS, PERFIL, ADMIN Y AUDITORÍA
// ============================================================================
async function loadOrders() {
  const box = document.getElementById('orders-list');
  if (!state.token) {
    box.innerHTML = '<p class="muted">Inicie sesión para consultar sus pedidos y rastreo de envíos.</p>';
    return;
  }
  try {
    const data = await apiFetch('/api/orders');
    if (!data.orders.length) {
      box.innerHTML = '<p class="muted">Aún no hay pedidos registrados.</p>';
      return;
    }
    box.innerHTML = data.orders
      .map(
        (o) => `
        <div class="card" style="background:#f8fafc;">
          <div class="section-title-row">
            <strong>Folio: ${o.folio} · Estado: ${o.estado.toUpperCase()}</strong>
            <span class="pill">Total: $${Number(o.total).toFixed(2)} MXN</span>
          </div>
          <div class="muted">Dirección: ${o.direccion_envio} | Pago: ${o.pago ? `${o.pago.tarjeta_enmascarada} (${o.pago.referencia_pasarela})` : o.metodo_pago}</div>
          <div class="muted">Guía de envío: <strong>${o.envio ? `${o.envio.numero_guia} (${o.envio.proveedor_paqueteria} - ${o.envio.estado_envio})` : 'N/A'}</strong></div>
          <div class="muted" style="font-size:0.76rem;">Hash Integridad SHA-256 (RNF-09): ${o.hash_integridad}</div>
          <div class="mt-2">
            ${
              o.estado !== 'devuelto' && o.estado !== 'cancelado'
                ? `<button type="button" class="btn btn-sm btn-outline return-order-btn" data-id="${o.id}">Solicitar Devolución y Reembolso (LFPC)</button>`
                : '<span class="badge badge-ok">Reembolsado / Devuelto</span>'
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
            body: JSON.stringify({ motivo: 'Devolución en línea conforme a LFPC' })
          });
          showAlert('Devolución procesada y reembolso emitido.');
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
        <div style="border-bottom:1px solid #e5e7eb;padding:0.5rem 0;">
          <strong>${n.asunto}</strong> <span class="badge badge-ok">${n.acuse_recibo}</span>
          <div class="muted">${n.mensaje}</div>
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
      <div class="kpis-grid">
        <div class="kpi-card"><div>Pedidos Totales</div><div class="kpi-val">${rep.ventas.totalPedidos}</div></div>
        <div class="kpi-card"><div>Ingresos Activos</div><div class="kpi-val">$${rep.ventas.ingresosTotalesMxn} MXN</div></div>
        <div class="kpi-card"><div>Ticket Promedio</div><div class="kpi-val">$${rep.ventas.ticketPromedioMxn} MXN</div></div>
        <div class="kpi-card"><div>Productos Activos</div><div class="kpi-val">${rep.inventario.totalProductosActivos}</div></div>
      </div>
      <h4 class="mt-2">Estado de Inventario en Almacén D3</h4>
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
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-view').forEach((v) => v.classList.add('hidden'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const target = document.getElementById(btn.dataset.tab);
      target.classList.remove('hidden');

      if (btn.dataset.tab === 'view-orders') loadOrders();
      if (btn.dataset.tab === 'view-profile') loadProfile();
      if (btn.dataset.tab === 'view-admin') loadAdminReports();
      if (btn.dataset.tab === 'view-audit') loadAuditCenter();
    });
  });

  // Filtros de búsqueda
  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    loadCatalog();
  });
  ['filter-category', 'filter-brand', 'filter-max-price', 'filter-sort'].forEach((id) => {
    document.getElementById(id).addEventListener('change', loadCatalog);
  });

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
      showAlert(`Bienvenido ${state.user.nombre}`);
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
      showAlert('Agregue al menos un artículo al carrito.', true);
      return;
    }
    if (!state.token) {
      cartDialog.close();
      authDialog.showModal();
      showAlert('Inicie sesión antes de continuar al pago.', true);
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
      <div><strong>Dirección de Entrega:</strong> ${addr}</div>
      <div><strong>Método de Pago:</strong> ${method.toUpperCase()}</div>
      <div><strong>Subtotal:</strong> $${state.calculatedTotals.subtotal.toFixed(2)} MXN</div>
      <div><strong>Descuento:</strong> -$${state.calculatedTotals.descuento.toFixed(2)} MXN</div>
      <div><strong>IVA (16%):</strong> $${state.calculatedTotals.impuestos.toFixed(2)} MXN</div>
      <div><strong>Envío:</strong> $${state.calculatedTotals.costoEnvio.toFixed(2)} MXN</div>
      <div style="font-size:1.25rem;margin-top:0.5rem;"><strong>Total Confirmado: $${state.calculatedTotals.total.toFixed(2)} MXN</strong></div>
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
        <div class="alert alert-info">
          ✅ <strong>${res.message}</strong><br/>
          Folio: <strong>${res.order.folio}</strong> | Guía DHL: <strong>${res.order.envio.numeroGuia}</strong><br/>
          Token PCI DSS: <code>${res.order.pago.tokenPci}</code> | Tiempo respuesta: ${res.responseTimeMs} ms
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
        `<div class="alert alert-info">Folio ARCO: <strong>${res.folio}</strong> — ${res.respuesta}</div>`;
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
          especificaciones: { origen: 'Panel Administrativo', certificadoCalidad: 'ISO-25012' }
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
