/**
 * Rutas de Carrito, Checkout, Pagos PCI DSS y Tarjetas Simuladas
 * RF-04, RF-05, RF-09, RNF-02, RNF-09, RNF-11, SEG-05, SEG-06, SEG-07
 */

const crypto = require('node:crypto');
const { getConfig } = require('../config/env');
const { getDb, recordAuditLog } = require('../db/database');
const { encryptData, computeOrderIntegrityHash } = require('../utils/crypto');
const { metricsState, recordLatency, authenticateRequest } = require('../middleware/security');
const {
  processPaymentGateway,
  createShipmentGuide,
  sendUserNotification
} = require('../services/externalProviders');
const { calculateCartTotals } = require('./cartCalculator');

function registerCheckoutRoutes(app) {
  // Configuración de Pasarela PayPal Sandbox Oficial (Moneda MXN)
  app.get('/api/payment/paypal-config', (_req, res) => {
    const { paypal } = getConfig();
    res.json({
      clientId: paypal.clientId,
      sandboxEmail: paypal.sandboxEmail,
      sandboxPassword: paypal.sandboxPassword,
      sandboxUrl: paypal.sandboxUrl,
      region: paypal.region,
      currency: paypal.currency,
      environment: paypal.environment
    });
  });

  // Cálculo seguro de carrito del lado servidor (RF-04, SEG-05)
  app.post('/api/cart/calculate', (req, res) => {
    const { items = [], cuponCodigo = '' } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío.' });
    }

    const db = getDb();
    const validatedItems = [];

    for (const item of items) {
      const prodId = Number(item.productoId || item.producto_id);
      const cantidad = Number(item.cantidad);
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        return res.status(400).json({ error: 'La cantidad de cada artículo debe ser un entero positivo (SEG-05).' });
      }

      // SEG-05: Siempre consultar precio y existencia desde la base de datos del servidor
      const prod = db.prepare(`
        SELECT c.id, c.sku, c.nombre, c.precio, c.imagen_url, i.stock_disponible
        FROM catalogo c
        JOIN inventario i ON i.producto_id = c.id
        WHERE c.id = ? AND c.activo = 1
      `).get(prodId);

      if (!prod) {
        return res.status(404).json({ error: `El producto con ID ${prodId} no existe o no está disponible.` });
      }
      if (prod.stock_disponible < cantidad) {
        return res.status(409).json({
          error: `Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stock_disponible}, solicitado: ${cantidad}.`
        });
      }

      validatedItems.push({
        productoId: prod.id,
        sku: prod.sku,
        nombre: prod.nombre,
        imagen_url: prod.imagen_url || '/assets/logo.png',
        cantidad,
        precio: prod.precio,
        subtotalItem: Number((prod.precio * cantidad).toFixed(2))
      });
    }

    let couponRow = null;
    if (cuponCodigo && String(cuponCodigo).trim()) {
      couponRow = db.prepare('SELECT * FROM cupones WHERE UPPER(codigo) = UPPER(?) AND activo = 1').get(String(cuponCodigo).trim());
      if (!couponRow) {
        return res.status(400).json({ error: `El cupón "${cuponCodigo}" no es válido o ha expirado.` });
      }
    }

    let isPremium = false;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : (req.headers['x-session-token'] || '').trim();
    if (token) {
      const sess = db.prepare(`
        SELECT u.membresia_premium, u.membresia_expira
        FROM sesiones s
        JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.token_id = ? AND s.revocada = 0 AND s.expira_en > ?
      `).get(token, Date.now());
      if (sess && sess.membresia_premium && (!sess.membresia_expira || new Date(sess.membresia_expira) > new Date())) {
        isPremium = true;
      }
    }

    const totals = calculateCartTotals(validatedItems, couponRow, isPremium);
    metricsState.cartCreatedCount += 1;

    res.json({
      items: validatedItems,
      ...totals,
      desgloseImpuestos: 'IVA 16% incluido en el cálculo final conforme a LFPC (NOR-09)'
    });
  });

  // Procesar Checkout en 3 pasos con idempotencia y tokenización PCI DSS (RF-05, RNF-11, SEG-06, SEG-07)
  app.post('/api/checkout', authenticateRequest, (req, res) => {
    const startCheckout = Date.now();
    const {
      items = [],
      cuponCodigo = '',
      direccionEnvio = '',
      metodoPago = 'tarjeta',
      cardNumber = '4111111111114242',
      cardHolder = '',
      expiry = '12/29',
      mesesSinIntereses = 1,
      idempotencyKey,
      pasosCheckout = 3,
      simulateTransientFailureCount = 0,
      simulateRejectedCard = false
    } = req.body || {};

    // RNF-11: El flujo de compra debe completarse en un máximo de 3 pasos
    if (Number(pasosCheckout) > 3) {
      return res.status(400).json({
        error: 'El flujo de checkout excede el máximo de 3 pasos permitido por el requisito de usabilidad RNF-11.'
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No se puede procesar un pedido sin artículos en el carrito.' });
    }
    if (!direccionEnvio || String(direccionEnvio).trim().length < 8) {
      return res.status(400).json({ error: 'Debe proporcionar una dirección de envío válida (mínimo 8 caracteres).' });
    }
    if (!['tarjeta', 'wallet', 'msi', 'paypal'].includes(metodoPago)) {
      return res.status(400).json({ error: 'Método de pago no soportado. Use tarjeta, wallet, msi o paypal.' });
    }

    const db = getDb();

    // Anti-replay / Idempotencia en transacciones de pago (Apartado 25 / SEG-06)
    const finalIdemKey = idempotencyKey || `idem_${req.user.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const existingTx = db.prepare('SELECT id, pedido_id, referencia_pasarela FROM transacciones WHERE idempotency_key = ?').get(finalIdemKey);
    if (existingTx) {
      return res.status(409).json({
        error: 'Transacción duplicada detectada (Protección Anti-Replay SEG-06 / Apartado 25).',
        pedidoId: existingTx.pedido_id,
        referenciaPasarela: existingTx.referencia_pasarela
      });
    }

    try {
      db.exec('BEGIN IMMEDIATE TRANSACTION;');

      const validatedItems = [];
      for (const item of items) {
        const prodId = Number(item.productoId || item.producto_id);
        const cantidad = Number(item.cantidad);
        if (!Number.isInteger(cantidad) || cantidad <= 0) {
          throw { status: 400, message: 'Cantidad inválida en artículos del pedido (SEG-05).' };
        }

        const prod = db.prepare(`
          SELECT c.id, c.sku, c.nombre, c.precio, i.stock_disponible
          FROM catalogo c
          JOIN inventario i ON i.producto_id = c.id
          WHERE c.id = ? AND c.activo = 1
        `).get(prodId);

        if (!prod) {
          throw { status: 404, message: `Producto ID ${prodId} no disponible.` };
        }
        if (prod.stock_disponible < cantidad) {
          throw {
            status: 409,
            message: `Sin stock suficiente para "${prod.nombre}" (Solicitado: ${cantidad}, Disponible: ${prod.stock_disponible}).`
          };
        }

        validatedItems.push({
          productoId: prod.id,
          nombre: prod.nombre,
          cantidad,
          precio: prod.precio,
          precioUnitario: prod.precio,
          subtotalItem: Number((prod.precio * cantidad).toFixed(2))
        });
      }

      let couponRow = null;
      if (cuponCodigo && String(cuponCodigo).trim()) {
        couponRow = db.prepare('SELECT * FROM cupones WHERE UPPER(codigo) = UPPER(?) AND activo = 1').get(String(cuponCodigo).trim());
        if (!couponRow) {
          throw { status: 400, message: `El cupón "${cuponCodigo}" no es válido.` };
        }
      }

      const isPremiumUser = Boolean(req.user.membresiaPremium);
      const totals = calculateCartTotals(validatedItems, couponRow, isPremiumUser);
      const totalDescuentoParaHash = totals.descuentoTotal !== undefined ? totals.descuentoTotal : Number((totals.descuento + (totals.cashback || 0)).toFixed(2));

      // RNF-09: Hash de integridad transaccional entre carrito y pasarela de pagos (ISO/IEC 25012)
      const hashIntegridad = computeOrderIntegrityHash({
        usuarioId: req.user.id,
        items: validatedItems,
        subtotal: totals.subtotal,
        impuestos: totals.impuestos,
        costoEnvio: totals.costoEnvio,
        descuento: totalDescuentoParaHash,
        total: totals.total
      });

      // Validación de saldo sobre tarjetas simuladas registradas (Sandbox / Pruebas de Compra)
      let matchedSimCard = null;
      if (['tarjeta', 'msi'].includes(metodoPago)) {
        const cleanCardNum = String(cardNumber || '').replace(/[\s-]/g, '');
        matchedSimCard = db.prepare(`
          SELECT * FROM tarjetas_simuladas 
          WHERE REPLACE(REPLACE(numero_tarjeta, ' ', ''), '-', '') = ? AND activa = 1
        `).get(cleanCardNum);

        if (matchedSimCard) {
          if (Number(matchedSimCard.saldo) < totals.total) {
            db.exec('ROLLBACK;');
            return res.status(400).json({
              error: `Saldo insuficiente en la tarjeta ${matchedSimCard.marca} (terminación ${matchedSimCard.numero_tarjeta.replace(/[\s-]/g, '').slice(-4)}). Saldo disponible: $${Number(matchedSimCard.saldo).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN. Total requerido: $${totals.total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN.`
            });
          }
        }
      }

      // Procesar cobro en Pasarela de Pagos PCI DSS (RF-05, SEG-07, RFC-0001)
      const paymentResult = processPaymentGateway({
        metodoPago,
        monto: totals.total,
        cardNumber,
        cardHolder: cardHolder || req.user.nombre,
        expiry,
        mesesSinIntereses,
        idempotencyKey: finalIdemKey,
        simulateTransientFailureCount: Number(simulateTransientFailureCount || 0),
        simulateRejectedCard: Boolean(simulateRejectedCard)
      });

      if (!paymentResult.success) {
        db.exec('ROLLBACK;');
        recordAuditLog(db, {
          usuarioId: req.user.id,
          rol: req.user.rol,
          accion: 'PAGO_RECHAZADO',
          modulo: 'Pagos (RF-05)',
          entidadId: finalIdemKey,
          ip: req.ip || '127.0.0.1',
          detalles: { motivo: paymentResult.motivo, intentos: paymentResult.intentosConexion }
        });
        return res.status(402).json({
          error: paymentResult.motivo,
          estadoPago: paymentResult.estado,
          intentosConexion: paymentResult.intentosConexion
        });
      }

      const now = new Date().toISOString();
      const folio = `EM-ORD-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

      // D3: Descontar stock en inventario
      const updateStock = db.prepare(`
        UPDATE inventario
        SET stock_disponible = stock_disponible - ?, updated_at = ?
        WHERE producto_id = ? AND stock_disponible >= ?
      `);
      for (const item of validatedItems) {
        const stRes = updateStock.run(item.cantidad, now, item.productoId, item.cantidad);
        if (stRes.changes === 0) {
          throw { status: 409, message: `Conflicto de concurrencia al reservar inventario de ${item.nombre}.` };
        }
      }

      // D4: Insertar pedido y sus artículos
      const orderInsert = db.prepare(`
        INSERT INTO pedidos (
          folio, usuario_id, subtotal, impuestos, costo_envio, descuento, cupon_codigo, total,
          estado, direccion_envio_cifrada, metodo_pago, pasos_checkout, hash_integridad, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pagado', ?, ?, ?, ?, ?, ?)
      `).run(
        folio,
        req.user.id,
        totals.subtotal,
        totals.impuestos,
        totals.costoEnvio,
        totalDescuentoParaHash,
        totals.cuponAplicado,
        totals.total,
        encryptData(direccionEnvio.trim()),
        metodoPago,
        Number(pasosCheckout),
        hashIntegridad,
        now,
        now
      );

      const pedidoId = Number(orderInsert.lastInsertRowid);
      const insertOrderItem = db.prepare(`
        INSERT INTO pedido_items (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const item of validatedItems) {
        insertOrderItem.run(pedidoId, item.productoId, item.nombre, item.cantidad, item.precioUnitario, item.subtotalItem);
      }

      // D5: Registrar transacción tokenizada PCI DSS
      db.prepare(`
        INSERT INTO transacciones (
          pedido_id, referencia_pasarela, proveedor_pasarela, metodo_pago, meses_sin_intereses,
          monto, moneda, tarjeta_enmascarada, token_pci, boveda_cifrada, idempotency_key,
          estado, intentos_conexion, latencia_ms, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'MXN', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        pedidoId,
        paymentResult.referenciaPasarela,
        paymentResult.proveedor,
        paymentResult.metodoPago,
        paymentResult.mesesSinIntereses,
        paymentResult.monto,
        paymentResult.tarjetaEnmascarada,
        paymentResult.tokenPci,
        paymentResult.bovedaCifrada,
        paymentResult.idempotencyKey,
        paymentResult.estado,
        paymentResult.intentosConexion,
        paymentResult.latenciaMs,
        now
      );

      // Descontar saldo de la tarjeta simulada si fue utilizada
      let nuevoSaldoSimCard = null;
      if (matchedSimCard) {
        nuevoSaldoSimCard = Number((matchedSimCard.saldo - totals.total).toFixed(2));
        db.prepare(`
          UPDATE tarjetas_simuladas 
          SET saldo = ?, updated_at = ? 
          WHERE id = ?
        `).run(nuevoSaldoSimCard, now, matchedSimCard.id);

        recordAuditLog(db, {
          usuarioId: req.user.id,
          rol: req.user.rol,
          accion: 'DESCUENTO_SALDO_TARJETA',
          modulo: 'Pagos (RF-05)',
          entidadId: String(matchedSimCard.id),
          ip: req.ip || '127.0.0.1',
          detalles: {
            tarjetaId: matchedSimCard.id,
            titular: matchedSimCard.titular,
            marca: matchedSimCard.marca,
            terminacion: matchedSimCard.numero_tarjeta.replace(/[\s-]/g, '').slice(-4),
            saldoAnterior: matchedSimCard.saldo,
            montoDescontado: totals.total,
            saldoNuevo: nuevoSaldoSimCard,
            pedidoFolio: folio
          }
        });
      }

      // D6: Generar guía de envío automática con proveedor de paquetería (OpenStreetMap)
      const envio = createShipmentGuide(db, { pedidoId, folioPedido: folio, direccionEnvio });

      // RF-09: Enviar notificación por correo electrónico al comprador
      const notificacion = sendUserNotification(db, {
        usuarioId: req.user.id,
        pedidoId,
        evento: 'PEDIDO_CONFIRMADO_Y_PAGADO',
        asunto: `Confirmación de Pedido ${folio} - ExpressMart`,
        mensaje: `Tu pedido ${folio} por $${totals.total.toFixed(2)} MXN ha sido pagado (${paymentResult.tarjetaEnmascarada}). Guía de rastreo: ${envio.numeroGuia}.`
      });

      // D8: Registrar en bitácora de auditoría
      recordAuditLog(db, {
        usuarioId: req.user.id,
        rol: req.user.rol,
        accion: 'CHECKOUT_COMPLETADO',
        modulo: 'Checkout y Pagos (RF-04/RF-05)',
        entidadId: folio,
        ip: req.ip || '127.0.0.1',
        detalles: {
          pedidoId,
          total: totals.total,
          hashIntegridad,
          referenciaPasarela: paymentResult.referenciaPasarela,
          numeroGuia: envio.numeroGuia
        }
      });

      db.exec('COMMIT;');

      const checkoutDurationMs = Math.max(5, Date.now() - startCheckout);
      recordLatency('checkout', checkoutDurationMs);
      metricsState.ordersCompletedCount += 1;

      return res.status(201).json({
        message: 'Pedido confirmado, pagado y guía de envío generada exitosamente.',
        responseTimeMs: checkoutDurationMs,
        withinSla: checkoutDurationMs <= 2000,
        order: {
          id: pedidoId,
          folio,
          estado: 'pagado',
          pasosCheckout: Number(pasosCheckout),
          ...totals,
          hashIntegridad,
          items: validatedItems,
          pago: {
            referenciaPasarela: paymentResult.referenciaPasarela,
            proveedor: paymentResult.proveedor,
            metodoPago: paymentResult.metodoPago,
            tarjetaEnmascarada: paymentResult.tarjetaEnmascarada,
            tokenPci: paymentResult.tokenPci,
            estado: paymentResult.estado,
            intentosConexion: paymentResult.intentosConexion,
            tarjetaSimulada: matchedSimCard ? {
              titular: matchedSimCard.titular,
              marca: matchedSimCard.marca,
              terminacion: matchedSimCard.numero_tarjeta.replace(/[\s-]/g, '').slice(-4),
              saldoAnterior: matchedSimCard.saldo,
              saldoNuevo: nuevoSaldoSimCard
            } : null
          },
          envio,
          notificacion
        }
      });
    } catch (err) {
      try {
        db.exec('ROLLBACK;');
      } catch (_) {
        // Ignorar si la transacción ya se cerró
      }
      if (err && err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      metricsState.totalErrors += 1;
      return res.status(500).json({ error: `Error al procesar el checkout: ${err.message}` });
    }
  });

  // =========================================================================
  // GESTIÓN DE TARJETAS SIMULADAS Y SALDOS DE COMPRA (PCI DSS / Sandbox Local)
  // =========================================================================

  // Listar tarjetas registradas con su saldo disponible
  app.get('/api/payments/simulated-cards', (_req, res) => {
    const db = getDb();
    const cards = db.prepare(`
      SELECT id, numero_tarjeta, titular, expiracion, cvv, saldo, saldo_inicial, marca, tipo, activa, created_at, updated_at
      FROM tarjetas_simuladas
      ORDER BY id ASC
    `).all();
    res.json(cards);
  });

  // Registrar nueva tarjeta con saldo asignado para simular compras
  app.post('/api/payments/simulated-cards', (req, res) => {
    const {
      numeroTarjeta,
      titular,
      expiracion = '12/29',
      cvv = '123',
      saldo = 10000,
      marca = 'Visa',
      tipo = 'credito'
    } = req.body || {};

    if (!numeroTarjeta || String(numeroTarjeta).trim().length < 12) {
      return res.status(400).json({ error: 'Número de tarjeta inválido (mínimo 12 caracteres).' });
    }
    if (!titular || String(titular).trim().length < 3) {
      return res.status(400).json({ error: 'Debe ingresar el nombre del titular (mínimo 3 caracteres).' });
    }

    const cleanCard = String(numeroTarjeta).trim();
    const montoSaldo = Math.max(0, Number(saldo) || 0);
    const db = getDb();
    const now = new Date().toISOString();

    try {
      const result = db.prepare(`
        INSERT INTO tarjetas_simuladas (
          numero_tarjeta, titular, expiracion, cvv, saldo, saldo_inicial, marca, tipo, activa, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        cleanCard,
        String(titular).trim().toUpperCase(),
        String(expiracion || '12/29').trim(),
        String(cvv || '123').trim(),
        montoSaldo,
        montoSaldo,
        String(marca || 'Visa').trim(),
        String(tipo || 'credito').trim(),
        now,
        now
      );

      recordAuditLog(db, {
        usuarioId: req.user ? req.user.id : null,
        rol: req.user ? req.user.rol : 'administrador',
        accion: 'REGISTRO_TARJETA_SIMULADA',
        modulo: 'Simulador de Pagos (RF-05)',
        entidadId: String(result.lastInsertRowid),
        detalles: {
          numero_tarjeta_enmascarado: cleanCard.replace(/\d(?=\d{4})/g, '*'),
          titular: String(titular).trim().toUpperCase(),
          saldoInicial: montoSaldo,
          marca
        }
      });

      res.status(201).json({
        message: 'Tarjeta registrada exitosamente con saldo asignado para compras.',
        cardId: Number(result.lastInsertRowid),
        saldo: montoSaldo
      });
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Este número de tarjeta ya se encuentra registrado.' });
      }
      return res.status(500).json({ error: `Error al registrar tarjeta: ${err.message}` });
    }
  });

  // Recargar saldo a una tarjeta simulada
  app.post('/api/payments/simulated-cards/:id/recharge', (req, res) => {
    const cardId = Number(req.params.id);
    const { monto } = req.body || {};
    const rechargeAmount = Number(monto);
    if (!Number.isFinite(rechargeAmount) || rechargeAmount <= 0) {
      return res.status(400).json({ error: 'El monto de recarga debe ser mayor a 0.' });
    }

    const db = getDb();
    const card = db.prepare('SELECT * FROM tarjetas_simuladas WHERE id = ?').get(cardId);
    if (!card) {
      return res.status(404).json({ error: `Tarjeta simulada #${cardId} no encontrada.` });
    }

    const now = new Date().toISOString();
    const nuevoSaldo = Number((card.saldo + rechargeAmount).toFixed(2));
    db.prepare('UPDATE tarjetas_simuladas SET saldo = ?, updated_at = ? WHERE id = ?').run(nuevoSaldo, now, cardId);

    recordAuditLog(db, {
      usuarioId: req.user ? req.user.id : null,
      rol: req.user ? req.user.rol : 'administrador',
      accion: 'RECARGA_SALDO_TARJETA',
      modulo: 'Simulador de Pagos (RF-05)',
      entidadId: String(cardId),
      detalles: {
        tarjetaId: cardId,
        saldoAnterior: card.saldo,
        montoRecargado: rechargeAmount,
        nuevoSaldo
      }
    });

    res.json({
      message: `Recarga aplicada exitosamente. Nuevo saldo disponible: $${nuevoSaldo.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`,
      cardId,
      saldoAnterior: card.saldo,
      nuevoSaldo
    });
  });

  // Alternar estado activo / bloqueado de una tarjeta
  app.patch('/api/payments/simulated-cards/:id/status', (req, res) => {
    const cardId = Number(req.params.id);
    const { activa } = req.body || {};
    const db = getDb();
    const card = db.prepare('SELECT * FROM tarjetas_simuladas WHERE id = ?').get(cardId);
    if (!card) {
      return res.status(404).json({ error: `Tarjeta #${cardId} no encontrada.` });
    }
    const nuevoEstado = activa !== undefined ? (activa ? 1 : 0) : (card.activa ? 0 : 1);
    const now = new Date().toISOString();
    db.prepare('UPDATE tarjetas_simuladas SET activa = ?, updated_at = ? WHERE id = ?').run(nuevoEstado, now, cardId);

    res.json({
      message: `Tarjeta ${nuevoEstado ? 'activada' : 'desactivada'} correctamente.`,
      cardId,
      activa: Boolean(nuevoEstado)
    });
  });
}

module.exports = {
  registerCheckoutRoutes
};
