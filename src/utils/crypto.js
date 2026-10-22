/**
 * Controles Criptográficos y de Seguridad de Datos (Apartados 18, 19, RNF-03, RNF-09, PCI DSS, LFPDPPP)
 * - Cifrado en reposo AES-256-GCM para datos personales (LFPDPPP) y referencias de pago (PCI DSS).
 * - Hash de contraseñas con scrypt + salt aleatorio (OWASP ASVS / SEG-01).
 * - Generación y verificación de códigos MFA/TOTP (RF-02 / SEG-01 / SEG-12).
 * - Tokenización de tarjetas conforme a PCI DSS (nunca almacena PAN completo ni CVV).
 * - Hash de integridad transaccional SHA-256 (ISO/IEC 25012 / RNF-09) y cadena de auditoría (SEG-15).
 */

const crypto = require('node:crypto');
const { getConfig } = require('../config/env');

function deriveKey(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Cifra texto sensible en reposo con AES-256-GCM (RNF-03, Apartado 18.2)
 */
function encryptData(plainText) {
  if (plainText === null || plainText === undefined || plainText === '') return '';
  const { encryptionKey } = getConfig();
  const key = deriveKey(encryptionKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Descifra texto cifrado con AES-256-GCM
 */
function decryptData(cipherText) {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.startsWith('enc:v1:')) {
    return cipherText || '';
  }
  const parts = cipherText.split(':');
  if (parts.length !== 5) {
    throw new Error('Formato de texto cifrado inválido');
  }
  const [, , ivHex, tagHex, dataHex] = parts;
  const { encryptionKey } = getConfig();
  const key = deriveKey(encryptionKey);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

/**
 * Valida fortaleza de contraseña según OWASP ASVS y SEG-01
 * Mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un carácter especial.
 */
function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return { valid: false, reason: 'La contraseña debe tener al menos 8 caracteres.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: 'La contraseña debe incluir al menos una letra mayúscula.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, reason: 'La contraseña debe incluir al menos una letra minúscula.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'La contraseña debe incluir al menos un número.' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, reason: 'La contraseña debe incluir al menos un carácter especial.' };
  }
  return { valid: true };
}

/**
 * Hash seguro de contraseña con scrypt y salt aleatorio
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

/**
 * Verificación de contraseña en tiempo constante
 */
function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string' || !storedHash.startsWith('scrypt:')) {
    return false;
  }
  const [, salt, hashHex] = storedHash.split(':');
  const derived = crypto.scryptSync(String(password), salt, 64);
  const storedBuf = Buffer.from(hashHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

/**
 * Genera secreto MFA y calcula código TOTP de 6 dígitos (RF-02, SEG-01, SEG-12)
 */
function generateMfaSecret() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

function generateTotpCode(mfaSecret, windowOffset = 0) {
  const timeStep = Math.floor(Date.now() / 30000) + windowOffset;
  const hmac = crypto.createHmac('sha256', String(mfaSecret)).update(String(timeStep)).digest('hex');
  const num = parseInt(hmac.slice(-6), 16) % 1000000;
  return String(num).padStart(6, '0');
}

function verifyTotpCode(mfaSecret, code) {
  if (!mfaSecret || !code) return false;
  const cleanCode = String(code).trim();
  for (const offset of [-1, 0, 1]) {
    if (generateTotpCode(mfaSecret, offset) === cleanCode) {
      return true;
    }
  }
  return false;
}

/**
 * Tokenización de tarjeta conforme a PCI DSS (NOR-06, SEG-07)
 * Nunca guarda el PAN completo ni el CVV; devuelve últimos 4 dígitos enmascarados y token cifrado.
 */
function tokenizeCard(cardNumber, cardHolder, expiry) {
  const digits = String(cardNumber || '').replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) {
    throw new Error('Número de tarjeta inválido para tokenización PCI DSS');
  }
  const last4 = digits.slice(-4);
  const brand = digits.startsWith('4')
    ? 'VISA'
    : digits.startsWith('5')
      ? 'MASTERCARD'
      : digits.startsWith('3')
        ? 'AMEX'
        : 'CARD';
  const rawTokenPayload = JSON.stringify({
    brand,
    last4,
    holder: String(cardHolder || 'TITULAR').trim().toUpperCase(),
    expiry: String(expiry || '12/28'),
    nonce: crypto.randomBytes(8).toString('hex')
  });
  const encryptedToken = encryptData(rawTokenPayload);
  return {
    token: `tok_pci_${crypto.createHash('sha256').update(encryptedToken).digest('hex').slice(0, 24)}`,
    maskedPan: `**** **** **** ${last4}`,
    brand,
    last4,
    vaultReference: encryptedToken
  };
}

/**
 * Calcula firma de integridad transaccional SHA-256 (ISO/IEC 25012, RNF-09)
 * Garantiza que los datos del pedido no sufran alteraciones entre el carrito y la pasarela de pagos.
 */
function computeOrderIntegrityHash({ usuarioId, items, subtotal, impuestos, costoEnvio, descuento, total }) {
  const canonicalItems = (items || [])
    .map((i) => `${i.producto_id || i.productoId}:${i.cantidad}:${Number(i.precio_unitario ?? i.precioUnitario).toFixed(2)}`)
    .sort()
    .join('|');
  const payload = [
    String(usuarioId),
    canonicalItems,
    Number(subtotal).toFixed(2),
    Number(impuestos).toFixed(2),
    Number(costoEnvio).toFixed(2),
    Number(descuento).toFixed(2),
    Number(total).toFixed(2)
  ].join('::');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Calcula hash encadenado para la bitácora de auditoría inmutable (SEG-15)
 */
function computeAuditChainHash(prevHash, entry) {
  const data = `${prevHash || 'GENESIS'}|${entry.timestamp}|${entry.usuario_id || 0}|${entry.rol || 'anon'}|${entry.accion}|${entry.modulo}|${entry.detalles_json || ''}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = {
  encryptData,
  decryptData,
  validatePasswordStrength,
  hashPassword,
  verifyPassword,
  generateMfaSecret,
  generateTotpCode,
  verifyTotpCode,
  tokenizeCard,
  computeOrderIntegrityHash,
  computeAuditChainHash
};
