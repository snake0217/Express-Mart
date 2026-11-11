/**
 * Módulo de Pedidos, Devoluciones y Rastreos Logísticos en Vivo con OpenStreetMap.
 * Simulación de camión/auto, rutas polilínea y georreferenciación CEDIS.
 */
// PEDIDOS, PERFIL, ADMIN Y AUDITORÍA EN MXN
// ============================================================================
async function loadOrders() {
  const box = document.getElementById('orders-list');
  if (!state.token) {
    box.innerHTML =
      '<p class="muted p-4 rounded-xl bg-surface-container-low">Inicie sesión para consultar sus pedidos en MXN, guías DHL/FedEx y gestionar devoluciones.</p>';
    return;
  }
  try {
    const data = await apiFetch('/api/orders');
    if (!data.orders || !data.orders.length) {
      box.innerHTML = `
        <div class="p-8 rounded-2xl bg-surface-container-low text-center border border-dashed border-surface-container">
          <span class="material-symbols-outlined text-[48px] text-secondary mb-2 block">receipt_long</span>
          <p class="font-bold text-on-surface text-base">Aún no tienes pedidos registrados</p>
          <p class="text-xs text-secondary mt-1 mb-4">Explora nuestro catálogo de productos en MXN y realiza tu primera compra con envío ExpressPrime gratis.</p>
          <button type="button" class="btn-nav-catalog px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-bold text-xs transition-colors cursor-pointer">
            Ir al Catálogo de Productos
          </button>
        </div>
      `;
      box.querySelector('.btn-nav-catalog')?.addEventListener('click', () => switchTab('view-catalog'));
      return;
    }

    box.innerHTML = data.orders
      .map((o) => {
        const itemsHtml = (o.items || [])
          .map((item) => {
            const imgUrl = item.imagen_url || '/assets/logo.png';
            const unitPrice = Number(item.precio_unitario || item.precio || 0);
            const subtotal = Number(item.subtotal || unitPrice * item.cantidad);
            return `
            <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-container-lowest border border-surface-container hover:border-primary/40 transition-all">
              <div class="relative w-16 h-16 rounded-lg bg-white p-1 border border-surface-dim shrink-0 overflow-hidden cursor-pointer order-item-view-trigger" data-prod-id="${item.producto_id}" title="Ver ficha técnica">
                <img
                  src="${imgUrl}"
                  alt="${item.nombre_producto}"
                  class="w-full h-full object-contain hover:scale-105 transition-transform"
                  onerror="this.src='/assets/logo.png'"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5">
                  ${item.categoria ? `<span class="px-2 py-0.2 rounded bg-surface-container-high text-on-surface font-label-xs text-[10px] font-bold uppercase">${item.categoria}</span>` : ''}
                  ${item.marca ? `<span class="text-secondary text-xs">${item.marca}</span>` : ''}
                  ${item.sku ? `<span class="text-secondary text-[11px] font-mono">(${item.sku})</span>` : ''}
                </div>
                <h4
                  class="font-headline-sm text-sm text-on-surface font-bold truncate cursor-pointer hover:text-primary transition-colors order-item-view-trigger"
                  data-prod-id="${item.producto_id}"
                  title="Ver ficha técnica"
                >
                  ${item.nombre_producto}
                </h4>
                <div class="flex items-center gap-2 text-xs text-secondary mt-1">
                  <span>Cantidad: <strong class="text-on-surface">${item.cantidad} ${item.cantidad === 1 ? 'unidad' : 'unidades'}</strong></span>
                  <span>·</span>
                  <span>Precio unitario: <strong class="text-on-surface">${formatMxn(unitPrice)}</strong></span>
                </div>
              </div>
              <div class="text-right shrink-0">
                <span class="font-label-xs text-secondary text-[11px] block">Subtotal</span>
                <span class="font-bold text-on-surface text-sm">${formatMxn(subtotal)}</span>
                <button
                  type="button"
                  class="mt-1 px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[11px] font-bold flex items-center gap-1 transition-colors order-item-view-trigger cursor-pointer ml-auto"
                  data-prod-id="${item.producto_id}"
                >
                  <span class="material-symbols-outlined text-[14px]">visibility</span>
                  Ver Producto
                </button>
              </div>
            </div>
          `;
          })
          .join('');

        const estadoColor =
          o.estado === 'entregado'
            ? 'bg-tertiary-fixed text-on-tertiary-fixed font-bold'
            : o.estado === 'devuelto' || o.estado === 'cancelado'
            ? 'bg-error-container text-on-error-container font-bold'
            : 'bg-primary-fixed text-on-primary-fixed font-bold';

        return `
        <div class="p-space-lg rounded-2xl bg-surface-container-low border border-surface-container flex flex-col gap-3 shadow-sm">
          <!-- Encabezado del Pedido -->
          <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-surface-container">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-label-xs text-label-xs uppercase text-secondary font-bold">Folio:</span>
                <strong class="font-headline-sm text-headline-sm text-on-surface">${o.folio}</strong>
                <span class="px-2.5 py-0.5 rounded-full text-xs uppercase ${estadoColor}">
                  ${o.estado.toUpperCase()}
                </span>
              </div>
              <div class="text-xs text-secondary mt-0.5">
                Fecha: ${o.created_at ? o.created_at.split('T')[0] : 'Reciente'} · Compra protegida por garantía oficial ExpressMart
              </div>
            </div>
            <div class="text-right">
              <span class="font-label-xs text-secondary text-xs block">Total Pagado en MXN</span>
              <span class="font-headline-sm text-lg text-primary font-extrabold">${formatMxn(o.total)}</span>
            </div>
          </div>

          <!-- Detalles de los Productos Comprados -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="font-label-sm text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px] text-primary">inventory_2</span>
                Detalles del Producto (${o.items ? o.items.length : 0} ${o.items && o.items.length === 1 ? 'artículo' : 'artículos'}):
              </span>
              <span class="text-xs text-tertiary font-bold flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">verified</span>
                Envío ExpressPrime
              </span>
            </div>
            <div class="space-y-2">
              ${itemsHtml || '<p class="text-xs text-secondary italic">No se encontraron artículos registrados para este pedido.</p>'}
            </div>
          </div>

          <!-- Datos de Envío y Pago -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-surface-container text-xs text-on-surface">
            <div class="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container space-y-1">
              <div class="text-secondary font-bold uppercase text-[10px] flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px] text-primary">local_shipping</span>
                Información de Logística y Envío:
              </div>
              <div><strong>Guía ExpressPrime:</strong> ${o.envio ? `${o.envio.numero_guia} (${o.envio.proveedor_paqueteria} · ${o.envio.estado_envio})` : 'Asignando guía en CEDIS'}</div>
              ${o.envio ? `<div class="text-secondary text-[11px]"><strong>🏢 Almacén Salida:</strong> ${escapeHtml(o.envio.almacen_origen || 'CEDIS Vallejo')} — ${escapeHtml(o.envio.almacen_direccion || 'Av. Ceylán 450, Bodega Logística 4-B, Col. Industrial Vallejo, CDMX')}</div>` : ''}
              <div class="text-secondary truncate"><strong>📍 Dirección Entrega:</strong> ${escapeHtml(o.direccion_envio || '')}</div>
              ${o.envio ? `
                <div class="pt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    class="track-osm-btn px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                    data-order-id="${o.id}"
                    data-folio="${o.folio}"
                  >
                    <span class="material-symbols-outlined text-[14px]">map</span>
                    Rastrear Envío en Vivo (OpenStreetMap)
                  </button>
                  ${o.envio.simulacion_activa ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 animate-pulse">🚚 Simulación en vivo</span>' : ''}
                </div>
              ` : ''}
            </div>
            <div class="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container space-y-1">
              <div class="text-secondary font-bold uppercase text-[10px] flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px] text-primary">credit_card</span>
                Método de Pago Seguro:
              </div>
              <div><strong>Transacción:</strong> ${o.pago ? `${o.pago.tarjeta_enmascarada} (${o.pago.referencia_pasarela})` : o.metodo_pago}</div>
              <div class="text-secondary"><strong>IVA Trasladado:</strong> 16% incluido en el total pagado</div>
            </div>
          </div>

          <!-- Botón de Devolución -->
          <div class="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-surface-container">
            <span class="text-xs text-secondary">
              Garantía de satisfacción de 30 días para devoluciones sin costo.
            </span>
            <div>
              ${
                o.estado === 'devuelto' || o.estado === 'cancelado'
                  ? '<span class="badge badge-ok">Reembolsado en MXN / Devolución completada</span>'
                  : o.solicitudReembolso && o.solicitudReembolso.estado === 'pendiente'
                  ? '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Petición de reembolso en revisión</span>'
                  : o.solicitudReembolso && o.solicitudReembolso.estado === 'aprobada'
                  ? '<span class="badge badge-ok">Reembolso Aprobado en MXN</span>'
                  : o.solicitudReembolso && o.solicitudReembolso.estado === 'denegada'
                  ? `<div class="text-right"><span class="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">Reembolso Denegado</span><div class="text-[11px] text-secondary mt-0.5">${escapeHtml(o.solicitudReembolso.respuesta_admin || '')}</div></div>`
                  : `<button type="button" class="btn btn-sm btn-outline return-order-btn cursor-pointer" data-id="${o.id}" data-folio="${escapeHtml(o.folio)}" data-total="${Number(o.total || 0)}" data-payment="${escapeHtml(o.pago ? o.pago.tarjeta_enmascarada : (o.metodo_pago || 'Método original'))}">Solicitar Devolución y Reembolso en MXN</button>`
              }
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    box.querySelectorAll('.order-item-view-trigger').forEach((el) => {
      el.addEventListener('click', () => {
        const prodId = Number(el.dataset.prodId);
        if (prodId) {
          openProductDetailPage(prodId);
        }
      });
    });

    box.querySelectorAll('.track-osm-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const orderId = Number(btn.dataset.orderId);
        const folio = btn.dataset.folio;
        if (orderId) {
          openCustomerTrackingModal(orderId, folio);
        }
      });
    });

    box.querySelectorAll('.return-order-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const orderId = btn.dataset.id;
        const folio = btn.dataset.folio || `Pedido #${orderId}`;
        const total = Number(btn.dataset.total || 0);
        const payment = btn.dataset.payment || 'Tarjeta / PayPal Original';
        openRefundRequestModal(orderId, folio, total, payment);
      });
    });
  } catch (err) {
    box.innerHTML = `<p class="alert alert-error">${err.message}</p>`;
  }
}

