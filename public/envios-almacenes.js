/**
 * Módulo de Pestañas y Vista de Almacenes CEDIS e Inventario por Almacén
 * para el Panel de Simulación de Repartidor (/envios)
 */
(function () {
  let inventoryData = null;
  let selectedWarehouseCode = '';

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMxn(val) {
    return `$${Number(val || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
  }

  function activateTab(tabId, onTabActivated) {
    const tablist = document.getElementById('envios-tablist');
    if (!tablist) return;
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));

    tabs.forEach((t) => {
      const isSelected = t.id === tabId;
      t.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      t.setAttribute('tabindex', isSelected ? '0' : '-1');
      if (isSelected) {
        t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    });

    panels.forEach((p) => {
      const isMatch = p.getAttribute('aria-labelledby') === tabId;
      if (isMatch) {
        p.removeAttribute('hidden');
      } else {
        p.hidden = 'until-found';
      }
    });

    if (typeof onTabActivated === 'function') {
      onTabActivated(tabId);
    }
  }

  function initTabs({ onSimulationTabShown, onWarehousesTabShown } = {}) {
    const tablist = document.getElementById('envios-tablist');
    if (!tablist) return;
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));

    const handleSwitch = (tabId) => {
      activateTab(tabId, (id) => {
        if (id === 'tab-envios-simulacion' && typeof onSimulationTabShown === 'function') {
          onSimulationTabShown();
        }
        if (id === 'tab-envios-almacenes') {
          loadWarehouseInventory();
          if (typeof onWarehousesTabShown === 'function') {
            onWarehousesTabShown();
          }
        }
      });
    };

    tabs.forEach((tab, idx) => {
      tab.addEventListener('click', () => handleSwitch(tab.id));
      tab.addEventListener('keydown', (ev) => {
        let nextIdx = null;
        if (ev.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
        else if (ev.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
        else if (ev.key === 'Home') nextIdx = 0;
        else if (ev.key === 'End') nextIdx = tabs.length - 1;

        if (nextIdx !== null) {
          ev.preventDefault();
          tabs[nextIdx].focus();
          handleSwitch(tabs[nextIdx].id);
        }
      });
    });

    panels.forEach((panel) => {
      panel.addEventListener('beforematch', () => {
        const ownerId = panel.getAttribute('aria-labelledby');
        if (ownerId) handleSwitch(ownerId);
      });
    });
  }

  function populateFilterControls(warehouses, productos) {
    const whSelect = document.getElementById('warehouse-inv-filter');
    if (whSelect) {
      const current = selectedWarehouseCode || whSelect.value || '';
      whSelect.innerHTML = '<option value="">Todos los Almacenes CEDIS</option>' + warehouses.map((wh) => (
        `<option value="${escapeHtml(wh.codigo)}">${escapeHtml(wh.nombre)} (${wh.productosCount || 0} productos)</option>`
      )).join('');
      whSelect.value = current;
    }

    const catSelect = document.getElementById('warehouse-category-filter');
    if (catSelect) {
      const prevCat = catSelect.value || '';
      const cats = Array.from(new Set(productos.map((p) => p.categoria).filter(Boolean))).sort();
      catSelect.innerHTML = '<option value="">Todas las Categorías</option>' + cats.map((c) => (
        `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
      )).join('');
      catSelect.value = cats.includes(prevCat) ? prevCat : '';
    }
  }

  function renderWarehouseCards(warehouses) {
    const grid = document.getElementById('warehouses-cards-grid');
    if (!grid) return;

    const badge = document.getElementById('tab-warehouses-badge');
    if (badge) badge.textContent = warehouses.length;

    grid.innerHTML = warehouses.map((wh) => {
      const isSelected = selectedWarehouseCode === wh.codigo;
      const color = wh.color || '#1d4e9a';
      const invValor = Number(wh.valorInventarioMxn || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });
      return `
        <button
          type="button"
          class="warehouse-select-card text-left bg-white rounded-xl border transition-all p-4 shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between gap-3 ${
            isSelected ? 'border-express-blue ring-2 ring-express-blue bg-blue-50/40' : 'border-slate-200 hover:border-slate-300'
          }"
          data-codigo="${escapeHtml(wh.codigo)}"
        >
          <div class="space-y-2 w-full">
            <div class="h-1.5 w-full rounded-full" style="background: ${escapeHtml(color)};"></div>
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">${escapeHtml(wh.codigo)}</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Operativo</span>
            </div>
            <h3 class="font-heading font-bold text-sm text-slate-800 leading-snug">${escapeHtml(wh.nombre)}</h3>
            <p class="text-[11px] text-slate-500 leading-relaxed line-clamp-2" title="${escapeHtml(wh.direccion)}">
              📍 ${escapeHtml(wh.direccion)}
            </p>
          </div>

          <div class="w-full pt-2.5 border-t border-slate-100 space-y-1.5">
            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <div class="bg-slate-50 rounded-lg p-2">
                <span class="text-slate-400 block text-[10px]">Productos</span>
                <strong class="text-slate-800 font-extrabold text-sm">${wh.productosCount || 0}</strong>
              </div>
              <div class="bg-slate-50 rounded-lg p-2">
                <span class="text-slate-400 block text-[10px]">Stock Total</span>
                <strong class="text-express-blue font-extrabold text-sm">${wh.stockTotal || 0} uds</strong>
              </div>
            </div>
            <div class="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
              <span>🚚 Pedidos: <strong>${wh.stats?.totalPedidos || 0}</strong></span>
              <span>💰 ~$${invValor}</span>
            </div>
          </div>
        </button>
      `;
    }).join('');

    grid.querySelectorAll('.warehouse-select-card').forEach((card) => {
      card.addEventListener('click', () => {
        const code = card.dataset.codigo || '';
        selectedWarehouseCode = selectedWarehouseCode === code ? '' : code;
        const whSelect = document.getElementById('warehouse-inv-filter');
        if (whSelect) whSelect.value = selectedWarehouseCode;
        renderSelectedWarehouseView();
      });
    });
  }

  function renderSelectedWarehouseView() {
    if (!inventoryData) return;
    const warehouses = inventoryData.warehouses || [];
    const allProducts = inventoryData.productos || [];

    renderWarehouseCards(warehouses);

    const searchQ = (document.getElementById('warehouse-products-search')?.value || '').trim().toLowerCase();
    const catFilter = (document.getElementById('warehouse-category-filter')?.value || '').trim().toLowerCase();

    const filteredProducts = allProducts.filter((p) => {
      if (selectedWarehouseCode && p.almacen_codigo !== selectedWarehouseCode) return false;
      if (catFilter && String(p.categoria || '').toLowerCase() !== catFilter) return false;
      if (searchQ) {
        const hay = `${p.nombre || ''} ${p.sku || ''} ${p.marca || ''} ${p.categoria || ''} ${p.almacen_nombre || ''}`.toLowerCase();
        if (!hay.includes(searchQ)) return false;
      }
      return true;
    });

    const banner = document.getElementById('selected-warehouse-banner');
    const selectedWh = warehouses.find((w) => w.codigo === selectedWarehouseCode);
    if (banner) {
      if (selectedWh) {
        banner.innerHTML = `
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full inline-block" style="background: ${escapeHtml(selectedWh.color || '#1d4e9a')};"></span>
                <strong class="font-heading text-base text-slate-800">${escapeHtml(selectedWh.nombre)}</strong>
                <span class="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-express-blue">${escapeHtml(selectedWh.codigo)}</span>
              </div>
              <p class="text-xs text-slate-600 mt-1">📍 ${escapeHtml(selectedWh.direccion)} &bull; 🕒 ${escapeHtml(selectedWh.horario || '24/7')} &bull; 🚛 Muelles: ${selectedWh.muelles_carga || 10}</p>
            </div>
            <button type="button" id="btn-clear-wh-selection" class="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer">
              Ver todos los almacenes
            </button>
          </div>
        `;
        document.getElementById('btn-clear-wh-selection')?.addEventListener('click', () => {
          selectedWarehouseCode = '';
          const whSelect = document.getElementById('warehouse-inv-filter');
          if (whSelect) whSelect.value = '';
          renderSelectedWarehouseView();
        });
      } else {
        banner.innerHTML = `
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong class="font-heading text-base text-slate-800">Inventario Consolidado en ${warehouses.length} Almacenes CEDIS</strong>
              <p class="text-xs text-slate-600 mt-0.5">Haz clic en cualquier tarjeta de almacén arriba o usa el filtro para inspeccionar sus productos.</p>
            </div>
            <span class="text-xs font-bold text-express-blue bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
              ${filteredProducts.length} productos mostrados
            </span>
          </div>
        `;
      }
    }

    const statusLabel = document.getElementById('warehouse-inv-count-status');
    if (statusLabel) {
      statusLabel.textContent = `${filteredProducts.length} ${filteredProducts.length === 1 ? 'producto encontrado' : 'productos encontrados'}`;
    }

    const container = document.getElementById('warehouses-products-table');
    if (!container) return;

    if (!filteredProducts.length) {
      container.innerHTML = `
        <div class="text-center py-12 px-4 text-slate-500 text-xs space-y-2">
          <span class="material-symbols-outlined text-[40px] text-slate-300 block">inventory_2</span>
          <p class="font-bold text-slate-700 text-sm">No se encontraron productos en este almacén con los filtros actuales</p>
          <p>Al publicar un producto desde ExpressMart puedes elegir asignarlo a cualquiera de los 5 almacenes CEDIS.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[11px]">
              <th class="py-3 px-4">Producto / SKU</th>
              <th class="py-3 px-4">Almacén CEDIS</th>
              <th class="py-3 px-4">Categoría y Marca</th>
              <th class="py-3 px-4 text-right">Precio Unitario</th>
              <th class="py-3 px-4 text-center">Stock en Almacén</th>
              <th class="py-3 px-4">Vendedor</th>
              <th class="py-3 px-4 text-center">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${filteredProducts.map((p) => {
              const stock = Number(p.stock_disponible || 0);
              const reserved = Number(p.stock_reservado || 0);
              let stockClass = 'bg-emerald-100 text-emerald-800';
              let statusText = 'Disponible';
              if (stock === 0) {
                stockClass = 'bg-red-100 text-red-700';
                statusText = 'Sin Stock';
              } else if (stock <= 5) {
                stockClass = 'bg-amber-100 text-amber-800';
                statusText = 'Stock Bajo';
              }
              return `
                <tr class="hover:bg-slate-50/90 transition-colors">
                  <td class="py-3 px-4">
                    <div class="flex items-center gap-3">
                      <img src="${escapeHtml(p.imagen_url || '/assets/logo.png')}" alt="${escapeHtml(p.nombre)}" class="w-10 h-10 object-cover rounded-lg border border-slate-200 bg-white shrink-0" onerror="this.src='/assets/logo.png'" />
                      <div>
                        <strong class="text-slate-800 font-bold block leading-snug">${escapeHtml(p.nombre)}</strong>
                        <span class="font-mono text-[10px] text-slate-500">${escapeHtml(p.sku)}</span>
                      </div>
                    </div>
                  </td>
                  <td class="py-3 px-4">
                    <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
                      <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background: ${escapeHtml(p.almacen_color || '#1d4e9a')};"></span>
                      <div>
                        <span class="font-bold text-slate-800 block leading-tight">${escapeHtml(p.almacen_codigo)}</span>
                        <span class="text-[10px] text-slate-500 block leading-tight">${escapeHtml(p.almacen_ciudad || p.almacen_nombre)}</span>
                      </div>
                    </div>
                  </td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded bg-blue-50 text-express-blue font-bold text-[10px]">${escapeHtml(p.categoria)}</span>
                    <span class="block text-[11px] text-slate-500 mt-0.5">${escapeHtml(p.marca)}</span>
                  </td>
                  <td class="py-3 px-4 text-right font-extrabold text-slate-800">${formatMxn(p.precio)}</td>
                  <td class="py-3 px-4 text-center">
                    <span class="font-extrabold text-sm text-slate-800 block">${stock} uds</span>
                    ${reserved > 0 ? `<span class="text-[10px] text-amber-600 block">(${reserved} reservadas)</span>` : ''}
                  </td>
                  <td class="py-3 px-4 text-slate-600 font-medium">${escapeHtml(p.vendedor_nombre || 'Vendedor ExpressMart')}</td>
                  <td class="py-3 px-4 text-center">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${stockClass}">${statusText}</span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function loadWarehouseInventory() {
    try {
      const res = await fetch('/api/logistics/warehouses/inventory');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      inventoryData = await res.json();
      populateFilterControls(inventoryData.warehouses || [], inventoryData.productos || []);
      renderSelectedWarehouseView();
    } catch (err) {
      const container = document.getElementById('warehouses-products-table');
      if (container) {
        container.innerHTML = `<div class="p-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg m-4">Error al cargar inventario de almacenes: ${escapeHtml(err.message)}</div>`;
      }
    }
  }

  function bindWarehouseTabEvents() {
    document.getElementById('warehouse-inv-filter')?.addEventListener('change', (ev) => {
      selectedWarehouseCode = ev.target.value || '';
      renderSelectedWarehouseView();
    });
    document.getElementById('warehouse-category-filter')?.addEventListener('change', renderSelectedWarehouseView);
    document.getElementById('warehouse-products-search')?.addEventListener('input', renderSelectedWarehouseView);
    document.getElementById('btn-refresh-warehouses-inv')?.addEventListener('click', loadWarehouseInventory);
  }

  window.EnviosAlmacenes = {
    initTabs,
    bindWarehouseTabEvents,
    loadWarehouseInventory
  };
})();
