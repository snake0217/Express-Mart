#!/usr/bin/env node
/**
 * Consola Interactiva de Base de Datos ExpressMart (SQLite)
 * Permite ejecutar consultas SQL interactivas o por argumento en terminal
 * sin dependencias externas usando el motor nativo node:sqlite.
 */

const readline = require('node:readline');
const path = require('node:path');
const { getDb, initDatabase } = require('../src/db/database');

const dbPath = path.join(__dirname, '../data/expressmart.sqlite');
const db = initDatabase(dbPath);

const HELP_TEXT = `
================================================================================
          CONSOLA INTERACTIVA SQL - EXPRESSMART MARKETPLACE MÉXICO
================================================================================
Comandos especiales disponibles:
  .tablas               Lista todas las tablas creadas y su número de filas
  .schema [tabla]       Muestra la estructura DDL de una tabla o de todas
  .kpis                 Resumen ejecutivo de ventas, catálogo y usuarios en MXN
  .ejemplos             Muestra una lista de consultas SQL útiles listas para usar
  .ayuda                Muestra esta ayuda
  .salir / .exit        Cierra la consola de base de datos

Consultas SQL directas:
  Escribe cualquier sentencia SQL terminada o no en punto y coma (;)
  Ejemplo: SELECT id, nombre, email, rol FROM usuarios;
================================================================================
`;

const USEFUL_QUERIES = [
  {
    titulo: '1. Usuarios registrados y roles de acceso',
    sql: "SELECT id, email, nombre, rol, mfa_enabled, activo, created_at FROM usuarios;"
  },
  {
    titulo: '2. Top 5 productos más caros en Pesos Mexicanos (MXN)',
    sql: "SELECT sku, nombre, categoria, marca, '$' || printf('%,d', precio) || ' MXN' AS precio_mxn FROM catalogo ORDER BY precio DESC LIMIT 5;"
  },
  {
    titulo: '3. Existencias e inventario por almacén',
    sql: "SELECT c.sku, c.nombre, c.categoria, i.stock_disponible, i.ubicacion_almacen, i.ultima_conciliacion FROM catalogo c JOIN inventario i ON c.id = i.producto_id ORDER BY i.stock_disponible ASC LIMIT 10;"
  },
  {
    titulo: '4. Pedidos confirmados, totales y guías de paquetería',
    sql: "SELECT p.folio, u.nombre AS cliente, '$' || printf('%,d', p.total) || ' MXN' AS total, p.metodo_pago, p.estado, e.proveedor_paqueteria, e.numero_guia FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id LEFT JOIN envios e ON p.id = e.pedido_id;"
  },
  {
    titulo: '5. Calificaciones y opiniones verificadas de clientes',
    sql: "SELECT c.nombre AS producto, r.calificacion || '/5' AS calif, r.comentario, r.verificada, r.created_at FROM resenas r JOIN catalogo c ON r.producto_id = c.id ORDER BY r.created_at DESC LIMIT 6;"
  },
  {
    titulo: '6. Cupones de descuento activos en MXN',
    sql: "SELECT codigo, tipo, valor, '$' || printf('%,d', compra_minima) || ' MXN' AS compra_minima, limite_usos, usos_actuales, activo FROM cupones;"
  },
  {
    titulo: '7. Bitácora de auditoría inmutable (Encadenamiento criptográfico SHA-256)',
    sql: "SELECT id, evento, usuario_email, rol, substr(hash_cadena, 1, 16) || '...' AS hash_sha256, timestamp FROM bitacora_auditoria ORDER BY id DESC LIMIT 8;"
  },
  {
    titulo: '8. Verificación de integridad física y pragmas SQLite',
    sql: "PRAGMA integrity_check;"
  }
];

function printTables() {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
    .all();
  const summary = tables.map((t) => {
    const countRow = db.prepare(`SELECT count(*) as count FROM ${t.name}`).get();
    return { Tabla: t.name, Registros: countRow.count };
  });
  console.log('\n--- TABLAS DEL SISTEMA EXPRESSMART ---');
  console.table(summary);
}

function printSchema(tableName) {
  let query = "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
  const params = [];
  if (tableName) {
    query += ' AND name = ?';
    params.push(tableName);
  }
  query += ' ORDER BY name;';
  const rows = db.prepare(query).all(...params);
  if (!rows.length) {
    console.log(`No se encontró la tabla '${tableName}'.`);
    return;
  }
  rows.forEach((r) => {
    console.log(`\n-- Estructura de la tabla: ${r.name}`);
    console.log(r.sql + ';');
  });
}

