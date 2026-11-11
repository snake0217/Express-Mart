/**
 * Panel de Envíos y Almacenes - ExpressMart México
 * Soporte OpenStreetMap (Leaflet.js), Autenticación por Panel y Simulación en Tiempo Real (Camión 🚚 / Auto 🚗)
 */

(function () {
  let map = null;
  let activeShipment = null;
  let allShipments = [];
  let allWarehouses = [];
  let currentVehicleType = 'camion';
  let simulationSpeed = 1;
  let simulationInterval = null;
  let backendSyncInterval = null;
  let routePolyline = null;
  let originMarker = null;
  let destMarker = null;
  let vehicleMarker = null;
  let currentWaypointIndex = 0;
  let panelSessionToken = '';
  let panelAuthenticated = false;

  // Autenticación: Leer token de sesión del panel o de la tienda (em_token)
  function getToken() {
    return (
      panelSessionToken ||
      localStorage.getItem('em_token') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('token') ||
      ''
    );
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
      panelAuthenticated = false;
      const overlay = document.getElementById('envios-login-overlay');
      if (overlay) overlay.classList.remove('hidden');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Error ${res.status}: ${res.statusText}`);
    }
    return data;
  }

  // Normalizar punto de ruta [lat, lng] o {lat, lng}
  function toLatLngTuple(pt) {
    if (Array.isArray(pt) && pt.length >= 2) {
      return [Number(pt[0]), Number(pt[1])];
    }
    if (pt && typeof pt === 'object' && pt.lat !== undefined && pt.lng !== undefined) {
      return [Number(pt.lat), Number(pt.lng)];
    }
    return null;
  }

  // Inicializar Mapa OpenStreetMap con Leaflet
  function initMap() {
    const container = document.getElementById('map-osm-container');
    if (!container || typeof L === 'undefined') return;

    map = L.map('map-osm-container', {
      center: [19.4326, -99.1332],
      zoom: 11,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors | ExpressMart Logística'
    }).addTo(map);

    // Permitir hacer clic en el mapa para fijar nuevas coordenadas de entrega al pedido seleccionado
    map.on('click', async (ev) => {
      if (!activeShipment) return;
      const clickedLat = Number(ev.latlng.lat.toFixed(5));
      const clickedLng = Number(ev.latlng.lng.toFixed(5));
      const baseAddr = (activeShipment.direccionEnvio || 'Domicilio del comprador').replace(/\s*\[Lat:.*?\]/g, '').trim();
      const updatedAddr = `${baseAddr} [Lat: ${clickedLat}, Lng: ${clickedLng}]`;

      try {
        await apiFetch(`/api/logistics/shipments/${activeShipment.pedidoId}/destination`, {
          method: 'PUT',
          body: JSON.stringify({
            direccion: updatedAddr,
            latDestino: clickedLat,
            lngDestino: clickedLng
          })
        });
        await loadShipments();
      } catch (err) {
        console.warn('No se pudo actualizar destino:', err.message);
      }
    });
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

  // Cargar lista de almacenes con sus direcciones falsas completas
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
          opt.textContent = `${wh.nombre} — ${wh.direccion || wh.ciudad}`;
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
  async function loadShipments(isBackgroundPoll = false) {
    if (!panelAuthenticated && !getToken()) return;

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

      if (!activeShipment && allShipments.length > 0) {
        selectShipment(allShipments[0]);
      } else if (activeShipment) {
        const found = allShipments.find((s) => s.id === activeShipment.id);
        if (found) {
          const wasActive = Boolean(activeShipment.simulacionActiva);
          activeShipment = found;
          if (!isBackgroundPoll || !simulationInterval) {
            renderShipmentOnMap(activeShipment, isBackgroundPoll);
            updateTelemetryUI();
            if (activeShipment.simulacionActiva && !simulationInterval && activeShipment.estadoEnvio !== 'entregado') {
              startSimulationLoop();
            } else if (!activeShipment.simulacionActiva && wasActive) {
              stopSimulationLoop();
            }
          }
        }
      }
    } catch (err) {
      if (!isBackgroundPoll) {
        console.error('Error al cargar envíos:', err);
        const listEl = document.getElementById('shipments-list');
        if (listEl) {
          listEl.innerHTML = `
            <div class="p-4 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              Error al consultar envíos: ${err.message}. Inicie sesión con sus credenciales de acceso.
            </div>
          `;
        }
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
      const whAddress = s.almacenDireccion || 'Av. Ceylán 450, Bodega Logística 4-B, Col. Industrial Vallejo, CDMX';

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
            <div class="truncate" title="${whAddress}"><strong>🏢 Almacén:</strong> ${s.almacenOrigen} — ${whAddress}</div>
            <div class="truncate text-slate-500" title="${s.direccionEnvio}"><strong>📍 Destino:</strong> ${s.direccionEnvio}</div>
          </div>

          <div class="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px]">
            <span class="font-bold text-express-blue">$${totalFmt} MXN</span>
            <span class="text-slate-400 font-medium">${itemsCount} ${itemsCount === 1 ? 'artículo' : 'artículos'} &bull; ${Math.round(s.progresoSimulacion || 0)}% ruta</span>
          </div>
        </div>
      `;
    }).join('');

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

    stopSimulationLoop();

    const whAddress = shipment.almacenDireccion || 'Av. Ceylán 450, Bodega Logística 4-B, Col. Industrial Vallejo, CDMX';
    document.getElementById('active-shipment-title').textContent = `Ruta de Entrega: ${shipment.pedidoFolio}`;
    document.getElementById('active-shipment-subtitle').textContent = `Guía: ${shipment.numeroGuia} • Salida: ${shipment.almacenOrigen} (${whAddress}) ➔ ${shipment.direccionEnvio}`;

    updateVehicleSelectorUI();
    renderShipmentOnMap(shipment, false);
    updateTelemetryUI();
    renderShipmentsList();

    if (shipment.simulacionActiva && shipment.estadoEnvio !== 'entregado') {
      startSimulationLoop();
    }
  }

  // Dibujar la ruta y los marcadores en OpenStreetMap
  function renderShipmentOnMap(shipment, preserveZoom = false) {
    if (!map) return;

    if (routePolyline) map.removeLayer(routePolyline);
    if (originMarker) map.removeLayer(originMarker);
    if (destMarker) map.removeLayer(destMarker);
    if (vehicleMarker) map.removeLayer(vehicleMarker);

    const origin = [Number(shipment.latOrigen || 19.4895), Number(shipment.lngOrigen || -99.1645)];
    const destination = [Number(shipment.latDestino || 19.3907), Number(shipment.lngDestino || -99.1636)];
    const rawPoints = Array.isArray(shipment.rutaPuntos) ? shipment.rutaPuntos.map(toLatLngTuple).filter(Boolean) : [];
    const waypoints = rawPoints.length >= 2 ? rawPoints : [origin, destination];
    shipment.rutaPuntos = waypoints;

    const whAddress = shipment.almacenDireccion || 'Av. Ceylán 450, Bodega Logística 4-B, Col. Industrial Vallejo, C.P. 02300, Azcapotzalco, CDMX';

    // Marcador de Almacén Origen con su dirección falsa completa
    originMarker = L.marker(origin, {
      icon: createWarehouseIcon(shipment.almacenOrigen)
    }).addTo(map);
    originMarker.bindPopup(`
      <div class="text-xs space-y-1">
        <strong class="text-express-blue block text-sm font-bold">🏢 ${shipment.almacenOrigen}</strong>
        <div class="font-semibold text-slate-700">${whAddress}</div>
        <div class="text-slate-500">Coordenadas CEDIS: ${origin[0].toFixed(4)}, ${origin[1].toFixed(4)}</div>
      </div>
    `);

    // Marcador de Destino del Cliente
    destMarker = L.marker(destination, {
      icon: createDestinationIcon(shipment.clienteNombre)
    }).addTo(map);
    destMarker.bindPopup(`
      <div class="text-xs space-y-1">
        <strong class="text-rose-600 block text-sm font-bold">📍 Destino del Comprador</strong>
        <div><strong>Cliente:</strong> ${shipment.clienteNombre}</div>
        <div class="text-slate-700"><strong>Dirección:</strong> ${shipment.direccionEnvio}</div>
        <div class="text-slate-500 font-mono">Coordenadas: ${destination[0].toFixed(4)}, ${destination[1].toFixed(4)}</div>
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

    if (!preserveZoom) {
      map.invalidateSize();
      const bounds = L.latLngBounds(waypoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }

    const progress = Number(shipment.progresoSimulacion || 0);
    currentWaypointIndex = Math.min(waypoints.length - 1, Math.max(0, Math.floor((progress / 100) * (waypoints.length - 1))));
    const currentPos = waypoints[currentWaypointIndex] || origin;

    vehicleMarker = L.marker(currentPos, {
      icon: createVehicleIcon(currentVehicleType),
      zIndexOffset: 1000
    }).addTo(map);

    vehicleMarker.bindTooltip(`
      <div class="font-bold text-xs">${currentVehicleType === 'auto' ? '🚗 Auto de Reparto' : '🚚 Camión de Reparto'} ExpressMart</div>
      <div class="text-[11px] text-slate-500">Guía: ${shipment.numeroGuia} (${progress.toFixed(0)}%)</div>
    `, { permanent: false, direction: 'top' });
  }

  // Actualizar Telemetría y Barra de Progreso
  function updateTelemetryUI() {
    if (!activeShipment) return;

    const s = activeShipment;
    const progress = Math.min(100, Math.max(0, Math.round(s.progresoSimulacion || 0)));
    const whAddress = s.almacenDireccion || 'Av. Ceylán 450, Bodega Logística 4-B, Col. Industrial Vallejo, C.P. 02300, Azcapotzalco, CDMX';

    document.getElementById('telemetry-progress-text').textContent = `${progress}%`;
    document.getElementById('telemetry-progress-bar').style.width = `${progress}%`;
    document.getElementById('telemetry-origin').textContent = s.almacenOrigen || 'CEDIS CDMX Norte';
    const origAddrEl = document.getElementById('telemetry-origin-address');
    if (origAddrEl) origAddrEl.textContent = whAddress;

    document.getElementById('telemetry-destination').textContent = s.direccionEnvio || 'Destino del comprador';
    const destCoordsEl = document.getElementById('telemetry-dest-coords');
    if (destCoordsEl) {
      destCoordsEl.textContent = `Coordenadas Destino: ${Number(s.latDestino || 19.3907).toFixed(4)}, ${Number(s.lngDestino || -99.1636).toFixed(4)}`;
    }

    document.getElementById('telemetry-coords').textContent = `${Number(s.latActual || s.latOrigen).toFixed(4)}, ${Number(s.lngActual || s.lngOrigen).toFixed(4)}`;
    document.getElementById('telemetry-vehicle-badge').textContent = currentVehicleType === 'auto' ? '🚗' : '🚚';

    const statusEl = document.getElementById('telemetry-status');
    if (s.estadoEnvio === 'entregado' || progress >= 100) {
      statusEl.textContent = 'Entregado en Destino (100%)';
      statusEl.className = 'font-semibold text-emerald-600';
    } else if (s.simulacionActiva || s.estadoEnvio === 'en_transito') {
      statusEl.textContent = `En Ruta En Vivo (~${45 * simulationSpeed} km/h)`;
      statusEl.className = 'font-semibold text-sky-600 animate-pulse';
    } else {
      statusEl.textContent = 'En Almacén CEDIS (Preparando)';
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
    if (currentWaypointIndex >= waypoints.length - 1) {
      currentWaypointIndex = 0;
    }
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

        if (currentWaypointIndex % 4 === 0 || currentWaypointIndex === waypoints.length - 1) {
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
        stopSimulationLoop();
        activeShipment.progresoSimulacion = 100.0;
        activeShipment.simulacionActiva = false;
        activeShipment.estadoEnvio = 'entregado';
        updateTelemetryUI();

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

  // Vincular eventos de login del panel y controles
  function bindEvents() {
    const loginOverlay = document.getElementById('envios-login-overlay');
    const loginForm = document.getElementById('envios-login-form');
    const loginError = document.getElementById('envios-login-error');
    const userInput = document.getElementById('envios-login-user');
    const passInput = document.getElementById('envios-login-pass');
    const btnTogglePass = document.getElementById('btn-toggle-envios-pass');
    const btnRelock = document.getElementById('btn-relock-panel');

    if (btnTogglePass && passInput) {
      btnTogglePass.addEventListener('click', () => {
        passInput.type = passInput.type === 'password' ? 'text' : 'password';
      });
    }

    document.querySelectorAll('.envios-quick-cred').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (userInput) userInput.value = btn.dataset.u || '';
        if (passInput) passInput.value = btn.dataset.p || '';
        if (loginError) loginError.classList.add('hidden');
      });
    });

    if (btnRelock && loginOverlay) {
      btnRelock.addEventListener('click', () => {
        panelAuthenticated = false;
        panelSessionToken = '';
        stopSimulationLoop();
        if (passInput) passInput.value = '';
        loginOverlay.classList.remove('hidden');
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (loginError) loginError.classList.add('hidden');
        const btnSubmit = document.getElementById('btn-submit-envios-login');
        try {
          if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<span>Verificando acceso...</span>';
          }
          const res = await fetch('/api/logistics/panel-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: userInput ? userInput.value.trim() : '',
              password: passInput ? passInput.value : ''
            })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || 'Usuario o contraseña incorrectos.');
          }

          panelSessionToken = data.token;
          panelAuthenticated = true;
          localStorage.setItem('em_token', data.token);
          localStorage.setItem('em_user', JSON.stringify(data.user));

          const roleTextEl = document.getElementById('user-role-text');
          if (roleTextEl && data.user) {
            roleTextEl.textContent = `${data.user.nombre} (${data.user.rol})`;
          }

          if (loginOverlay) loginOverlay.classList.add('hidden');
          setTimeout(() => {
            if (map) map.invalidateSize();
          }, 150);

          await loadWarehouses();
          await loadShipments();

          if (backendSyncInterval) clearInterval(backendSyncInterval);
          backendSyncInterval = setInterval(() => loadShipments(true), 3000);
        } catch (err) {
          if (loginError) {
            loginError.textContent = err.message;
            loginError.classList.remove('hidden');
          }
        } finally {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<span class="material-symbols-outlined text-[18px]">login</span><span>Ingresar al Panel de Rastreo en Vivo</span>';
          }
        }
      });
    }

    // Refrescar
    document.getElementById('btn-refresh-shipments')?.addEventListener('click', () => loadShipments(false));

    // Filtros
    document.getElementById('select-warehouse-filter')?.addEventListener('change', () => loadShipments(false));
    document.getElementById('select-status-filter')?.addEventListener('change', () => loadShipments(false));

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
        const res = await apiFetch(`/api/logistics/shipments/${activeShipment.pedidoId}/simulation/start`, {
          method: 'POST',
          body: JSON.stringify({ tipoVehiculo: currentVehicleType })
        });
        if (Number(activeShipment.progresoSimulacion) >= 100 || res.progresoSimulacion === 0) {
          currentWaypointIndex = 0;
          activeShipment.progresoSimulacion = 0;
        }
        activeShipment.simulacionActiva = true;
        activeShipment.estadoEnvio = 'en_transito';
        startSimulationLoop();
        updateTelemetryUI();
        renderShipmentsList();
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
        loadShipments(false);
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
        stopSimulationLoop();
        await apiFetch(`/api/logistics/shipments/${activeShipment.pedidoId}/prepare`, { method: 'POST' });
        await loadShipments(false);
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
        await loadShipments(false);
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
        await loadShipments(false);
      } catch (err) {
        alert('Error al marcar entrega: ' + err.message);
      }
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    initMap();
    bindEvents();
    loadWarehouses();
  });
})();
