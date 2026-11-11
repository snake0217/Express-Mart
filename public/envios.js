/**
 * Panel de Envíos y Almacenes - ExpressMart México
 * Soporte OpenStreetMap (Leaflet.js) y Simulación en Tiempo Real (Camión 🚚 / Auto 🚗)
 */

(function () {
  let map = null;
  let activeShipment = null;
  let allShipments = [];
  let allWarehouses = [];
  let currentVehicleType = 'camion';
  let simulationSpeed = 1;
  let simulationInterval = null;
  let routePolyline = null;
  let originMarker = null;
  let destMarker = null;
  let vehicleMarker = null;
  let currentWaypointIndex = 0;

  // Autenticación: Leer token desde localStorage o cookie
  function getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  function getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async function apiFetch(endpoint, options = {}) {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        ...getHeaders(),
        ...(options.headers || {})
      }
    });

    if (res.status === 401) {
      // Si no está autenticado, intentar usar token de sesión almacenado en currentUser
      const currentUserStr = localStorage.getItem('currentUser');
      if (!currentUserStr) {
        console.warn('Sesión no detectada. Operando en modo vista interactiva.');
      }
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Error ${res.status}: ${res.statusText}`);
    }
    return data;
  }

  // Inicializar Mapa OpenStreetMap con Leaflet
  function initMap() {
    const container = document.getElementById('map-osm-container');
    if (!container) return;

    // CDMX Centro por defecto [19.4326, -99.1332]
    map = L.map('map-osm-container', {
      center: [19.4326, -99.1332],
      zoom: 11,
      zoomControl: true
    });

    // Capa de teselas OpenStreetMap oficial
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors | ExpressMart Logística'
    }).addTo(map);
  }

  // Crear iconos personalizados para Leaflet
  function createWarehouseIcon(name) {
    return L.divIcon({
      className: 'custom-warehouse-icon',
      html: `
        <div class="warehouse-badge" title="${name}">
          <span class="material-symbols-outlined text-[18px]">warehouse</span>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
  }

  function createDestinationIcon(title) {
    return L.divIcon({
      className: 'custom-dest-icon',
      html: `
        <div class="destination-badge" title="${title}">
          <span class="material-symbols-outlined text-[18px]">home</span>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
  }

  function createVehicleIcon(type = 'camion') {
    const emoji = type === 'auto' ? '🚗' : '🚚';
    return L.divIcon({
      className: 'custom-vehicle-icon',
      html: `
        <div class="truck-marker-container">
          <div class="pulse-ring"></div>
          <div class="vehicle-icon-badge text-lg" id="vehicle-marker-badge">${emoji}</div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });
  }

  // Cargar lista de almacenes
  async function loadWarehouses() {
    try {
      const data = await apiFetch('/api/logistics/warehouses');
      allWarehouses = data.warehouses || [];
      const select = document.getElementById('select-warehouse-filter');
      if (select) {
        select.innerHTML = '<option value="">Todos los Almacenes</option>';
        allWarehouses.forEach((wh) => {
          const opt = document.createElement('option');
          opt.value = wh.codigo;
          opt.textContent = `${wh.nombre} (${wh.ciudad})`;
          select.appendChild(opt);
        });
      }
      const countEl = document.getElementById('metric-warehouses-count');
      if (countEl) countEl.textContent = allWarehouses.length;
    } catch (err) {
      console.warn('Error al cargar almacenes:', err.message);
    }
  }

  // Cargar lista de envíos y pedidos
  async function loadShipments() {
    const whFilter = document.getElementById('select-warehouse-filter')?.value || '';
    const stFilter = document.getElementById('select-status-filter')?.value || '';

    let url = '/api/logistics/shipments';
    const params = new URLSearchParams();
    if (whFilter) params.append('almacen', whFilter);
    if (stFilter) params.append('estado', stFilter);
    if (params.toString()) url += '?' + params.toString();

    try {
      const data = await apiFetch(url);
      allShipments = data.shipments || [];

      // Actualizar contadores métricos
      let prepCount = 0;
      let transCount = 0;
      let delivCount = 0;

      allShipments.forEach((s) => {
        if (s.estadoEnvio === 'preparando') prepCount++;
        else if (s.estadoEnvio === 'en_transito') transCount++;
        else if (s.estadoEnvio === 'entregado') delivCount++;
      });

      document.getElementById('metric-preparing-count').textContent = prepCount;
      document.getElementById('metric-transit-count').textContent = transCount;
      document.getElementById('metric-delivered-count').textContent = delivCount;
      document.getElementById('total-shipments-label').textContent = `${allShipments.length} pedidos encontrados`;

      renderShipmentsList();

      // Si no hay envío activo o el activo ya no está, seleccionar el primero disponible
      if (!activeShipment && allShipments.length > 0) {
        selectShipment(allShipments[0]);
      } else if (activeShipment) {
        const found = allShipments.find((s) => s.id === activeShipment.id);
        if (found) {
          activeShipment = found;
          updateTelemetryUI();
        }
      }
    } catch (err) {
      console.error('Error al cargar envíos:', err);
      const listEl = document.getElementById('shipments-list');
      if (listEl) {
        listEl.innerHTML = `
          <div class="p-4 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
            Error al consultar envíos: ${err.message}. Asegúrate de tener permisos administrativos o de vendedor.
          </div>
        `;
      }
    }
  }

  // Renderizar la lista de tarjetas de pedidos
  function renderShipmentsList() {
    const listEl = document.getElementById('shipments-list');
    if (!listEl) return;

    if (allShipments.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-10 text-slate-400 text-xs">
          <span class="material-symbols-outlined text-[32px] text-slate-300 block mb-1">inbox</span>
          No se encontraron pedidos con los filtros aplicados.
        </div>
      `;
      return;
    }

    listEl.innerHTML = allShipments.map((s) => {
      const isSelected = activeShipment && activeShipment.id === s.id;
      let badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
      let statusLabel = 'Preparando';
      let statusIcon = 'inventory_2';

      if (s.estadoEnvio === 'en_transito') {
        badgeClass = 'bg-sky-100 text-sky-800 border-sky-200 animate-pulse';
        statusLabel = 'En Progreso';
        statusIcon = 'local_shipping';
      } else if (s.estadoEnvio === 'entregado') {
        badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
        statusLabel = 'Entregado';
        statusIcon = 'verified';
      }

      const totalFmt = Number(s.pedidoTotal).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const itemsCount = s.items ? s.items.length : 0;

      return `
        <div class="p-3 rounded-lg border transition cursor-pointer shipment-card ${
          isSelected ? 'bg-blue-50/70 border-express-blue shadow-sm ring-1 ring-express-blue' : 'bg-white border-slate-200 hover:border-slate-300'
        }" data-id="${s.id}">
          <div class="flex items-start justify-between gap-2 mb-1.5">
            <div>
              <span class="font-bold text-xs text-slate-800 block">${s.pedidoFolio}</span>
              <span class="text-[11px] text-slate-500 font-mono">${s.numeroGuia}</span>
            </div>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}">
              <span class="material-symbols-outlined text-[12px]">${statusIcon}</span>
              ${statusLabel}
            </span>
          </div>

          <div class="text-[11px] text-slate-600 space-y-0.5 mb-2">
            <div><strong>Cliente:</strong> ${s.clienteNombre} (${s.clienteEmail})</div>
            <div class="truncate"><strong>Almacén:</strong> ${s.almacenOrigen}</div>
            <div class="truncate text-slate-500"><strong>Destino:</strong> ${s.direccionEnvio}</div>
          </div>

          <div class="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px]">
            <span class="font-bold text-express-blue">$${totalFmt} MXN</span>
            <span class="text-slate-400 font-medium">${itemsCount} ${itemsCount === 1 ? 'artículo' : 'artículos'} &bull; ${Math.round(s.progresoSimulacion || 0)}% ruta</span>
          </div>
        </div>
      `;
    }).join('');

    // Asignar listeners a cada tarjeta
    listEl.querySelectorAll('.shipment-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = Number(card.dataset.id);
        const shipment = allShipments.find((s) => s.id === id);
        if (shipment) {
          selectShipment(shipment);
        }
      });
    });
  }

  // Seleccionar un envío y proyectarlo en el mapa OpenStreetMap
  function selectShipment(shipment) {
    activeShipment = shipment;
    currentVehicleType = shipment.tipoVehiculo || 'camion';

    // Detener cualquier animación en curso
    stopSimulationLoop();

    // Actualizar encabezado
    document.getElementById('active-shipment-title').textContent = `Ruta de Entrega: ${shipment.pedidoFolio}`;
    document.getElementById('active-shipment-subtitle').textContent = `Guía: ${shipment.numeroGuia} &bull; ${shipment.almacenOrigen} ➔ ${shipment.direccionEnvio}`;

    // Actualizar botones de vehículo
    updateVehicleSelectorUI();

    // Renderizar ruta y marcadores en OpenStreetMap
    renderShipmentOnMap(shipment);

    // Actualizar telemetría
    updateTelemetryUI();

    // Re-renderizar lista para reflejar selección
    renderShipmentsList();

    // Si la simulación estaba activa en el backend, reanudarla
    if (shipment.simulacionActiva && shipment.estadoEnvio !== 'entregado') {
      startSimulationLoop();
    }
  }

  // Dibujar la ruta y los marcadores en OpenStreetMap
  function renderShipmentOnMap(shipment) {
    if (!map) return;

    // Limpiar capas previas
    if (routePolyline) map.removeLayer(routePolyline);
    if (originMarker) map.removeLayer(originMarker);
    if (destMarker) map.removeLayer(destMarker);
    if (vehicleMarker) map.removeLayer(vehicleMarker);

    const origin = [shipment.latOrigen, shipment.lngOrigen];
    const destination = [shipment.latDestino, shipment.lngDestino];
    const waypoints = shipment.rutaPuntos && shipment.rutaPuntos.length > 0
      ? shipment.rutaPuntos
      : [origin, destination];

    // Marcador de Almacén Origen
    originMarker = L.marker(origin, {
      icon: createWarehouseIcon(shipment.almacenOrigen)
    }).addTo(map);
    originMarker.bindPopup(`
      <div class="text-xs space-y-1">
        <strong class="text-express-blue block text-sm font-bold">🏢 ${shipment.almacenOrigen}</strong>
        <div>Almacén Central / Centro de Distribución CEDIS</div>
        <div class="text-slate-500">Muelle de Carga y Despacho</div>
      </div>
    `);

    // Marcador de Destino del Cliente
    destMarker = L.marker(destination, {
      icon: createDestinationIcon(shipment.clienteNombre)
    }).addTo(map);
    destMarker.bindPopup(`
      <div class="text-xs space-y-1">
        <strong class="text-rose-600 block text-sm font-bold">📍 Destino del Cliente</strong>
        <div><strong>Cliente:</strong> ${shipment.clienteNombre}</div>
        <div class="text-slate-600"><strong>Dirección:</strong> ${shipment.direccionEnvio}</div>
        <div class="text-emerald-700 font-bold">Total Pedido: $${Number(shipment.pedidoTotal).toFixed(2)} MXN</div>
      </div>
    `);

    // Trazo de la ruta vehicular en OpenStreetMap
    routePolyline = L.polyline(waypoints, {
      color: '#1d4e9a',
      weight: 5,
      opacity: 0.85,
      lineJoin: 'round',
      dashArray: shipment.estadoEnvio === 'preparando' ? '6, 8' : null
    }).addTo(map);

    // Ajustar vista del mapa para encuadrar la ruta completa
    const bounds = L.latLngBounds([origin, destination]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });

    // Determinar índice actual de posición según progreso
    const progress = Number(shipment.progresoSimulacion || 0);
    currentWaypointIndex = Math.floor((progress / 100) * (waypoints.length - 1));
    const currentPos = waypoints[currentWaypointIndex] || origin;

    // Marcador del Vehículo de Reparto (Camión o Auto)
    vehicleMarker = L.marker(currentPos, {
      icon: createVehicleIcon(currentVehicleType),
      zIndexOffset: 1000
    }).addTo(map);

    vehicleMarker.bindTooltip(`
      <div class="font-bold text-xs">${currentVehicleType === 'auto' ? '🚗 Auto de Reparto' : '🚚 Camión de Reparto'} ExpressMart</div>
      <div class="text-[11px] text-slate-500">Guía: ${shipment.numeroGuia}</div>
    `, { permanent: false, direction: 'top' });
  }

  // Actualizar Telemetría y Barra de Progreso
  function updateTelemetryUI() {
    if (!activeShipment) return;

    const s = activeShipment;
    const progress = Math.min(100, Math.max(0, Math.round(s.progresoSimulacion || 0)));

    document.getElementById('telemetry-progress-text').textContent = `${progress}%`;
    document.getElementById('telemetry-progress-bar').style.width = `${progress}%`;
    document.getElementById('telemetry-origin').textContent = s.almacenOrigen || 'CEDIS';
    document.getElementById('telemetry-destination').textContent = s.direccionEnvio || 'Destino';
    document.getElementById('telemetry-coords').textContent = `${Number(s.latActual).toFixed(4)}, ${Number(s.lngActual).toFixed(4)}`;
    document.getElementById('telemetry-vehicle-badge').textContent = currentVehicleType === 'auto' ? '🚗' : '🚚';

    const statusEl = document.getElementById('telemetry-status');
    if (s.estadoEnvio === 'entregado' || progress >= 100) {
      statusEl.textContent = 'Entregado en Destino';
      statusEl.className = 'font-semibold text-emerald-600';
    } else if (s.simulacionActiva || s.estadoEnvio === 'en_transito') {
      statusEl.textContent = `En Ruta (~${45 * simulationSpeed} km/h)`;
      statusEl.className = 'font-semibold text-sky-600 animate-pulse';
    } else {
      statusEl.textContent = 'En Almacén (Preparando)';
      statusEl.className = 'font-semibold text-amber-600';
    }
  }

  function updateVehicleSelectorUI() {
    const btnTruck = document.getElementById('btn-vehicle-truck');
    const btnCar = document.getElementById('btn-vehicle-car');
    if (!btnTruck || !btnCar) return;

    if (currentVehicleType === 'auto') {
      btnCar.className = 'px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 bg-white text-express-blue shadow-sm border border-slate-200 transition';
      btnTruck.className = 'px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 text-slate-600 hover:text-slate-800 transition';
    } else {
      btnTruck.className = 'px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 bg-white text-express-blue shadow-sm border border-slate-200 transition';
      btnCar.className = 'px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 text-slate-600 hover:text-slate-800 transition';
    }

    if (vehicleMarker) {
      vehicleMarker.setIcon(createVehicleIcon(currentVehicleType));
    }
  }

  // Bucle de animación de la simulación
  function startSimulationLoop() {
    stopSimulationLoop();
    if (!activeShipment || !activeShipment.rutaPuntos || activeShipment.rutaPuntos.length === 0) return;

    const waypoints = activeShipment.rutaPuntos;
    const intervalMs = Math.max(80, Math.floor(600 / simulationSpeed));

    simulationInterval = setInterval(async () => {
      if (currentWaypointIndex < waypoints.length - 1) {
        currentWaypointIndex++;
        const nextPos = waypoints[currentWaypointIndex];

        if (vehicleMarker) {
          vehicleMarker.setLatLng(nextPos);
        }

        const pct = ((currentWaypointIndex / (waypoints.length - 1)) * 100).toFixed(1);
        activeShipment.progresoSimulacion = Number(pct);
        activeShipment.latActual = nextPos[0];
        activeShipment.lngActual = nextPos[1];
        activeShipment.simulacionActiva = true;

        updateTelemetryUI();

        // Sincronizar periódicamente con el backend (cada 5 waypoints o al finalizar)
        if (currentWaypointIndex % 5 === 0 || currentWaypointIndex === waypoints.length - 1) {
          apiFetch(`/api/logistics/shipments/${activeShipment.pedidoId}/simulation/progress`, {
            method: 'POST',
            body: JSON.stringify({
              progreso: activeShipment.progresoSimulacion,
              lat: nextPos[0],
              lng: nextPos[1]
            })
          }).catch(() => {});
        }
      } else {
        // Fin de ruta alcanzado
        stopSimulationLoop();
        activeShipment.progresoSimulacion = 100.0;
        activeShipment.simulacionActiva = false;
        activeShipment.estadoEnvio = 'entregado';
        updateTelemetryUI();

        // Notificar entrega al backend
        apiFetch(`/api/logistics/shipments/${activeShipment.pedidoId}/deliver`, {
          method: 'POST'
        }).then(() => {
          loadShipments();
        }).catch(() => {});
      }
    }, intervalMs);
  }

  function stopSimulationLoop() {
    if (simulationInterval) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }
  }

  // Vincular eventos de botones y controles
  function bindEvents() {
    // Refrescar
    document.getElementById('btn-refresh-shipments')?.addEventListener('click', loadShipments);

    // Filtros
    document.getElementById('select-warehouse-filter')?.addEventListener('change', loadShipments);
    document.getElementById('select-status-filter')?.addEventListener('change', loadShipments);

    // Selector de Vehículo (Camión / Auto)
    document.getElementById('btn-vehicle-truck')?.addEventListener('click', () => {
      currentVehicleType = 'camion';
      updateVehicleSelectorUI();
      if (activeShipment) {
        activeShipment.tipoVehiculo = 'camion';
        apiFetch(`/api/logistics/shipments/${activeShipment.pedidoId}/simulation/start`, {
          method: 'POST',
          body: JSON.stringify({ tipoVehiculo: 'camion' })
        }).catch(() => {});
      }
    });

    document.getElementById('btn-vehicle-car')?.addEventListener('click', () => {
      currentVehicleType = 'auto';
      updateVehicleSelectorUI();
      if (activeShipment) {
        activeShipment.tipoVehiculo = 'auto';
        apiFetch(`/api/logistics/shipments/${activeShipment.pedidoId}/simulation/start`, {
          method: 'POST',
          body: JSON.stringify({ tipoVehiculo: 'auto' })
        }).catch(() => {});
      }
    });

    // Iniciar Simulación
    document.getElementById('btn-sim-start')?.addEventListener('click', async () => {
      if (!activeShipment) return;
      try {
        await apiFetch(`/api/logistics/shipments/${activeShipment.pedidoId}/simulation/start`, {
          method: 'POST',
          body: JSON.stringify({ tipoVehiculo: currentVehicleType })
        });
        activeShipment.simulacionActiva = true;
        activeShipment.estadoEnvio = 'en_transito';
        startSimulationLoop();
        updateTelemetryUI();
      } catch (err) {
        alert('Error al iniciar simulación: ' + err.message);
      }
    });

    // Parar Simulación
    document.getElementById('btn-sim-stop')?.addEventListener('click', async () => {
      if (!activeShipment) return;
      try {
        await apiFetch(`/api/logistics/shipments/${activeShipment.pedidoId}/simulation/stop`, {
          method: 'POST'
        });
        stopSimulationLoop();
        activeShipment.simulacionActiva = false;
        updateTelemetryUI();
      } catch (err) {
        alert('Error al pausar simulación: ' + err.message);
      }
    });

    // Reiniciar Simulación
    document.getElementById('btn-sim-reset')?.addEventListener('click', async () => {
      if (!activeShipment) return;
      try {
        await apiFetch(`/api/logistics/shipments/${activeShipment.pedidoId}/simulation/reset`, {
          method: 'POST'
        });
        stopSimulationLoop();
        currentWaypointIndex = 0;
        activeShipment.progresoSimulacion = 0.0;
        activeShipment.simulacionActiva = false;
        activeShipment.estadoEnvio = 'preparando';
        if (activeShipment.rutaPuntos && activeShipment.rutaPuntos.length > 0 && vehicleMarker) {
          vehicleMarker.setLatLng(activeShipment.rutaPuntos[0]);
        }
        updateTelemetryUI();
        loadShipments();
      } catch (err) {
        alert('Error al reiniciar simulación: ' + err.message);
      }
    });

    // Botones de Velocidad (1x, 2x, 5x)
    function setSpeed(sp, btnId) {
      simulationSpeed = sp;
      ['btn-speed-1x', 'btn-speed-2x', 'btn-speed-5x'].forEach((id) => {
        const b = document.getElementById(id);
        if (b) {
          b.className = id === btnId
            ? 'px-2 py-0.5 rounded bg-express-blue text-white font-bold text-xs'
            : 'px-2 py-0.5 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold text-xs';
        }
      });
      if (simulationInterval) {
        startSimulationLoop();
      }
      updateTelemetryUI();
    }

    document.getElementById('btn-speed-1x')?.addEventListener('click', () => setSpeed(1, 'btn-speed-1x'));
    document.getElementById('btn-speed-2x')?.addEventListener('click', () => setSpeed(2, 'btn-speed-2x'));
    document.getElementById('btn-speed-5x')?.addEventListener('click', () => setSpeed(5, 'btn-speed-5x'));

    // Acciones de Gestión de Almacén
    document.getElementById('btn-action-prepare')?.addEventListener('click', async () => {
      if (!activeShipment) return;
      try {
        await apiFetch(`/api/logistics/shipments/${activeShipment.pedidoId}/prepare`, { method: 'POST' });
        loadShipments();
      } catch (err) {
        alert('Error al preparar envío: ' + err.message);
      }
    });

    document.getElementById('btn-action-dispatch')?.addEventListener('click', async () => {
      if (!activeShipment) return;
      try {
        await apiFetch(`/api/logistics/shipments/${activeShipment.pedidoId}/dispatch`, {
          method: 'POST',
          body: JSON.stringify({ tipoVehiculo: currentVehicleType })
        });
        loadShipments();
        startSimulationLoop();
      } catch (err) {
        alert('Error al despachar envío: ' + err.message);
      }
    });

    document.getElementById('btn-action-deliver')?.addEventListener('click', async () => {
      if (!activeShipment) return;
      try {
        await apiFetch(`/api/logistics/shipments/${activeShipment.pedidoId}/deliver`, { method: 'POST' });
        stopSimulationLoop();
        loadShipments();
      } catch (err) {
        alert('Error al marcar entrega: ' + err.message);
      }
    });
  }

  // Inicialización al cargar la página
  window.addEventListener('DOMContentLoaded', () => {
    initMap();
    bindEvents();
    loadWarehouses();
    loadShipments();

    // Actualizar nombre de usuario si existe en sesión
    try {
      const userStr = localStorage.getItem('currentUser');
      if (userStr) {
        const u = JSON.parse(userStr);
        const textEl = document.getElementById('user-role-text');
        if (textEl) textEl.textContent = `${u.nombre || u.email} (${u.rol || 'admin'})`;
      }
    } catch (_) {}
  });
})();
