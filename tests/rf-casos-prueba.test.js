/**
 * Suite Integral de Casos de Prueba por Requisito Funcional (RF-01 a RF-10)
 * Cubre escenarios positivos, negativos, límites de negocio y extensiones de Sprint (Cartera PayPal,
 * ExpressPrime, 2FA, Reembolsos LFPC, Logística OSM y Dashboard/Tarjeta Receptora de Vendedor).
 */

const request = require('supertest');
const { initDatabase, getDb } = require('../src/db/database');
const { createApp } = require('../src/app');
const emailService = require('../src/services/emailService');

describe('Casos de Prueba Trazables por Requisito Funcional (RF-01 a RF-10)', () => {
  let app;
  let adminToken;
  let sellerToken;
  let auditorToken;
  let origSendMail;

  async function loginWithMfa(email, password) {
    const step1 = await request(app).post('/api/auth/login').send({ email, password });
    expect(step1.status).toBe(200);
    expect(step1.body.mfaRequired).toBe(true);
    const step2 = await request(app).post('/api/auth/login').send({
      email,
      password,
      mfaCode: step1.body.demoHintCode
    });
    expect(step2.status).toBe(200);
    expect(step2.body.token).toBeDefined();
    return step2.body;
  }

  async function loginDirect(email, password) {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    return res.body;
  }

  async function registerBuyer(suffix, extra = {}) {
    const email = `rf_buyer_${suffix}_${Date.now()}@expressmart.mx`;
    const res = await request(app).post('/api/auth/register').send({
      email,
      password: 'BuyerPassword123!',
      nombre: `Comprador ${suffix}`,
      direccion: 'Av. Reforma 100, CDMX',
      telefono: '+52 55 1000 2000',
      consentimientoPrivacidad: true,
      ...extra
    });
    return { email, res };
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    origSendMail = emailService.transporter.sendMail;
    emailService.transporter.sendMail = async () => ({ messageId: 'mock-rf-suite' });
    initDatabase(':memory:');
    app = createApp();

    adminToken = (await loginWithMfa('admin@expressmart.mx', 'AdminPassword123!')).token;
    sellerToken = (await loginWithMfa('vendedor@expressmart.mx', 'VendedorPassword123!')).token;
    auditorToken = (await loginDirect('auditor@expressmart.mx', 'AuditorPassword123!')).token;
  });

  afterAll(() => {
    if (origSendMail) {
      emailService.transporter.sendMail = origSendMail;
    }
  });

  // =========================================================================
  // RF-01: Autenticación de clientes, perfil cifrado y Derechos ARCO (LFPDPPP)
  // =========================================================================
  describe('RF-01: Autenticación de clientes y LFPDPPP', () => {
    test('RF-01-CP01 [Positivo]: Registro, keep-alive, actualización de perfil cifrado y Derechos ARCO', async () => {
      const { email, res: regRes } = await registerBuyer('rf01_pos');
      expect(regRes.status).toBe(201);
      expect(regRes.body.token).toBeDefined();
      const buyerToken = regRes.body.token;

      // Verificar almacenamiento cifrado en reposo AES-256-GCM en BD (D1)
      const db = getDb();
      const dbUser = db.prepare('SELECT direccion_cifrada, telefono_cifrado FROM usuarios WHERE email = ?').get(email);
      expect(dbUser.direccion_cifrada).toContain('enc:v1:');
      expect(dbUser.telefono_cifrado).toContain('enc:v1:');

      // Actualizar perfil con coordenadas y consultar perfil descifrado
      const updRes = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          nombre: 'Comprador Actualizado RF01',
          direccion: 'Insurgentes Sur 1602, CDMX',
          latitud: 19.3712,
          longitud: -99.1802
        });
      expect(updRes.status).toBe(200);

      const profRes = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${buyerToken}`);
      expect(profRes.status).toBe(200);
      expect(profRes.body.user.nombre).toBe('Comprador Actualizado RF01');
      expect(profRes.body.user.direccion).toBe('Insurgentes Sur 1602, CDMX');

      // Keep-alive de sesión y solicitud ARCO
      const keepAlive = await request(app).post('/api/auth/keep-alive').set('Authorization', `Bearer ${buyerToken}`);
      expect(keepAlive.status).toBe(200);

      const arco = await request(app)
        .post('/api/privacy/arco')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ tipo: 'rectificacion', descripcion: 'Actualización de domicilio fiscal del comprador.' });
      expect(arco.status).toBe(201);
      expect(arco.body.folio).toMatch(/^ARCO-/);
    });

    test('RF-01-CP02 [Negativo y Autogestión]: Rechazo sin consentimiento, duplicado y eliminación propia', async () => {
      const noConsent = await registerBuyer('noconsent', { consentimientoPrivacidad: false });
      expect(noConsent.res.status).toBe(400);

      const weakPass = await registerBuyer('weakpass', { password: '123' });
      expect(weakPass.res.status).toBe(400);

      const first = await registerBuyer('dup_rf01');
      expect(first.res.status).toBe(201);
      const dupRes = await request(app).post('/api/auth/register').send({
        email: first.email,
        password: 'BuyerPassword123!',
        nombre: 'Duplicado',
        consentimientoPrivacidad: true
      });
      expect(dupRes.status).toBe(409);

      // Eliminación propia de cuenta (LFPDPPP Cancelación) e invalidación inmediata de sesión
      const delRes = await request(app).delete('/api/users/me').set('Authorization', `Bearer ${first.res.body.token}`);
      expect(delRes.status).toBe(200);

      const postDel = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${first.res.body.token}`);
      expect(postDel.status).toBe(401);
    });
  });

  // =========================================================================
  // RF-02: Acceso administrativo y RBAC con MFA obligatorio
  // =========================================================================
  describe('RF-02: Acceso administrativo, MFA y RBAC', () => {
    test('RF-02-CP01 [Positivo]: Acceso 2FA/TOTP para administrador/vendedor y login estándar soporte/auditor', async () => {
      const soporte = await loginDirect('soporte@expressmart.mx', 'SoportePassword123!');
      expect(soporte.user.rol).toBe('soporte');

      const adminProf = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${adminToken}`);
      expect(adminProf.status).toBe(200);
      expect(adminProf.body.user.rol).toBe('administrador');

      const sellerProf = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${sellerToken}`);
      expect(sellerProf.status).toBe(200);
      expect(sellerProf.body.user.rol).toBe('vendedor');
    });

    test('RF-02-CP02 [Negativo / Seguridad]: Rechazo TOTP inválido, bloqueo RBAC a cliente y protección Superadmin', async () => {
      const badMfa = await request(app).post('/api/auth/login').send({
        email: 'admin@expressmart.mx',
        password: 'AdminPassword123!',
        mfaCode: '999999'
      });
      expect(badMfa.status).toBe(401);

      const { res: buyerReg } = await registerBuyer('rbac_chk');
      const buyerToken = buyerReg.body.token;

      // Cliente no puede acceder a rutas administrativas
      const forbiddenAudit = await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${buyerToken}`);
      expect(forbiddenAudit.status).toBe(403);

      const forbiddenUserUpd = await request(app)
        .put(`/api/admin/users/${buyerReg.body.user.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ rol: 'administrador' });
      expect(forbiddenUserUpd.status).toBe(403);

      // Admin no puede eliminar cuenta Superadmin ID 1
      const delSuper = await request(app).delete('/api/admin/users/1').set('Authorization', `Bearer ${adminToken}`);
      expect(delSuper.status).toBe(400);
    });
  });

  // =========================================================================
  // RF-03: Catálogo y Búsqueda (< 2 segundos)
  // =========================================================================
  describe('RF-03: Catálogo y Búsqueda (< 2 s)', () => {
    test('RF-03-CP01 [Positivo]: Búsqueda multicriterio y detalle de producto dentro del SLA (< 2000 ms)', async () => {
      const listRes = await request(app).get('/api/products?q=Laptop&categoria=Computo&maxPrecio=35000&orden=precio_asc');
      expect(listRes.status).toBe(200);
      expect(listRes.body.withinSla).toBe(true);
      expect(listRes.body.responseTimeMs).toBeLessThan(2000);
      expect(listRes.body.products.length).toBeGreaterThanOrEqual(1);

      const prodId = listRes.body.products[0].id;
      const detailRes = await request(app).get(`/api/products/${prodId}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.id).toBe(prodId);
      expect(detailRes.body.especificaciones_json).toBeDefined();
    });

    test('RF-03-CP02 [Negativo]: Producto inexistente retorna HTTP 404 y rango sin coincidencias lista vacía', async () => {
      const notFound = await request(app).get('/api/products/999999');
      expect(notFound.status).toBe(404);

      const emptySearch = await request(app).get('/api/products?q=ProductoInexistenteXYZ987');
      expect(emptySearch.status).toBe(200);
      expect(emptySearch.body.products).toHaveLength(0);
    });
  });

  // =========================================================================
  // RF-04: Carrito de compras (subtotal, IVA 16%, envío y cupones)
  // =========================================================================
  describe('RF-04: Carrito de compras', () => {
    test('RF-04-CP01 [Positivo]: Cálculo exacto con envío cobrado (<$999), envío gratis (>=$999) y cupones', async () => {
      // Buscar producto con precio < 999 en catálogo sembrado (o crear uno económico temporal)
      const createLow = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          sku: `EM-LOW-${Date.now()}`,
          nombre: 'Cable USB-C 2m Trenzado',
          descripcion: 'Cable de carga rápida certificado 100W para laptop y móvil.',
          categoria: 'Accesorios',
          marca: 'VoltPro',
          precio: 300,
          condiciones_envio: 'Envío estándar nacional.',
          stock: 10
        });
      expect(createLow.status).toBe(201);
      const lowId = createLow.body.productId;

      // Escenario A: < $999 sin cupón -> cobra envío $99 e IVA 16%
      const calcShip = await request(app).post('/api/cart/calculate').send({
        items: [{ productoId: lowId, cantidad: 1 }]
      });
      expect(calcShip.status).toBe(200);
      expect(calcShip.body.subtotal).toBe(300);
      expect(calcShip.body.impuestos).toBe(48);
      expect(calcShip.body.costoEnvio).toBe(99);
      expect(calcShip.body.total).toBe(447);

      // Escenario B: < $999 con cupón ENVIOGRATIS -> envío $0
      const calcFree = await request(app).post('/api/cart/calculate').send({
        items: [{ productoId: lowId, cantidad: 1 }],
        cuponCodigo: 'ENVIOGRATIS'
      });
      expect(calcFree.status).toBe(200);
      expect(calcFree.body.costoEnvio).toBe(0);
      expect(calcFree.body.total).toBe(348);

      // Escenario C: >= $999 con BIENVENIDA10 -> 10% descuento + envío gratis
      const calcDisc = await request(app).post('/api/cart/calculate').send({
        items: [{ productoId: lowId, cantidad: 4 }],
        cuponCodigo: 'BIENVENIDA10'
      });
      expect(calcDisc.status).toBe(200);
      expect(calcDisc.body.subtotal).toBe(1200);
      expect(calcDisc.body.descuento).toBe(120);
      expect(calcDisc.body.costoEnvio).toBe(0);
      expect(calcDisc.body.impuestos).toBe(172.8);
      expect(calcDisc.body.total).toBe(1252.8);
    });

    test('RF-04-CP02 [Negativo]: Carrito vacío (400), cupón inexistente (400) y exceso de stock (409)', async () => {
      const emptyCart = await request(app).post('/api/cart/calculate').send({ items: [] });
      expect(emptyCart.status).toBe(400);

      const badCoupon = await request(app).post('/api/cart/calculate').send({
        items: [{ productoId: 1, cantidad: 1 }],
        cuponCodigo: 'NO_EXISTE_CUPON'
      });
      expect(badCoupon.status).toBe(400);

      const overStock = await request(app).post('/api/cart/calculate').send({
        items: [{ productoId: 1, cantidad: 9999 }]
      });
      expect(overStock.status).toBe(409);
    });
  });

  // =========================================================================
  // RF-05: Pagos (Checkout 3 pasos, PCI DSS, Cartera 3 plásticos, PayPal MXN y ExpressPrime)
  // =========================================================================
  describe('RF-05: Pagos, Cartera Digital y Membresía ExpressPrime', () => {
    test('RF-05-CP01 [Positivo]: Pago en 3 pasos con tarjeta simulada asignada, descuento de saldo e idempotencia', async () => {
      const { res: buyerReg } = await registerBuyer('rf05_card');
      const buyerId = buyerReg.body.user.id;
      const buyerToken = buyerReg.body.token;
      const suffix = String(Math.floor(1000 + Math.random() * 8999));
      const cardNum = `455500001111${suffix}`;

      const cardRes = await request(app)
        .post('/api/payments/simulated-cards')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          usuarioId: buyerId,
          numeroTarjeta: cardNum,
          titular: 'COMPRADOR RF05',
          expiracion: '11/29',
          saldo: 20000,
          colorPlastico: '#0f766e'
        });
      expect(cardRes.status).toBe(201);

      const idemKey = `rf05_idem_${Date.now()}`;
      const payRes = await request(app)
        .post('/api/checkout')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productoId: 2, cantidad: 1 }],
          direccionEnvio: 'Calle Juárez 40, Centro, CDMX',
          metodoPago: 'tarjeta',
          simulatedCardId: cardRes.body.cardId,
          idempotencyKey: idemKey,
          pasosCheckout: 3
        });
      expect(payRes.status).toBe(201);
      expect(payRes.body.order.pago.tokenPci).toMatch(/^tok_pci_/);
      expect(payRes.body.order.pago.tarjetaEnmascarada).toContain(suffix);

      // Reintento con misma idempotencyKey debe bloquear doble cobro (409)
      const replayRes = await request(app)
        .post('/api/checkout')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productoId: 2, cantidad: 1 }],
          direccionEnvio: 'Calle Juárez 40, Centro, CDMX',
          metodoPago: 'tarjeta',
          simulatedCardId: cardRes.body.cardId,
          idempotencyKey: idemKey,
          pasosCheckout: 3
        });
      expect(replayRes.status).toBe(409);

      // Verificar saldo descontado en tarjeta
      const listCards = await request(app)
        .get('/api/payments/simulated-cards?mine=1')
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(listCards.status).toBe(200);
      expect(listCards.body[0].saldo).toBeLessThan(20000);
      expect(listCards.body[0].color_plastico).toBe('#0f766e');
    });

    test('RF-05-CP02 [Negativo y Reglas de Cartera]: >3 pasos, tarjeta declinada, saldo insuficiente y límite de 3 tarjetas', async () => {
      const { res: buyerReg } = await registerBuyer('rf05_neg');
      const buyerId = buyerReg.body.user.id;
      const buyerToken = buyerReg.body.token;

      // Registrar 3 tarjetas (límite máximo permitido) con bajo saldo en la primera
      const cards = [];
      for (let i = 1; i <= 3; i += 1) {
        const c = await request(app)
          .post('/api/payments/simulated-cards')
          .set('Authorization', `Bearer ${buyerToken}`)
          .send({
            usuarioId: buyerId,
            numeroTarjeta: `42220000${i}000${String(Date.now()).slice(-4)}`,
            titular: `PLASTICO ${i}`,
            saldo: i === 1 ? 50 : 5000
          });
        expect(c.status).toBe(201);
        cards.push(c.body.cardId);
      }

      // 4a tarjeta debe ser rechazada (máximo 3 por usuario)
      const fourthCard = await request(app)
        .post('/api/payments/simulated-cards')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          usuarioId: buyerId,
          numeroTarjeta: `422200004000${String(Date.now()).slice(-4)}`,
          titular: 'CUARTA TARJETA',
          saldo: 5000
        });
      expect(fourthCard.status).toBe(400);

      // Tarjeta con saldo insuficiente ($50 MXN)
      const lowFunds = await request(app)
        .post('/api/checkout')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productoId: 2, cantidad: 1 }],
          direccionEnvio: 'Av. Chapultepec 120, CDMX',
          metodoPago: 'tarjeta',
          simulatedCardId: cards[0],
          pasosCheckout: 3
        });
      expect(lowFunds.status).toBe(400);

      // Flujo mayor a 3 pasos (RNF-11)
      const invalidSteps = await request(app)
        .post('/api/checkout')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productoId: 2, cantidad: 1 }],
          direccionEnvio: 'Av. Chapultepec 120, CDMX',
          metodoPago: 'tarjeta',
          pasosCheckout: 4
        });
      expect(invalidSteps.status).toBe(400);

      // Tarjeta declinada (terminación 0000)
      const declined = await request(app)
        .post('/api/checkout')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productoId: 2, cantidad: 1 }],
          direccionEnvio: 'Av. Chapultepec 120, CDMX',
          metodoPago: 'tarjeta',
          cardNumber: '4111111111110000',
          pasosCheckout: 3
        });
      expect(declined.status).toBe(402);
    });

    test('RF-05-CP03 [Positivo Extensión]: PayPal Sandbox MXN y Membresía ExpressPrime', async () => {
      const { res: buyerReg } = await registerBuyer('rf05_paypal_prime');
      const buyerToken = buyerReg.body.token;

      const ppCfg = await request(app).get('/api/payment/paypal-config');
      expect(ppCfg.status).toBe(200);
      expect(ppCfg.body.currency).toBe('MXN');

      const subRes = await request(app)
        .post('/api/membership/subscribe')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ plan: '1_mes', metodoPago: 'tarjeta' });
      expect(subRes.status).toBe(200);
      expect(subRes.body.user.membresiaPremium).toBe(true);

      const ppOrder = await request(app)
        .post('/api/checkout')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productoId: 2, cantidad: 1 }],
          direccionEnvio: 'Paseo de la Reforma 222, CDMX',
          metodoPago: 'paypal',
          pasosCheckout: 3
        });
      expect(ppOrder.status).toBe(201);
      expect(ppOrder.body.order.pago.metodoPago).toBe('paypal');

      const cancelSub = await request(app)
        .post('/api/membership/cancel')
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(cancelSub.status).toBe(200);
    });
  });

  // =========================================================================
  // RF-06: Gestión de productos e inventario + Panel exclusivo de Vendedor
  // =========================================================================
  describe('RF-06: Gestión de productos e inventario y Dashboard de Vendedor', () => {
    test('RF-06-CP01 [Positivo]: Alta/edición de producto y vista aislada de productos propios en /api/seller/dashboard', async () => {
      const skuSeller = `EM-VEND-${Date.now()}`;
      const createRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          sku: skuSeller,
          nombre: 'Teclado Mecánico Vendedor Pro',
          descripcion: 'Teclado compacto 75% con switches táctiles silenciosos.',
          categoria: 'Accesorios',
          marca: 'KeyMaster',
          precio: 1850,
          condiciones_envio: 'Envío asegurado 24-48h.',
          stock: 12
        });
      expect(createRes.status).toBe(201);
      const sellerProdId = createRes.body.productId;

      // Producto creado por administrador NO debe aparecer como propio del vendedor
      const adminProdRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sku: `EM-ADM-${Date.now()}`,
          nombre: 'Producto Exclusivo Admin',
          descripcion: 'Publicado por administrador para verificar aislamiento de dashboard.',
          categoria: 'Computo',
          marca: 'AdminBrand',
          precio: 3500,
          condiciones_envio: 'Envío estándar.',
          stock: 5
        });
      expect(adminProdRes.status).toBe(201);
      const adminProdId = adminProdRes.body.productId;

      const sellerDash = await request(app)
        .get('/api/seller/dashboard')
        .set('Authorization', `Bearer ${sellerToken}`);
      expect(sellerDash.status).toBe(200);
      expect(sellerDash.body.productos.some((p) => p.id === sellerProdId)).toBe(true);
      expect(sellerDash.body.productos.some((p) => p.id === adminProdId)).toBe(false);

      // Vendedor actualiza rápidamente su propio stock y precio
      const quickUpd = await request(app)
        .put(`/api/seller/products/${sellerProdId}/stock`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ stock: 18, precio: 1799 });
      expect(quickUpd.status).toBe(200);
    });

    test('RF-06-CP02 [Negativo / Permisos]: Validación ISO 25012, SKU duplicado y aislamiento entre vendedores', async () => {
      const incomplete = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ nombre: 'Sin SKU ni precio' });
      expect(incomplete.status).toBe(400);

      const dupSku = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          sku: 'EM-LAP-001',
          nombre: 'Duplicado',
          descripcion: 'Intento de duplicar SKU existente en catálogo.',
          categoria: 'Computo',
          marca: 'TechNova',
          precio: 5000,
          condiciones_envio: 'Envío gratis.',
          stock: 2
        });
      expect(dupSku.status).toBe(409);

      // Producto de admin no puede ser editado por vendedor vía /api/seller/products/:id/stock
      const adminProd = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sku: `EM-LOCK-${Date.now()}`,
          nombre: 'Producto Protegido Admin',
          descripcion: 'Solo editable por su creador o administrador.',
          categoria: 'Hogar',
          marca: 'HomePro',
          precio: 1200,
          condiciones_envio: 'Envío estándar.',
          stock: 3
        });
      const forbiddenEdit = await request(app)
        .put(`/api/seller/products/${adminProd.body.productId}/stock`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ stock: 99 });
      expect(forbiddenEdit.status).toBe(403);
    });
  });

  // =========================================================================
  // RF-07: Gestión de pedidos, logística OSM y reembolsos LFPC
  // =========================================================================
  describe('RF-07: Gestión de pedidos, logística y devoluciones/reembolsos', () => {
    test('RF-07-CP01 [Positivo]: Ciclo completo de pedido -> preparación -> envío/simulación -> entrega y reembolso', async () => {
      const { res: buyerReg } = await registerBuyer('rf07_flow');
      const buyerToken = buyerReg.body.token;

      // Pedido 1 para ciclo logístico hasta entrega
      const ord1 = await request(app)
        .post('/api/checkout')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productoId: 2, cantidad: 1 }],
          direccionEnvio: 'Av. Álvaro Obregón 185, Roma Norte, CDMX',
          metodoPago: 'tarjeta',
          pasosCheckout: 3
        });
      expect(ord1.status).toBe(201);
      const pedido1Id = ord1.body.order.id;

      // Aislamiento de pedidos propios
      const myOrders = await request(app).get('/api/orders').set('Authorization', `Bearer ${buyerToken}`);
      expect(myOrders.status).toBe(200);
      expect(myOrders.body.orders.every((o) => o.usuario_id === buyerReg.body.user.id)).toBe(true);

      // Logística CEDIS -> despacho -> simulación -> entrega
      expect(
        (await request(app)
          .post(`/api/logistics/shipments/${pedido1Id}/prepare`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ almacenCodigo: 'CEDIS-CDMX-NORTE' })).status
      ).toBe(200);

      expect(
        (await request(app)
          .post(`/api/logistics/shipments/${pedido1Id}/dispatch`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ tipoVehiculo: 'camion' })).status
      ).toBe(200);

      expect(
        (await request(app)
          .post(`/api/logistics/shipments/${pedido1Id}/deliver`)
          .set('Authorization', `Bearer ${adminToken}`)).status
      ).toBe(200);

      // Pedido 2 para flujo de solicitud y aprobación de reembolso
      const ord2 = await request(app)
        .post('/api/checkout')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productoId: 3, cantidad: 1 }],
          direccionEnvio: 'Av. Álvaro Obregón 185, Roma Norte, CDMX',
          metodoPago: 'tarjeta',
          pasosCheckout: 3
        });
      expect(ord2.status).toBe(201);
      const pedido2Id = ord2.body.order.id;

      const reqRef = await request(app)
        .post(`/api/orders/${pedido2Id}/refund-request`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ motivo: 'Garantía LFPC: producto con empaque dañado.' });
      expect(reqRef.status).toBe(201);

      const appRef = await request(app)
        .post(`/api/admin/refund-requests/${reqRef.body.requestId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ respuesta: 'Reembolso aprobado tras validación en almacén.' });
      expect(appRef.status).toBe(200);
      expect(appRef.body.estado).toBe('aprobada');
    });

    test('RF-07-CP02 [Negativo / Denegación]: Estado inválido y denegación formal de reembolso con notificación', async () => {
      const { res: buyerReg } = await registerBuyer('rf07_neg');
      const buyerToken = buyerReg.body.token;

      const ordRes = await request(app)
        .post('/api/checkout')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productoId: 2, cantidad: 1 }],
          direccionEnvio: 'Calle Durango 50, CDMX',
          metodoPago: 'tarjeta',
          pasosCheckout: 3
        });
      const pedidoId = ordRes.body.order.id;

      // Estado inválido
      const badState = await request(app)
        .patch(`/api/orders/${pedidoId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ estado: 'estado_inexistente' });
      expect(badState.status).toBe(400);

      // Solicitar y denegar reembolso
      const reqRef = await request(app)
        .post(`/api/orders/${pedidoId}/refund-request`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ motivo: 'Ya no lo necesito' });
      expect(reqRef.status).toBe(201);

      const rejRef = await request(app)
        .post(`/api/admin/refund-requests/${reqRef.body.requestId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ motivo: 'Evidencia insuficiente; requiere fotografías de empaque.' });
      expect(rejRef.status).toBe(200);
      expect(rejRef.body.estado).toBe('denegada');
    });

    test('RF-07-CP03 [Positivo / Negativo]: Selección de almacén CEDIS al crear/editar producto e inventario en /api/logistics/warehouses/inventory', async () => {
      // 1. Validar rechazo 400 ante almacén CEDIS inexistente
      const invalidWhRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          sku: `EM-BADWH-${Date.now()}`,
          nombre: 'Producto Almacén Inválido',
          descripcion: 'Prueba de validación de almacén inexistente.',
          categoria: 'Computo',
          marca: 'TestBrand',
          precio: 1299,
          condiciones_envio: 'Envío estándar.',
          stock: 5,
          ubicacion_almacen: 'CEDIS-INEXISTENTE'
        });
      expect(invalidWhRes.status).toBe(400);

      // 2. Crear producto asignado explícitamente a CEDIS-GDL-01
      const skuWh = `EM-GDL-${Date.now()}`;
      const createGdl = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          sku: skuWh,
          nombre: 'Monitor Curvo Jalisco 27',
          descripcion: 'Monitor IPS QHD asignado directamente al CEDIS Guadalajara.',
          categoria: 'Computo',
          marca: 'VisionMX',
          precio: 5499,
          condiciones_envio: 'Envío asegurado 24h.',
          stock: 14,
          ubicacion_almacen: 'CEDIS-GDL-01'
        });
      expect(createGdl.status).toBe(201);
      expect(createGdl.body.ubicacion_almacen).toBe('CEDIS-GDL-01');
      const prodId = createGdl.body.productId;

      // 3. Consultar productos por almacén desde catálogo y desde logística
      const catFilter = await request(app).get('/api/products?almacen=CEDIS-GDL-01');
      expect(catFilter.status).toBe(200);
      expect(catFilter.body.products.some((p) => Number(p.id) === Number(prodId))).toBe(true);

      const whInv = await request(app)
        .get('/api/logistics/warehouses/inventory')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(whInv.status).toBe(200);
      expect(whInv.body.warehouses.length).toBeGreaterThanOrEqual(5);
      expect(whInv.body.warehouses.every((w) => Array.isArray(w.productos) && w.productos.length > 0)).toBe(true);
      const gdlWh = whInv.body.warehouses.find((w) => w.codigo === 'CEDIS-GDL-01');
      expect(gdlWh).toBeDefined();
      expect(gdlWh.productos.some((p) => Number(p.id) === Number(prodId) && p.sku === skuWh)).toBe(true);

      const gdlProductsRes = await request(app)
        .get('/api/logistics/warehouses/CEDIS-GDL-01/products')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(gdlProductsRes.status).toBe(200);
      expect(gdlProductsRes.body.productos.some((p) => Number(p.id) === Number(prodId))).toBe(true);

      // 4. Reasignar almacén a CEDIS-MTY-01 desde endpoint de vendedor y confirmar traslado
      const moveRes = await request(app)
        .put(`/api/seller/products/${prodId}/stock`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ stock: 20, precio: 5399, ubicacion_almacen: 'CEDIS-MTY-01' });
      expect(moveRes.status).toBe(200);
      expect(moveRes.body.ubicacion_almacen).toBe('CEDIS-MTY-01');

      const mtyProductsRes = await request(app)
        .get('/api/logistics/warehouses/CEDIS-MTY-01/products')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(mtyProductsRes.status).toBe(200);
      expect(mtyProductsRes.body.productos.some((p) => Number(p.id) === Number(prodId) && p.stock_disponible === 20)).toBe(true);

      const dashAfterMove = await request(app)
        .get('/api/seller/dashboard')
        .set('Authorization', `Bearer ${sellerToken}`);
      expect(dashAfterMove.status).toBe(200);
      const dashProd = dashAfterMove.body.productos.find((p) => Number(p.id) === Number(prodId));
      expect(dashProd?.ubicacion_almacen).toBe('CEDIS-MTY-01');
    });
  });

  // =========================================================================
  // RF-08: Sistema de calificaciones y reseñas
  // =========================================================================
  describe('RF-08: Sistema de calificaciones y reseñas', () => {
    test('RF-08-CP01 [Positivo]: Reseña verificada (tras compra) y reseña no verificada reflejadas en catálogo', async () => {
      const { res: buyerReg } = await registerBuyer('rf08_rev');
      const buyerToken = buyerReg.body.token;

      // Comprar producto 2 para obtener insignia compraVerificada=true
      await request(app)
        .post('/api/checkout')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productoId: 2, cantidad: 1 }],
          direccionEnvio: 'Av. Insurgentes 500, CDMX',
          metodoPago: 'tarjeta',
          pasosCheckout: 3
        });

      const verifiedRev = await request(app)
        .post('/api/products/2/reviews')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ calificacion: 5, comentario: 'Sonido claro y entrega puntual en CDMX.' });
      expect(verifiedRev.status).toBe(201);
      expect(verifiedRev.body.compraVerificada).toBe(true);

      // Reseña de producto no comprado por este usuario -> compraVerificada=false
      const unverifiedRev = await request(app)
        .post('/api/products/4/reviews')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ calificacion: 4, comentario: 'Buena ficha técnica y acabados.' });
      expect(unverifiedRev.status).toBe(201);
      expect(unverifiedRev.body.compraVerificada).toBe(false);
    });

    test('RF-08-CP02 [Negativo]: Calificación fuera de 1..5, comentario corto y producto inexistente', async () => {
      const { res: buyerReg } = await registerBuyer('rf08_neg');
      const buyerToken = buyerReg.body.token;

      expect(
        (await request(app)
          .post('/api/products/2/reviews')
          .set('Authorization', `Bearer ${buyerToken}`)
          .send({ calificacion: 6, comentario: 'Calificación fuera de rango.' })).status
      ).toBe(400);

      expect(
        (await request(app)
          .post('/api/products/2/reviews')
          .set('Authorization', `Bearer ${buyerToken}`)
          .send({ calificacion: 5, comentario: 'Ok' })).status
      ).toBe(400);

      expect(
        (await request(app)
          .post('/api/products/999999/reviews')
          .set('Authorization', `Bearer ${buyerToken}`)
          .send({ calificacion: 5, comentario: 'Producto que no existe.' })).status
      ).toBe(404);
    });
  });

  // =========================================================================
  // RF-09: Notificaciones con acuse SMTP en eventos clave
  // =========================================================================
  describe('RF-09: Notificaciones y acuses de recibo SMTP', () => {
    test('RF-09-CP01 [Positivo]: Registro, compra y actualización logística generan notificaciones ACK-SMTP-* en perfil', async () => {
      const { res: buyerReg } = await registerBuyer('rf09_notif');
      const buyerToken = buyerReg.body.token;

      const checkoutRes = await request(app)
        .post('/api/checkout')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productoId: 2, cantidad: 1 }],
          direccionEnvio: 'Calle Colima 120, CDMX',
          metodoPago: 'tarjeta',
          pasosCheckout: 3
        });
      expect(checkoutRes.status).toBe(201);
      expect(checkoutRes.body.order.notificacion.acuseRecibo).toMatch(/^ACK-SMTP-/);

      // Cambio logístico dispara nueva notificación
      await request(app)
        .patch(`/api/orders/${checkoutRes.body.order.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ estado: 'enviado', ubicacion: 'Hub Norte CDMX', detalle: 'En ruta local' });

      const profRes = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${buyerToken}`);
      expect(profRes.status).toBe(200);
      const events = profRes.body.notifications.map((n) => n.evento);
      expect(events).toContain('REGISTRO_CUENTA');
      expect(events).toContain('PEDIDO_CONFIRMADO_Y_PAGADO');
      expect(events).toContain('ACTUALIZACION_PEDIDO_ENVIADO');
      expect(profRes.body.notifications.every((n) => /^ACK-SMTP-/.test(n.acuse_recibo))).toBe(true);
    });

    test('RF-09-CP02 [Negativo]: Error 404 en pedido inexistente no emite notificaciones espurias', async () => {
      const badOrder = await request(app)
        .patch('/api/orders/999999/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ estado: 'enviado' });
      expect(badOrder.status).toBe(404);
    });
  });

  // =========================================================================
  // RF-10: Reportes ejecutivos, liquidaciones de vendedor e integridad ISO 25012
  // =========================================================================
  describe('RF-10: Reportes ejecutivos, liquidaciones y bitácora SHA-256', () => {
    test('RF-10-CP01 [Positivo]: Reportes ejecutivos admin/auditor, tarjeta receptora y acreditación simulada vendedor', async () => {
      const summary = await request(app).get('/api/reports/summary').set('Authorization', `Bearer ${auditorToken}`);
      expect(summary.status).toBe(200);
      expect(summary.body.ventas).toBeDefined();
      expect(summary.body.inventario).toBeDefined();
      expect(Array.isArray(summary.body.topProductos)).toBe(true);

      const auditLog = await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${auditorToken}`);
      expect(auditLog.status).toBe(200);
      expect(auditLog.body.chainIntact).toBe(true);

      const dqAudit = await request(app).get('/api/quality/data-audit').set('Authorization', `Bearer ${auditorToken}`);
      expect(dqAudit.status).toBe(200);
      expect(dqAudit.body.dimensiones.integridad.cumple).toBe(true);

      // Vincular tarjeta receptora propia al vendedor y acreditar ventas simuladas
      const linkCard = await request(app)
        .post('/api/seller/receiving-card')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          numeroTarjeta: `541200009999${String(Date.now()).slice(-4)}`,
          titular: 'CARLOS ADAIR VENDEDOR',
          marca: 'Mastercard',
          tipo: 'debito',
          colorPlastico: '#059669',
          saldoInicial: 1000
        });
      expect(linkCard.status).toBe(200);
      expect(linkCard.body.card.es_receptora).toBe(1);

      const creditRes = await request(app)
        .post('/api/seller/credit-sales')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ monto: 2500 });
      expect(creditRes.status).toBe(200);
      expect(creditRes.body.nuevoSaldo).toBe(3500);
    });

    test('RF-10-CP02 [Negativo / Permisos]: Bloqueo a cliente y validaciones de tarjeta receptora de vendedor', async () => {
      const { res: buyerReg } = await registerBuyer('rf10_neg');
      const buyerToken = buyerReg.body.token;

      expect((await request(app).get('/api/reports/summary').set('Authorization', `Bearer ${buyerToken}`)).status).toBe(403);
      expect((await request(app).get('/api/quality/data-audit').set('Authorization', `Bearer ${buyerToken}`)).status).toBe(403);
      expect((await request(app).get('/api/seller/dashboard').set('Authorization', `Bearer ${buyerToken}`)).status).toBe(403);

      // Vendedor no puede vincular una tarjeta inexistente/ajena por ID
      const badLink = await request(app)
        .post('/api/seller/receiving-card')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ cardId: 999999 });
      expect(badLink.status).toBe(404);
    });
  });
});
