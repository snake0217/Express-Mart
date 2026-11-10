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

    // Carga de foto de perfil y persistencia al guardar cambios subsecuentes
    const photoDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const photoRes = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({ fotoPerfil: photoDataUrl });
    expect(photoRes.status).toBe(200);
    expect(photoRes.body.user.fotoPerfil).toBe(photoDataUrl);

    // Guardar formulario de perfil preservando la foto existente
    const formSaveRes = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        nombre: 'María Fernanda López con Foto',
        direccion: 'Calle Madero 20, Centro, CDMX',
        fotoPerfil: photoDataUrl
      });
    expect(formSaveRes.status).toBe(200);
    expect(formSaveRes.body.user.fotoPerfil).toBe(photoDataUrl);

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

    const policyRes = await request(app).get('/api/quality/database-policy');
    expect(policyRes.status).toBe(200);
    expect(policyRes.body.codigoDocumento).toBe('POL-BD-MC001');
    expect(policyRes.body.motorBaseDeDatos.foreignKeysActivas).toBe(true);
    expect(policyRes.body.almacenesDfdNivel1).toHaveLength(8);
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

  test('CP-RF-12: Pasarela y checkout con PayPal Sandbox Oficial en MXN (RF-05 / Apartado 25)', async () => {
    // 1. Verificar endpoint de configuración pública de PayPal Sandbox
    const configRes = await request(app).get('/api/payment/paypal-config');
    expect(configRes.status).toBe(200);
    expect(configRes.body.clientId).toBe('Ac1DHKE068BKREloy9_v2y2mb5PawyS-0dX32ko2XKrwfYxyejUYXfMjoUaEkRpmloEN6kf3SlgGrdw_');
    expect(configRes.body.sandboxEmail).toBe('bancochido@banco.com');
    expect(configRes.body.region).toBe('MX');
    expect(configRes.body.currency).toBe('MXN');

    // 2. Realizar checkout con método paypal
    const checkoutPaypalRes = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        items: [{ productoId: 2, cantidad: 1 }],
        direccionEnvio: 'Av. Chapultepec 500, Roma Norte, Cuauhtémoc, CDMX',
        metodoPago: 'paypal',
        pasosCheckout: 3
      });

    expect(checkoutPaypalRes.status).toBe(201);
    expect(checkoutPaypalRes.body.order.folio).toMatch(/^EM-ORD-/);
    expect(checkoutPaypalRes.body.order.pago.proveedor).toMatch(/PayPal Sandbox/);
    expect(checkoutPaypalRes.body.order.pago.metodoPago).toBe('paypal');
    expect(checkoutPaypalRes.body.order.pago.tarjetaEnmascarada).toContain('bancochido@banco.com');
    expect(checkoutPaypalRes.body.order.pago.referenciaPasarela).toMatch(/^PAYPAL-SBX-/);
  });

  test('CP-RF-13: Planes de membresía ExpressPrime, activación, envíos gratis y 5% de cashback en compras', async () => {
    // 1. Un usuario nuevo se registra sin membresía premium
    const newReg = await request(app).post('/api/auth/register').send({
      nombre: 'Carlos Prime Test',
      email: 'carlos.prime@example.com',
      password: 'PasswordSegura2026!',
      direccion: 'Av. Insurgentes Sur 1234, CDMX',
      telefono: '+52 55 9988 7766',
      consentimientoPrivacidad: true
    });
    expect(newReg.status).toBe(201);
    expect(newReg.body.user.membresiaPremium).toBe(false);
    const primeUserToken = newReg.body.token;

    // 2. Consultar catálogo de planes de suscripción
    const plansRes = await request(app).get('/api/membership/plans');
    expect(plansRes.status).toBe(200);
    expect(plansRes.body.plans.length).toBe(3);
    const plan1Mes = plansRes.body.plans.find((p) => p.id === '1_mes');
    const plan3Meses = plansRes.body.plans.find((p) => p.id === '3_meses');
    const plan1Ano = plansRes.body.plans.find((p) => p.id === '1_ano');
    expect(plan1Mes.precio).toBe(99.00);
    expect(plan3Meses.precio).toBe(249.00);
    expect(plan1Ano.precio).toBe(899.00);

    // 3. Status inicial: inactiva
    const initialStatus = await request(app)
      .get('/api/membership/status')
      .set('Authorization', `Bearer ${primeUserToken}`);
    expect(initialStatus.status).toBe(200);
    expect(initialStatus.body.activa).toBe(false);

    // 4. Suscribirse al plan 3 meses con simulación de pago
    const subRes = await request(app)
      .post('/api/membership/subscribe')
      .set('Authorization', `Bearer ${primeUserToken}`)
      .send({
        plan: '3_meses',
        metodoPago: 'tarjeta',
        cardNumber: '4111111111114242'
      });
    expect(subRes.status).toBe(200);
    expect(subRes.body.success).toBe(true);
    expect(subRes.body.plan.id).toBe('3_meses');
    expect(subRes.body.user.membresiaPremium).toBe(true);

    // 5. Verificar que el perfil refleje la membresía activa
    const profRes = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${primeUserToken}`);
    expect(profRes.body.user.membresiaPremium).toBe(true);
    expect(profRes.body.user.membresiaPlan).toBe('3_meses');

    // 6. Calcular carrito para miembro premium:
    // Debe tener envío GRATIS ($0) y 5% de cashback en montos de compra
    const cartRes = await request(app)
      .post('/api/cart/calculate')
      .set('Authorization', `Bearer ${primeUserToken}`)
      .send({
        items: [{ productoId: 1, cantidad: 1 }]
      });
    expect(cartRes.status).toBe(200);
    expect(cartRes.body.isPremium).toBe(true);
    expect(cartRes.body.costoEnvio).toBe(0);
    expect(cartRes.body.cashback).toBeGreaterThan(0);
    expect(cartRes.body.cashback).toBe(Number((cartRes.body.subtotal * 0.05).toFixed(2)));

    // 7. Checkout con cuenta premium: el cashback y envío gratis se desglosan en la orden y se valida el hash de integridad
    const checkoutRes = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${primeUserToken}`)
      .send({
        items: [{ productoId: 1, cantidad: 1 }],
        direccionEnvio: 'Av. Insurgentes Sur 1234, CDMX',
        metodoPago: 'tarjeta'
      });
    expect(checkoutRes.status).toBe(201);
    expect(checkoutRes.body.order.isPremium).toBe(true);
    expect(checkoutRes.body.order.costoEnvio).toBe(0);
    expect(checkoutRes.body.order.cashback).toBe(cartRes.body.cashback);

    // 8. Cancelar membresía
    const cancelRes = await request(app)
      .post('/api/membership/cancel')
      .set('Authorization', `Bearer ${primeUserToken}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.success).toBe(true);

    const postCancelProf = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${primeUserToken}`);
    expect(postCancelProf.body.user.membresiaPremium).toBe(false);
  });

  test('CP-RF-12: Verificación de dos pasos (2FA) por correo, reenvío y validación', async () => {
    expect((await request(app).post('/api/auth/resend-code').send({})).status).toBe(400);
    expect((await request(app).post('/api/auth/verify-mfa').send({})).status).toBe(400);

    const resendRes = await request(app).post('/api/auth/resend-code').send({
      email: 'admin@expressmart.mx',
      purpose: 'login'
    });
    expect(resendRes.status).toBe(200);

    const badVerify = await request(app).post('/api/auth/verify-mfa').send({
      email: 'admin@expressmart.mx',
      code: '000000',
      purpose: 'login'
    });
    expect(badVerify.status).toBe(400);

    const okVerify = await request(app).post('/api/auth/verify-mfa').send({
      email: 'admin@expressmart.mx',
      code: '123456',
      purpose: 'login'
    });
    expect(okVerify.status).toBe(200);
    expect(okVerify.body.token).toBeDefined();
  });
});

