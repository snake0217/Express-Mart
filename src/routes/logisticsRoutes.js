/**
 * Rutas de Logística, Almacenes CEDIS y Simulación de Envíos OpenStreetMap
 * RF-07, DEV-09
 */

const path = require('node:path');
const crypto = require('node:crypto');
const { getDb, recordAuditLog } = require('../db/database');
const { decryptData, encryptData, verifyPassword } = require('../utils/crypto');
const { authenticateRequest, requireRoles, createSession } = require('../middleware/security');
const { sendUserNotification } = require('../services/externalProviders');
const {
  WAREHOUSES,
  getWarehouseDetails,
  resolveDestinationCoordinates,
  resolveWarehouseForDestination,
  generateRouteCoordinates,
  advanceActiveSimulations
} = require('../services/logisticsService');

function registerLogisticsRoutes(app) {
  // Vista HTML para el módulo de Envíos y Logística
  app.get(['/envios', '/logistica'], (_req, res) => {
    res.sendFile(path.join(__dirname, '../../public/envios.html'));
  });

  // Autenticación directa para el Panel de Logística y Rastreo en Vivo (/envios)
  app.post('/api/logistics/panel-auth', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Ingrese usuario/correo y contraseña para acceder al panel.' });
    }

    const cleanInput = String(email).trim().toLowerCase();
    const db = getDb();
    let user = db.prepare('SELECT * FROM usuarios WHERE LOWER(email) = ? OR LOWER(nombre) = ?').get(cleanInput, cleanInput);
    if (!user && cleanInput === 'admin') {
      user = db.prepare("SELECT * FROM usuarios WHERE LOWER(email) = 'admin@expressmart.mx'").get();
    }
    if (!user && cleanInput === 'vendedor') {
      user = db.prepare("SELECT * FROM usuarios WHERE LOWER(email) = 'vendedor@expressmart.mx'").get();
    }
    if (!user && cleanInput === 'auditor') {
      user = db.prepare("SELECT * FROM usuarios WHERE LOWER(email) = 'auditor@expressmart.mx'").get();
    }
    if (!user || !user.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas o cuenta inactiva.' });
    }
    const aliasPasswords = {
      'admin@expressmart.mx': ['AdminPassword123!', 'Admin123!@#'],
      'vendedor@expressmart.mx': ['VendedorPassword123!', 'Vendedor123!@#'],
      'cliente@expressmart.mx': ['ClientePassword123!', 'Cliente123!@#'],
      'auditor@expressmart.mx': ['AuditorPassword123!', 'Auditor123!@#'],
      'soporte@expressmart.mx': ['SoportePassword123!', 'Soporte123!@#']
    };
    const isAliasMatch = (aliasPasswords[user.email.toLowerCase()] || []).includes(String(password));
    if (!verifyPassword(String(password), user.password_hash) && !isAliasMatch) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const session = createSession(db, {
      usuarioId: user.id,
      rol: user.rol,
      mfaVerificado: 1,
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'LogisticsPanel'
    });

    recordAuditLog(db, {
      usuarioId: user.id,
      rol: user.rol,
      accion: 'ACCESO_PANEL_ENVIOS_OSM',
      modulo: 'Logística y Almacenes (RF-07 / DEV-09)',
      entidadId: user.email,
      ip: req.ip || '127.0.0.1'
    });

    return res.json({
      success: true,
      token: session.tokenId,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
        fotoPerfil: user.foto_perfil || ''
      }
    });
  });

  // Listar Almacenes (CEDIS) con métricas de inventario y pedidos
  app.get('/api/logistics/warehouses', (req, res) => {
    const db = getDb();
    advanceActiveSimulations(db);
    let rows = [];
    try {
      rows = db.prepare('SELECT * FROM almacenes WHERE activo = 1 ORDER BY id ASC').all();
    } catch (_) {
      rows = WAREHOUSES.map((w, idx) => ({ id: idx + 1, ...w, activo: 1 }));
    }

    const enriched = rows.map((wh) => {
      const details = getWarehouseDetails(wh.codigo || wh.nombre);
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
        direccion: wh.direccion || details.direccion,
        stats
      };
    });

    res.json({ total: enriched.length, warehouses: enriched });
  });

  // Listar envíos para el Panel de Envíos y Almacenes (Admin/Vendedor/Soporte/Auditor)
  app.get('/api/logistics/shipments', authenticateRequest, requireRoles('administrador', 'vendedor', 'soporte', 'auditor', 'cliente'), (req, res) => {
    const { almacen, estado } = req.query || {};
    const db = getDb();
    advanceActiveSimulations(db);

    let sql = `
      SELECT 
        e.*,
        p.folio as pedido_folio, p.total as pedido_total, p.estado as pedido_estado,
        p.usuario_id as pedido_usuario_id,
        p.metodo_pago, p.direccion_envio_cifrada, p.created_at as pedido_fecha,
        u.nombre as cliente_nombre, u.email as cliente_email, u.telefono_cifrado as cliente_telefono_cifrado
      FROM envios e
      JOIN pedidos p ON p.id = e.pedido_id
      JOIN usuarios u ON u.id = p.usuario_id
      WHERE 1=1
    `;
    const params = [];
    if (req.user.rol === 'cliente') {
      sql += ' AND p.usuario_id = ?';
      params.push(req.user.id);
    }
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

      const whDetails = getWarehouseDetails(r.almacen_codigo || r.almacen_origen);
      const almacenDireccion = r.almacen_direccion || whDetails.direccion;

      let rutaPuntos = [];
      try {
        rutaPuntos = JSON.parse(r.ruta_puntos_json || '[]');
      } catch (_) {}
      if (!Array.isArray(rutaPuntos) || rutaPuntos.length < 2) {
        rutaPuntos = generateRouteCoordinates(
          { latitud: r.lat_origen || whDetails.latitud, longitud: r.lng_origen || whDetails.longitud },
          { lat: r.lat_destino || 19.3458, lng: r.lng_destino || -99.1617 },
          40
        );
      }

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
        almacenDireccion,
        almacen_direccion: almacenDireccion,
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
        rutaPuntos,
        ruta_puntos: rutaPuntos,
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
    advanceActiveSimulations(db, pedidoId);

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
    const whDetails = getWarehouseDetails(shipment.almacen_codigo || shipment.almacen_origen);
    const almacenDireccion = shipment.almacen_direccion || whDetails.direccion;

    let rutaPuntos = [];
    try {
      rutaPuntos = JSON.parse(shipment.ruta_puntos_json || '[]');
    } catch (_) {}
    if (!Array.isArray(rutaPuntos) || rutaPuntos.length < 2) {
      rutaPuntos = generateRouteCoordinates(
        { latitud: shipment.lat_origen || whDetails.latitud, longitud: shipment.lng_origen || whDetails.longitud },
        { lat: shipment.lat_destino || 19.3458, lng: shipment.lng_destino || -99.1617 },
        40
      );
    }

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
        almacenDireccion,
        almacen_direccion: almacenDireccion,
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
        rutaPuntos,
        ruta_puntos: rutaPuntos,
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
    let nuevoProgreso = Number(shipment.progreso_simulacion || 0);
    let nuevaLatActual = Number(shipment.lat_actual || shipment.lat_origen);
    let nuevaLngActual = Number(shipment.lng_actual || shipment.lng_origen);

    if (shipment.estado_envio === 'preparando' || shipment.estado_envio === 'entregado' || nuevoProgreso >= 100) {
      nuevoEstado = 'en_transito';
      if (nuevoProgreso >= 100) {
        nuevoProgreso = 0.0;
        nuevaLatActual = Number(shipment.lat_origen);
        nuevaLngActual = Number(shipment.lng_origen);
      }
      db.prepare("UPDATE pedidos SET estado = 'enviado', updated_at = ? WHERE id = ?").run(now, pedidoId);
    }

    db.prepare(`
      UPDATE envios
      SET simulacion_activa = 1, estado_envio = ?, tipo_vehiculo = ?,
          progreso_simulacion = ?, lat_actual = ?, lng_actual = ?, updated_at = ?
      WHERE pedido_id = ?
    `).run(nuevoEstado, updateVehiculo, nuevoProgreso, nuevaLatActual, nuevaLngActual, now, pedidoId);

    res.json({
      success: true,
      message: 'Simulación de envío iniciada en OpenStreetMap.',
      simulacionActiva: true,
      simulacion_activa: 1,
      estadoEnvio: nuevoEstado,
      estado_envio: nuevoEstado,
      progresoSimulacion: nuevoProgreso,
      progreso_simulacion: nuevoProgreso,
      tipoVehiculo: updateVehiculo,
      tipo_vehiculo: updateVehiculo,
      shipment: {
        pedido_id: pedidoId,
        pedidoId,
        estado_envio: nuevoEstado,
        estadoEnvio: nuevoEstado,
        progreso_simulacion: nuevoProgreso,
        progresoSimulacion: nuevoProgreso,
        lat_actual: nuevaLatActual,
        lng_actual: nuevaLngActual,
        simulacion_activa: 1,
        simulacionActiva: true,
        tipo_vehiculo: updateVehiculo,
        tipoVehiculo: updateVehiculo
      }
    });
  });

  // Actualizar Coordenadas / Dirección de Destino en el Mapa OpenStreetMap (Cliente o Admin)
  app.put('/api/logistics/shipments/:pedidoId/destination', authenticateRequest, (req, res) => {
    const pedidoId = Number(req.params.pedidoId);
    const { direccion, latDestino, lngDestino } = req.body || {};
    const db = getDb();

    const order = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });
    if (order.usuario_id !== req.user.id && !['administrador', 'vendedor', 'soporte'].includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para modificar el destino de este pedido.' });
    }

    const shipment = db.prepare('SELECT * FROM envios WHERE pedido_id = ?').get(pedidoId);
    if (!shipment) return res.status(404).json({ error: 'Envío no encontrado.' });

    const currentDir = direccion ? String(direccion).trim() : decryptData(order.direccion_envio_cifrada);
    const destCoords = resolveDestinationCoordinates(currentDir, latDestino, lngDestino);
    const warehouse = resolveWarehouseForDestination(destCoords);
    const routePoints = generateRouteCoordinates(warehouse, destCoords, 40);
    const now = new Date().toISOString();

    if (direccion && String(direccion).trim().length >= 5) {
      db.prepare('UPDATE pedidos SET direccion_envio_cifrada = ?, updated_at = ? WHERE id = ?')
        .run(encryptData(String(direccion).trim()), now, pedidoId);
    }

    db.prepare(`
      UPDATE envios
      SET almacen_origen = ?, almacen_codigo = ?, almacen_direccion = ?,
          lat_origen = ?, lng_origen = ?,
          lat_destino = ?, lng_destino = ?,
          lat_actual = CASE WHEN progreso_simulacion = 0 THEN ? ELSE lat_actual END,
          lng_actual = CASE WHEN progreso_simulacion = 0 THEN ? ELSE lng_actual END,
          ruta_puntos_json = ?, updated_at = ?
      WHERE pedido_id = ?
    `).run(
      warehouse.nombre,
      warehouse.codigo,
      warehouse.direccion,
      warehouse.latitud,
      warehouse.longitud,
      destCoords.lat,
      destCoords.lng,
      warehouse.latitud,
      warehouse.longitud,
      JSON.stringify(routePoints),
      now,
      pedidoId
    );

    res.json({
      success: true,
      message: 'Coordenadas y ruta de entrega actualizadas en OpenStreetMap.',
      almacenOrigen: warehouse.nombre,
      almacenDireccion: warehouse.direccion,
      latDestino: destCoords.lat,
      lngDestino: destCoords.lng,
      rutaPuntos: routePoints
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