function openRefundRequestModal(orderId, folio, total, payment) {
  const dialog = document.getElementById('refund-request-dialog');
  if (!dialog) return;

  const orderIdInput = document.getElementById('refund-modal-order-id');
  const folioEl = document.getElementById('refund-modal-folio');
  const amountEl = document.getElementById('refund-modal-amount');
  const paymentEl = document.getElementById('refund-modal-payment');
  const reasonEl = document.getElementById('refund-modal-reason');

  if (orderIdInput) orderIdInput.value = String(orderId);
  if (folioEl) folioEl.textContent = folio;
  if (amountEl) amountEl.textContent = formatMxn(total);
  if (paymentEl) paymentEl.textContent = payment;
  if (reasonEl) {
    reasonEl.value = 'El producto no cumplió con mis expectativas y solicito devolución bajo garantía de satisfacción de 30 días.';
  }

  if (!dialog.open) {
    dialog.showModal();
  }
  setTimeout(() => {
    if (reasonEl) {
      reasonEl.focus();
      reasonEl.select();
    }
  }, 80);
}

// ============================================================================
// RASTREO Y SIMULACIÓN EN VIVO OPENSTREETMAP (CLIENTE)
// ============================================================================
let customerMapInstance = null;
let customerVehicleMarker = null;
let customerRoutePolyline = null;
let customerOriginMarker = null;
let customerDestMarker = null;
let customerTrackingInterval = null;
let currentCustomerTrackedOrderId = null;

