/**
 * Rutas de Pedidos, Devoluciones, Reembolsos y Garantía LFPC
 * RF-07, RF-09, DEV-07, NOR-09
 */

const { getDb, recordAuditLog } = require('../db/database');
const { decryptData } = require('../utils/crypto');
const { authenticateRequest, requireRoles } = require('../middleware/security');
const { sendUserNotification } = require('../services/externalProviders');
const { advanceActiveSimulations, getWarehouseDetails } = require('../services/logisticsService');

function registerOrderRoutes(app) {
  // =========================================================================
  // PROCESO 5 (DFD): GESTIÓN DE PEDIDOS, ENVÍOS Y DEVOLUCIONES (RF-07, DEV-07, DEV-09)
  // =========================================================================
  app.get('/api/orders', authenticateRequest, (req, res) => {
    const db = getDb();
    advanceActiveSimulations(db);
    const isPrivileged = ['administrador', 'vendedor', 'soporte', 'auditor'].includes(req.user.rol);
    const showAll = isPrivileged && (req.query.scope === 'all' || req.query.all === 'true' || req.query.all === '1');

    const orders = showAll
      ? db.prepare(`
          SELECT p.*, u.email as cliente_email, u.nombre as cliente_nombre
          FROM pedidos p
          JOIN usuarios u ON u.id = p.usuario_id
          ORDER BY p.id DESC
        `).all()
      : db.prepare(`
          SELECT p.*, u.email as cliente_email, u.nombre as cliente_nombre
          FROM pedidos p
          JOIN usuarios u ON u.id = p.usuario_id
          WHERE p.usuario_id = ?
          ORDER BY p.id DESC
        `).all(req.user.id);

    const enriched = orders.map((o) => {
      const items = db.prepare(`
        SELECT pi.*, COALESCE(c.imagen_url, '/assets/logo.png') as imagen_url, c.categoria, c.marca, c.sku
        FROM pedido_items pi
        LEFT JOIN catalogo c ON c.id = pi.producto_id
        WHERE pi.pedido_id = ?
      `).all(o.id);
      const envio = db.prepare('SELECT * FROM envios WHERE pedido_id = ?').get(o.id);
      const whDetails = envio ? getWarehouseDetails(envio.almacen_codigo || envio.almacen_origen) : null;
      const pago = db.prepare('SELECT referencia_pasarela, proveedor_pasarela, metodo_pago, meses_sin_intereses, monto, tarjeta_enmascarada, token_pci, estado, created_at FROM transacciones WHERE pedido_id = ?').get(o.id);
      const solicitudReembolso = db.prepare('SELECT * FROM solicitudes_reembolso WHERE pedido_id = ? ORDER BY id DESC LIMIT 1').get(o.id) || null;
      return {
        ...o,
        direccion_envio: decryptData(o.direccion_envio_cifrada),
        items,
        envio: envio
          ? {
              ...envio,
              almacen_direccion: envio.almacen_direccion || (whDetails ? whDetails.direccion : ''),
              historial: JSON.parse(envio.historial_rastreo_json || '[]'),
              rutaPuntos: JSON.parse(envio.ruta_puntos_json || '[]'),
              simulacionActiva: Boolean(envio.simulacion_activa)
            }
          : null,
        pago,
        solicitudReembolso
      };
    });

    res.json({ total: enriched.length, orders: enriched });
  });

  // Actualizar estado del pedido y envío (RF-07)
  app.patch('/api/orders/:id/status', authenticateRequest, requireRoles('administrador', 'vendedor', 'soporte'), (req, res) => {
    const pedidoId = Number(req.params.id);
    const { estado, ubicacion = 'Centro Logístico ExpressMart', detalle = '' } = req.body || {};
    const validStates = ['pendiente', 'pagado', 'procesando', 'enviado', 'entregado', 'cancelado', 'devuelto'];

    if (!validStates.includes(estado)) {
      return res.status(400).json({ error: `Estado inválido. Valores permitidos: ${validStates.join(', ')}` });
    }

    const db = getDb();
    const order = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE pedidos SET estado = ?, updated_at = ? WHERE id = ?').run(estado, now, pedidoId);

    // Si se cancela o devuelve y no estaba ya cancelado/devuelto, reintegrar stock y reembolsar pago
    if ((estado === 'cancelado' || estado === 'devuelto') && !['cancelado', 'devuelto'].includes(order.estado)) {
      const items = db.prepare('SELECT * FROM pedido_items WHERE pedido_id = ?').all(pedidoId);
      for (const item of items) {
        db.prepare('UPDATE inventario SET stock_disponible = stock_disponible + ?, updated_at = ? WHERE producto_id = ?').run(
          item.cantidad,
          now,
          item.producto_id
        );
      }
      db.prepare("UPDATE transacciones SET estado = 'reembolsado' WHERE pedido_id = ?").run(pedidoId);
    }

    // Actualizar estado en D6 Envíos
    const envio = db.prepare('SELECT * FROM envios WHERE pedido_id = ?').get(pedidoId);
    if (envio) {
      const mapShipmentState = {
        pendiente: 'preparando',
        pagado: 'preparando',
        procesando: 'preparando',
        enviado: 'en_transito',
        entregado: 'entregado',
        cancelado: 'devuelto',
        devuelto: 'devuelto'
      };
      const nuevoEstadoEnvio = mapShipmentState[estado] || envio.estado_envio;
      const historial = JSON.parse(envio.historial_rastreo_json || '[]');
      historial.push({
        fecha: now,
        estado: nuevoEstadoEnvio,
        ubicacion,
        detalle: detalle || `Pedido actualizado a estado: ${estado}`
      });
      db.prepare('UPDATE envios SET estado_envio = ?, historial_rastreo_json = ?, updated_at = ? WHERE pedido_id = ?').run(
        nuevoEstadoEnvio,
        JSON.stringify(historial),
        now,
        pedidoId
      );
    }

    // RF-09: Notificar al cliente del cambio de estado
    sendUserNotification(db, {
      usuarioId: order.usuario_id,
      pedidoId,
      evento: `ACTUALIZACION_PEDIDO_${estado.toUpperCase()}`,
      asunto: `Actualización de tu pedido ${order.folio}: ${estado.toUpperCase()}`,
      mensaje: `El estado de tu pedido ${order.folio} cambió a "${estado}". ${detalle}`
    });

    recordAuditLog(db, {
      usuarioId: req.user.id,
      rol: req.user.rol,
      accion: 'CAMBIO_ESTADO_PEDIDO',
      modulo: 'Pedidos y Logística (RF-07)',
      entidadId: order.folio,
      ip: req.ip || '127.0.0.1',
      detalles: { estadoAnterior: order.estado, estadoNuevo: estado }
    });

    res.json({
      message: `Estado del pedido ${order.folio} actualizado a "${estado}".`,
      folio: order.folio,
      estado
    });
  });

  // Solicitud de devolución por el cliente (LFPC NOR-09 / RF-07)
  app.post('/api/orders/:id/return', authenticateRequest, (req, res) => {
    const pedidoId = Number(req.params.id);
    const { motivo = 'Devolución solicitada dentro de garantía LFPC' } = req.body || {};
    const db = getDb();

    const order = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    if (order.usuario_id !== req.user.id && req.user.rol !== 'administrador') {
      return res.status(403).json({ error: 'No tiene permiso para devolver este pedido (SEG-02).' });
    }
    if (['cancelado', 'devuelto'].includes(order.estado)) {
      return res.status(400).json({ error: 'El pedido ya fue cancelado o devuelto previamente.' });
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE pedidos SET estado = 'devuelto', motivo_devolucion = ?, updated_at = ? WHERE id = ?").run(
      String(motivo).trim(),
      now,
      pedidoId
    );

    const items = db.prepare('SELECT * FROM pedido_items WHERE pedido_id = ?').all(pedidoId);
    for (const item of items) {
      db.prepare('UPDATE inventario SET stock_disponible = stock_disponible + ?, updated_at = ? WHERE producto_id = ?').run(
        item.cantidad,
        now,
        item.producto_id
      );
    }
    db.prepare("UPDATE transacciones SET estado = 'reembolsado' WHERE pedido_id = ?").run(pedidoId);
    db.prepare("UPDATE envios SET estado_envio = 'devuelto', updated_at = ? WHERE pedido_id = ?").run(now, pedidoId);

    sendUserNotification(db, {
      usuarioId: order.usuario_id,
      pedidoId,
      evento: 'DEVOLUCION_Y_REEMBOLSO_APLICADO',
      asunto: `Devolución y reembolso confirmados - Pedido ${order.folio}`,
      mensaje: `Tu devolución del pedido ${order.folio} fue procesada y el reembolso de $${order.total.toFixed(2)} MXN ha sido emitido.`
    });

    recordAuditLog(db, {
      usuarioId: req.user.id,
      rol: req.user.rol,
      accion: 'DEVOLUCION_PEDIDO_LFPC',
      modulo: 'Devoluciones y Reembolsos (RF-07 / NOR-09)',
      entidadId: order.folio,
      ip: req.ip || '127.0.0.1',
      detalles: { motivo }
    });

    res.json({
      message: 'Devolución registrada, inventario reintegrado y reembolso procesado en pasarela.',
      folio: order.folio,
      estado: 'devuelto',
      reembolsoMonto: order.total
    });
  });

  // =========================================================================
  // GESTIÓN DE PETICIONES DE REEMBOLSO (LFPC NOR-09 / SGC)
  // =========================================================================
  app.get('/api/admin/refund-requests', authenticateRequest, requireRoles('administrador', 'soporte', 'auditor'), (req, res) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT 
        sr.id, sr.pedido_id, sr.usuario_id, sr.monto, sr.motivo, sr.estado,
        sr.respuesta_admin, sr.fecha_solicitud, sr.fecha_resolucion, sr.created_at, sr.updated_at,
        p.folio as pedido_folio, p.total as pedido_total, p.metodo_pago,
        u.nombre as cliente_nombre, u.email as cliente_email
      FROM solicitudes_reembolso sr
      JOIN pedidos p ON p.id = sr.pedido_id
      JOIN usuarios u ON u.id = sr.usuario_id
      ORDER BY sr.id DESC
    `).all();

    res.json({ total: rows.length, requests: rows });
  });

  app.post('/api/orders/:id/refund-request', authenticateRequest, (req, res) => {
    const pedidoId = Number(req.params.id);
    const { motivo = 'Solicitud de reembolso y devolución bajo garantía LFPC' } = req.body || {};
    const db = getDb();

    const order = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    if (order.usuario_id !== req.user.id && req.user.rol !== 'administrador') {
      return res.status(403).json({ error: 'No tiene permiso para solicitar reembolso de este pedido.' });
    }
    if (['cancelado', 'devuelto'].includes(order.estado)) {
      return res.status(400).json({ error: 'El pedido ya fue cancelado o devuelto previamente.' });
    }

    const pending = db.prepare("SELECT id FROM solicitudes_reembolso WHERE pedido_id = ? AND estado = 'pendiente'").get(pedidoId);
    if (pending) {
      return res.status(400).json({ error: 'Ya existe una solicitud de reembolso pendiente para este pedido.' });
    }

    const now = new Date().toISOString();
    const ins = db.prepare(`
      INSERT INTO solicitudes_reembolso (pedido_id, usuario_id, monto, motivo, estado, fecha_solicitud, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pendiente', ?, ?, ?)
    `).run(pedidoId, order.usuario_id, order.total, String(motivo).trim(), now, now, now);

    sendUserNotification(db, {
      usuarioId: order.usuario_id,
      pedidoId,
      evento: 'SOLICITUD_REEMBOLSO_REGISTRADA',
      asunto: `Solicitud de reembolso recibida - Pedido ${order.folio}`,
      mensaje: `Hemos recibido tu solicitud de reembolso para el pedido ${order.folio} por $${order.total.toFixed(2)} MXN. Un administrador la revisará a la brevedad.`
    });

    recordAuditLog(db, {
      usuarioId: req.user.id,
      rol: req.user.rol,
      accion: 'SOLICITUD_REEMBOLSO_CREADA',
      modulo: 'Devoluciones y Reembolsos (RF-07 / NOR-09)',
      entidadId: order.folio,
      detalles: { motivo: String(motivo).trim(), monto: order.total }
    });

    res.status(201).json({
      message: 'Solicitud de reembolso registrada exitosamente. Está pendiente de aprobación por el administrador.',
      requestId: Number(ins.lastInsertRowid),
      pedidoId,
      folio: order.folio,
      monto: order.total,
      estado: 'pendiente'
    });
  });

  app.post('/api/admin/refund-requests/:id/approve', authenticateRequest, requireRoles('administrador'), (req, res) => {
    const requestId = Number(req.params.id);
    const { respuesta = 'Reembolso aprobado conforme a la política de devoluciones y garantía de satisfacción.' } = req.body || {};
    const db = getDb();

    const requestRow = db.prepare('SELECT * FROM solicitudes_reembolso WHERE id = ?').get(requestId);
    if (!requestRow) {
      return res.status(404).json({ error: `Solicitud de reembolso #${requestId} no encontrada.` });
    }
    if (requestRow.estado !== 'pendiente') {
      return res.status(400).json({ error: `La solicitud #${requestId} ya fue resuelta previamente (${requestRow.estado}).` });
    }

    const order = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(requestRow.pedido_id);
    if (!order) {
      return res.status(404).json({ error: 'Pedido asociado no encontrado.' });
    }

    const now = new Date().toISOString();
    let tarjetaReembolsada = null;

    try {
      db.exec('BEGIN IMMEDIATE TRANSACTION;');

      // 1. Actualizar solicitud
      db.prepare(`
        UPDATE solicitudes_reembolso
        SET estado = 'aprobada', respuesta_admin = ?, fecha_resolucion = ?, updated_at = ?
        WHERE id = ?
      `).run(String(respuesta).trim(), now, now, requestId);

      // 2. Actualizar pedido
      db.prepare("UPDATE pedidos SET estado = 'devuelto', motivo_devolucion = ?, updated_at = ? WHERE id = ?").run(
        requestRow.motivo,
        now,
        order.id
      );

      // 3. Reintegrar inventario
      const items = db.prepare('SELECT * FROM pedido_items WHERE pedido_id = ?').all(order.id);
      for (const item of items) {
        db.prepare('UPDATE inventario SET stock_disponible = stock_disponible + ?, updated_at = ? WHERE producto_id = ?').run(
          item.cantidad,
          now,
          item.producto_id
        );
      }

      // 4. Actualizar transacciones y envíos
      db.prepare("UPDATE transacciones SET estado = 'reembolsado' WHERE pedido_id = ?").run(order.id);
      db.prepare("UPDATE envios SET estado_envio = 'devuelto', updated_at = ? WHERE pedido_id = ?").run(now, order.id);

      // 5. Reembolsar a tarjeta simulada si coincide
      const tx = db.prepare('SELECT * FROM transacciones WHERE pedido_id = ?').get(order.id);
      if (tx && tx.tarjeta_enmascarada) {
        const last4 = tx.tarjeta_enmascarada.slice(-4);
        const card = db.prepare("SELECT * FROM tarjetas_simuladas WHERE numero_tarjeta LIKE '%' || ?").get(last4);
        if (card) {
          const nuevoSaldo = Number((card.saldo + order.total).toFixed(2));
          db.prepare('UPDATE tarjetas_simuladas SET saldo = ?, updated_at = ? WHERE id = ?').run(nuevoSaldo, now, card.id);
          tarjetaReembolsada = {
            id: card.id,
            marca: card.marca,
            tarjetaEnmascarada: `•••• ${last4}`,
            saldoAnterior: card.saldo,
            saldoNuevo: nuevoSaldo
          };
        }
      }

      db.exec('COMMIT;');

      sendUserNotification(db, {
        usuarioId: order.usuario_id,
        pedidoId: order.id,
        evento: 'REEMBOLSO_APROBADO',
        asunto: `Reembolso aprobado para el pedido ${order.folio}`,
        mensaje: `Tu solicitud de reembolso del pedido ${order.folio} por $${order.total.toFixed(2)} MXN fue aprobada. ${String(respuesta).trim()}`
      });

      recordAuditLog(db, {
        usuarioId: req.user.id,
        rol: req.user.rol,
        accion: 'APROBACION_REEMBOLSO_ADMIN',
        modulo: 'Devoluciones y Reembolsos (RF-07 / NOR-09)',
        entidadId: order.folio,
        detalles: {
          requestId,
          montoReembolsado: order.total,
          respuesta: String(respuesta).trim(),
          tarjetaReembolsada
        }
      });

      res.json({
        message: `Solicitud de reembolso #${requestId} aprobada exitosamente. Fondos reintegrados e inventario restaurado.`,
        requestId,
        folio: order.folio,
        estado: 'aprobada',
        reembolsoMonto: order.total,
        tarjetaReembolsada
      });
    } catch (err) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      console.error('APPROVE REFUND ERROR:', err);
      res.status(500).json({ error: 'Error al aprobar reembolso: ' + err.message });
    }
  });

  app.post('/api/admin/refund-requests/:id/reject', authenticateRequest, requireRoles('administrador'), (req, res) => {
    const requestId = Number(req.params.id);
    const { motivo = 'Solicitud no cumple con los criterios de garantía o excede el plazo establecido.' } = req.body || {};
    const db = getDb();

    const requestRow = db.prepare('SELECT * FROM solicitudes_reembolso WHERE id = ?').get(requestId);
    if (!requestRow) {
      return res.status(404).json({ error: `Solicitud de reembolso #${requestId} no encontrada.` });
    }
    if (requestRow.estado !== 'pendiente') {
      return res.status(400).json({ error: `La solicitud #${requestId} ya fue resuelta previamente (${requestRow.estado}).` });
    }

    const order = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(requestRow.pedido_id);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE solicitudes_reembolso
      SET estado = 'denegada', respuesta_admin = ?, fecha_resolucion = ?, updated_at = ?
      WHERE id = ?
    `).run(String(motivo).trim(), now, now, requestId);

    if (order) {
      sendUserNotification(db, {
        usuarioId: order.usuario_id,
        pedidoId: order.id,
        evento: 'REEMBOLSO_DENEGADO',
        asunto: `Actualización de solicitud de reembolso - Pedido ${order.folio}`,
        mensaje: `Tu solicitud de reembolso del pedido ${order.folio} fue denegada. Motivo: ${String(motivo).trim()}`
      });
    }

    recordAuditLog(db, {
      usuarioId: req.user.id,
      rol: req.user.rol,
      accion: 'DENEGACION_REEMBOLSO_ADMIN',
      modulo: 'Devoluciones y Reembolsos (RF-07 / NOR-09)',
      entidadId: order ? order.folio : `REQ-${requestId}`,
      detalles: {
        requestId,
        motivoRechazo: String(motivo).trim()
      }
    });

    res.json({
      message: `Solicitud de reembolso #${requestId} denegada.`,
      requestId,
      estado: 'denegada',
      respuestaAdmin: String(motivo).trim()
    });
  });
}

module.exports = {
  registerOrderRoutes
};
