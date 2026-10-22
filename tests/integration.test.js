/**
 * Suite de Pruebas Funcionales y de Integración (Apartados 22 y 23 del Manual de Calidad)
 * Cubre los casos de prueba CP-RF-01 a CP-RF-10 y tolerancia a fallos RNF-05.
 */

const request = require('supertest');
const { initDatabase } = require('../src/db/database');
const { createApp } = require('../src/app');

describe('Pruebas Funcionales y de Integración End-to-End (CP-RF-01 a CP-RF-10)', () => {
  let app;
  let clienteToken;
  let adminToken;
  let vendedorToken;
  let createdOrderId;

  beforeAll(() => {
    initDatabase(':memory:');
    app = createApp();
  });

  test('CP-RF-01: Registro, inicio de sesión, perfil cifrado y Derechos ARCO (LFPDPPP)', async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      nombre: 'María Fernanda López',
      email: 'maria.lopez@example.com',
      password: 'PasswordSegura2026!',
      direccion: 'Av. Universidad 3000, Coyoacán, CDMX',
      telefono: '+52 55 4433 2211',
      consentimientoPrivacidad: true
    });
    expect(regRes.status).toBe(201);
    expect(regRes.body.token).toBeDefined();
    clienteToken = regRes.body.token;

    const profRes = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${clienteToken}`);
    expect(profRes.status).toBe(200);
    expect(profRes.body.user.direccion).toBe('Av. Universidad 3000, Coyoacán, CDMX');
    expect(profRes.body.notifications.length).toBeGreaterThanOrEqual(1);

    const updateRes = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        nombre: 'María Fernanda López Actualizada',
        direccion: 'Calle Madero 15, Centro Histórico, CDMX'
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.user.direccion).toBe('Calle Madero 15, Centro Histórico, CDMX');

    // Solicitud de Derechos ARCO (NOR-08)
    const arcoRes = await request(app)
      .post('/api/privacy/arco')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        tipo: 'acceso',
        descripcion: 'Solicito informe de mis datos personales almacenados en ExpressMart.'
      });
    expect(arcoRes.status).toBe(201);
    expect(arcoRes.body.folio).toMatch(/^ARCO-/);
  });

  test('CP-RF-02: Acceso administrativo y de vendedor con MFA obligatorio', async () => {
    // Paso 1: Solicitar login de admin sin código MFA -> exige MFA
    const step1 = await request(app).post('/api/auth/login').send({
      email: 'admin@expressmart.mx',
      password: 'AdminPassword123!'
    });
    expect(step1.status).toBe(200);
    expect(step1.body.mfaRequired).toBe(true);
    expect(step1.body.demoHintCode).toMatch(/^\d{6}$/);

    // Paso 2: Completar login con código TOTP
    const step2 = await request(app).post('/api/auth/login').send({
      email: 'admin@expressmart.mx',
      password: 'AdminPassword123!',
      mfaCode: step1.body.demoHintCode
    });
    expect(step2.status).toBe(200);
    expect(step2.body.token).toBeDefined();
    adminToken = step2.body.token;

    // Login de vendedor con MFA
    const vStep1 = await request(app).post('/api/auth/login').send({
      email: 'vendedor@expressmart.mx',
      password: 'VendedorPassword123!'
    });
    const vStep2 = await request(app).post('/api/auth/login').send({
      email: 'vendedor@expressmart.mx',
      password: 'VendedorPassword123!',
      mfaCode: vStep1.body.demoHintCode
    });
    expect(vStep2.status).toBe(200);
    vendedorToken = vStep2.body.token;
  });

  test('CP-RF-03: Búsqueda y filtrado del catálogo en menos de 2 segundos', async () => {
    const resAll = await request(app).get('/api/products');
    expect(resAll.status).toBe(200);
    expect(resAll.body.withinSla).toBe(true);
    expect(resAll.body.responseTimeMs).toBeLessThan(2000);
    expect(resAll.body.products.length).toBeGreaterThanOrEqual(6);

    const resFiltered = await request(app).get('/api/products?q=Laptop&categoria=Computo&marca=TechNova&maxPrecio=20000&orden=precio_asc');
    expect(resFiltered.status).toBe(200);
    expect(resFiltered.body.products.length).toBe(1);
    expect(resFiltered.body.products[0].sku).toBe('EM-LAP-001');

    const detailRes = await request(app).get(`/api/products/${resFiltered.body.products[0].id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.sku).toBe('EM-LAP-001');
  });

  test('CP-RF-04: Cálculo de carrito con impuestos, envío y cupones', async () => {
    const calcRes = await request(app).post('/api/cart/calculate').send({
      items: [{ productoId: 2, cantidad: 2 }],
      cuponCodigo: 'BIENVENIDA10'
    });
    expect(calcRes.status).toBe(200);
    expect(calcRes.body.subtotal).toBe(4998);
    expect(calcRes.body.descuento).toBe(499.8);
    expect(calcRes.body.costoEnvio).toBe(0);
    expect(calcRes.body.total).toBeGreaterThan(0);

    // Rechazo cuando se solicita más stock del disponible
    const noStockRes = await request(app).post('/api/cart/calculate').send({
      items: [{ productoId: 1, cantidad: 999 }]
    });
    expect(noStockRes.status).toBe(409);
  });

  test('CP-RF-05 y CP-RF-09: Checkout en 3 pasos, pasarela PCI DSS, guía de envío y notificación', async () => {
    const checkoutRes = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        items: [{ productoId: 2, cantidad: 1 }],
        cuponCodigo: 'BIENVENIDA10',
        direccionEnvio: 'Calle Madero 15, Centro Histórico, CDMX',
        metodoPago: 'msi',
        mesesSinIntereses: 6,
        cardHolder: 'MARIA F LOPEZ',
        cardNumber: '4111111111114242',
        expiry: '12/29',
        pasosCheckout: 3
      });

    expect(checkoutRes.status).toBe(201);
    expect(checkoutRes.body.withinSla).toBe(true);
    expect(checkoutRes.body.order.folio).toMatch(/^EM-ORD-/);
    expect(checkoutRes.body.order.pago.tarjetaEnmascarada).toBe('**** **** **** 4242');
    expect(checkoutRes.body.order.envio.numeroGuia).toMatch(/^EM-GUIA-/);
    expect(checkoutRes.body.order.notificacion.acuseRecibo).toMatch(/^ACK-SMTP-/);
    createdOrderId = checkoutRes.body.order.id;
  });

  test('CP-RF-06: Gestión de productos e inventario por Administrador/Vendedor', async () => {
    const createProd = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${vendedorToken}`)
      .send({
        sku: 'EM-TAB-007',
        nombre: 'Tablet Pro 11" 256GB Wi-Fi + Pencil',
        descripcion: 'Pantalla Liquid Retina 120Hz ideal para ilustración y productividad.',
        categoria: 'Computo',
        marca: 'TechNova',
        precio: 9499.00,
        condiciones_envio: 'Envío exprés gratis 24 hrs.',
        especificaciones: { pantalla: '11 pulgadas', almacenamiento: '256GB' },
        stock: 14
      });
    expect(createProd.status).toBe(201);

    const updateProd = await request(app)
      .put(`/api/products/${createProd.body.productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        precio: 8999.00,
        stock: 20
      });
    expect(updateProd.status).toBe(200);
  });

  test('CP-RF-07: Gestión de pedidos, actualización logística y devolución con reembolso', async () => {
    const listOrders = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${clienteToken}`);
    expect(listOrders.status).toBe(200);
    expect(listOrders.body.orders.length).toBeGreaterThanOrEqual(1);

    // Admin actualiza estado a enviado
    const statusUpdate = await request(app)
      .patch(`/api/orders/${createdOrderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        estado: 'enviado',
        ubicacion: 'Hub DHL Aeropuerto CDMX',
        detalle: 'En tránsito hacia domicilio del cliente'
      });
    expect(statusUpdate.status).toBe(200);
    expect(statusUpdate.body.estado).toBe('enviado');

    // Cliente solicita devolución amparada en LFPC
    const returnRes = await request(app)
      .post(`/api/orders/${createdOrderId}/return`)
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({ motivo: 'Cambio de modelo solicitado dentro de los 30 días LFPC' });
    expect(returnRes.status).toBe(200);
    expect(returnRes.body.estado).toBe('devuelto');
  });

  test('CP-RF-08: Sistema de calificaciones y reseñas verificadas', async () => {
    const revRes = await request(app)
      .post('/api/products/2/reviews')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        calificacion: 5,
        comentario: 'Excelente calidad de sonido y atención inmediata en el envío.'
      });
    expect(revRes.status).toBe(201);
    expect(revRes.body.compraVerificada).toBe(true);
  });

  test('CP-RF-10 y Calidad de Datos ISO/IEC 25012: Reportes de ventas y auditoría de datos', async () => {
    const repRes = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(repRes.status).toBe(200);
    expect(repRes.body.ventas).toBeDefined();
    expect(repRes.body.inventario.totalProductosActivos).toBeGreaterThanOrEqual(7);

    const dqRes = await request(app)
      .get('/api/quality/data-audit')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dqRes.status).toBe(200);
    expect(dqRes.body.dimensiones.integridad.cumple).toBe(true);
    expect(dqRes.body.dimensiones.completitud.cumple).toBe(true);
    expect(dqRes.body.dimensiones.consistencia.cumple).toBe(true);
  });

  test('CP-RNF-05: Tolerancia a fallos ante caída del servicio de recomendaciones', async () => {
    // Apagar servicio de recomendaciones
    const simOff = await request(app)
      .post('/api/admin/contingency/recommendations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ healthy: false });
    expect(simOff.status).toBe(200);
    expect(simOff.body.recommendationsServiceHealthy).toBe(false);

    // Verificar que el catálogo sigue funcionando normalmente en modo degradado
    const catRes = await request(app).get('/api/products');
    expect(catRes.status).toBe(200);
    expect(catRes.body.products.length).toBeGreaterThan(0);
    expect(catRes.body.recommendations.degradedMode).toBe(true);

    // Restablecer servicio
    await request(app)
      .post('/api/admin/contingency/recommendations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ healthy: true });
  });

  test('Escenarios adicionales y negativos: Health, Metrics, Legal, Rechazo de tarjeta, Wallet y Cancelación', async () => {
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('UP');

    const metrics = await request(app).get('/api/metrics');
    expect(metrics.status).toBe(200);
    expect(metrics.body.kpisApartado7.disponibilidadServicioPorcentaje).toBeGreaterThanOrEqual(99.9);

    const legal = await request(app).get('/api/legal/privacy-and-terms');
    expect(legal.status).toBe(200);
    expect(legal.body.lfpdppp).toBeDefined();
    expect(legal.body.lfpc).toBeDefined();

    // Rechazo cuando pasosCheckout > 3 (RNF-11)
    const tooManySteps = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        items: [{ productoId: 2, cantidad: 1 }],
        direccionEnvio: 'Av. Universidad 3000, CDMX',
        metodoPago: 'tarjeta',
        pasosCheckout: 4
      });
    expect(tooManySteps.status).toBe(400);

    // Rechazo de tarjeta declinada (terminación 0000)
    const declinedCard = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        items: [{ productoId: 2, cantidad: 1 }],
        direccionEnvio: 'Av. Universidad 3000, CDMX',
        metodoPago: 'tarjeta',
        cardNumber: '4111111111110000',
        pasosCheckout: 3
      });
    expect(declinedCard.status).toBe(402);

    // Compra exitosa con Wallet y cupón ENVIOGRATIS, seguida de cancelación administrativa
    const walletOrder = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        items: [{ productoId: 5, cantidad: 1 }],
        cuponCodigo: 'ENVIOGRATIS',
        direccionEnvio: 'Av. Universidad 3000, CDMX',
        metodoPago: 'wallet',
        pasosCheckout: 3
      });
    expect(walletOrder.status).toBe(201);

    const cancelRes = await request(app)
      .patch(`/api/orders/${walletOrder.body.order.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: 'cancelado', detalle: 'Cancelado a petición del usuario' });
    expect(cancelRes.status).toBe(200);

    // Casos negativos de validación en registro, productos, cupones y reseñas
    expect((await request(app).post('/api/auth/register').send({ email: 'bad' })).status).toBe(400);
    expect((await request(app).get('/api/products/99999')).status).toBe(404);
    expect((await request(app).post('/api/cart/calculate').send({ items: [] })).status).toBe(400);
    expect(
      (await request(app).post('/api/cart/calculate').send({
        items: [{ productoId: 1, cantidad: 1 }],
        cuponCodigo: 'CUPON_INEXISTENTE'
      })).status
    ).toBe(400);
    expect(
      (await request(app)
        .post('/api/products/1/reviews')
        .set('Authorization', `Bearer ${clienteToken}`)
        .send({ calificacion: 9, comentario: 'Invalido' })).status
    ).toBe(400);
  });
});