function printKpis() {
  const prodCount = db.prepare('SELECT count(*) as total, sum(precio) as valorTotal FROM catalogo WHERE activo = 1').get();
  const userCount = db.prepare('SELECT count(*) as total FROM usuarios').get();
  const orderStats = db.prepare("SELECT count(*) as total, coalesce(sum(total), 0) as ingresos, coalesce(avg(total), 0) as ticketPromedio FROM pedidos WHERE estado != 'cancelado'").get();
  const stockCount = db.prepare('SELECT sum(stock_disponible) as totalStock FROM inventario').get();
  const reviewStats = db.prepare('SELECT count(*) as total, avg(calificacion) as promedio FROM resenas').get();

  console.log('\n================================================================================');
  console.log('                 RESUMEN EJECUTIVO DE NEGOCIO (KPIs EN MXN)                    ');
  console.log('================================================================================');
  console.table([
    { Métrica: 'Usuarios Registrados', Valor: userCount.total },
    { Métrica: 'Productos en Catálogo', Valor: prodCount.total },
    { Métrica: 'Unidades en Stock (CEDIS CDMX)', Valor: stockCount.totalStock || 0 },
    { Métrica: 'Pedidos Concretados', Valor: orderStats.total },
    { Métrica: 'Ingresos Totales en Pesos', Valor: `$${Number(orderStats.ingresos).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN` },
    { Métrica: 'Ticket Promedio de Venta', Valor: `$${Number(orderStats.ticketPromedio).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN` },
    { Métrica: 'Opiniones Verificadas', Valor: reviewStats.total },
    { Métrica: 'Calificación Promedio', Valor: `${Number(reviewStats.promedio || 0).toFixed(2)} / 5.00` }
  ]);
  console.log('================================================================================\n');
}

function printExamples() {
  console.log('\n--- CONSULTAS SQL DE EJEMPLO LISTAS PARA COPIAR O EJECUTAR ---');
  USEFUL_QUERIES.forEach((q, idx) => {
    console.log(`\n${q.titulo}:`);
    console.log(`  ${q.sql}`);
  });
  console.log('\nPara ejecutar un ejemplo, copia el SQL y pégalo en la consola.\n');
}

function executeQuery(rawSql) {
  const sql = rawSql.trim().replace(/;+$/, '');
  if (!sql) return;

  const isSelect = /^(SELECT|PRAGMA|WITH|EXPLAIN)/i.test(sql);
  const start = process.hrtime.bigint();

  try {
    if (isSelect) {
      const stmt = db.prepare(sql);
      const rows = stmt.all();
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      if (rows.length === 0) {
        console.log(`(0 filas devueltas en ${durationMs.toFixed(2)} ms)`);
      } else {
        console.table(rows);
        console.log(`(${rows.length} fila${rows.length > 1 ? 's' : ''} en ${durationMs.toFixed(2)} ms)`);
      }
    } else {
      const stmt = db.prepare(sql);
      const result = stmt.run();
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      console.log(`OK. Filas modificadas: ${result.changes}, Último ID insertado: ${result.lastInsertRowid} (${durationMs.toFixed(2)} ms)`);
    }
  } catch (err) {
    console.error(`Error SQL: ${err.message}`);
  }
}

// Ejecución directa por línea de comandos si se pasa argumento: node scripts/db-console.js "SELECT ..."
const argQuery = process.argv.slice(2).join(' ').trim();
if (argQuery) {
  if (argQuery === '.tablas') printTables();
  else if (argQuery.startsWith('.schema')) printSchema(argQuery.split(' ')[1]);
  else if (argQuery === '.kpis') printKpis();
  else if (argQuery === '.ejemplos') printExamples();
  else executeQuery(argQuery);
  process.exit(0);
}

// Modo interactivo REPL
console.log(HELP_TEXT);
printTables();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'ExpressMart-SQL> '
});

rl.prompt();

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (trimmed === '.salir' || trimmed === '.exit' || trimmed === '.quit') {
    console.log('Cerrando sesión de base de datos...');
    rl.close();
    process.exit(0);
  } else if (trimmed === '.ayuda' || trimmed === '.help') {
    console.log(HELP_TEXT);
  } else if (trimmed === '.tablas') {
    printTables();
  } else if (trimmed.startsWith('.schema')) {
    const parts = trimmed.split(/\s+/);
    printSchema(parts[1]);
  } else if (trimmed === '.kpis') {
    printKpis();
  } else if (trimmed === '.ejemplos') {
    printExamples();
  } else if (trimmed) {
    executeQuery(trimmed);
  }
  rl.prompt();
});

rl.on('close', () => {
  console.log('\nSesión terminada.');
  process.exit(0);
});