function closeCustomerTrackingModal() {
  if (customerTrackingInterval) {
    clearInterval(customerTrackingInterval);
    customerTrackingInterval = null;
  }
  currentCustomerTrackedOrderId = null;
  const dialog = document.getElementById('modal-rastreo-envio');
  if (dialog) {
    try {
      if (dialog.open) dialog.close();
    } catch (_) {}
    dialog.removeAttribute('open');
  }
  if (typeof loadOrders === 'function') {
    loadOrders();
  }
}

function initCustomerTrackingModal() {
  const dialog = document.getElementById('modal-rastreo-envio');
  const btnClose = document.getElementById('btn-close-rastreo-modal');
  const btnAccept = document.getElementById('btn-accept-rastreo-modal');

  if (btnClose) btnClose.onclick = closeCustomerTrackingModal;
  if (btnAccept) btnAccept.onclick = closeCustomerTrackingModal;
  if (dialog) {
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeCustomerTrackingModal();
    });
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        closeCustomerTrackingModal();
      }
    });
  }
}

async function openCustomerTrackingModal(orderId, fallbackFolio) {
  const dialog = document.getElementById('modal-rastreo-envio');
  if (!dialog) return;

  if (customerTrackingInterval) {
    clearInterval(customerTrackingInterval);
    customerTrackingInterval = null;
  }

  currentCustomerTrackedOrderId = orderId;
  const btnClose = document.getElementById('btn-close-rastreo-modal');
  const btnAccept = document.getElementById('btn-accept-rastreo-modal');
  if (btnClose) btnClose.onclick = closeCustomerTrackingModal;
  if (btnAccept) btnAccept.onclick = closeCustomerTrackingModal;

  if (!dialog.open) {
    dialog.showModal();
  }

  const mapContainer = document.getElementById('customer-osm-map');
  const folioEl = document.getElementById('cust-track-folio');
  const guiaEl = document.getElementById('cust-track-guia');
  const almacenEl = document.getElementById('cust-track-almacen');
  const almacenDirEl = document.getElementById('cust-track-almacen-dir');
  const vehiculoEl = document.getElementById('cust-track-vehiculo');
  const progresoEl = document.getElementById('cust-track-progreso-txt');
  const progressBar = document.getElementById('cust-track-progress-bar');
  const simStatusEl = document.getElementById('cust-track-sim-status');
  const destinoEl = document.getElementById('cust-track-destino');
  const coordsLiveEl = document.getElementById('cust-track-coords-live');
  const liveBadge = document.getElementById('cust-track-live-badge');

  if (folioEl) folioEl.textContent = fallbackFolio || `#${orderId}`;

  // Inicializar Leaflet si aún no está instanciado
  if (typeof L !== 'undefined' && !customerMapInstance && mapContainer) {
    customerMapInstance = L.map('customer-osm-map', {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([19.4326, -99.1332], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(customerMapInstance);

    // Permitir al comprador hacer clic en el mapa para actualizar las coordenadas y calcular el nombre de la calle
    customerMapInstance.on('click', async (ev) => {
      if (!currentCustomerTrackedOrderId) return;
      const clickedLat = Number(ev.latlng.lat.toFixed(5));
      const clickedLng = Number(ev.latlng.lng.toFixed(5));
      let streetAddress = destinoEl ? destinoEl.textContent.replace(/\s*\[Lat:.*?\]/g, '').trim() : 'Domicilio seleccionado en mapa';
      if (typeof resolveStreetNameFromMapClick === 'function') {
        const geo = await resolveStreetNameFromMapClick(clickedLat, clickedLng);
        if (geo && geo.direccionCompleta) {
          streetAddress = geo.direccionCompleta;
        }
      }
      const newAddressWithCoords = `${streetAddress} [Lat: ${clickedLat}, Lng: ${clickedLng}]`;
      try {
        await apiFetch(`/api/logistics/shipments/${currentCustomerTrackedOrderId}/destination`, {
          method: 'PUT',
          body: JSON.stringify({
            direccion: newAddressWithCoords,
            latDestino: clickedLat,
            lngDestino: clickedLng
          })
        });
        showToast({
          title: '📍 Destino y calle actualizados en el mapa',
          message: `${streetAddress} (${clickedLat}, ${clickedLng})`,
          imageUrl: '/assets/logo.png'
        });
        initialFitDone = false;
        await fetchStatus();
      } catch (err) {
        console.warn('No se pudo actualizar el punto de entrega:', err.message);
      }
    });
  }

  let initialFitDone = false;

  setTimeout(() => {
    if (customerMapInstance) customerMapInstance.invalidateSize();
  }, 200);

  const normalizeLatLng = (p) => {
    if (Array.isArray(p) && p.length >= 2) {
      return [Number(p[0]), Number(p[1])];
    }
    if (p && typeof p === 'object' && p.lat !== undefined && p.lng !== undefined) {
      return [Number(p.lat), Number(p.lng)];
    }
    return null;
  };

  const renderData = (shipment) => {
    if (!shipment) return;
    if (folioEl) folioEl.textContent = shipment.folio_pedido || shipment.pedidoFolio || fallbackFolio || `#${orderId}`;
    if (guiaEl) guiaEl.textContent = shipment.numero_guia || shipment.numeroGuia || 'Pendiente';
    const warehouseName = shipment.almacen_origen || shipment.almacenOrigen || shipment.almacen_codigo || 'CEDIS CDMX Norte (Vallejo)';
    const warehouseAddr = shipment.almacen_direccion || shipment.almacenDireccion || 'Av. Ceylán 450, Bodega Logística 4-B, Col. Industrial Vallejo, C.P. 02300, Azcapotzalco, CDMX';
    if (almacenEl) almacenEl.textContent = warehouseName;
    if (almacenDirEl) almacenDirEl.textContent = `${warehouseName} — ${warehouseAddr}`;

    const destLat = Number(shipment.lat_destino ?? shipment.latDestino ?? 19.3907);
    const destLng = Number(shipment.lng_destino ?? shipment.lngDestino ?? -99.1636);
    const destText = shipment.direccion_destino || shipment.direccionEnvio || 'Domicilio del comprador';
    if (destinoEl) {
      destinoEl.textContent = destText.includes('Lat:')
        ? destText
        : `${destText} (${destLat.toFixed(4)}, ${destLng.toFixed(4)})`;
    }

    const progress = Math.min(100, Math.max(0, Number(shipment.progreso_simulacion ?? shipment.progresoSimulacion ?? 0)));
    if (progresoEl) progresoEl.textContent = `${progress.toFixed(1)}%`;
    if (progressBar) progressBar.style.width = `${progress}%`;

    const isTruck = (shipment.tipo_vehiculo || shipment.tipoVehiculo) !== 'auto';
    const vehicleIconChar = isTruck ? '🚚' : '🚗';
    const vehicleLabel = isTruck ? 'Camión ExpressPrime' : 'Auto Utilitario Express';
    if (vehiculoEl) vehiculoEl.innerHTML = `<span class="text-base">${vehicleIconChar}</span> <span>${vehicleLabel}</span>`;

    const isSimActive = Boolean(shipment.simulacion_activa || shipment.simulacionActiva);
    const estadoEnvio = shipment.estado_envio || shipment.estadoEnvio || 'preparando';

    if (isSimActive) {
      if (simStatusEl) {
        simStatusEl.textContent = 'En Ruta (Simulación Activa)';
        simStatusEl.className = 'font-bold text-emerald-600 block mt-0.5 animate-pulse';
      }
      if (liveBadge) {
        liveBadge.textContent = 'Simulación en Vivo';
        liveBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 animate-pulse';
      }
    } else {
      if (simStatusEl) {
        simStatusEl.textContent = estadoEnvio === 'entregado'
          ? 'Entregado en Destino'
          : estadoEnvio === 'preparando'
          ? 'Preparando en Almacén'
          : 'Pausada / En Espera';
        simStatusEl.className = 'font-bold text-secondary block mt-0.5';
      }
      if (liveBadge) {
        liveBadge.textContent = estadoEnvio.replace('_', ' ').toUpperCase();
        liveBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-surface-container-high text-on-surface';
      }
    }

    if (typeof L === 'undefined' || !customerMapInstance) return;

    // Limpiar marcadores y polilíneas anteriores
    if (customerRoutePolyline) {
      customerMapInstance.removeLayer(customerRoutePolyline);
      customerRoutePolyline = null;
    }
    if (customerOriginMarker) {
      customerMapInstance.removeLayer(customerOriginMarker);
      customerOriginMarker = null;
    }
    if (customerDestMarker) {
      customerMapInstance.removeLayer(customerDestMarker);
      customerDestMarker = null;
    }
    if (customerVehicleMarker) {
      customerMapInstance.removeLayer(customerVehicleMarker);
      customerVehicleMarker = null;
    }

    const origLat = Number(shipment.lat_origen ?? shipment.latOrigen ?? 19.4895);
    const origLng = Number(shipment.lng_origen ?? shipment.lngOrigen ?? -99.1645);
    const rawRoute = shipment.ruta_puntos || shipment.rutaPuntos || [];
    let latLngs = rawRoute
      .map(normalizeLatLng)
      .filter((pt) => pt && Number.isFinite(pt[0]) && Number.isFinite(pt[1]));

    if (latLngs.length < 2) {
      latLngs = [
        [origLat, origLng],
        [(origLat + destLat) / 2 + 0.008, (origLng + destLng) / 2 - 0.006],
        [destLat, destLng]
      ];
    }

    customerRoutePolyline = L.polyline(latLngs, {
      color: '#0284c7',
      weight: 5,
      opacity: 0.85,
      dashArray: isSimActive ? '10, 8' : null
    }).addTo(customerMapInstance);

    // Marcador CEDIS Origen con dirección falsa completa
    const originCoord = latLngs[0];
    const originIcon = L.divIcon({
      className: 'cedis-map-marker',
      html: `<div style="background:#1d4e9a; color:#fff; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; font-size:16px; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.35);">🏢</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    customerOriginMarker = L.marker(originCoord, { icon: originIcon })
      .bindPopup(`<strong>🏢 ${escapeHtml(warehouseName)}</strong><br><span style="font-size:11px;">${escapeHtml(warehouseAddr)}</span><br><small>Coordenadas: ${originCoord[0].toFixed(4)}, ${originCoord[1].toFixed(4)}</small>`)
      .addTo(customerMapInstance);

    // Marcador Destino del Comprador
    const destCoord = latLngs[latLngs.length - 1];
    const destIcon = L.divIcon({
      className: 'dest-map-marker',
      html: `<div style="background:#059669; color:#fff; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; font-size:16px; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.35);">📍</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    customerDestMarker = L.marker(destCoord, { icon: destIcon })
      .bindPopup(`<strong>📍 Domicilio de Entrega</strong><br><span style="font-size:11px;">${escapeHtml(destText)}</span><br><small>Coordenadas: ${destCoord[0].toFixed(4)}, ${destCoord[1].toFixed(4)}</small>`)
      .addTo(customerMapInstance);

    // Calcular posición actual del vehículo a partir de progreso o lat_actual/lng_actual
    const pointIdx = Math.min(latLngs.length - 1, Math.max(0, Math.floor((progress / 100) * (latLngs.length - 1))));
    const fallbackPt = latLngs[pointIdx] || originCoord;
    const currentLat = Number.isFinite(Number(shipment.lat_actual)) && progress > 0 ? Number(shipment.lat_actual) : fallbackPt[0];
    const currentLng = Number.isFinite(Number(shipment.lng_actual)) && progress > 0 ? Number(shipment.lng_actual) : fallbackPt[1];

    if (coordsLiveEl) {
      coordsLiveEl.textContent = `${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`;
    }

    const vehicleHtml = `
      <div class="simulation-truck-marker" style="display:flex; align-items:center; justify-content:center; position:relative;">
        ${isSimActive ? '<div class="radar-pulse-ring" style="position:absolute; width:46px; height:46px; border-radius:50%; background:rgba(16,185,129,0.35); animation:pulse 1.5s infinite;"></div>' : ''}
        <div style="background:${isSimActive ? '#059669' : '#0284c7'}; color:#fff; border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; font-size:20px; border:2px solid #fff; box-shadow:0 3px 10px rgba(0,0,0,0.45); z-index:2;">
          ${vehicleIconChar}
        </div>
      </div>
    `;
    const vehicleDivIcon = L.divIcon({
      className: 'vehicle-marker-wrapper',
      html: vehicleHtml,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });
    customerVehicleMarker = L.marker([currentLat, currentLng], { icon: vehicleDivIcon })
      .bindPopup(`<strong>${vehicleIconChar} ${vehicleLabel}</strong><br>Avance: <strong>${progress.toFixed(1)}%</strong><br>Estado: ${escapeHtml(estadoEnvio)}<br><small>Ubicación: ${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}</small>`)
      .addTo(customerMapInstance);

    if (!initialFitDone) {
      customerMapInstance.invalidateSize();
      customerMapInstance.fitBounds(L.latLngBounds(latLngs), { padding: [45, 45], maxZoom: 15 });
      initialFitDone = true;
    }
  };

  const fetchStatus = async () => {
    if (!dialog.open) {
      closeCustomerTrackingModal();
      return;
    }
    try {
      const data = await apiFetch(`/api/logistics/shipments/${orderId}`);
      if (data && data.shipment) {
        renderData(data.shipment);
      }
    } catch (err) {
      console.warn('Error al consultar rastreo de envío:', err.message);
    }
  };

  await fetchStatus();

  // Actualización periódica cada 2 segundos para reflejar avances o cambios de estado del admin en vivo
  customerTrackingInterval = setInterval(fetchStatus, 2000);
}

function initOrdersLogisticsEvents() {
  const btnRefresh = document.getElementById('btn-refresh-orders');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadOrders);
  }

  const refundDialog = document.getElementById('refund-request-dialog');
  const closeRefundModal = () => {
    if (refundDialog && refundDialog.open) {
      refundDialog.close();
    }
  };

  document.getElementById('btn-close-refund-modal')?.addEventListener('click', closeRefundModal);
  document.getElementById('btn-cancel-refund-modal')?.addEventListener('click', closeRefundModal);

  document.querySelectorAll('.refund-reason-preset').forEach((chip) => {
    chip.addEventListener('click', () => {
      const reasonEl = document.getElementById('refund-modal-reason');
      if (reasonEl && chip.dataset.reason) {
        reasonEl.value = chip.dataset.reason;
        reasonEl.focus();
      }
    });
  });

  const refundForm = document.getElementById('refund-request-form');
  if (refundForm) {
    refundForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const orderId = document.getElementById('refund-modal-order-id')?.value;
      const reasonEl = document.getElementById('refund-modal-reason');
      const submitBtn = document.getElementById('btn-submit-refund-modal');
      const motivo = reasonEl ? reasonEl.value.trim() : '';

      if (!orderId) return;
      if (!motivo || motivo.length < 5) {
        showAlert('Por favor escribe el motivo de tu devolución (mínimo 5 caracteres).', true);
        return;
      }

      try {
        if (submitBtn) submitBtn.disabled = true;
        const res = await apiFetch(`/api/orders/${orderId}/refund-request`, {
          method: 'POST',
          body: JSON.stringify({ motivo })
        });
        closeRefundModal();
        showAlert(res.message || 'Petición de reembolso enviada al administrador.');
        showToast({
          title: 'Solicitud de reembolso enviada',
          message: 'Tu solicitud fue recibida con éxito y está en revisión administrativa.',
          imageUrl: '/assets/logo.png'
        });
        loadOrders();
      } catch (err) {
        showAlert(err.message, true);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
}

window.loadOrders = loadOrders;
window.openRefundRequestModal = openRefundRequestModal;
window.closeCustomerTrackingModal = closeCustomerTrackingModal;
window.initCustomerTrackingModal = initCustomerTrackingModal;
window.openCustomerTrackingModal = openCustomerTrackingModal;
window.initOrdersLogisticsEvents = initOrdersLogisticsEvents;
