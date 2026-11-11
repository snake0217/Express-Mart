/**
 * Registro de Auditoría Inmutable Encadenado por SHA-256 (D8 / SEG-15)
 */

const { computeAuditChainHash } = require('../utils/crypto');

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
  recordAuditLog
};
