/**
 * Rutas de Catálogo, Productos, Inventario, Reseñas y Contingencia de Recomendaciones
 * RF-03, RF-06, RF-08, RNF-05, DEV-02, DEV-03, DEV-08, ISO/IEC 25012
 */

const { getDb, recordAuditLog } = require('../db/database');
const { recordLatency, authenticateRequest, requireRoles } = require('../middleware/security');
const { isPositiveNumber } = require('../utils/sanitizer');
const {
  getProductRecommendations,
  setRecommendationsServiceHealth,
  getRecommendationsServiceHealth
} = require('../services/externalProviders');

function registerCatalogRoutes(app) {
  // =========================================================================
  // PROCESO 2 (DFD): CATÁLOGO, BÚSQUEDA E INVENTARIO (RF-03, RF-06, DEV-02, DEV-03, DEV-08)
  // =========================================================================
  app.get('/api/products', (req, res) => {
    const start = Date.now();
    const { q = '', categoria = '', marca = '', minPrecio, maxPrecio, orden = '' } = req.query || {};
    const db = getDb();

    let sql = `
      SELECT c.*, i.stock_disponible, i.stock_reservado, i.ubicacion_almacen,
             COALESCE((SELECT ROUND(AVG(r.calificacion), 1) FROM resenas r WHERE r.producto_id = c.id), 5.0) AS calificacion_promedio,
             (SELECT COUNT(*) FROM resenas r WHERE r.producto_id = c.id) AS total_resenas
      FROM catalogo c
      LEFT JOIN inventario i ON i.producto_id = c.id
      WHERE c.activo = 1
    `;
    const params = [];

    if (q && String(q).trim()) {
      sql += ' AND (LOWER(c.nombre) LIKE LOWER(?) OR LOWER(c.descripcion) LIKE LOWER(?) OR LOWER(c.marca) LIKE LOWER(?))';
      const term = `%${String(q).trim()}%`;
      params.push(term, term, term);
    }
    if (categoria && String(categoria).trim()) {
      sql += ' AND LOWER(c.categoria) = LOWER(?)';
      params.push(String(categoria).trim());
    }
    if (marca && String(marca).trim()) {
      sql += ' AND LOWER(c.marca) = LOWER(?)';
      params.push(String(marca).trim());
    }
    if (minPrecio !== undefined && minPrecio !== '') {
      sql += ' AND c.precio >= ?';
      params.push(Number(minPrecio));
    }
    if (maxPrecio !== undefined && maxPrecio !== '') {
      sql += ' AND c.precio <= ?';
      params.push(Number(maxPrecio));
    }

    if (orden === 'precio_asc') {
      sql += ' ORDER BY c.precio ASC';
    } else if (orden === 'precio_desc') {
      sql += ' ORDER BY c.precio DESC';
    } else {
      sql += ' ORDER BY c.id ASC';
    }

    const rows = db.prepare(sql).all(...params).map((r) => ({
      ...r,
      especificaciones: JSON.parse(r.especificaciones_json || '{}')
    }));

    const recommendations = getProductRecommendations(db, categoria || null);
    const responseTimeMs = Math.max(1, Date.now() - start);
    recordLatency('search', responseTimeMs);

    res.json({
      responseTimeMs,
      slaTargetMs: 2000,
      withinSla: responseTimeMs < 2000,
      total: rows.length,
      products: rows,
      recommendations
    });
  });

  app.get('/api/products/:id', (req, res) => {
    const db = getDb();
    const param = req.params.id;
    const isNum = /^\d+$/.test(param);
    const product = isNum
      ? db.prepare(`
          SELECT c.*, i.stock_disponible, i.stock_reservado, i.ubicacion_almacen
          FROM catalogo c
          LEFT JOIN inventario i ON i.producto_id = c.id
          WHERE c.id = ? OR c.sku = ?
        `).get(Number(param), param)
      : db.prepare(`
          SELECT c.*, i.stock_disponible, i.stock_reservado, i.ubicacion_almacen
          FROM catalogo c
          LEFT JOIN inventario i ON i.producto_id = c.id
          WHERE c.sku = ?
        `).get(param);

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado en el catálogo.' });
    }

    const reviews = db.prepare(`
      SELECT r.id, r.calificacion, r.comentario, r.verificada, r.created_at, u.nombre as autor
      FROM resenas r
      JOIN usuarios u ON u.id = r.usuario_id
      WHERE r.producto_id = ? AND r.moderada = 1
      ORDER BY r.id DESC
    `).all(product.id);

    res.json({
      ...product,
      especificaciones: JSON.parse(product.especificaciones_json || '{}'),
      reviews
    });
  });

  // Alta de producto (RF-06, SEG-04, ISO/IEC 25012 Completitud)
  app.post('/api/products', authenticateRequest, requireRoles('administrador', 'vendedor'), (req, res) => {
    const {
      sku,
      nombre,
      descripcion,
      categoria,
      marca,
      precio,
      imagen_url = '/assets/logo.png',
      especificaciones = {},
      condiciones_envio,
      stock = 0
    } = req.body || {};

    // Verificación de completitud ISO/IEC 25012 (Apartado 19)
    if (!sku || !nombre || !descripcion || !categoria || !marca || !condiciones_envio) {
      return res.status(400).json({
        error: 'Checklist de publicación incompleto (ISO/IEC 25012): sku, nombre, descripcion, categoria, marca y condiciones_envio son obligatorios.'
      });
    }
    if (!isPositiveNumber(precio) || Number(precio) <= 0) {
      return res.status(400).json({ error: 'El precio del producto debe ser un número positivo mayor a 0.' });
    }
    if (!isPositiveNumber(stock)) {
      return res.status(400).json({ error: 'El stock inicial no puede ser negativo.' });
    }

    const db = getDb();
    const existingSku = db.prepare('SELECT id FROM catalogo WHERE LOWER(sku) = LOWER(?)').get(String(sku).trim());
    if (existingSku) {
      return res.status(409).json({ error: 'El SKU especificado ya existe en el catálogo.' });
    }

    const now = new Date().toISOString();
    const specStr = typeof especificaciones === 'string' ? especificaciones : JSON.stringify(especificaciones);

    const insertRes = db.prepare(`
      INSERT INTO catalogo (sku, nombre, descripcion, categoria, marca, precio, imagen_url, especificaciones_json, condiciones_envio, vendedor_id, activo, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      String(sku).trim().toUpperCase(),
      String(nombre).trim(),
      String(descripcion).trim(),
      String(categoria).trim(),
      String(marca).trim(),
      Number(precio),
      String(imagen_url).trim(),
      specStr,
      String(condiciones_envio).trim(),
      req.user.id,
      now,
      now
    );

    const productId = Number(insertRes.lastInsertRowid);
    db.prepare(`
      INSERT INTO inventario (producto_id, stock_disponible, stock_reservado, ubicacion_almacen, ultima_conciliacion, updated_at)
      VALUES (?, ?, 0, 'CEDIS-CDMX-NORTE', ?, ?)
    `).run(productId, Number(stock), now, now);

    recordAuditLog(db, {
      usuarioId: req.user.id,
      rol: req.user.rol,
      accion: 'ALTA_PRODUCTO_CATALOGO',
      modulo: 'Catálogo e Inventario (RF-06)',
      entidadId: productId,
      ip: req.ip || '127.0.0.1',
      detalles: { sku, nombre, precio: Number(precio), stock: Number(stock) }
    });

    res.status(201).json({
      message: 'Producto registrado y publicado en catálogo con inventario inicial.',
      productId,
      sku: String(sku).trim().toUpperCase()
    });
  });

  // Edición de producto e inventario (RF-06, SEG-04)
  app.put('/api/products/:id', authenticateRequest, requireRoles('administrador', 'vendedor'), (req, res) => {
    const productId = Number(req.params.id);
    const { nombre, descripcion, categoria, marca, precio, stock, condiciones_envio, activo } = req.body || {};
    const db = getDb();

    const current = db.prepare('SELECT * FROM catalogo WHERE id = ?').get(productId);
    if (!current) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    if (precio !== undefined && (!isPositiveNumber(precio) || Number(precio) <= 0)) {
      return res.status(400).json({ error: 'El precio debe ser mayor a 0.' });
    }
    if (stock !== undefined && !isPositiveNumber(stock)) {
      return res.status(400).json({ error: 'El stock no puede ser negativo.' });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE catalogo
      SET nombre = ?, descripcion = ?, categoria = ?, marca = ?, precio = ?, condiciones_envio = ?, activo = ?, updated_at = ?
      WHERE id = ?
    `).run(
      nombre !== undefined ? String(nombre).trim() : current.nombre,
      descripcion !== undefined ? String(descripcion).trim() : current.descripcion,
      categoria !== undefined ? String(categoria).trim() : current.categoria,
      marca !== undefined ? String(marca).trim() : current.marca,
      precio !== undefined ? Number(precio) : current.precio,
      condiciones_envio !== undefined ? String(condiciones_envio).trim() : current.condiciones_envio,
      activo !== undefined ? (activo ? 1 : 0) : current.activo,
      now,
      productId
    );

    if (stock !== undefined) {
      db.prepare(`
        UPDATE inventario SET stock_disponible = ?, ultima_conciliacion = ?, updated_at = ? WHERE producto_id = ?
      `).run(Number(stock), now, now, productId);
    }

    recordAuditLog(db, {
      usuarioId: req.user.id,
      rol: req.user.rol,
      accion: 'ACTUALIZACION_PRODUCTO_INVENTARIO',
      modulo: 'Catálogo e Inventario (RF-06)',
      entidadId: productId,
      ip: req.ip || '127.0.0.1',
      detalles: { precio, stock, activo }
    });

    res.json({ message: 'Producto e inventario actualizados correctamente.', productId });
  });

  // Alta de reseña (RF-08)
  app.post('/api/products/:id/reviews', authenticateRequest, (req, res) => {
    const productoId = Number(req.params.id);
    const { calificacion, comentario } = req.body || {};
    const ratingNum = Number(calificacion);

    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'La calificación debe ser un número entero entre 1 y 5 estrellas (RF-08).' });
    }
    if (!comentario || String(comentario).trim().length < 5) {
      return res.status(400).json({ error: 'El comentario de la reseña debe contener al menos 5 caracteres.' });
    }

    const db = getDb();
    const prod = db.prepare('SELECT id, nombre FROM catalogo WHERE id = ?').get(productoId);
    if (!prod) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const purchased = db.prepare(`
      SELECT p.id FROM pedidos p
      JOIN pedido_items pi ON pi.pedido_id = p.id
      WHERE p.usuario_id = ? AND pi.producto_id = ? AND p.estado != 'cancelado'
      LIMIT 1
    `).get(req.user.id, productoId);

    const now = new Date().toISOString();
    const insertRev = db.prepare(`
      INSERT INTO resenas (producto_id, usuario_id, pedido_id, calificacion, comentario, verificada, moderada, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(productoId, req.user.id, purchased ? purchased.id : null, ratingNum, String(comentario).trim(), purchased ? 1 : 0, now);

    recordAuditLog(db, {
      usuarioId: req.user.id,
      rol: req.user.rol,
      accion: 'ALTA_RESENA_PRODUCTO',
      modulo: 'Reseñas (RF-08)',
      entidadId: insertRev.lastInsertRowid,
      detalles: { productoId, calificacion: ratingNum, compraVerificada: Boolean(purchased) }
    });

    res.status(201).json({
      message: 'Reseña registrada exitosamente.',
      reviewId: Number(insertRev.lastInsertRowid),
      compraVerificada: Boolean(purchased)
    });
  });

  // Simulador de Contingencia del Servicio de Recomendaciones (RNF-05, Apartado 34.2)
  app.post('/api/admin/contingency/recommendations', authenticateRequest, requireRoles('administrador', 'auditor'), (req, res) => {
    const { healthy } = req.body || {};
    setRecommendationsServiceHealth(Boolean(healthy));
    const db = getDb();
    recordAuditLog(db, {
      usuarioId: req.user.id,
      rol: req.user.rol,
      accion: 'SIMULACRO_CONTINGENCIA_RNF05',
      modulo: 'Continuidad y Fiabilidad (Apartado 34.2)',
      entidadId: 'recommendations-service',
      detalles: { healthy: Boolean(healthy) }
    });
    res.json({
      recommendationsServiceHealthy: getRecommendationsServiceHealth(),
      message: healthy
        ? 'Servicio de recomendaciones restablecido.'
        : 'Simulacro activado: Servicio de recomendaciones apagado; el catálogo y el checkout continúan operando con normalidad (RNF-05).'
    });
  });
}

module.exports = {
  registerCatalogRoutes
};
