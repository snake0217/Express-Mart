/**
 * Validación, Sanitización y Codificación de Entradas (Apartados 18, 25, OWASP ASVS / Top 10, SEG-11)
 * Previene ataques de Cross-Site Scripting (XSS), inyección de comandos y manipulación de parámetros.
 */

const DANGEROUS_PATTERNS = [
  /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
  /javascript\s*:/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
  /(\bUNION\b\s+\bSELECT\b|\bDROP\b\s+\bTABLE\b|--\s*$|;\s*\bDROP\b)/i
];

function sanitizeString(input, maxLength = 500) {
  if (input === null || input === undefined) return '';
  let str = String(input).trim();
  if (str.length > maxLength) {
    str = str.slice(0, maxLength);
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function containsMaliciousPayload(input) {
  if (typeof input !== 'string') return false;
  return DANGEROUS_PATTERNS.some((regex) => regex.test(input));
}

function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (Array.isArray(obj)) return obj.map((item) => sanitizeObject(item));
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      // No escapar contraseñas pero sí validar su longitud
      if (k.toLowerCase().includes('password') || k === 'contrasena') {
        out[k] = typeof v === 'string' ? v.slice(0, 128) : v;
      } else {
        out[k] = sanitizeObject(v);
      }
    }
    return out;
  }
  return obj;
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isPositiveNumber(val) {
  const num = Number(val);
  return Number.isFinite(num) && num >= 0;
}

module.exports = {
  sanitizeString,
  containsMaliciousPayload,
  sanitizeObject,
  isValidEmail,
  isPositiveNumber
};
