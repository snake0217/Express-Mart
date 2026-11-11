/**
 * Capa de Persistencia y Almacenes de Datos DFD Nivel 1 (Apartados 13, 18, 19, ISO/IEC 25012, SEG-08)
 * Implementa consultas parametrizadas estrictas sobre SQLite (node:sqlite) y modela los 8 almacenes del DFD Nivel 1:
 *  - D1: Usuarios (roles: cliente, vendedor, administrador, soporte, auditor + MFA + LFPDPPP)
 *  - D2: Catálogo (productos con completitud verificada: imagen, especificaciones, condiciones de envío)
 *  - D3: Inventario (control de existencias disponible, reservado y conciliación)
 *  - D4: Pedidos (pedidos + detalle de artículos + hash de integridad SHA-256)
 *  - D5: Transacciones (pagos tokenizados PCI DSS + llave de idempotencia)
 *  - D6: Envíos (guías de paquetería, rastreo y devoluciones)
 *  - D7: Reseñas (calificaciones verificadas de clientes)
 *  - D8: Bitácora de auditoría (registro inmutable encadenado por SHA-256)
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { getConfig } = require('../config/env');
const { computeAuditChainHash } = require('../utils/crypto');
const {
  ensureWarehousesTable,
  ensureShipmentsTableExtended
} = require('../services/logisticsService');
const { createAllTables } = require('./schema');
const { catalogDataset } = require('./seedCatalog');
const {
  seedDatabaseIfEmpty,
  syncCatalogAndReviews,
  seedSimulatedCardsIfEmpty,
  seedRefundRequestsIfEmpty
} = require('./seedData');

let dbInstance = null;

function initDatabase(customPath) {
  const config = getConfig();
  const targetPath = customPath || config.dbPath;

  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(targetPath);
  db.exec('PRAGMA foreign_keys = ON;');
  if (targetPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
  }

  createAllTables(db);

  dbInstance = db;
  seedDatabaseIfEmpty(db);
  seedSimulatedCardsIfEmpty(db);
  seedRefundRequestsIfEmpty(db);
  ensureWarehousesTable(db);
  ensureShipmentsTableExtended(db);
  syncCatalogAndReviews(db);
  return db;
}

function getDb() {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

function recordAuditLog(db, { usuarioId = null, rol = 'sistema', accion, modulo, entidadId = '', ip = '127.0.0.1', detalles = {} }) {
  const lastRow = db.prepare('SELECT hash_cadena FROM bitacora_auditoria ORDER BY id DESC LIMIT 1').get();
  const prevHash = lastRow ? lastRow.hash_cadena : 'GENESIS_EXPRESSMART_MC001';
  const timestamp = new Date().toISOString();
  const detallesJson = JSON.stringify(detalles);
  const hashCadena = computeAuditChainHash(prevHash, {
    timestamp,
    usuario_id: usuarioId,
    rol,
    accion,
    modulo,
    detalles_json: detallesJson
  });

  db.prepare(`
    INSERT INTO bitacora_auditoria (timestamp, usuario_id, rol, accion, modulo, entidad_id, ip, detalles_json, prev_hash, hash_cadena)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(timestamp, usuarioId, rol, accion, modulo, String(entidadId), ip, detallesJson, prevHash, hashCadena);

  return hashCadena;
}

module.exports = {
  initDatabase,
  getDb,
  recordAuditLog,
  catalogDataset
};
