/**
 * Suite de Pruebas Unitarias Automatizadas (Apartado 21.1 y RNF-04 >= 80% cobertura)
 */

const { getConfig, ENVIRONMENTS } = require('../src/config/env');
const {
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
} = require('../src/utils/crypto');
const {
  sanitizeString,
  containsMaliciousPayload,
  sanitizeObject,
  isValidEmail,
  isPositiveNumber
} = require('../src/utils/sanitizer');
const { calculateCartTotals } = require('../src/app');
const { processPaymentGateway } = require('../src/services/externalProviders');

describe('Pruebas Unitarias - Configuración, Criptografía, Sanitización y Reglas de Negocio', () => {
  test('1. Configuración de ambientes (Apartado 20)', () => {
    const cfg = getConfig();
    expect(cfg.version).toBe('1.0.0');
    expect(ENVIRONMENTS).toHaveProperty('development');
    expect(ENVIRONMENTS).toHaveProperty('test');
    expect(ENVIRONMENTS).toHaveProperty('staging');
    expect(ENVIRONMENTS).toHaveProperty('production');
    expect(cfg.paymentGateway.timeoutMs).toBe(30000);
    expect(cfg.paymentGateway.maxRetries).toBe(3);
  });

  test('2. Cifrado y descifrado AES-256-GCM en reposo (RNF-03 / Apartado 18.2)', () => {
    const original = 'Av. Insurgentes Sur 1602, CDMX';
    const encrypted = encryptData(original);
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain('Insurgentes');
    expect(decryptData(encrypted)).toBe(original);
    expect(encryptData('')).toBe('');
    expect(decryptData('texto-plano')).toBe('texto-plano');
    expect(() => decryptData('enc:v1:malformed')).toThrow();
  });

  test('3. Fortaleza y hash de contraseñas con scrypt (OWASP ASVS / SEG-01)', () => {
    expect(validatePasswordStrength('corta').valid).toBe(false);
    expect(validatePasswordStrength('sinmayuscula1!').valid).toBe(false);
    expect(validatePasswordStrength('SINMINUSCULA1!').valid).toBe(false);
    expect(validatePasswordStrength('SinNumeros!!').valid).toBe(false);
    expect(validatePasswordStrength('SinSimbolos123').valid).toBe(false);
    expect(validatePasswordStrength('Segura2026!').valid).toBe(true);

    const hash = hashPassword('Segura2026!');
    expect(verifyPassword('Segura2026!', hash)).toBe(true);
    expect(verifyPassword('Incorrecta2026!', hash)).toBe(false);
    expect(verifyPassword('Segura2026!', 'invalido')).toBe(false);
  });

  test('4. Generación y verificación de códigos MFA TOTP (RF-02 / SEG-12)', () => {
    const secret = generateMfaSecret();
    expect(secret).toHaveLength(32);
    const code = generateTotpCode(secret);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotpCode(secret, code)).toBe(true);
    expect(verifyTotpCode(secret, '000000')).toBe(code === '000000');
    expect(verifyTotpCode('', code)).toBe(false);
  });

  test('5. Tokenización de tarjetas conforme a PCI DSS (NOR-06 / SEG-07)', () => {
    const tokVisa = tokenizeCard('4111 1111 1111 4242', 'Diego Alarcon', '12/29');
    expect(tokVisa.brand).toBe('VISA');
    expect(tokVisa.maskedPan).toBe('**** **** **** 4242');
    expect(tokVisa.token).toMatch(/^tok_pci_/);
    expect(tokVisa.vaultReference).toMatch(/^enc:v1:/);

    const tokMaster = tokenizeCard('5500000000001234', 'Carlos Adair', '10/28');
    expect(tokMaster.brand).toBe('MASTERCARD');

    const tokAmex = tokenizeCard('378282246310005', 'Cristopher Erik', '08/29');
    expect(tokAmex.brand).toBe('AMEX');

    expect(() => tokenizeCard('12345', 'Test', '12/28')).toThrow();
  });

  test('6. Hash de integridad transaccional SHA-256 (ISO/IEC 25012 / RNF-09) y cadena de auditoría (SEG-15)', () => {
    const h1 = computeOrderIntegrityHash({
      usuarioId: 3,
      items: [{ productoId: 1, cantidad: 2, precioUnitario: 1000 }],
      subtotal: 2000,
      impuestos: 320,
      costoEnvio: 0,
      descuento: 0,
      total: 2320
    });
    const h2 = computeOrderIntegrityHash({
      usuarioId: 3,
      items: [{ productoId: 1, cantidad: 2, precioUnitario: 1000 }],
      subtotal: 2000,
      impuestos: 320,
      costoEnvio: 0,
      descuento: 0,
      total: 2320
    });
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);

    const auditHash = computeAuditChainHash('GENESIS', {
      timestamp: '2026-10-21T00:00:00Z',
      usuario_id: 1,
      rol: 'administrador',
      accion: 'TEST',
      modulo: 'Unit',
      detalles_json: '{}'
    });
    expect(auditHash).toHaveLength(64);
  });

  test('7. Sanitización de entradas y detección de XSS / SQLi (SEG-11)', () => {
    expect(sanitizeString('<script>alert("xss")</script>')).toContain('&lt;script&gt;');
    expect(containsMaliciousPayload('<script>alert(1)</script>')).toBe(true);
    expect(containsMaliciousPayload("1' UNION SELECT * FROM usuarios --")).toBe(true);
    expect(containsMaliciousPayload('Laptop ProBook 14')).toBe(false);

    const cleanObj = sanitizeObject({
      nombre: '<b>Juan</b>',
      password: '<script>no-alterar-password</script>',
      lista: ['<i>item</i>']
    });
    expect(cleanObj.nombre).toBe('&lt;b&gt;Juan&lt;/b&gt;');
    expect(cleanObj.password).toBe('<script>no-alterar-password</script>');
    expect(cleanObj.lista[0]).toBe('&lt;i&gt;item&lt;/i&gt;');

    const longBase64 = 'data:image/png;base64,' + 'A'.repeat(1500);
    const photoObj = sanitizeObject({
      fotoPerfil: longBase64,
      avatar: 'https://lh3.googleusercontent.com/test.png'
    });
    expect(photoObj.fotoPerfil).toBe(longBase64);
    expect(photoObj.avatar).toBe('https://lh3.googleusercontent.com/test.png');

    expect(isValidEmail('cliente@expressmart.mx')).toBe(true);
    expect(isValidEmail('correo-invalido')).toBe(false);
    expect(isPositiveNumber(150)).toBe(true);
    expect(isPositiveNumber(-5)).toBe(false);
  });

  test('8. Cálculo de carrito, impuestos, envío y cupones (RF-04)', () => {
    // Pedido menor a $999 cobra envío de $99
    const calcSmall = calculateCartTotals([{ cantidad: 1, precio: 500 }], null);
    expect(calcSmall.subtotal).toBe(500);
    expect(calcSmall.impuestos).toBe(80);
    expect(calcSmall.costoEnvio).toBe(99);
    expect(calcSmall.total).toBe(679);

    // Cupón de porcentaje BIENVENIDA10 (10%)
    const calcPct = calculateCartTotals(
      [{ cantidad: 2, precio: 1000 }],
      { codigo: 'BIENVENIDA10', tipo: 'porcentaje', valor: 10, monto_minimo: 500, activo: 1 }
    );
    expect(calcPct.subtotal).toBe(2000);
    expect(calcPct.descuento).toBe(200);
    expect(calcPct.impuestos).toBe(288);
    expect(calcPct.costoEnvio).toBe(0);
    expect(calcPct.total).toBe(2088);

    // Cupón de monto fijo AHORRA250
    const calcFixed = calculateCartTotals(
      [{ cantidad: 1, precio: 2000 }],
      { codigo: 'AHORRA250', tipo: 'monto_fijo', valor: 250, monto_minimo: 1500, activo: 1 }
    );
    expect(calcFixed.descuento).toBe(250);

    // Cupón de envío gratis en pedido pequeño
    const calcFreeShip = calculateCartTotals(
      [{ cantidad: 1, precio: 300 }],
      { codigo: 'ENVIOGRATIS', tipo: 'envio_gratis', valor: 99, monto_minimo: 0, activo: 1 }
    );
    expect(calcFreeShip.costoEnvio).toBe(0);
  });

  test('9. Pasarela de pagos con reintentos ante fallas transitorias (RFC-0001 / PRB-0001)', () => {
    // Éxito tras 2 fallos transitorios (al 3er intento)
    const recovered = processPaymentGateway({
      metodoPago: 'tarjeta',
      monto: 1500,
      simulateTransientFailureCount: 2
    });
    expect(recovered.success).toBe(true);
    expect(recovered.intentosConexion).toBe(3);
    expect(recovered.connectionReleased).toBe(true);

    // Fallo tras agotar los 3 reintentos
    const exhausted = processPaymentGateway({
      metodoPago: 'tarjeta',
      monto: 1500,
      simulateTransientFailureCount: 3
    });
    expect(exhausted.success).toBe(false);
    expect(exhausted.intentosConexion).toBe(3);
  });
});
