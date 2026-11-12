/**
 * Rutas de Panel de Vendedor y Administrador (ExpressMart MX)
 * Catálogo propio, ventas del vendedor y gestión de tarjeta receptora de pagos simulados.
 * RF-01, RF-06, RF-10, SGC MC-001 v1.0
 */

const { getDb, recordAuditLog } = require('../db/database');
const { authenticateRequest, requireRoles } = require('../middleware/security');
const { isPositiveNumber } = require('../utils/sanitizer');
const { getWarehouseDetails, resolveValidWarehouse } = require('../services/logisticsService');

function registerSellerRoutes(app) {
  // =========================================================================
  // DASHBOARD DEL VENDEDOR Y ADMINISTRADOR (RF-06, RF-10)
  // Devuelve únicamente productos subidos por este usuario, sus ventas y su tarjeta receptora.
  // =========================================================================
  app.get('/api/seller/dashboard', authenticateRequest, requireRoles('administrador', 'vendedor'), (req, res) => {
    const db = getDb();
    const vendorId = req.user.id;

    // 1. Productos subidos por este vendedor/administrador
    const productos = db.prepare(`
      SELECT c.*,
             COALESCE(i.stock_disponible, 0) as stock_disponible,
             COALESCE(i.stock_reservado, 0) as stock_reservado,
             COALESCE(i.ubicacion_almacen, 'CEDIS-CDMX-01') as ubicacion_almacen,
             COALESCE((
               SELECT SUM(pi.cantidad) 
               FROM pedido_items pi 
               JOIN pedidos p ON p.id = pi.pedido_id 
               WHERE pi.producto_id = c.id AND p.estado != 'cancelado'
             ), 0) as total_vendido_unidades,
             COALESCE((
               SELECT SUM(pi.subtotal) 
               FROM pedido_items pi 
               JOIN pedidos p ON p.id = pi.pedido_id 
               WHERE pi.producto_id = c.id AND p.estado != 'cancelado'
             ), 0) as total_vendido_monto
      FROM catalogo c
      LEFT JOIN inventario i ON i.producto_id = c.id
      WHERE c.vendedor_id = ?
      ORDER BY c.id DESC
    `).all(vendorId).map((p) => {
      const wh = getWarehouseDetails(p.ubicacion_almacen);
      return {
        ...p,
        ubicacion_almacen: wh.codigo,
        almacen_nombre: wh.nombre,
        almacen_ciudad: wh.ciudad || ''
      };
    });

    // 2. Ventas que corresponden a productos subidos por este usuario
    const ventas = db.prepare(`
      SELECT pi.id, pi.pedido_id, pi.producto_id, pi.nombre_producto, pi.cantidad, pi.precio_unitario, pi.subtotal,
             p.folio, p.estado, p.created_at,
             u.nombre as comprador_nombre, u.email as comprador_email
      FROM pedido_items pi
      JOIN catalogo c ON c.id = pi.producto_id
      JOIN pedidos p ON p.id = pi.pedido_id
      JOIN usuarios u ON u.id = p.usuario_id
      WHERE c.vendedor_id = ?
      ORDER BY p.id DESC
    `).all(vendorId);

    // 3. Tarjeta receptora de dinero simulado asignada a este usuario
    let receivingCard = db.prepare(`
      SELECT id, usuario_id, numero_tarjeta, titular, expiracion, cvv, saldo, saldo_inicial,
             marca, tipo, color_plastico, vinculada_paypal, es_receptora, activa, created_at, updated_at
      FROM tarjetas_simuladas
      WHERE usuario_id = ? AND activa = 1
      ORDER BY es_receptora DESC, id DESC
      LIMIT 1
    `).get(vendorId);

    // Si tiene tarjeta pero ninguna tiene es_receptora=1, marcar la primera activa
    if (receivingCard && !receivingCard.es_receptora) {
      db.prepare('UPDATE tarjetas_simuladas SET es_receptora = 1 WHERE id = ?').run(receivingCard.id);
      receivingCard.es_receptora = 1;
    }

    // Todas las tarjetas del usuario (hasta 3)
    const userCards = db.prepare(`
      SELECT id, usuario_id, numero_tarjeta, titular, expiracion, saldo, marca, tipo, color_plastico, es_receptora, activa
      FROM tarjetas_simuladas
      WHERE usuario_id = ? AND activa = 1
      ORDER BY es_receptora DESC, id ASC
    `).all(vendorId);

    // 4. Métricas calculadas para este vendedor
    const ventasEfectivas = ventas.filter((v) => !['cancelado'].includes(v.estado));
    const totalIngresos = Number(ventasEfectivas.reduce((acc, v) => acc + Number(v.subtotal || 0), 0).toFixed(2));
    const unidadesVendidas = ventasEfectivas.reduce((acc, v) => acc + Number(v.cantidad || 0), 0);
    const totalPedidos = new Set(ventasEfectivas.map((v) => v.pedido_id)).size;
    const saldoRecibido = receivingCard ? Number(receivingCard.saldo.toFixed(2)) : 0;

    res.json({
      vendedor: {
        id: req.user.id,
        nombre: req.user.nombre,
        email: req.user.email,
        rol: req.user.rol
      },
      receivingCard: receivingCard || null,
      userCards,
      productos,
      ventas,
      metricas: {
        totalIngresos,
        unidadesVendidas,
        totalPedidos,
        totalProductos: productos.length,
        saldoRecibido
      }
    });
  });

  // =========================================================================
  // VINCULACIÓN O REGISTRO DE TARJETA RECEPTORA DE PAGOS SIMULADOS
  // =========================================================================
  app.post('/api/seller/receiving-card', authenticateRequest, requireRoles('administrador', 'vendedor'), (req, res) => {
    const db = getDb();
    const vendorId = req.user.id;
    const { cardId, numeroTarjeta, titular, expiracion = '12/29', cvv = '123', marca = 'Visa', tipo = 'debito', colorPlastico = '#1d4ed8', saldoInicial = 0 } = req.body || {};

    try {
      db.exec('BEGIN IMMEDIATE TRANSACTION;');

      let targetCardId = null;

      if (cardId) {
        // Opción A: Vincular una tarjeta existente de su cartera
        const existing = db.prepare('SELECT * FROM tarjetas_simuladas WHERE id = ? AND usuario_id = ? AND activa = 1').get(Number(cardId), vendorId);
        if (!existing) {
          db.exec('ROLLBACK;');
          return res.status(404).json({ error: 'Tarjeta no encontrada o no pertenece a tu cuenta.' });
        }
        targetCardId = existing.id;
      } else {
        // Opción B: Crear y registrar una nueva tarjeta receptora
        if (!numeroTarjeta || String(numeroTarjeta).trim().length < 12) {
          db.exec('ROLLBACK;');
          return res.status(400).json({ error: 'Número de tarjeta inválido (mínimo 12 caracteres).' });
        }
        if (!titular || String(titular).trim().length < 3) {
          db.exec('ROLLBACK;');
          return res.status(400).json({ error: 'Debe ingresar el nombre del titular (mínimo 3 caracteres).' });
        }

        // Validar límite de 3 tarjetas por usuario
        const countRow = db.prepare('SELECT COUNT(*) as total FROM tarjetas_simuladas WHERE usuario_id = ?').get(vendorId);
        if (countRow && Number(countRow.total) >= 3) {
          db.exec('ROLLBACK;');
          return res.status(400).json({
            error: 'Límite alcanzado (máximo 3 tarjetas por usuario). Selecciona una de tus tarjetas existentes como receptora.'
          });
        }

        const cleanCard = String(numeroTarjeta).trim();
        const montoSaldo = Math.max(0, Number(saldoInicial) || 0);
        const cleanColor = String(colorPlastico || '#1d4ed8').trim();
        const now = new Date().toISOString();

        const insertResult = db.prepare(`
          INSERT INTO tarjetas_simuladas (
            usuario_id, numero_tarjeta, titular, expiracion, cvv, saldo, saldo_inicial,
            marca, tipo, color_plastico, vinculada_paypal, es_receptora, activa, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, ?, ?)
        `).run(
          vendorId,
          cleanCard,
          String(titular).trim().toUpperCase(),
          String(expiracion || '12/29').trim(),
          String(cvv || '123').trim(),
          montoSaldo,
          montoSaldo,
          String(marca || 'Visa').trim(),
          String(tipo || 'debito').trim(),
          cleanColor,
          now,
          now
        );

        targetCardId = Number(insertResult.lastInsertRowid);
      }

      // Desactivar bandera es_receptora en todas las tarjetas de este usuario
      db.prepare('UPDATE tarjetas_simuladas SET es_receptora = 0 WHERE usuario_id = ?').run(vendorId);
      // Activar es_receptora en la tarjeta seleccionada
      db.prepare('UPDATE tarjetas_simuladas SET es_receptora = 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), targetCardId);

      db.exec('COMMIT;');

      const activeCard = db.prepare('SELECT * FROM tarjetas_simuladas WHERE id = ?').get(targetCardId);

      recordAuditLog(db, {
        usuarioId: vendorId,
        rol: req.user.rol,
        accion: 'VINCULACION_TARJETA_RECEPTORA_VENDEDOR',
        modulo: 'Panel de Vendedor y Liquidaciones (RF-05, RF-10)',
        entidadId: String(targetCardId),
        detalles: {
          tarjetaId: targetCardId,
          titular: activeCard.titular,
          marca: activeCard.marca,
          numeroEnmascarado: activeCard.numero_tarjeta.replace(/\d(?=\d{4})/g, '*'),
          saldo: activeCard.saldo
        }
      });

      res.status(200).json({
        message: 'Tarjeta receptora de cobro vinculada exitosamente.',
        card: activeCard
      });
    } catch (err) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      if (err.message && err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Este número de tarjeta ya se encuentra registrado en el sistema.' });
      }
      return res.status(500).json({ error: `Error al vincular tarjeta receptora: ${err.message}` });
    }
  });

  // =========================================================================
  // ACREDITAR FONDOS / VENTAS A LA TARJETA RECEPTORA (SIMULACIÓN DE COBRO)
  // =========================================================================
  app.post('/api/seller/credit-sales', authenticateRequest, requireRoles('administrador', 'vendedor'), (req, res) => {
    const db = getDb();
    const vendorId = req.user.id;
    const { monto } = req.body || {};

    const receivingCard = db.prepare(`
      SELECT * FROM tarjetas_simuladas
      WHERE usuario_id = ? AND activa = 1
      ORDER BY es_receptora DESC, id DESC
      LIMIT 1
    `).get(vendorId);

    if (!receivingCard) {
      return res.status(400).json({
        error: 'No tienes una tarjeta receptora vinculada. Por favor agrega o vincula una tarjeta para recibir los fondos.'
      });
    }

    // Calcular total de ventas del vendedor para liquidación
    const ventasTotalesRow = db.prepare(`
      SELECT COALESCE(SUM(pi.subtotal), 0) as totalVentas
      FROM pedido_items pi
      JOIN catalogo c ON c.id = pi.producto_id
      JOIN pedidos p ON p.id = pi.pedido_id
      WHERE c.vendedor_id = ? AND p.estado != 'cancelado'
    `).get(vendorId);

    const totalVentasMonto = Number(ventasTotalesRow ? ventasTotalesRow.totalVentas : 0);

    // Monto a acreditar (monto especificado o importe de ventas base)
    const montoAcreditar = monto !== undefined && isPositiveNumber(monto) && Number(monto) > 0
      ? Number(Number(monto).toFixed(2))
      : Math.max(1000, Number(totalVentasMonto.toFixed(2)));

    const now = new Date().toISOString();
    const nuevoSaldo = Number((receivingCard.saldo + montoAcreditar).toFixed(2));

    db.prepare('UPDATE tarjetas_simuladas SET saldo = ?, updated_at = ? WHERE id = ?')
      .run(nuevoSaldo, now, receivingCard.id);

    recordAuditLog(db, {
      usuarioId: vendorId,
      rol: req.user.rol,
      accion: 'ACREDITACION_VENTAS_TARJETA_VENDEDOR',
      modulo: 'Panel de Vendedor y Liquidaciones (RF-05, RF-10)',
      entidadId: String(receivingCard.id),
      detalles: {
        tarjetaId: receivingCard.id,
        montoAcreditado: montoAcreditar,
        saldoAnterior: receivingCard.saldo,
        nuevoSaldo
      }
    });

    res.json({
      message: `Se acreditaron exitosamente $${montoAcreditar.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN a tu tarjeta receptora.`,
      saldoAnterior: receivingCard.saldo,
      nuevoSaldo,
      tarjeta: {
        id: receivingCard.id,
        titular: receivingCard.titular,
        marca: receivingCard.marca,
        colorPlastico: receivingCard.color_plastico,
        saldo: nuevoSaldo
      }
    });
  });

  // =========================================================================
  // GESTIÓN RÁPIDA DE STOCK Y PRECIO DE PRODUCTOS PROPIOS (RF-06)
  // =========================================================================
  app.put('/api/seller/products/:id/stock', authenticateRequest, requireRoles('administrador', 'vendedor'), (req, res) => {
    const db = getDb();
    const productId = Number(req.params.id);
    const { stock, precio, activo, ubicacion_almacen, almacenCodigo, almacen_codigo } = req.body || {};

    const prod = db.prepare('SELECT * FROM catalogo WHERE id = ?').get(productId);
    if (!prod) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    if (req.user.rol === 'vendedor' && prod.vendedor_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para modificar productos de otros vendedores.' });
    }

    const requestedWh = ubicacion_almacen ?? almacenCodigo ?? almacen_codigo;
    let resolvedWh = null;
    if (requestedWh !== undefined && String(requestedWh).trim() !== '') {
      resolvedWh = resolveValidWarehouse(db, requestedWh);
      if (!resolvedWh) {
        return res.status(400).json({ error: `El almacén especificado (${requestedWh}) no existe en los CEDIS activos.` });
      }
    }

    const now = new Date().toISOString();

    if (stock !== undefined || resolvedWh) {
      if (stock !== undefined && !isPositiveNumber(stock)) {
        return res.status(400).json({ error: 'El stock no puede ser negativo.' });
      }
      const currentInv = db.prepare('SELECT stock_disponible, ubicacion_almacen FROM inventario WHERE producto_id = ?').get(productId);
      const nextStock = stock !== undefined ? Number(stock) : Number(currentInv ? currentInv.stock_disponible : 0);
      const nextWh = resolvedWh ? resolvedWh.codigo : (currentInv ? currentInv.ubicacion_almacen : 'CEDIS-CDMX-01');
      db.prepare(`
        UPDATE inventario 
        SET stock_disponible = ?, ubicacion_almacen = ?, ultima_conciliacion = ?, updated_at = ? 
        WHERE producto_id = ?
      `).run(nextStock, nextWh, now, now, productId);
    }

    if (precio !== undefined || activo !== undefined) {
      if (precio !== undefined && (!isPositiveNumber(precio) || Number(precio) <= 0)) {
        return res.status(400).json({ error: 'El precio debe ser un número positivo mayor a 0.' });
      }
      db.prepare(`
        UPDATE catalogo
        SET precio = COALESCE(?, precio),
            activo = COALESCE(?, activo),
            updated_at = ?
        WHERE id = ?
      `).run(
        precio !== undefined ? Number(precio) : null,
        activo !== undefined ? (activo ? 1 : 0) : null,
        now,
        productId
      );
    }

    recordAuditLog(db, {
      usuarioId: req.user.id,
      rol: req.user.rol,
      accion: 'ACTUALIZACION_STOCK_PRECIO_VENDEDOR',
      modulo: 'Panel de Vendedor (RF-06)',
      entidadId: String(productId),
      detalles: { productId, stock, precio, activo, ubicacion_almacen: resolvedWh ? resolvedWh.codigo : undefined }
    });

    res.json({
      message: 'Producto actualizado exitosamente.',
      productId,
      ubicacion_almacen: resolvedWh ? resolvedWh.codigo : undefined
    });
  });
}

module.exports = {
  registerSellerRoutes
};
