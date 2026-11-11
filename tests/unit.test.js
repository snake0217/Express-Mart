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

  test('10. Procesamiento de pagos simulados con PayPal Sandbox en MXN (RF-05 / Apartado 25)', () => {
    const ppResult = processPaymentGateway({
      metodoPago: 'paypal',
      monto: 2499.00
    });
    expect(ppResult.success).toBe(true);
    expect(ppResult.estado).toBe('capturado');
    expect(ppResult.moneda).toBe('MXN');
    expect(ppResult.monto).toBe(2499.00);
    expect(ppResult.proveedor).toMatch(/PayPal Sandbox/);
    expect(ppResult.referenciaPasarela).toMatch(/^PAYPAL-SBX-/);
    expect(ppResult.tarjetaEnmascarada).toContain('bancochido@banco.com');
    expect(ppResult.tokenPci).toMatch(/^PP-TOK-/);
    expect(ppResult.connectionReleased).toBe(true);
  });

  test('11. Servicio de Correos Electrónicos con Nodemailer y Plantilla 2FA', async () => {
    const { buildVerificationEmailTemplate, sendVerificationEmail, transporter } = require('../src/services/emailService');
    const htmlRegistro = buildVerificationEmailTemplate({
      nombre: 'Diego Alarcón',
      code: '849201',
      purpose: 'registro'
    });
    expect(htmlRegistro).toContain('849201');
    expect(htmlRegistro).toContain('Diego Alarcón');
    expect(htmlRegistro).toContain('Verifiquemos tu correo');

    const htmlLogin = buildVerificationEmailTemplate({
      nombre: 'Diego Alarcón',
      code: '654321',
      purpose: 'login'
    });
    expect(htmlLogin).toContain('654321');
    expect(htmlLogin).toContain('Código de Seguridad');

    const htmlDefault = buildVerificationEmailTemplate({ code: '999999' });
    expect(htmlDefault).toContain('999999');
    expect(htmlDefault).toContain('Usuario');

    const testDomainRes = await sendVerificationEmail({
      to: 'admin@expressmart.mx',
      code: '888888'
    });
    expect(testDomainRes.success).toBe(true);

    const testDomainRes2 = await sendVerificationEmail({
      to: 'usuario@example.com',
      code: '777777',
      purpose: 'login'
    });
    expect(testDomainRes2.success).toBe(true);

    const origSend = transporter.sendMail;
    transporter.sendMail = jest.fn().mockResolvedValue({ messageId: 'mock-123' });

    const resReg = await sendVerificationEmail({
      to: 'diegoman170802@gmail.com',
      nombre: 'Diego Alarcón',
      code: '123456',
      purpose: 'registro'
    });
    expect(resReg.success).toBe(true);
    expect(resReg.messageId).toBe('mock-123');

    const resLog = await sendVerificationEmail({
      to: 'diegoman170802@gmail.com',
      nombre: 'Diego Alarcón',
      code: '654321',
      purpose: 'login'
    });
    expect(resLog.success).toBe(true);

    // Error handling
    transporter.sendMail = jest.fn().mockRejectedValue(new Error('SMTP Error'));
    const resErr = await sendVerificationEmail({
      to: 'diegoman170802@gmail.com',
      nombre: 'Diego Alarcón',
      code: '000000',
      purpose: 'registro'
    });
    expect(resErr.success).toBe(false);
    expect(resErr.error).toBe('SMTP Error');

    transporter.sendMail = origSend;
  });

  test('12. Servicio de Logística OpenStreetMap, Almacenes con Direcciones y Simulación en Tiempo Real', async () => {
    const request = require('supertest');
    const { createApp } = require('../src/app');
    const { getDb } = require('../src/db/database');
    const {
      WAREHOUSES,
      getWarehouseDetails,
      resolveDestinationCoordinates,
      resolveWarehouseForDestination,
      generateRouteCoordinates,
      advanceActiveSimulations
    } = require('../src/services/logisticsService');

    expect(WAREHOUSES.length).toBeGreaterThanOrEqual(5);
    expect(getWarehouseDetails('CEDIS-CDMX-02').codigo).toBe('CEDIS-CDMX-02');
    expect(getWarehouseDetails('sur').codigo).toBe('CEDIS-CDMX-02');
    expect(getWarehouseDetails('guadalajara').codigo).toBe('CEDIS-GDL-01');
    expect(getWarehouseDetails('monterrey').codigo).toBe('CEDIS-MTY-01');
    expect(getWarehouseDetails('puebla').codigo).toBe('CEDIS-PUE-01');
    expect(getWarehouseDetails('inexistente').codigo).toBe('CEDIS-CDMX-01');

    // Coordenadas explícitas y embebidas
    const explicit = resolveDestinationCoordinates('Mi Casa', 19.412345, -99.165432);
    expect(explicit.lat).toBe(19.412345);
    expect(explicit.lng).toBe(-99.165432);

    const embedded = resolveDestinationCoordinates('Calle Falsa 123 [Lat: 19.35500, Lng: -99.16200]');
    expect(embedded.lat).toBe(19.355);
    expect(embedded.lng).toBe(-99.162);

    // Palabras clave de zonas
    expect(resolveDestinationCoordinates('Coyoacán CDMX').zona).toContain('Coyoacán');
    expect(resolveDestinationCoordinates('Polanco Reforma').zona).toContain('Polanco');
    expect(resolveDestinationCoordinates('Roma Norte').zona).toContain('Roma');
    expect(resolveDestinationCoordinates('Col. Del Valle').zona).toContain('Valle');
    expect(resolveDestinationCoordinates('Zapopan Guadalajara').zona).toContain('Guadalajara');
    expect(resolveDestinationCoordinates('San Pedro Monterrey').zona).toContain('Monterrey');
    expect(resolveDestinationCoordinates('Cholula Puebla').zona).toContain('Puebla');
    expect(resolveDestinationCoordinates('Dirección Genérica 999').zona).toContain('CDMX');

    const whGdl = resolveWarehouseForDestination({ lat: 20.6767, lng: -103.3496 });
    expect(whGdl.codigo).toBe('CEDIS-GDL-01');
    const route = generateRouteCoordinates(whGdl, { lat: 20.6767, lng: -103.3496 }, 25);
    expect(route.length).toBe(26);

    const app = createApp();
    const db = getDb();

    // Panel Auth
    expect((await request(app).post('/api/logistics/panel-auth').send({})).status).toBe(400);
    expect((await request(app).post('/api/logistics/panel-auth').send({ email: 'noexiste@expressmart.mx', password: '123' })).status).toBe(401);
    expect((await request(app).post('/api/logistics/panel-auth').send({ email: 'admin', password: 'WrongPassword!' })).status).toBe(401);

    const authAdmin = await request(app).post('/api/logistics/panel-auth').send({ email: 'admin', password: 'Admin123!@#' });
    expect(authAdmin.status).toBe(200);
    expect(authAdmin.body.token).toBeDefined();
    const adminToken = authAdmin.body.token;

    const authVend = await request(app).post('/api/logistics/panel-auth').send({ email: 'vendedor', password: 'Vendedor123!@#' });
    expect(authVend.status).toBe(200);

    // Almacenes y Envíos
    const whRes = await request(app).get('/api/logistics/warehouses');
    expect(whRes.status).toBe(200);
    expect(whRes.body.warehouses[0].direccion).toBeDefined();

    const listRes = await request(app)
      .get('/api/logistics/shipments?almacen=CEDIS-CDMX-01&estado=en_transito')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);

    const allShipments = await request(app)
      .get('/api/logistics/shipments')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(allShipments.status).toBe(200);
    const pid = allShipments.body.shipments[0].pedidoId;

    // Detalle de envío
    const detRes = await request(app)
      .get(`/api/logistics/shipments/${pid}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detRes.status).toBe(200);
    expect(detRes.body.shipment.almacenDireccion).toBeDefined();

    // Actualizar destino en el mapa OpenStreetMap
    const destUpdate = await request(app)
      .put(`/api/logistics/shipments/${pid}/destination`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        direccion: 'Av. Insurgentes Sur 1602, Crédito Constructor, CDMX',
        latDestino: 19.3672,
        lngDestino: -99.1815
      });
    expect(destUpdate.status).toBe(200);
    expect(destUpdate.body.latDestino).toBe(19.3672);

    // Ciclo completo de simulación: prepare -> dispatch -> stop -> start -> progress -> reset -> deliver
    expect(
      (await request(app).post(`/api/logistics/shipments/${pid}/prepare`).set('Authorization', `Bearer ${adminToken}`)).status
    ).toBe(200);

    expect(
      (await request(app).post(`/api/logistics/shipments/${pid}/dispatch`).set('Authorization', `Bearer ${adminToken}`).send({ tipoVehiculo: 'auto' })).status
    ).toBe(200);

    // Probar advanceActiveSimulations forzando updated_at en el pasado
    const pastIso = new Date(Date.now() - 4000).toISOString();
    db.prepare('UPDATE envios SET simulacion_activa = 1, progreso_simulacion = 20, updated_at = ? WHERE pedido_id = ?').run(pastIso, pid);
    advanceActiveSimulations(db, pid);
    const afterStep = db.prepare('SELECT progreso_simulacion FROM envios WHERE pedido_id = ?').get(pid);
    expect(afterStep.progreso_simulacion).toBeGreaterThan(20);

    // Probar llegada al 100% en advanceActiveSimulations
    db.prepare('UPDATE envios SET simulacion_activa = 1, progreso_simulacion = 98, updated_at = ? WHERE pedido_id = ?').run(pastIso, pid);
    advanceActiveSimulations(db, pid);
    const afterFinish = db.prepare('SELECT progreso_simulacion, estado_envio, simulacion_activa FROM envios WHERE pedido_id = ?').get(pid);
    expect(afterFinish.progreso_simulacion).toBe(100);
    expect(afterFinish.estado_envio).toBe('entregado');

    // Reiniciar simulación desde 100% usando /simulation/start
    const restartSim = await request(app)
      .post(`/api/logistics/shipments/${pid}/simulation/start`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tipoVehiculo: 'camion' });
    expect(restartSim.status).toBe(200);
    expect(restartSim.body.progresoSimulacion).toBe(0);

    expect(
      (await request(app).post(`/api/logistics/shipments/${pid}/simulation/stop`).set('Authorization', `Bearer ${adminToken}`)).status
    ).toBe(200);

    expect(
      (await request(app).post(`/api/logistics/shipments/${pid}/simulation/progress`).set('Authorization', `Bearer ${adminToken}`).send({ progreso: 45.5, lat: 19.41, lng: -99.16 })).status
    ).toBe(200);

    expect(
      (await request(app).post(`/api/logistics/shipments/${pid}/simulation/progress`).set('Authorization', `Bearer ${adminToken}`).send({ progreso: 100, lat: 19.3672, lng: -99.1815 })).status
    ).toBe(200);

    expect(
      (await request(app).post(`/api/logistics/shipments/${pid}/simulation/reset`).set('Authorization', `Bearer ${adminToken}`)).status
    ).toBe(200);

    expect(
      (await request(app).post(`/api/logistics/shipments/${pid}/deliver`).set('Authorization', `Bearer ${adminToken}`)).status
    ).toBe(200);
  });
});

