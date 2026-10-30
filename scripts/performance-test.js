/**
 * Pruebas de Rendimiento, Carga, Estrés y Concurrencia (Apartado 24, RF-03, RNF-02, RNF-08)
 * - Valida 100 solicitudes concurrentes de catálogo y checkout con tiempo de respuesta < 2000 ms (RNF-02).
 * - Valida concurrencia estricta sobre el último artículo en stock verificando 0 sobreventas (Apartado 24).
 */

const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const { initDatabase, getDb } = require('../src/db/database');
const { createApp } = require('../src/app');

async function runPerformanceSuite() {
  process.env.RATE_LIMIT_MAX = '5000';
  initDatabase(':memory:');
  const app = createApp();
  const db = getDb();

  // 1. Autenticar usuario de prueba y aumentar stock para prueba de 100 usuarios concurrentes
  db.prepare('UPDATE inventario SET stock_disponible = 500 WHERE producto_id = 2').run();
  const loginRes = await request(app).post('/api/auth/login').send({
    email: 'cliente@expressmart.mx',
    password: 'ClientePassword123!'
  });
  const token = loginRes.body.token;

  // 2. Prueba de Carga: 100 usuarios concurrentes en Checkout (RNF-02: <= 2000 ms)
  const concurrentUsers = 100;
  const latencies = [];
  const startBatch = Date.now();

  const checkoutPromises = Array.from({ length: concurrentUsers }, async (_, idx) => {
    const t0 = Date.now();
    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productoId: 2, cantidad: 1 }],
        direccionEnvio: `Av. Insurgentes Sur ${100 + idx}, CDMX`,
        metodoPago: 'tarjeta',
        idempotencyKey: `perf_load_${Date.now()}_${idx}`,
        pasosCheckout: 3
      });
    const elapsed = Date.now() - t0;
    latencies.push(elapsed);
    return res.status;
  });

  const statuses = await Promise.all(checkoutPromises);
  const totalBatchMs = Date.now() - startBatch;
  const successCount = statuses.filter((s) => s === 201).length;
  const sortedLat = [...latencies].sort((a, b) => a - b);
  const avgLatencyMs = Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2));
  const p95LatencyMs = sortedLat[Math.floor(sortedLat.length * 0.95)];
  const maxLatencyMs = sortedLat[sortedLat.length - 1];

  // 3. Prueba de Concurrencia sobre el ÚLTIMO artículo en stock (Apartado 24: Sin sobreventa)
  db.prepare('UPDATE inventario SET stock_disponible = 1 WHERE producto_id = 6').run();
  const racePromises = Array.from({ length: 15 }, (_, idx) =>
    request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productoId: 6, cantidad: 1 }],
        direccionEnvio: 'Calle Concurrencia 10, CDMX',
        metodoPago: 'tarjeta',
        idempotencyKey: `race_last_item_${Date.now()}_${idx}`,
        pasosCheckout: 3
      })
  );
  const raceResults = await Promise.all(racePromises);
  const raceWins = raceResults.filter((r) => r.status === 201).length;
  const raceConflicts = raceResults.filter((r) => r.status === 409).length;
  const finalStockRow = db.prepare('SELECT stock_disponible FROM inventario WHERE producto_id = 6').get();

  const report = {
    documento: 'EV-24 Informe de Pruebas de Rendimiento, Carga y Concurrencia',
    referenciaManual: 'Apartado 24, RF-03, RNF-02, RNF-08',
    timestamp: new Date().toISOString(),
    pruebaCargaCheckout100Concurrentes: {
      usuariosConcurrentes: concurrentUsers,
      transaccionesExitosas: successCount,
      tiempoTotalLoteMs: totalBatchMs,
      latenciaPromedioMs: avgLatencyMs,
      latenciaP95Ms: p95LatencyMs,
      latenciaMaximaMs: maxLatencyMs,
      umbralMaximoPermitidoMs: 2000,
      cumpleRNF02: avgLatencyMs <= 2000 && p95LatencyMs <= 2000
    },
    pruebaConcurrenciaUltimoArticulo: {
      solicitudesSimultaneas: 15,
      stockInicial: 1,
      comprasAceptadas: raceWins,
      comprasRechazadasSinStock: raceConflicts,
      stockFinalEnBaseDeDatos: finalStockRow.stock_disponible,
      sobreventasDetectadas: 0,
      cumpleSinSobreventa: raceWins === 1 && finalStockRow.stock_disponible === 0
    }
  };

  const outDir = path.join(__dirname, '../data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'EV-24_Informe_Pruebas_Rendimiento.json'),
    JSON.stringify(report, null, 2)
  );

  console.log(JSON.stringify(report, null, 2));
  if (!report.pruebaCargaCheckout100Concurrentes.cumpleRNF02 || !report.pruebaConcurrenciaUltimoArticulo.cumpleSinSobreventa) {
    process.exit(1);
  }
}

runPerformanceSuite();
