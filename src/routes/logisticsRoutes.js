/**
 * Rutas de Logística, Almacenes CEDIS y Simulación de Envíos OpenStreetMap
 * RF-07, DEV-09
 */

const path = require('node:path');
const { getDb, recordAuditLog } = require('../db/database');
const { decryptData } = require('../utils/crypto');
const { authenticateRequest, requireRoles } = require('../middleware/security');
const { sendUserNotification } = require('../services/externalProviders');
const { WAREHOUSES } = require('../services/logisticsService');

function registerLogisticsRoutes(app) {
  // Vista HTML para el módulo de Envíos y Logística
  app.get(['/envios', '/logistica'], (_req, res) => {
    res.sendFile(path.join(__dirname, '../../public/envios.html'));
  });

  // Listar Almacenes (CEDIS) con métricas de inventario y pedidos
  app.get('/api/logistics/warehouses', (req, res) => {
    const db = getDb();
    let rows = [];
    try {
      rows = db.prepare('SELECT * FROM almacenes WHERE activo = 1 ORDER BY id ASC').all();
    } catch (_) {
      rows = WAREHOUSES.map((w, idx) => ({ id: idx + 1, ...w, activo: 1 }));
    }

    const enriched = rows.map((wh) => {
      let stats = { totalPedidos: 0, preparando: 0, enTransito: 0, entregados: 0 };
      try {
        const counts = db.prepare(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN estado_envio = 'preparando' THEN 1 ELSE 0 END) as preparando,
            SUM(CASE WHEN estado_envio = 'en_transito' THEN 1 ELSE 0 END) as enTransito,
            SUM(CASE WHEN estado_envio = 'entregado' THEN 1 ELSE 0 END) as entregados
          FROM envios
          WHERE almacen_codigo = ? OR almacen_origen LIKE '%' || ? || '%'
        `).get(wh.codigo, wh.codigo);
        if (counts) {
          stats = {
            totalPedidos: Number(counts.total || 0),
            preparando: Number(counts.preparando || 0),
            enTransito: Number(counts.enTransito || 0),
            entregados: Number(counts.entregados || 0)
          };
        }
      } catch (_) {}
      return {
        ...wh,
        stats
      };
    });

    res.json({ total: enriched.length, warehouses: enriched });
  });

  // Listar envíos para el Panel de Envíos y Almacenes (Admin/Vendedor/Soporte/Auditor)
  app.get('/api/logistics/shipments', authenticateRequest, requireRoles('administrador', 'vendedor', 'soporte', 'auditor'), (req, res) => {
    const { almacen, estado } = req.query || {};
    const db = getDb();

    let sql = `
      SELECT 
        e.*,
        p.folio as pedido_folio, p.total as pedido_total, p.estado as pedido_estado,
        p.metodo_pago, p.direccion_envio_cifrada, p.created_at as pedido_fecha,
        u.nombre as cliente_nombre, u.email as cliente_email, u.telefono_cifrado as cliente_telefono_cifrado
      FROM envios e
      JOIN pedidos p ON p.id = e.pedido_id
      JOIN usuarios u ON u.id = p.usuario_id
      WHERE 1=1
    `;
    const params = [];
    if (almacen && String(almacen).trim()) {
      sql += ' AND (e.almacen_codigo = ? OR e.almacen_origen LIKE ?)';
      params.push(almacen.trim(), `%${almacen.trim()}%`);
    }
    if (estado && String(estado).trim()) {
      sql += ' AND e.estado_envio = ?';
      params.push(estado.trim());
    }
    sql += ' ORDER BY e.id DESC';

    const rows = db.prepare(sql).all(...params).map((r) => {
      let direccion = 'Dirección no disponible';
      try {
        direccion = decryptData(r.direccion_envio_cifrada);
      } catch (_) {}

      let items = [];
      try {
        items = db.prepare('SELECT producto_id, nombre_producto, cantidad, precio_unitario, subtotal FROM pedido_items WHERE pedido_id = ?').all(r.pedido_id);
      } catch (_) {}

      return {
        id: r.id,
        pedidoId: r.pedido_id,
        pedido_id: r.pedido_id,
        pedidoFolio: r.pedido_folio,
        folio_pedido: r.pedido_folio,
        pedidoTotal: r.pedido_total,
        pedidoEstado: r.pedido_estado,
        pedidoFecha: r.pedido_fecha,
        clienteNombre: r.cliente_nombre,
        clienteEmail: r.cliente_email,
        direccionEnvio: direccion,
        direccion_destino: direccion,
        items,
        numeroGuia: r.numero_guia,
        numero_guia: r.numero_guia,
        proveedorPaqueteria: r.proveedor_paqueteria,
        proveedor_paqueteria: r.proveedor_paqueteria,
        estadoEnvio: r.estado_envio,
        estado_envio: r.estado_envio,
        almacenOrigen: r.almacen_origen,
        almacen_origen: r.almacen_origen,
        almacenCodigo: r.almacen_codigo,
        almacen_codigo: r.almacen_codigo,
        latOrigen: r.lat_origen,
        lat_origen: r.lat_origen,
        lngOrigen: r.lng_origen,
        lng_origen: r.lng_origen,
        latDestino: r.lat_destino,
        lat_destino: r.lat_destino,
        lngDestino: r.lng_destino,
        lng_destino: r.lng_destino,
        latActual: r.lat_actual,
        lat_actual: r.lat_actual,
        lngActual: r.lng_actual,
        lng_actual: r.lng_actual,
        progresoSimulacion: r.progreso_simulacion,
        progreso_simulacion: r.progreso_simulacion,
        simulacionActiva: Boolean(r.simulacion_activa),
        simulacion_activa: r.simulacion_activa,
        tipoVehiculo: r.tipo_vehiculo || 'camion',
        tipo_vehiculo: r.tipo_vehiculo || 'camion',
        rutaPuntos: JSON.parse(r.ruta_puntos_json || '[]'),
        ruta_puntos: JSON.parse(r.ruta_puntos_json || '[]'),
        historial: JSON.parse(r.historial_rastreo_json || '[]'),
        fechaEstimada: r.fecha_estimada,
        updatedAt: r.updated_at
      };
    });

    res.json({ total: rows.length, shipments: rows });
  });

  // Detalle y Rastreo en Vivo OpenStreetMap para un pedido (Cliente o Admin)
  app.get('/api/logistics/shipments/:pedidoId', authenticateRequest, (req, res) => {
    const pedidoId = Number(req.params.pedidoId);
    const db = getDb();

    const order = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    if (order.usuario_id !== req.user.id && !['administrador', 'vendedor', 'soporte', 'auditor'].includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para rastrear este envío.' });
    }

    const shipment = db.prepare('SELECT * FROM envios WHERE pedido_id = ?').get(pedidoId);
    if (!shipment) {
      return res.status(404).json({ error: 'No se encontró guía de envío para este pedido.' });
    }

    let direccion = 'Dirección no disponible';
    try {
      direccion = decryptData(order.direccion_envio_cifrada);
    } catch (_) {}

    const items = db.prepare('SELECT producto_id, nombre_producto, cantidad, precio_unitario, subtotal FROM pedido_items WHERE pedido_id = ?').all(pedidoId);

    res.json({
      shipment: {
        id: shipment.id,
        pedidoId,
        pedido_id: pedidoId,
        pedidoFolio: order.folio,
        folio_pedido: order.folio,
        pedidoTotal: order.total,
        pedidoEstado: order.estado,
        direccionEnvio: direccion,
        direccion_destino: direccion,
        items,
        numeroGuia: shipment.numero_guia,
        numero_guia: shipment.numero_guia,
        proveedorPaqueteria: shipment.proveedor_paqueteria,
        proveedor_paqueteria: shipment.proveedor_paqueteria,
        estadoEnvio: shipment.estado_envio,
        estado_envio: shipment.estado_envio,
        almacenOrigen: shipment.almacen_origen,
        almacen_origen: shipment.almacen_origen,
        almacenCodigo: shipment.almacen_codigo,
        almacen_codigo: shipment.almacen_codigo,
        latOrigen: shipment.lat_origen,
        lat_origen: shipment.lat_origen,
        lngOrigen: shipment.lng_origen,
        lng_origen: shipment.lng_origen,
        latDestino: shipment.lat_destino,
        lat_destino: shipment.lat_destino,
        lngDestino: shipment.lng_destino,
        lng_destino: shipment.lng_destino,
        latActual: shipment.lat_actual,
        lat_actual: shipment.lat_actual,
        lngActual: shipment.lng_actual,
        lng_actual: shipment.lng_actual,
        progresoSimulacion: shipment.progreso_simulacion,
        progreso_simulacion: shipment.progreso_simulacion,
        simulacionActiva: Boolean(shipment.simulacion_activa),
        simulacion_activa: shipment.simulacion_activa,
        tipoVehiculo: shipment.tipo_vehiculo || 'camion',
        tipo_vehiculo: shipment.tipo_vehiculo || 'camion',
        rutaPuntos: JSON.parse(shipment.ruta_puntos_json || '[]'),
        ruta_puntos: JSON.parse(shipment.ruta_puntos_json || '[]'),
        historial: JSON.parse(shipment.historial_rastreo_json || '[]'),
        fechaEstimada: shipment.fecha_estimada,
        updatedAt: shipment.updated_at
      }
    });
  });

  // Preparar envío en Almacén (Admin/Vendedor/Soporte)
  app.post('/api/logistics/shipments/:pedidoId/prepare', authenticateRequest, requireRoles('administrador', 'vendedor', 'soporte'), (req, res) => {
    const pedidoId = Number(req.params.pedidoId);
    const db = getDb();
    const shipment = db.prepare('SELECT * FROM envios WHERE pedido_id = ?').get(pedidoId);
    if (!shipment) return res.status(404).json({ error: 'Envío no encontrado.' });

    const order = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    const now = new Date().toISOString();
    const historial = JSON.parse(shipment.historial_rastreo_json || '[]');
    historial.push({
      fecha: now,
      estado: 'preparando',
      ubicacion: shipment.almacen_origen,
      detalle: 'Pedido recolectado, embalado y ubicado en muelle de carga del almacén.'
    });

    db.prepare(`
      UPDATE envios 
      SET estado_envio = 'preparando', progreso_simulacion = 0.0, simulacion_activa = 0,
          lat_actual = lat_origen, lng_actual = lng_origen,
          historial_rastreo_json = ?, updated_at = ?
      WHERE pedido_id = ?
    `).run(JSON.stringify(historial), now, pedidoId);

    db.prepare("UPDATE pedidos SET estado = 'procesando', updated_at = ? WHERE id = ?").run(now, pedidoId);

    sendUserNotification(db, {
      usuarioId: order.usuario_id,
      pedidoId,
      evento: 'ENVIO_PREPARANDO',
      asunto: `Tu pedido ${order.folio} se está preparando en almacén`,
      mensaje: `El almacén ${shipment.almacen_origen} ha comenzado la preparación y empaque de tu envío.`
    });

    recordAuditLog(db, {
      usuarioId: req.user.id,
      rol: req.user.rol,
      accion: 'LOGISTICA_PREPARAR_ENVIO',
      modulo: 'Logística y Almacenes (RF-07 / DEV-09)',
      entidadId: shipment.numero_guia,
      detalles: { pedidoId, almacen: shipment.almacen_origen }
    });

    res.json({
      message: `Envío ${shipment.numero_guia} marcado como en preparación en ${shipment.almacen_origen}.`,
      estadoEnvio: 'preparando',
      estado_envio: 'preparando',
      progresoSimulacion: 0.0,
      simulacionActiva: false,
      simulacion_activa: 0,
      shipment: {
        pedido_id: pedidoId,
        pedidoId,
        estado_envio: 'preparando',
        estadoEnvio: 'preparando',
        simulacion_activa: 0,
        simulacionActiva: false,
        progreso_simulacion: 0,
        progresoSimulacion: 0
      }
    });
  });

  // Poner Envío en Progreso / En Tránsito (Admin/Vendedor/Soporte)
  app.post('/api/logistics/shipments/:pedidoId/dispatch', authenticateRequest, requireRoles('administrador', 'vendedor', 'soporte'), (req, res) => {
    const pedidoId = Number(req.params.pedidoId);
    const { tipoVehiculo = 'camion' } = req.body || {};
    const db = getDb();
    const shipment = db.prepare('SELECT * FROM envios WHERE pedido_id = ?').get(pedidoId);
    if (!shipment) return res.status(404).json({ error: 'Envío no encontrado.' });

    const order = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    const now = new Date().toISOString();
    const historial = JSON.parse(shipment.historial_rastreo_json || '[]');
    historial.push({
      fecha: now,
      estado: 'en_transito',
      ubicacion: 'En ruta desde ' + shipment.almacen_origen,
      detalle: `El vehículo de reparto (${tipoVehiculo === 'auto' ? 'Auto Express' : 'Camión de Carga'}) ha partido del almacén hacia el destino.`
    });

    db.prepare(`
      UPDATE envios 
      SET estado_envio = 'en_transito', simulacion_activa = 1, tipo_vehiculo = ?,
          historial_rastreo_json = ?, updated_at = ?
      WHERE pedido_id = ?
    `).run(tipoVehiculo, JSON.stringify(historial), now, pedidoId);

    db.prepare("UPDATE pedidos SET estado = 'enviado', updated_at = ? WHERE id = ?").run(now, pedidoId);

    sendUserNotification(db, {
      usuarioId: order.usuario_id,
      pedidoId,
      evento: 'ENVIO_EN_TRANSITO',
      asunto: `¡Tu pedido ${order.folio} va en camino!`,
      mensaje: `Tu envío ha salido de ${shipment.almacen_origen} con guía ${shipment.numero_guia}. Puedes ver el rastreo en vivo sobre el mapa OpenStreetMap.`
    });

    recordAuditLog(db, {
      usuarioId: req.user.id,
      rol: req.user.rol,
      accion: 'LOGISTICA_DESPACHO_EN_TRANSITO',
      modulo: 'Logística y Almacenes (RF-07 / DEV-09)',
      entidadId: shipment.numero_guia,
      detalles: { pedidoId, tipoVehiculo }
    });

    res.json({
      message: `Envío ${shipment.numero_guia} despachado. Simulación iniciada en OpenStreetMap.`,
      estadoEnvio: 'en_transito',
      estado_envio: 'en_transito',
      simulacionActiva: true,
      simulacion_activa: 1,
      tipoVehiculo,
      tipo_vehiculo: tipoVehiculo,
      shipment: {
        pedido_id: pedidoId,
        pedidoId,
        estado_envio: 'en_transito',
        estadoEnvio: 'en_transito',
        simulacion_activa: 1,
        simulacionActiva: true,
        tipo_vehiculo: tipoVehiculo,
        tipoVehiculo
      }
    });
  });

  // Iniciar Simulación en el Mapa OpenStreetMap (Admin/Vendedor)
  app.post('/api/logistics/shipments/:pedidoId/simulation/start', authenticateRequest, requireRoles('administrador', 'vendedor', 'soporte'), (req, res) => {
    const pedidoId = Number(req.params.pedidoId);
    const { tipoVehiculo } = req.body || {};
    const db = getDb();
    const shipment = db.prepare('SELECT * FROM envios WHERE pedido_id = ?').get(pedidoId);
    if (!shipment) return res.status(404).json({ error: 'Envío no encontrado.' });

    const now = new Date().toISOString();
    const updateVehiculo = ['camion', 'auto'].includes(tipoVehiculo) ? tipoVehiculo : shipment.tipo_vehiculo;

    let nuevoEstado = shipment.estado_envio;
    if (shipment.estado_envio === 'preparando' || shipment.estado_envio === 'entregado') {
      nuevoEstado = 'en_transito';
      db.prepare("UPDATE pedidos SET estado = 'enviado', updated_at = ? WHERE id = ?").run(now, pedidoId);
    }

    db.prepare(`
      UPDATE envios
      SET simulacion_activa = 1, estado_envio = ?, tipo_vehiculo = ?, updated_at = ?
      WHERE pedido_id = ?
    `).run(nuevoEstado, updateVehiculo, now, pedidoId);

    res.json({
      success: true,
      message: 'Simulación de envío iniciada en OpenStreetMap.',
      simulacionActiva: true,
      simulacion_activa: 1,
      estadoEnvio: nuevoEstado,
      estado_envio: nuevoEstado,
      tipoVehiculo: updateVehiculo,
      tipo_vehiculo: updateVehiculo,
      shipment: {
        pedido_id: pedidoId,
        pedidoId,
        estado_envio: nuevoEstado,
        estadoEnvio: nuevoEstado,
        simulacion_activa: 1,
        simulacionActiva: true,
        tipo_vehiculo: updateVehiculo,
        tipoVehiculo: updateVehiculo
      }
    });
  });

  // Parar Simulación en el Mapa OpenStreetMap (Admin/Vendedor)
  app.post('/api/logistics/shipments/:pedidoId/simulation/stop', authenticateRequest, requireRoles('administrador', 'vendedor', 'soporte'), (req, res) => {
    const pedidoId = Number(req.params.pedidoId);
    const db = getDb();
    const shipment = db.prepare('SELECT * FROM envios WHERE pedido_id = ?').get(pedidoId);
    if (!shipment) return res.status(404).json({ error: 'Envío no encontrado.' });

    const now = new Date().toISOString();
    db.prepare('UPDATE envios SET simulacion_activa = 0, updated_at = ? WHERE pedido_id = ?').run(now, pedidoId);

    res.json({
      success: true,
      message: 'Simulación de envío pausada en OpenStreetMap.',
      simulacionActiva: false,
      simulacion_activa: 0,
      shipment: {
        pedido_id: pedidoId,
        pedidoId,
        simulacion_activa: 0,
        simulacionActiva: false
      }
    });
  });

  // Reiniciar Simulación de Ruta (Admin/Vendedor)
  app.post('/api/logistics/shipments/:pedidoId/simulation/reset', authenticateRequest, requireRoles('administrador', 'vendedor', 'soporte'), (req, res) => {
    const pedidoId = Number(req.params.pedidoId);
    const db = getDb();
    const shipment = db.prepare('SELECT * FROM envios WHERE pedido_id = ?').get(pedidoId);
    if (!shipment) return res.status(404).json({ error: 'Envío no encontrado.' });

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE envios 
      SET progreso_simulacion = 0.0, simulacion_activa = 0,
          lat_actual = lat_origen, lng_actual = lng_origen,
          estado_envio = 'preparando', updated_at = ?
      WHERE pedido_id = ?
    `).run(now, pedidoId);

    db.prepare("UPDATE pedidos SET estado = 'procesando', updated_at = ? WHERE id = ?").run(now, pedidoId);

    res.json({
      success: true,
      message: 'Simulación de ruta reiniciada en el almacén de origen.',
      progresoSimulacion: 0.0,
      progreso_simulacion: 0.0,
      simulacionActiva: false,
      simulacion_activa: 0,
      estadoEnvio: 'preparando',
      estado_envio: 'preparando',
      shipment: {
        pedido_id: pedidoId,
        pedidoId,
        progreso_simulacion: 0.0,
        simulacion_activa: 0,
        estado_envio: 'preparando'
      }
    });
  });

  // Sincronizar Progreso de Simulación (Coordenadas en Tiempo Real)
  app.post('/api/logistics/shipments/:pedidoId/simulation/progress', authenticateRequest, (req, res) => {
    const pedidoId = Number(req.params.pedidoId);
    const { progreso, lat, lng } = req.body || {};
    const db = getDb();
    const shipment = db.prepare('SELECT * FROM envios WHERE pedido_id = ?').get(pedidoId);
    if (!shipment) return res.status(404).json({ error: 'Envío no encontrado.' });

    const now = new Date().toISOString();
    const cleanProgress = Math.min(100.0, Math.max(0.0, Number(progreso || 0)));
    const cleanLat = lat ? Number(lat) : shipment.lat_actual;
    const cleanLng = lng ? Number(lng) : shipment.lng_actual;

    let nuevoEstado = shipment.estado_envio;
    if (cleanProgress >= 100.0) {
      nuevoEstado = 'entregado';
      db.prepare("UPDATE pedidos SET estado = 'entregado', updated_at = ? WHERE id = ?").run(now, pedidoId);
    } else if (cleanProgress > 0 && nuevoEstado === 'preparando') {
      nuevoEstado = 'en_transito';
      db.prepare("UPDATE pedidos SET estado = 'enviado', updated_at = ? WHERE id = ?").run(now, pedidoId);
    }

    db.prepare(`
      UPDATE envios
      SET progreso_simulacion = ?, lat_actual = ?, lng_actual = ?,
          estado_envio = ?, updated_at = ?
      WHERE pedido_id = ?
    `).run(cleanProgress, cleanLat, cleanLng, nuevoEstado, now, pedidoId);

    res.json({
      success: true,
      progresoSimulacion: cleanProgress,
      progreso_simulacion: cleanProgress,
      latActual: cleanLat,
      lat_actual: cleanLat,
      lngActual: cleanLng,
      lng_actual: cleanLng,
      estadoEnvio: nuevoEstado,
      estado_envio: nuevoEstado,
      shipment: {
        pedido_id: pedidoId,
        pedidoId,
        progreso_simulacion: cleanProgress,
        progresoSimulacion: cleanProgress,
        lat_actual: cleanLat,
        latActual: cleanLat,
        lng_actual: cleanLng,
        lngActual: cleanLng,
        estado_envio: nuevoEstado,
        estadoEnvio: nuevoEstado
      }
    });
  });

  // Marcar como Entregado en Destino
  app.post('/api/logistics/shipments/:pedidoId/deliver', authenticateRequest, requireRoles('administrador', 'vendedor', 'soporte'), (req, res) => {
    const pedidoId = Number(req.params.pedidoId);
    const db = getDb();
    const shipment = db.prepare('SELECT * FROM envios WHERE pedido_id = ?').get(pedidoId);
    if (!shipment) return res.status(404).json({ error: 'Envío no encontrado.' });

    const order = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    const now = new Date().toISOString();
    const historial = JSON.parse(shipment.historial_rastreo_json || '[]');
    historial.push({
      fecha: now,
      estado: 'entregado',
      ubicacion: 'Domicilio del comprador',
      detalle: 'Paquete entregado exitosamente y recibido por el cliente.'
    });

    db.prepare(`
      UPDATE envios 
      SET estado_envio = 'entregado', progreso_simulacion = 100.0, simulacion_activa = 0,
          lat_actual = lat_destino, lng_actual = lng_destino,
          historial_rastreo_json = ?, updated_at = ?
      WHERE pedido_id = ?
    `).run(JSON.stringify(historial), now, pedidoId);

    db.prepare("UPDATE pedidos SET estado = 'entregado', updated_at = ? WHERE id = ?").run(now, pedidoId);

    sendUserNotification(db, {
      usuarioId: order.usuario_id,
      pedidoId,
      evento: 'PEDIDO_ENTREGADO',
      asunto: `¡Tu pedido ${order.folio} ha sido entregado!`,
      mensaje: `Confirmamos la entrega de tu paquete en tu domicilio. ¡Gracias por comprar en ExpressMart!`
    });

    recordAuditLog(db, {
      usuarioId: req.user.id,
      rol: req.user.rol,
      accion: 'LOGISTICA_ENTREGA_COMPLETADA',
      modulo: 'Logística y Almacenes (RF-07 / DEV-09)',
      entidadId: shipment.numero_guia,
      detalles: { pedidoId, guia: shipment.numero_guia }
    });

    res.json({
      message: `Envío ${shipment.numero_guia} marcado como entregado exitosamente.`,
      estadoEnvio: 'entregado',
      estado_envio: 'entregado',
      progresoSimulacion: 100.0,
      progreso_simulacion: 100.0,
      simulacionActiva: false,
      simulacion_activa: 0,
      shipment: {
        pedido_id: pedidoId,
        pedidoId,
        estado_envio: 'entregado',
        estadoEnvio: 'entregado',
        progreso_simulacion: 100,
        progresoSimulacion: 100,
        simulacion_activa: 0,
        simulacionActiva: false
      }
    });
  });
}

module.exports = {
  registerLogisticsRoutes
};
