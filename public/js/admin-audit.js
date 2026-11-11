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
    });
  }

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

window.loadAdminReports = loadAdminReports;
window.loadAuditCenter = loadAuditCenter;
window.initAdminAuditEvents = initAdminAuditEvents;
