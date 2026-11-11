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


function initAdminAuditEvents() {
  // Alta de Producto en Panel Administrativo
  document.getElementById('admin-product-form').addEventListener('submit', async (e) => {
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
      document.getElementById('admin-product-form').reset();
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

