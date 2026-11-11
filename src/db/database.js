/**
 * Capa de Persistencia y Almacenes de Datos DFD Nivel 1 (Apartados 13, 18, 19, ISO/IEC 25012, SEG-08)
 * Implementa consultas parametrizadas estrictas sobre SQLite (node:sqlite) y modela los 8 almacenes del DFD Nivel 1:
 *  - D1: Usuarios (roles: cliente, vendedor, administrador, soporte, auditor + MFA + LFPDPPP)
 *  - D2: Catálogo (productos con completitud verificada: imagen, especificaciones, condiciones de envío)
 *  - D3: Inventario (control de existencias disponible, reservado y conciliación)
 *  - D4: Pedidos (pedidos + detalle de artículos + hash de integridad SHA-256)
 *  - D5: Transacciones (pagos tokenizados PCI DSS + llave de idempotencia)
 *  - D6: Envíos (guías de paquetería, rastreo y devoluciones)
 *  - D7: Reseñas (calificaciones verificadas de clientes)
 *  - D8: Bitácora de auditoría (registro inmutable encadenado por SHA-256)
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { getConfig } = require('../config/env');
const {
  encryptData,
  hashPassword,
  generateMfaSecret,
  computeAuditChainHash
} = require('../utils/crypto');
const {
  ensureWarehousesTable,
  ensureShipmentsTableExtended
} = require('../services/logisticsService');

let dbInstance = null;

function initDatabase(customPath) {
  const config = getConfig();
  const targetPath = customPath || config.dbPath;

  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(targetPath);
  db.exec('PRAGMA foreign_keys = ON;');
  if (targetPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }

  db.exec(`
    -- D1: Usuarios
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('cliente', 'vendedor', 'administrador', 'soporte', 'auditor')),
      foto_perfil TEXT DEFAULT '',
      mfa_enabled INTEGER NOT NULL DEFAULT 0,
      mfa_secret TEXT,
      direccion_cifrada TEXT,
      telefono_cifrado TEXT,
      consentimiento_privacidad INTEGER NOT NULL DEFAULT 1,
      aviso_privacidad_version TEXT NOT NULL DEFAULT 'v1.0-2026',
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      membresia_premium INTEGER NOT NULL DEFAULT 0,
      membresia_plan TEXT DEFAULT NULL,
      membresia_expira TEXT DEFAULT NULL,
      created_at TEXT NOT NULL
    );

    -- Suscripciones y Membresías Premium ExpressPrime
    CREATE TABLE IF NOT EXISTS suscripciones_premium (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      plan TEXT NOT NULL CHECK (plan IN ('1_mes', '3_meses', '1_ano')),
      monto REAL NOT NULL,
      moneda TEXT NOT NULL DEFAULT 'MXN',
      metodo_pago TEXT NOT NULL,
      referencia_pago TEXT NOT NULL,
      fecha_inicio TEXT NOT NULL,
      fecha_expiracion TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'activa',
      created_at TEXT NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    -- Códigos de Verificación de Dos Pasos (2FA) por Correo Electrónico (Nodemailer)
    CREATE TABLE IF NOT EXISTS mfa_email_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      codigo TEXT NOT NULL,
      proposito TEXT NOT NULL CHECK (proposito IN ('registro', 'login')),
      payload_json TEXT,
      expira_en INTEGER NOT NULL,
      usado INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- Sesiones activas (SEG-03)
    CREATE TABLE IF NOT EXISTS sesiones (
      token_id TEXT PRIMARY KEY,
      usuario_id INTEGER NOT NULL,
      rol TEXT NOT NULL,
      mfa_verificado INTEGER NOT NULL DEFAULT 0,
      ip TEXT,
      user_agent TEXT,
      expira_en INTEGER NOT NULL,
      revocada INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    -- D2: Catálogo de productos
    CREATE TABLE IF NOT EXISTS catalogo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      categoria TEXT NOT NULL,
      marca TEXT NOT NULL,
      precio REAL NOT NULL CHECK (precio >= 0),
      imagen_url TEXT NOT NULL,
      especificaciones_json TEXT NOT NULL,
      condiciones_envio TEXT NOT NULL,
      vendedor_id INTEGER NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (vendedor_id) REFERENCES usuarios(id)
    );

    -- D3: Inventario
    CREATE TABLE IF NOT EXISTS inventario (
      producto_id INTEGER PRIMARY KEY,
      stock_disponible INTEGER NOT NULL CHECK (stock_disponible >= 0),
      stock_reservado INTEGER NOT NULL DEFAULT 0 CHECK (stock_reservado >= 0),
      ubicacion_almacen TEXT NOT NULL DEFAULT 'CEDIS-CDMX-01',
      ultima_conciliacion TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (producto_id) REFERENCES catalogo(id)
    );

    -- Carrito persistente del lado servidor (SEG-05)
    CREATE TABLE IF NOT EXISTS carrito_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      cantidad INTEGER NOT NULL CHECK (cantidad > 0),
      updated_at TEXT NOT NULL,
      UNIQUE(usuario_id, producto_id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (producto_id) REFERENCES catalogo(id)
    );

    -- Cupones promocionales (RF-04)
    CREATE TABLE IF NOT EXISTS cupones (
      codigo TEXT PRIMARY KEY,
      descripcion TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('porcentaje', 'monto_fijo', 'envio_gratis')),
      valor REAL NOT NULL CHECK (valor >= 0),
      monto_minimo REAL NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1
    );

    -- D4: Pedidos
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio TEXT UNIQUE NOT NULL,
      usuario_id INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      impuestos REAL NOT NULL,
      costo_envio REAL NOT NULL,
      descuento REAL NOT NULL DEFAULT 0,
      cupon_codigo TEXT,
      total REAL NOT NULL,
      estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'pagado', 'procesando', 'enviado', 'entregado', 'cancelado', 'devuelto')),
      direccion_envio_cifrada TEXT NOT NULL,
      metodo_pago TEXT NOT NULL,
      pasos_checkout INTEGER NOT NULL DEFAULT 3,
      hash_integridad TEXT NOT NULL,
      motivo_devolucion TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS pedido_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      nombre_producto TEXT NOT NULL,
      cantidad INTEGER NOT NULL CHECK (cantidad > 0),
      precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
      subtotal REAL NOT NULL CHECK (subtotal >= 0),
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
      FOREIGN KEY (producto_id) REFERENCES catalogo(id)
    );

    -- D5: Transacciones (Pagos PCI DSS)
    CREATE TABLE IF NOT EXISTS transacciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      referencia_pasarela TEXT UNIQUE NOT NULL,
      proveedor_pasarela TEXT NOT NULL,
      metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('tarjeta', 'wallet', 'msi', 'paypal')),
      meses_sin_intereses INTEGER NOT NULL DEFAULT 1,
      monto REAL NOT NULL,
      moneda TEXT NOT NULL DEFAULT 'MXN',
      tarjeta_enmascarada TEXT NOT NULL,
      token_pci TEXT NOT NULL,
      boveda_cifrada TEXT NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL,
      estado TEXT NOT NULL CHECK (estado IN ('autorizado', 'capturado', 'rechazado', 'reembolsado')),
      intentos_conexion INTEGER NOT NULL DEFAULT 1,
      latencia_ms INTEGER NOT NULL DEFAULT 45,
      created_at TEXT NOT NULL,
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
    );

    -- D6: Envíos y Logística (OpenStreetMap / Simulación en Tiempo Real)
    CREATE TABLE IF NOT EXISTS envios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER UNIQUE NOT NULL,
      proveedor_paqueteria TEXT NOT NULL,
      numero_guia TEXT UNIQUE NOT NULL,
      estado_envio TEXT NOT NULL CHECK (estado_envio IN ('preparando', 'en_transito', 'en_reparto', 'entregado', 'devuelto')),
      fecha_estimada TEXT NOT NULL,
      historial_rastreo_json TEXT NOT NULL,
      almacen_origen TEXT NOT NULL DEFAULT 'CEDIS CDMX Norte (Vallejo)',
      almacen_codigo TEXT NOT NULL DEFAULT 'CEDIS-CDMX-01',
      lat_origen REAL NOT NULL DEFAULT 19.5186,
      lng_origen REAL NOT NULL DEFAULT -99.1645,
      lat_destino REAL NOT NULL DEFAULT 19.3458,
      lng_destino REAL NOT NULL DEFAULT -99.1617,
      lat_actual REAL NOT NULL DEFAULT 19.5186,
      lng_actual REAL NOT NULL DEFAULT -99.1645,
      progreso_simulacion REAL NOT NULL DEFAULT 0.0,
      simulacion_activa INTEGER NOT NULL DEFAULT 0,
      tipo_vehiculo TEXT NOT NULL DEFAULT 'camion',
      ruta_puntos_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
    );

    -- D7: Reseñas
    CREATE TABLE IF NOT EXISTS resenas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      pedido_id INTEGER,
      calificacion INTEGER NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
      comentario TEXT NOT NULL,
      verificada INTEGER NOT NULL DEFAULT 1,
      moderada INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (producto_id) REFERENCES catalogo(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    -- Notificaciones (RF-09)
    CREATE TABLE IF NOT EXISTS notificaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      pedido_id INTEGER,
      canal TEXT NOT NULL DEFAULT 'correo',
      evento TEXT NOT NULL,
      asunto TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      estado_envio TEXT NOT NULL DEFAULT 'entregado',
      acuse_recibo TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    -- Solicitudes Derechos ARCO (LFPDPPP NOR-08)
    CREATE TABLE IF NOT EXISTS derechos_arco (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio TEXT UNIQUE NOT NULL,
      usuario_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('acceso', 'rectificacion', 'cancelacion', 'oposicion')),
      descripcion TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'atendida',
      respuesta TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    -- D8: Bitácora de auditoría inmutable (SEG-15)
    CREATE TABLE IF NOT EXISTS bitacora_auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      usuario_id INTEGER,
      rol TEXT NOT NULL,
      accion TEXT NOT NULL,
      modulo TEXT NOT NULL,
      entidad_id TEXT,
      ip TEXT,
      detalles_json TEXT,
      prev_hash TEXT NOT NULL,
      hash_cadena TEXT NOT NULL
    );

    -- Tarjetas Simuladas para Compras y Saldo (PCI DSS / Sandbox Local)
    CREATE TABLE IF NOT EXISTS tarjetas_simuladas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_tarjeta TEXT UNIQUE NOT NULL,
      titular TEXT NOT NULL,
      expiracion TEXT NOT NULL,
      cvv TEXT NOT NULL,
      saldo REAL NOT NULL CHECK (saldo >= 0),
      saldo_inicial REAL NOT NULL DEFAULT 0,
      marca TEXT NOT NULL DEFAULT 'Visa',
      tipo TEXT NOT NULL DEFAULT 'credito',
      activa INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- D9: Solicitudes de Devolución y Reembolso (LFPC NOR-09 / SGC)
    CREATE TABLE IF NOT EXISTS solicitudes_reembolso (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      monto REAL NOT NULL,
      motivo TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'denegada')),
      respuesta_admin TEXT,
      fecha_solicitud TEXT NOT NULL,
      fecha_resolucion TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
  `);

  try {
    db.exec("ALTER TABLE usuarios ADD COLUMN foto_perfil TEXT DEFAULT '';");
  } catch (_) {
    // Columna foto_perfil ya existe
  }

  try {
    db.exec('ALTER TABLE usuarios ADD COLUMN membresia_premium INTEGER NOT NULL DEFAULT 0;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE usuarios ADD COLUMN membresia_plan TEXT DEFAULT NULL;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE usuarios ADD COLUMN membresia_expira TEXT DEFAULT NULL;');
  } catch (_) {}

  try {
    const txRow = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='transacciones'").get();
    if (txRow && txRow.sql && !txRow.sql.includes("'paypal'")) {
      db.exec(`
        CREATE TABLE transacciones_migrated (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pedido_id INTEGER NOT NULL,
          referencia_pasarela TEXT UNIQUE NOT NULL,
          proveedor_pasarela TEXT NOT NULL,
          metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('tarjeta', 'wallet', 'msi', 'paypal')),
          meses_sin_intereses INTEGER NOT NULL DEFAULT 1,
          monto REAL NOT NULL,
          moneda TEXT NOT NULL DEFAULT 'MXN',
          tarjeta_enmascarada TEXT NOT NULL,
          token_pci TEXT NOT NULL,
          boveda_cifrada TEXT NOT NULL,
          idempotency_key TEXT UNIQUE NOT NULL,
          estado TEXT NOT NULL CHECK (estado IN ('autorizado', 'capturado', 'rechazado', 'reembolsado')),
          intentos_conexion INTEGER NOT NULL DEFAULT 1,
          latencia_ms INTEGER NOT NULL DEFAULT 45,
          created_at TEXT NOT NULL,
          FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
        );
        INSERT INTO transacciones_migrated SELECT * FROM transacciones;
        DROP TABLE transacciones;
        ALTER TABLE transacciones_migrated RENAME TO transacciones;
      `);
    }
  } catch (_) {
    // Si la tabla no existe o ya fue migrada
  }

  dbInstance = db;
  seedDatabaseIfEmpty(db);
  seedSimulatedCardsIfEmpty(db);
  seedRefundRequestsIfEmpty(db);
  ensureWarehousesTable(db);
  ensureShipmentsTableExtended(db);
  syncCatalogAndReviews(db);
  return db;
}

function getDb() {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

function recordAuditLog(db, { usuarioId = null, rol = 'sistema', accion, modulo, entidadId = '', ip = '127.0.0.1', detalles = {} }) {
  const lastRow = db.prepare('SELECT hash_cadena FROM bitacora_auditoria ORDER BY id DESC LIMIT 1').get();
  const prevHash = lastRow ? lastRow.hash_cadena : 'GENESIS_EXPRESSMART_MC001';
  const timestamp = new Date().toISOString();
  const detallesJson = JSON.stringify(detalles);
  const hashCadena = computeAuditChainHash(prevHash, {
    timestamp,
    usuario_id: usuarioId,
    rol,
    accion,
    modulo,
    detalles_json: detallesJson
  });

  db.prepare(`
    INSERT INTO bitacora_auditoria (timestamp, usuario_id, rol, accion, modulo, entidad_id, ip, detalles_json, prev_hash, hash_cadena)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(timestamp, usuarioId, rol, accion, modulo, String(entidadId), ip, detallesJson, prevHash, hashCadena);

  return hashCadena;
}

// Catálogo completo con completitud 100% conforme a ISO/IEC 25012 (Apartado 19) y diseño Stitch Aura Commerce en MXN
  const catalogDataset = [
    {
      sku: 'EM-LAP-001',
      nombre: 'Laptop ProBook Ultra 14" M3 16GB RAM 512GB SSD',
      descripcion: 'Laptop ultradelgada de alto rendimiento ideal para desarrollo de software, diseño y trabajo remoto con batería de 18 horas.',
      categoria: 'Computo',
      marca: 'TechNova',
      precio: 18499.00,
      imagen_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBTCJiWI-6-Heul2smvgxTpSo-jL8v7bDz3jlHCIgTvFooVv0glp0pD9_yUfb-Hxn0XYxAHlK-xLIosus43-09r_OJ9gG36Pb2bAc9Sy28ysb7ZJTKIyWoGx-a3fhH0vfD786wJcdJNQZjL83dOGHVC908t41RQIhO4YsmiJhKsUq3Qw7zNR5cAgPbc1EfaSbtFN4rCDccIex3egVIS6QLW-jXaRNG5TXjZsH0HKnQrgfuOjNa_xW_h',
      especificaciones: { procesador: 'Octa-Core 3.8GHz', ram: '16 GB LPDDR5', almacenamiento: '512 GB NVMe SSD', garantia: '12 meses directo' },
      condiciones_envio: 'Envío ExpressPrime gratis (24 a 48 hrs) a todo México vía DHL/FedEx con firma de recibido.',
      stock: 25
    },
    {
      sku: 'EM-AUD-002',
      nombre: 'ExpressSound Pro 900 - Audífonos Inalámbricos ANC Híbrido 65h',
      descripcion: 'Cancelación activa de ruido híbrida de 45dB, audio espacial Hi-Res LDAC, conexión multipunto Bluetooth 5.4 y hasta 65 horas de autonomía.',
      categoria: 'Audio',
      marca: 'SonicWave',
      precio: 2499.00,
      imagen_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD9x7DGUcRUPnx9tMkd8iBqtJ23_AFOqhpYkj3fWrDJlIcKI2yd36PICOhE72gaaPxS5Y9Dpqv5Q4Fb02iu4iRYffEgz5l7Y1HEe_zFPqrsqmB-khaJ4P1W9ZGk-i2lPbcAp6ueFTCKt4SAWt_iTEo2fVmbtksTh9TRylOkLWWSM-8Arg_MYNEAStON-TPpRq_1KyM1vitKx6_In4pKMAoaHDP4h2srmMUK5u70VSumliGn9nJE20hV',
      especificaciones: { conectividad: 'Bluetooth 5.4 + 3.5mm + USB-C', bateria: '65 horas', peso: '250g', garantia: '12 meses' },
      condiciones_envio: 'Envío ExpressPrime GRATIS en pedidos mayores a $599 MXN. Llega mañana en CDMX.',
      stock: 60
    },
    {
      sku: 'EM-MON-003',
      nombre: 'Monitor Curvo UltraWide 27" 4K UHD 144Hz IPS HDR400',
      descripcion: 'Monitor profesional con calibración de color de fábrica Delta E < 2, puerto USB-C 90W Power Delivery y tasa de refresco de 144Hz.',
      categoria: 'Computo',
      marca: 'VisionMax',
      precio: 6890.00,
      imagen_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDQ1NdX8iUR_vBOTMEVF6O8It3gDpYZdPZB3hW3Dl2UcJXDNsYaM8C9TbL12y-CZbnOfB08O3svEPEWukO0j_t_MjAKSgyQz9p15m_-yg9z_pxzIYFBdF0G6XmJKpZhsiRGdxnMQKTEYyWCqU19E1aignr_kuL_oQEbFTkPcgtfKJSWnkSk9PjxbCxQDIkmST_S9gigp15pEI-LHGn8nxd2Di8IoWw98ylOtk9-I2xy4VtoLB2GpM-S',
      especificaciones: { resolucion: '3840x2160 4K', panel: 'IPS 144Hz 1ms', puertos: '2x HDMI 2.1, 1x DP 1.4, USB-C 90W', garantia: '24 meses' },
      condiciones_envio: 'Envío asegurado ExpressPrime sin costo con empaque de doble protección.',
      stock: 18
    },
    {
      sku: 'EM-SMT-004',
      nombre: 'Smartwatch GalaxyNova Titanium AMOLED GPS + LTE',
      descripcion: 'Pantalla de cristal de zafiro AMOLED siempre activa, sensores avanzados de salud y ECG, resistencia al agua 50m y batería de 72 horas.',
      categoria: 'telefonia',
      marca: 'TechNova',
      precio: 12999.00,
      imagen_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD_I25Hzq_-crMeyOnuy1kHP4ka435D-xpmNhPWiqrP2XCM3De3JYQL-zut4nxmCLfVXkRHUBb1gXwrKhc_21sfLIK0iWYUVZJXIhMKVEMD3KoOezG5urma7XD80_PeFXRq1s17gsrpHGLRGRfYgCEz16vbXMrK1HQkapd-FQ8z-qW-PEN91cFvVe-1EgMHSnU4_clXOUgmr4eJZeWt1BBJVXTaE8qBkJYTl1yJa00eo3nJI1Zcek06',
      especificaciones: { pantalla: '1.9" Super AMOLED Zafiro', almacenamiento: '32 GB', conectores: 'GPS Dual + 5G LTE', red: 'Compatible iOS y Android' },
      condiciones_envio: 'Envío exprés gratis con seguro contra robo o extravío incluido.',
      stock: 32
    },
    {
      sku: 'EM-ACC-005',
      nombre: 'Teclado Mecánico Inalámbrico RGB Hot-Swap Español PBT',
      descripcion: 'Distribución ISO Español con tecla Ñ, switches táctiles silenciosos, chasis de aluminio y conexión triple (Bluetooth, 2.4GHz, USB-C).',
      categoria: 'Accesorios',
      marca: 'KeyMaster',
      precio: 1350.00,
      imagen_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBC9qDtB-vVjPL7qLlK8A9S7mFDO3qXC3A-5fyWG1LxxaL9OFov3wGFzO91CwziLpyBBnds1vhu5Z8xptAKwyvgaDAu4Zb4H08UqqbQXyPQxJ8aj3fBSj92EXf_ZuC0UT9mlrAy-slr4bWGgSxtXnccjB9MBlmobyxBgZxWGUPBUEyBraQxXtCPevJFICyidsOeLy7EPPRdfLgKcD0Zv6kjdTV6TxvJEqXACvgUiizvv3md2m7wL7WY',
      especificaciones: { switches: 'Táctil Silencioso Hot-Swap', idioma: 'Español Latinoamérica', bateria: '4000 mAh', garantia: '12 meses' },
      condiciones_envio: 'Envío gratis en compras mayores a $599 MXN; despacho el mismo día desde CEDIS CDMX.',
      stock: 45
    },
    {
      sku: 'EM-HOG-006',
      nombre: 'Cafetera Espresso Automática Barista Pro 20 Bares Acero Inox',
      descripcion: 'Sistema de extracción profesional de 20 bares con molino cónico integrado, manómetro analógico y espumador de leche térmico en acero inoxidable.',
      categoria: 'Hogar',
      marca: 'HomeElite',
      precio: 4590.00,
      imagen_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDVr-ottMVLlGk9mFLPXAIoqx_Tftu5fXahb1GNfqXLeSbM5gVOWk7TCo87ez421_n1N7BBU-qeNTlCfhzKFlfU57_Jk41UEKsXEgAe9uClKF7UBchcV2tsgZvAAZ28-A9tvZvSPo_cFGWOXczDVMHET2aRi_JB9zgHyFtz9lf_r3AqEybviaDjOqY9eWVGNyn4lXfbsHj43ez-wijgX5kdv_LX0f29pfuk9u4V0bYnXACZkW3rM2wl',
      especificaciones: { presion: '20 Bares Italian Pump', capacidad: '2.0 Litros', potencia: '1450W', garantia: '12 meses en México' },
      condiciones_envio: 'Envío terrestre asegurado sin costo en 24 a 48 horas hábiles.',
      stock: 15
    },
    {
      sku: 'EM-HOG-007',
      nombre: 'Robot Aspirador y Friegasuelos Inteligente LiDAR 6000Pa Autovaciado',
      descripcion: 'Navegación láser LiDAR 360°, mapeo multicapa inteligente para casa o departamento, control por app y base de autovaciado automático.',
      categoria: 'Hogar',
      marca: 'HomeElite',
      precio: 5499.00,
      imagen_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDd11LBJ4Te8iSIKmTm_ZWGl3RkDB_rTtvmLOvwYW4iGhdJphhxet2bWfF91z6OmzfsuCw_Q_2I_2ZiaKxjjO9v1GyhBt9IFiftuQgKyJVwRbmTLSy9rmZFjxi0spysqUKqa1LpS1iqq32Lpl2nWWS_4VajOWcOKJ9_OYc9kTyAd1n6xVDZO294QpaTmRePDjE4rhrUl42hC2o6ao49O_UMQFVEcTNL1AXpLEyhog1zr4uo5rpm5tb_',
      especificaciones: { succion: '6000 Pa HyperForce', navegacion: 'Láser LiDAR 3D', autonomia: '180 minutos', garantia: '24 meses' },
      condiciones_envio: 'Envío ExpressPrime gratis a todo México con entrega garantizada.',
      stock: 22
    },
    {
      sku: 'EM-AUD-008',
      nombre: 'Bocina Inteligente Bluetooth 360° BassBoost Impermeable IP67',
      descripcion: 'Sonido envolvente de 360 grados con radiadores pasivos duales, resistencia total al agua y polvo IP67 y 24 horas de batería continua.',
      categoria: 'Audio',
      marca: 'SonicWave',
      precio: 1299.00,
      imagen_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBL9jxxCFrAocO5nCuzT5PfX44RSiQ6Nct7y1zMK4Yoq2xsYt9EO1kd5pgfKAc1JIaoNUGzVICn4dWrvHi_moybHOdm_P2H3ACaZJVkSMsFnrXaD9I1cvzVtdvNUD6Ts0yIGa8d6yV15txPZpzrhqH8m9rCeaKUwqaUofPkA_g6-QdMQYiMB1jFNsEQDSELU1TTk07MTEvcmEDGwgu0aT6sUwSOMSxx1QfyZPU411gTWBsE1QqJUl5d',
      especificaciones: { potencia: '40W RMS', resistencia: 'IP67 Sumergible', bateria: '24 horas', garantia: '12 meses' },
      condiciones_envio: 'Envío ExpressPrime gratis en 24 hrs desde CEDIS CDMX.',
      stock: 38
    },
    {
      sku: 'EM-GAM-009',
      nombre: 'Consola Portátil NovaDeck OLED 1TB AMD Zen4 16GB LPDDR5',
      descripcion: 'Pantalla OLED 7.4" HDR a 90Hz, procesador AMD Custom Zen4 con gráficos RDNA 3, 1TB NVMe SSD de alta velocidad y ergonomía premium para juego AAA.',
      categoria: 'Accesorios',
      marca: 'GameCraft',
      precio: 14999.00,
      imagen_url: '/assets/productos/novadeck-oled.jpg',
      especificaciones: { procesador: 'AMD Zen 4 8-Core', pantalla: '7.4" OLED 90Hz HDR', almacenamiento: '1TB NVMe SSD', bateria: '50Wh (hasta 12h)', garantia: '12 meses' },
      condiciones_envio: 'Envío ExpressPrime gratis a todo México con entrega en 24 hrs y empaque sellado.',
      stock: 20
    },
    {
      sku: 'EM-COM-010',
      nombre: 'Computadora Todo en Uno UltraView 24" Core i7 16GB 1TB SSD',
      descripcion: 'Workstation estilizada All-in-One con chasis de aluminio pulido, pantalla IPS FHD antireflejante, cámara web 1080p retráctil y audio Dolby.',
      categoria: 'Computo',
      marca: 'VisionMax',
      precio: 16890.00,
      imagen_url: '/assets/productos/all-in-one-ultraview.jpg',
      especificaciones: { procesador: 'Intel Core i7 13700T', ram: '16GB DDR5 5200MHz', pantalla: '23.8" FHD IPS sRGB 99%', conectividad: 'Wi-Fi 6E + Bluetooth 5.3', garantia: '24 meses' },
      condiciones_envio: 'Envío frágil asegurado sin costo adicional desde CEDIS CDMX.',
      stock: 14
    },
    {
      sku: 'EM-AUD-011',
      nombre: 'Micrófono Condensador de Estudio USB-C RGB Brazo Metálico',
      descripcion: 'Cápsula cardioide de 24 bits / 192kHz, filtro antipop integrado, control de ganancia analógico y montaje antivibración profesional para streaming.',
      categoria: 'Audio',
      marca: 'SonicWave',
      precio: 1899.00,
      imagen_url: '/assets/productos/microfono-estudio-rgb.jpg',
      especificaciones: { resolucion: '24-bit / 192kHz', patron: 'Cardioide con silenciador táctil', conexion: 'USB-C / Jack 3.5mm latencia cero', garantia: '12 meses' },
      condiciones_envio: 'Envío ExpressPrime gratis en compras a partir de $599 MXN.',
      stock: 40
    },
    {
      sku: 'EM-ACC-012',
      nombre: 'Mouse Ergonómico Inalámbrico Vertical Dual Sensor 4000 DPI',
      descripcion: 'Diseño ergonómico con ángulo de 57° que reduce la fatiga muscular del antebrazo, rueda de desplazamiento magnética y batería recargable por USB-C.',
      categoria: 'Accesorios',
      marca: 'KeyMaster',
      precio: 899.00,
      imagen_url: '/assets/productos/mouse-ergonomico-vertical.jpg',
      especificaciones: { conexion: 'Bluetooth + Receptor USB 2.4GHz', sensor: 'Óptico 4000 DPI ajustable', bateria: 'Batería Li-Po 500mAh (4 meses)', garantia: '12 meses' },
      condiciones_envio: 'Envío express el mismo día para pedidos antes de las 14:00 hrs.',
      stock: 55
    },
    {
      sku: 'EM-TEL-013',
      nombre: 'Smartphone Apex 12 Pro 5G 256GB Cámara Leica 108MP 120Hz',
      descripcion: 'Potencia pura con Snapdragon 8 Gen 3, pantalla AMOLED LTPO 120Hz de 6.7 pulgadas, carga ultrarrápida de 120W HyperCharge y resistencia al agua IP68.',
      categoria: 'telefonia',
      marca: 'ApexTech',
      precio: 13499.00,
      imagen_url: '/assets/productos/smartphone-apex-12-pro.jpg',
      especificaciones: { procesador: 'Snapdragon 8 Gen 3', camara: 'Triple 108MP + 50MP Telefoto', bateria: '5000 mAh Carga 120W', red: '5G Dual SIM México', garantia: '12 meses' },
      condiciones_envio: 'Envío prioritario con firma de entrega y seguro de trayecto total.',
      stock: 28
    },
    {
      sku: 'EM-HOG-014',
      nombre: 'Freidora de Aire Digital DualZone 8L 1800W con Ventana LED',
      descripcion: 'Doble canasta independiente de 4L cada una para cocinar dos platillos a la vez con tecnología SyncCook, panel táctil digital con 10 preajustes.',
      categoria: 'Hogar',
      marca: 'HomeElite',
      precio: 2299.00,
      imagen_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBOYsOkQ6_GBPFlVb9W1snXq3HY8VF90bi5TOvBhKvQD8oLjZXOE1ZHbTNSX95tEaAlXCZK31PcDP5xZ6rZo2wyF-W1WVBroq55aSmrT0mHgGIm_AREXr8lQHIAyrChEpSncO2Rhp5K0liyvXKoBkleZDeTp68y6SIKBkIepl6sQw7E3iyMn-rHE8Q1FZ7wAC3b9Opiif_BQWQIE_GQQzAZtANfEJp1ipBqpzAEE0PDNubDkhtlvCLT',
      especificaciones: { capacidad: '8.0 Litros (2x 4.0L)', potencia: '1800 Watts', funciones: '10 programas automáticos + Deshidratar', garantia: '12 meses' },
      condiciones_envio: 'Envío terrestre sin costo con entrega estimada en 24 a 48 horas.',
      stock: 35
    },
    {
      sku: 'EM-HOG-015',
      nombre: 'Licuadora de Alta Potencia SilentBlend 1500W Vaso Tritan 2L',
      descripcion: 'Motor de 1500W con cuchillas de acero inoxidable de grado quirúrgico, campana de insonorización para uso ultrasilencioso y programas automáticos para smoothies y hielo.',
      categoria: 'Hogar',
      marca: 'HomeElite',
      precio: 1750.00,
      imagen_url: '/assets/productos/licuadora-silentblend.jpg',
      especificaciones: { potencia: '1500W Peak', vaso: 'Tritan libre de BPA 2.0 Litros', velocidades: '6 velocidades variables + Pulso', garantia: '24 meses' },
      condiciones_envio: 'Envío asegurado ExpressPrime gratis desde CEDIS Vallejo.',
      stock: 25
    },
    {
      sku: 'EM-ACC-016',
      nombre: 'Silla Ergonómica Ejecutiva Soporte Lumbar 3D Malla Transpirable',
      descripcion: 'Diseño anatómico con soporte lumbar adaptativo, reposabrazos 3D multidireccionales, reclinación hasta 135° y pistón de gas Clase 4 certificado BIFMA.',
      categoria: 'Accesorios',
      marca: 'KeyMaster',
      precio: 3890.00,
      imagen_url: '/assets/productos/silla-ergonomica-ejecutiva.jpg',
      especificaciones: { material: 'Malla mesh transpirable + Aluminio', soporte: 'Hasta 150 kg', certificacion: 'BIFMA / ANSI', garantia: '36 meses' },
      condiciones_envio: 'Envío especializado con caja reforzada y manual de ensamble rápido.',
      stock: 19
    },
    {
      sku: 'EM-COM-017',
      nombre: 'Laptop Gamer Titan 16" QHD 240Hz RTX 4070 Intel i9 32GB 1TB',
      descripcion: 'Potencia descomunal para gamers y creadores: Intel Core i9 14900HX, GPU NVIDIA GeForce RTX 4070 8GB GDDR6, 32GB RAM DDR5 y pantalla de 240Hz G-Sync.',
      categoria: 'Computo',
      marca: 'ApexTech',
      precio: 28999.00,
      imagen_url: '/assets/productos/laptop-gamer-titan.jpg',
      especificaciones: { procesador: 'Intel Core i9-14900HX 24-Cores', gpu: 'NVIDIA RTX 4070 8GB 140W', pantalla: '16" QHD 2560x1600 240Hz', ram: '32GB DDR5 5600MHz', garantia: '12 meses' },
      condiciones_envio: 'Envío prioritario con seguro total anti-siniestro incluido.',
      stock: 12
    },
    {
      sku: 'EM-TEL-018',
      nombre: 'Tablet UltraPad Pro 12" 2K 120Hz 128GB Wi-Fi con Stylus Pen',
      descripcion: 'Chasis unibody metálico ultrafino de 6.1mm, 4 altavoces estéreo sintonizados por AKG, pantalla IPS 2K a 120Hz y soporte magnético para stylus activo.',
      categoria: 'telefonia',
      marca: 'ApexTech',
      precio: 7499.00,
      imagen_url: '/assets/productos/tablet-ultrapad-pro.jpg',
      especificaciones: { pantalla: '12" 2K IPS 120Hz', almacenamiento: '128GB UFS 3.1 + MicroSD', stylus: 'Stylus activo 4096 niveles incluido', garantia: '12 meses' },
      condiciones_envio: 'Envío ExpressPrime sin costo con entrega en 24 horas hábiles.',
      stock: 30
    },
    {
      sku: 'EM-AUD-019',
      nombre: 'Barra de Sonido CinemaSurround 3.1 Dolby Atmos 360W Subwoofer',
      descripcion: 'Inmersión acústica cinematográfica en tu sala: decodificación nativa Dolby Atmos y DTS:X, subwoofer inalámbrico de 8 pulgadas y entradas HDMI eARC y óptica.',
      categoria: 'Audio',
      marca: 'SonicWave',
      precio: 4699.00,
      imagen_url: '/assets/productos/barra-sonido-cinemasurround.jpg',
      especificaciones: { potencia: '360W RMS Total', canales: '3.1 Canales con canal central vocal', conectividad: 'HDMI eARC + Óptico + Bluetooth 5.3', garantia: '12 meses' },
      condiciones_envio: 'Envío express protegido con espuma de polietileno de alta densidad.',
      stock: 16
    },
    {
      sku: 'EM-HOG-020',
      nombre: 'Purificador de Aire Inteligente True HEPA H13 Carbón Activo',
      descripcion: 'Elimina el 99.97% de polvo, alérgenos, humo y bacterias en áreas de hasta 55 m². Sensor de partículas PM2.5 láser y monitoreo en tiempo real.',
      categoria: 'Hogar',
      marca: 'HomeElite',
      precio: 2890.00,
      imagen_url: '/assets/productos/purificador-aire-hepa.jpg',
      especificaciones: { filtro: 'True HEPA H13 + Carbón activado', cad: '380 m³/h', nivelRuido: 'Desde 22 dB en modo noche', garantia: '24 meses' },
      condiciones_envio: 'Envío ExpressPrime gratis a toda la República Mexicana.',
      stock: 26
    },
    {
      sku: 'EM-TV-021',
      nombre: 'Pantalla SAMSUNG 75" Crystal UHD 4K Smart TV UN75AU7000FXZX',
      descripcion: 'Pantalla inteligente gigante de 75 pulgadas Crystal UHD 4K, HDR10+, procesador Crystal 4K, sonido Q-Symphony y sistema operativo Tizen oficial.',
      categoria: 'Electronica',
      marca: 'Samsung',
      precio: 14999.00,
      imagen_url: '/assets/productos/samsung-75-crystal-uhd.jpg',
      especificaciones: { pantalla: '75" 4K UHD 3840x2160', procesador: 'Crystal Processor 4K', hdr: 'HDR10+ / HLG', conectividad: '3x HDMI, 1x USB, Wi-Fi 5, Bluetooth', audio: '20W con Q-Symphony', garantia: '12 meses directo con Samsung México' },
      condiciones_envio: 'Envío ExpressPrime especializado y asegurado sin costo a toda la República Mexicana.',
      stock: 15
    },
    {
      sku: 'EM-GAM-022',
      nombre: 'Consola Nintendo Switch 2 Pantalla OLED HDR 120Hz 256GB',
      descripcion: 'La nueva generación de Nintendo: pantalla OLED de 8 pulgadas HDR a 120Hz, Joy-Con magnéticos, retrocompatibilidad completa y salida 4K en base dock.',
      categoria: 'Videojuegos',
      marca: 'Nintendo',
      precio: 9999.00,
      imagen_url: '/assets/productos/nintendo-switch-2.webp',
      especificaciones: { pantalla: '8" OLED HDR 1080p 120Hz', almacenamiento: '256GB UFS ultrarrápido', gpu: 'NVIDIA personalizada con DLSS y Ray Tracing', modoTv: 'Salida 4K 60fps HDMI 2.1', garantia: '12 meses oficial Nintendo México' },
      condiciones_envio: 'Envío prioritario ExpressPrime en 24h con empaque sellado de fábrica.',
      stock: 25
    },
    {
      sku: 'EM-GAM-023',
      nombre: 'Consola Microsoft Xbox Series S 512GB SSD All-Digital Blanco',
      descripcion: 'Rendimiento de última generación en el diseño más compacto de Xbox con tiempos de carga instantáneos Xbox Velocity Architecture y hasta 120 FPS.',
      categoria: 'Videojuegos',
      marca: 'Microsoft',
      precio: 5799.00,
      imagen_url: '/assets/productos/xbox-series-s.png',
      especificaciones: { procesador: 'AMD Zen 2 de 8 núcleos a 3.6 GHz', gpu: 'AMD RDNA 2 de 4 TFLOPS', almacenamiento: '512GB NVMe SSD', resolucion: '1440p hasta 120 FPS', audio: 'Dolby Atmos y Dolby Vision', garantia: '12 meses oficial Microsoft México' },
      condiciones_envio: 'Envío ExpressPrime gratis asegurado con entrega al día siguiente.',
      stock: 20
    },
    {
      sku: 'EM-GAM-024',
      nombre: 'Gears of War: E-Day Preventa Oficial Xbox Series X|S / PC Windows',
      descripcion: 'El regreso a los orígenes en Unreal Engine 5. Sigue a Marcus Fenix y Dom Santiago durante las primeras 24 horas del Día de la Emergencia.',
      categoria: 'Videojuegos',
      marca: 'Xbox Game Studios',
      precio: 1599.00,
      imagen_url: '/assets/productos/gears-of-war-eday.webp',
      especificaciones: { plataforma: 'Xbox Series X|S y PC (Play Anywhere)', motor: 'Unreal Engine 5 Lumen & Nanite', cooperativo: 'Campaña coop local y online', idioma: 'Español Latino oficial', garantia: 'Garantía oficial Xbox' },
      condiciones_envio: 'Preventa con código DLC de bonificación y entrega garantizada en lanzamiento.',
      stock: 40
    },
    {
      sku: 'EM-LIB-025',
      nombre: 'Libro Gears of War: El Fin de la Coalición - Novela Canónica',
      descripcion: 'Edición oficial en español de la aclamada novela de Karen Traviss sobre la caída de la Coalición tras el hundimiento de la meseta de Jacinto.',
      categoria: 'Libros',
      marca: 'Timun Mas / Xbox',
      precio: 489.00,
      imagen_url: '/assets/productos/gears-fin-coalicion.webp',
      especificaciones: { autor: 'Karen Traviss', paginas: '448 páginas', encuadernacion: 'Rústica con solapas acabado mate', idioma: 'Español oficial', isbn: '978-8448008892' },
      condiciones_envio: 'Envío ExpressPrime en sobre acolchado de alta protección.',
      stock: 35
    },
    {
      sku: 'EM-PEL-026',
      nombre: 'La Familia P. Luche Colección Completa 3 Temporadas Remasterizada DVD',
      descripcion: 'Edición completa de colección con las 3 temporadas de la comedia más popular de la televisión mexicana creada por Eugenio Derbez.',
      categoria: 'Entretenimiento',
      marca: 'Televisa Home Entertainment',
      precio: 549.00,
      imagen_url: '/assets/productos/familia-peluche-dvd.jpg',
      especificaciones: { formato: 'DVD Región 1 y 4 (Multizona México)', audio: 'Español Dolby Digital 2.0', discos: '6 discos DVD con estuche coleccionador', extras: 'Bloopers y detrás de cámaras', duracion: 'Aprox. 1,800 minutos' },
      condiciones_envio: 'Envío ExpressPrime garantizado a toda la República Mexicana.',
      stock: 30
    },
    {
      sku: 'EM-DEP-027',
      nombre: 'Proteína Dymatize Elite 100% Whey 5 lbs (2.27 kg) Rich Chocolate',
      descripcion: '25g de proteína 100% suero de leche de absorción rápida por porción, 5.5g de BCAAs y delicioso sabor chocolate. Certificación Informed Choice.',
      categoria: 'Deportes',
      marca: 'Dymatize Nutrition',
      precio: 1699.00,
      imagen_url: '/assets/productos/elite-whey-protein.webp',
      especificaciones: { contenidoNeto: '5 lbs (2,270 g - 63 porciones)', proteinaPorPorcion: '25 g de proteína de suero', bcaa: '5.5 g aminoácidos ramificados', sabor: 'Rich Chocolate', certificacion: 'Informed Choice / GMP' },
      condiciones_envio: 'Envío ExpressPrime en caja sellada con precinto de seguridad intacto.',
      stock: 28
    },
    {
      sku: 'EM-AGR-028',
      nombre: 'Llanta Para Tractor Agrícola 9.5-16 (6c) R-1 Fortmaster TT',
      descripcion: 'Neumático agrícola de tracción profunda con barras en ángulo R-1 para tractores agrícolas y maquinaria de campo. 6 capas reforzadas contra pinchazos.',
      categoria: 'Automotriz',
      marca: 'Fortmaster',
      precio: 4250.00,
      imagen_url: '/assets/productos/llanta-tractor-fortmaster.webp',
      especificaciones: { medida: '9.5-16', lonas: '6 Capas (6 PR)', disenoBanda: 'R-1 tracción profunda lodo/campo', tipo: 'Tube Type (TT)', cargaMaxima: 'Hasta 950 kg por neumático' },
      condiciones_envio: 'Envío terrestre especializado de carga pesada asegurado a todo México.',
      stock: 14
    },
    {
      sku: "EM-COM-029",
      nombre: "Router Wi-Fi 6 AX3000 Doble Banda Gigabit TP-Link Archer AX55",
      descripcion: "Enrutador Wi-Fi 6 de última generación con velocidades combinadas de hasta 3 Gbps, tecnología OFDMA, MU-MIMO y 4 antenas de alta ganancia para cobertura completa.",
      categoria: "Computo",
      marca: "TP-Link",
      precio: 1499.00,
      imagen_url: "/assets/productos/router-wifi6-tplink.jpg",
      especificaciones: {"velocidad":"AX3000 (2402 Mbps en 5GHz + 574 Mbps en 2.4GHz)","procesador":"Dual-Core CPU Qualcomm","puertos":"1x WAN Gigabit + 4x LAN Gigabit + 1x USB 3.0","seguridad":"WPA3 y TP-Link HomeShield","cobertura":"Casas de 3 a 4 recámaras"},
      condiciones_envio: "Envío ExpressPrime asegurado con empaque antiestático.",
      stock: 35
    },
    {
      sku: "EM-COM-030",
      nombre: "Monitor Curvo UltraWide 34\" WQHD 165Hz HDR400 Dell Gaming S3422DWG",
      descripcion: "Monitor gamer curvo 1800R con resolución WQHD (3440 x 1440), panel VA con 90% DCI-P3, tasa de refresco de 165Hz y tiempo de respuesta de 1ms MPRT con AMD FreeSync Premium Pro.",
      categoria: "Computo",
      marca: "Dell",
      precio: 8999.00,
      imagen_url: "/assets/productos/monitor-curvo-ultrawide.jpg",
      especificaciones: {"resolucion":"WQHD 3440 x 1440 (21:9)","tasaRefresco":"165Hz DisplayPort / 100Hz HDMI","curvatura":"1800R","brillo":"400 cd/m² (VESA DisplayHDR 400)","puertos":"2x HDMI 2.0, 1x DP 1.4, Hub USB 3.2"},
      condiciones_envio: "Envío terrestre especializado para pantallas con embalaje de máxima protección.",
      stock: 18
    },
    {
      sku: "EM-COM-031",
      nombre: "Disco Sólido SSD NVMe M.2 2TB PCIe 4.0 Samsung 990 PRO 7450MB/s",
      descripcion: "Unidad de estado sólido NVMe Gen 4x4 de máximo rendimiento para gaming profesional y edición de video 4K/8K. Eficiencia térmica optimizada con disipador de níquel.",
      categoria: "Computo",
      marca: "Samsung",
      precio: 3499.00,
      imagen_url: "/assets/productos/ssd-nvme-samsung-990pro.jpg",
      especificaciones: {"capacidad":"2TB (2,000 GB)","interfaz":"PCIe Gen 4.0 x4, NVMe 2.0","velocidadLectura":"Hasta 7,450 MB/s","velocidadEscritura":"Hasta 6,900 MB/s","durabilidad":"1200 TBW / 5 años garantía"},
      condiciones_envio: "Envío inmediato en sobre de burbuja acolchado con sello de inviolabilidad.",
      stock: 45
    },
    {
      sku: "EM-COM-032",
      nombre: "Impresora Multifuncional Tanque de Tinta Continua Wi-Fi Epson EcoTank L3250",
      descripcion: "Impresora multifuncional 3 en 1 (imprime, copia y escanea) con sistema de tanque de tinta recargable EcoTank. Costo de impresión ultra bajo y conectividad inalámbrica con Smart Panel.",
      categoria: "Computo",
      marca: "Epson",
      precio: 3899.00,
      imagen_url: "/assets/productos/impresora-epson-ecotank.jpg",
      especificaciones: {"rendimiento":"Hasta 4,500 páginas en negro / 7,500 a color por carga","conectividad":"Wi-Fi, Wi-Fi Direct y USB 2.0","resolucion":"5760 x 1440 dpi","velocidad":"33 ppm en negro, 15 ppm color","compatibilidad":"Windows, macOS, iOS y Android"},
      condiciones_envio: "Envío en caja original con botellas de tinta iniciales selladas de fábrica.",
      stock: 26
    },
    {
      sku: "EM-COM-033",
      nombre: "Memoria RAM DDR5 32GB (2x16GB) 6000MHz CL30 Corsair Vengeance RGB",
      descripcion: "Kit de memoria RAM DDR5 de alto desempeño optimizado para plataformas Intel XMP 3.0 y AMD EXPO. Iluminación RGB dinámica direccionable de diez zonas por módulo.",
      categoria: "Computo",
      marca: "Corsair",
      precio: 2299.00,
      imagen_url: "/assets/productos/ram-ddr5-corsair-vengeance.jpg",
      especificaciones: {"capacidad":"32GB (2x16GB)","tipo":"DDR5 288-pin UDIMM","velocidad":"6000 MHz","latencia":"CL30-36-36-76","perfiles":"Intel XMP 3.0 & AMD EXPO compatible"},
      condiciones_envio: "Envío ExpressPrime con empaque antiestático de protección grado industrial.",
      stock: 40
    },
    {
      sku: "EM-COM-034",
      nombre: "Cámara Web 4K Ultra HD con Micrófonos Estéreo Duales Logitech Brio 4K",
      descripcion: "Webcam profesional para streaming y videollamadas ejecutivas con resolución 4K a 30fps o 1080p a 60fps, tecnología RightLight 3 con HDR y sensor de infrarrojos compatible con Windows Hello.",
      categoria: "Computo",
      marca: "Logitech",
      precio: 2899.00,
      imagen_url: "/assets/productos/webcam-logitech-brio-4k.jpg",
      especificaciones: {"resolucion":"4K Ultra HD / 1080p Full HD a 60 fps","campoVision":"Ajustable a 65°, 78° y 90°","zoom":"Digital 5x en Full HD","microfonos":"Omnidireccionales dobles con reducción de ruido","conexion":"USB-C a USB-A desmontable"},
      condiciones_envio: "Envío rápido protegido con funda de transporte y tapa de privacidad incluida.",
      stock: 32
    },
    {
      sku: "EM-COM-035",
      nombre: "Tarjeta Madre ASUS ROG Strix B650-A Gaming WiFi Socket AM5 DDR5",
      descripcion: "Placa base ATX para procesadores AMD Ryzen serie 7000/8000/9000 con 12+2 fases de poder, PCIe 5.0 M.2, Wi-Fi 6E integrado, disipadores plateados masivos y audio SupremeFX.",
      categoria: "Computo",
      marca: "ASUS",
      precio: 4699.00,
      imagen_url: "/assets/productos/motherboard-asus-rog-strix.jpg",
      especificaciones: {"socket":"AMD AM5 (LGA 1718)","factorForma":"ATX","soporteMemoria":"4x DDR5 hasta 7600+(OC) MHz","conectividad":"Wi-Fi 6E + Intel 2.5Gb Ethernet","ranurasM2":"3x M.2 (1x PCIe 5.0 + 2x PCIe 4.0)"},
      condiciones_envio: "Envío asegurado en caja sellada con precintos holográficos de fábrica.",
      stock: 15
    },
    {
      sku: "EM-COM-036",
      nombre: "Fuente de Poder Modular 850W 80 Plus Gold Corsair RM850e ATX 3.0",
      descripcion: "Fuente de alimentación totalmente modular de bajo ruido con certificación 80 PLUS Gold y Cybenetics Platinum. Cumple con el estándar ATX 3.0 y PCIe 5.0 con conector nativo 12VHPWR.",
      categoria: "Computo",
      marca: "Corsair",
      precio: 2499.00,
      imagen_url: "/assets/productos/fuente-corsair-rm850e.jpg",
      especificaciones: {"potencia":"850 Watts continuos","certificacion":"80 PLUS Gold (hasta 90% de eficiencia)","estandar":"ATX 3.0 / PCIe 5.0 Ready (cable 12VHPWR incluido)","ventilador":"120mm con modo Zero RPM a baja carga","protecciones":"OVP, OCP, OTP, SCP, UVP, OPP"},
      condiciones_envio: "Envío prioritario con bolsa de cables modulares completa y accesorios.",
      stock: 22
    },
    {
      sku: "EM-AUD-037",
      nombre: "Audífonos Inalámbricos Over-Ear Noise Cancelling Sony WH-1000XM5 Negro",
      descripcion: "Líder en cancelación de ruido con dos procesadores y 8 micrófonos dedicados. Audio de alta resolución LDAC, llamadas ultranítidas con IA y hasta 30 horas de batería continua.",
      categoria: "Audio",
      marca: "Sony",
      precio: 6499.00,
      imagen_url: "/assets/productos/audifonos-sony-wh1000xm5.jpg",
      especificaciones: {"driver":"30 mm con diafragma de fibra de carbono","cancelacionRuido":"Auto NC Optimizer con doble procesador V1 y QN1","duracionBateria":"Hasta 30 hrs con ANC / Carga rápida 3 min = 3 hrs","codecs":"LDAC, AAC, SBC","peso":"250 gramos"},
      condiciones_envio: "Envío express asegurado en estuche rígido de viaje colapsable.",
      stock: 25
    },
    {
      sku: "EM-AUD-038",
      nombre: "Bocina Bluetooth Portátil Resistente al Agua IP67 JBL Charge 5 40W",
      descripcion: "Altavoz inalámbrico resistente al agua y polvo con sonido JBL Original Pro Sound. Conductor de excursión larga, tweeter separado y dos radiadores pasivos de bajos.",
      categoria: "Audio",
      marca: "JBL",
      precio: 2899.00,
      imagen_url: "/assets/productos/bocina-jbl-charge-5.jpg",
      especificaciones: {"potenciaSalida":"30W RMS woofer + 10W RMS tweeter (40W total)","resistencia":"Certificación IP67 contra agua y polvo","bateria":"Hasta 20 horas de reproducción (7500 mAh)","funcionPowerbank":"Puerto USB-A para recargar tu celular","conectividad":"Bluetooth 5.1 y JBL PartyBoost"},
      condiciones_envio: "Envío protegido con caja sellada y cable USB-C de alta resistencia.",
      stock: 38
    },
    {
      sku: "EM-AUD-039",
      nombre: "Auriculares In-Ear Deportivos True Wireless Jabra Elite 8 Active IP68",
      descripcion: "Los audífonos deportivos más resistentes del mundo según estándares militares (MIL-STD-810H). Cancelación activa de ruido adaptativa y sonido espacial Dolby Audio.",
      categoria: "Audio",
      marca: "Jabra",
      precio: 3299.00,
      imagen_url: "/assets/productos/auriculares-jabra-elite-8.jpg",
      especificaciones: {"proteccion":"IP68 a prueba de agua, sudor y caídas (estuche IP54)","bateria":"Hasta 32 horas en total con el estuche de carga","tecnologias":"Adaptive Hybrid ANC, Dolby Spatial Sound y HearThrough","conexion":"Bluetooth 5.3 con Multipoint y Fast Pair","almohadillas":"Tecnología ShakeGrip de silicona líquida"},
      condiciones_envio: "Envío ExpressPrime garantizado con 3 pares de almohadillas EarGels.",
      stock: 29
    },
    {
      sku: "EM-AUD-040",
      nombre: "Micrófono Lavalier Inalámbrico Dual con Cancelación de Ruido DJI Mic 2",
      descripcion: "Sistema de audio profesional para creadores de contenido y entrevistas. Grabación interna flotante de 32 bits, cancelación de ruido inteligente y alcance de hasta 250 metros.",
      categoria: "Audio",
      marca: "DJI",
      precio: 5899.00,
      imagen_url: "/assets/productos/microfono-dji-mic-2.jpg",
      especificaciones: {"canales":"Dual Channel (2 transmisores + 1 receptor)","grabacionInterna":"8 GB interna de audio flotante de 32 bits (14 horas)","alcance":"Hasta 250 m en línea recta sin obstáculos","compatibilidad":"Cámaras DSLR, smartphones USB-C y Lightning","autonomia":"Hasta 18 horas de uso con el estuche de carga"},
      condiciones_envio: "Envío asegurado en estuche metálico de carga con adaptadores magnéticos.",
      stock: 20
    },
    {
      sku: "EM-AUD-041",
      nombre: "Amplificador DAC Portátil de Alta Fidelidad FiiO BTR7 Bluetooth LDAC",
      descripcion: "Receptor Bluetooth y DAC USB con amplificación dual THX AAA-28 balanceada. Pantalla IPS a color de 1.3 pulgadas, soporte MQA y salida balanceada de 4.4mm y 3.5mm.",
      categoria: "Audio",
      marca: "FiiO",
      precio: 3799.00,
      imagen_url: "/assets/productos/amplificador-dac-fiio-btr7.jpg",
      especificaciones: {"dac":"Dual ES9219C x 2","amplificacion":"THX AAA-28 x 2 balanceado","salidas":"3.5mm Single Ended + 4.4mm Balanceada","resolucion":"PCM 384kHz/32bit y DSD256 nativo vía USB","bluetooth":"Bluetooth 5.1 con LDAC, aptX HD, aptX Adaptive"},
      condiciones_envio: "Envío rápido en caja de colección con funda de cuero sintético y cables USB-C.",
      stock: 16
    },
    {
      sku: "EM-AUD-042",
      nombre: "Barra de Sonido Compacta con Subwoofer Inalámbrico Bose TV Speaker",
      descripcion: "Barra de sonido diseñada para ofrecer diálogos nítidos y graves profundos al instante. Conexión sencilla por cable óptico o HDMI ARC, y conectividad Bluetooth para música.",
      categoria: "Audio",
      marca: "Bose",
      precio: 5499.00,
      imagen_url: "/assets/productos/barra-sonido-bose-tv.jpg",
      especificaciones: {"configuracion":"2 transductores de rango completo + 1 tweeter central","modoDialogo":"Realce de voz para no perder una sola palabra","entradas":"HDMI ARC, Óptico digital, Auxiliar 3.5mm, USB","dimensiones":"5.6 cm x 59.4 cm x 10.2 cm","control":"Control remoto por infrarrojos incluido"},
      condiciones_envio: "Envío seguro en caja acolchada oficial con cable óptico incluido.",
      stock: 24
    },
    {
      sku: "EM-TEL-043",
      nombre: "Smartphone Samsung Galaxy S24 Ultra 5G 512GB Titanium Gray",
      descripcion: "El buque insignia de Samsung con marco de titanio, pantalla plana Dynamic AMOLED 2X de 6.8\" 120Hz, cámara de 200MP con zoom óptico 5x/10x, procesador Snapdragon 8 Gen 3 e IA Galaxy AI.",
      categoria: "telefonia",
      marca: "Samsung",
      precio: 23999.00,
      imagen_url: "/assets/productos/samsung-galaxy-s24-ultra.jpg",
      especificaciones: {"pantalla":"6.8\" QHD+ Dynamic AMOLED 2X (2600 nits)","procesador":"Snapdragon 8 Gen 3 for Galaxy (4nm)","camaraPrincipal":"200 MP + 50 MP (periscopio 5x) + 12 MP ultra gran angular + 10 MP telefoto 3x","bateria":"5,000 mAh con carga de 45W","extras":"S-Pen integrado con latencia de 2.8ms y resistencia IP68"},
      condiciones_envio: "Envío prioritario con seguro total de tránsito y entrega bajo firma.",
      stock: 19
    },
    {
      sku: "EM-TEL-044",
      nombre: "Cargador Rápido GaN 100W 4 Puertos USB-C PD 3.0 UGREEN Nexode",
      descripcion: "Cargador de pared con tecnología de nitruro de galio (GaN II) de tamaño compacto. Capaz de cargar simultáneamente 3 laptops y 1 smartphone a máxima velocidad con protección térmica.",
      categoria: "telefonia",
      marca: "UGREEN",
      precio: 999.00,
      imagen_url: "/assets/productos/cargador-gan-100w-ugreen.jpg",
      especificaciones: {"potenciaMaxima":"100 Watts USB Power Delivery","puertos":"3x USB-C + 1x USB-A","protocolos":"PD 3.0, PPS, QC 4+, AFC, FCP","proteccion":"Thermal Guard con escaneo térmico de 800 lecturas/seg","clavija":"Plegable tipo americana ideal para viajes"},
      condiciones_envio: "Envío ExpressPrime en paquete individual sellado.",
      stock: 50
    },
    {
      sku: "EM-TEL-045",
      nombre: "Batería Portátil Power Bank 24,000mAh 140W Anker Prime 737",
      descripcion: "Batería externa de alta capacidad con pantalla inteligente digital. Entrega hasta 140W de salida por un solo puerto USB-C, recargando una MacBook Pro al 50% en solo 28 minutos.",
      categoria: "telefonia",
      marca: "Anker",
      precio: 2499.00,
      imagen_url: "/assets/productos/powerbank-anker-737.jpg",
      especificaciones: {"capacidad":"24,000 mAh / 86.4 Wh (aprobada para aviones)","salidaMaxima":"140W Power Delivery 3.1","pantalla":"OLED a color con métricas de voltaje, potencia y salud de batería","recargaRapida":"Recarga completa del power bank en solo 52 minutos a 140W","puertos":"2x USB-C bidireccionales + 1x USB-A"},
      condiciones_envio: "Envío asegurado con empaque reglamentario para baterías de litio UN3480.",
      stock: 30
    },
    {
      sku: "EM-TEL-046",
      nombre: "Estabilizador Gimbal Inteligente de 3 Ejes para Celular DJI Osmo Mobile 6",
      descripcion: "Gimbal portátil con barra de extensión integrada, inicio rápido al desplegarse y seguimiento ActiveTrack 6.0 que mantiene a los sujetos siempre en el encuadre perfecto.",
      categoria: "telefonia",
      marca: "DJI",
      precio: 2799.00,
      imagen_url: "/assets/productos/gimbal-dji-osmo-mobile-6.jpg",
      especificaciones: {"estabilizacion":"Cardán motorizado en 3 ejes de grado profesional","extension":"Brazo telescópico integrado de 215 mm","pesoSoportado":"Smartphones de hasta 290 gramos","modosGrabacion":"Timelapse, Motionlapse, Hyperlapse, DynamicZoom","conectividad":"Bluetooth 5.1 con app DJI Mimo"},
      condiciones_envio: "Envío rápido con tripié de sobremesa, abrazadera magnética y estuche de viaje.",
      stock: 22
    },
    {
      sku: "EM-TEL-047",
      nombre: "Soporte MagSafe de Carga Inalámbrica 3 en 1 Belkin BoostCharge Pro 15W",
      descripcion: "Estación de carga rápida inalámbrica con certificación oficial Made for MagSafe. Suministra hasta 15W al iPhone mientras carga simultáneamente el Apple Watch y los AirPods.",
      categoria: "telefonia",
      marca: "Belkin",
      precio: 1899.00,
      imagen_url: "/assets/productos/soporte-magsafe-belkin-3en1.jpg",
      especificaciones: {"potencia":"15W MagSafe iPhone + 5W Apple Watch + 5W AirPods","orientacion":"Modo horizontal (StandBy) o vertical","diseno":"Brazo de acero inoxidable con base pesada antiderrapante","certificacion":"Apple MFi y Qi Certified","adaptador":"Eliminador de corriente de 40W incluido"},
      condiciones_envio: "Envío inmediato en caja original sellada con adaptador de corriente nacional.",
      stock: 28
    },
    {
      sku: "EM-ACC-048",
      nombre: "Teclado Mecánico Custom Inalámbrico 75% Hot-Swap Keychron Q1 Pro",
      descripcion: "Teclado mecánico premium con chasis de aluminio CNC mecanizado, perilla rotatoria programable, conectividad Bluetooth 5.1 y cable USB-C. Switches Keychron K Pro Banana pre-lubricados.",
      categoria: "Accesorios",
      marca: "Keychron",
      precio: 3699.00,
      imagen_url: "/assets/productos/teclado-keychron-q1-pro.jpg",
      especificaciones: {"formato":"75% compacto con 81 teclas + encoder rotativo","estructura":"Doble montura por junta (Double-Gasket Mount)","compatibilidad":"Soporte total QMK/VIA para Mac y Windows","bateria":"4,000 mAh recargable (hasta 300 hrs sin luz)","teclas":"PBT Double-Shot perfil KSA"},
      condiciones_envio: "Envío protegido con extractor de teclas, extractor de switches y cable trenzado.",
      stock: 25
    },
    {
      sku: "EM-ACC-049",
      nombre: "Hub Adaptador USB-C 10 en 1 Multipuerto 4K HDMI 100W PD Gigabit Anker 565",
      descripcion: "Concentrador USB-C de grado profesional que expande un solo puerto a diez conexiones simultáneas. Soporta salida de video 4K a 60Hz, transferencias a 10Gbps y carga pasante de 100W.",
      categoria: "Accesorios",
      marca: "Anker",
      precio: 1199.00,
      imagen_url: "/assets/productos/hub-usbc-anker-565.jpg",
      especificaciones: {"puertosVideo":"1x HDMI 2.0 (4K@60Hz) + 1x DisplayPort (4K@60Hz)","puertosDatos":"1x USB-C 10Gbps, 1x USB-A 10Gbps, 2x USB-A 480Mbps","almacenamiento":"Lector de tarjetas SD y microSD UHS-I simultáneo","red":"Ethernet RJ45 Gigabit 10/100/1000 Mbps","carga":"Entrada USB-C PD hasta 100W (85W efectivos a laptop)"},
      condiciones_envio: "Envío ExpressPrime con funda de terciopelo para transporte seguro.",
      stock: 36
    },
    {
      sku: "EM-ACC-050",
      nombre: "Tapete de Escritorio Mouse Pad Gamer XXL 90x40cm SteelSeries QcK Prism RGB",
      descripcion: "Alfombrilla para mouse de superficie de tela microtejida QcK legendaria con costuras reforzadas e iluminación RGB de dos zonas personalizable sincronizada con audio y juegos.",
      categoria: "Accesorios",
      marca: "SteelSeries",
      precio: 899.00,
      imagen_url: "/assets/productos/mousepad-steelseries-qck-xxl.jpg",
      especificaciones: {"dimensiones":"900 mm x 400 mm x 4 mm","superficie":"Microfibra optimizada para sensores ópticos y láser","base":"Goma antideslizante de alta densidad","iluminacion":"PrismSync RGB dinámica de 360 grados de doble zona","conexion":"Cable USB trenzado de 1.8 metros"},
      condiciones_envio: "Envío en tubo cilíndrico rígido de protección contra dobleces.",
      stock: 42
    },
    {
      sku: "EM-ACC-051",
      nombre: "Base Enfriadora para Laptop con Turbina de Flujo Sellado IETS GT500 5000RPM",
      descripcion: "Refrigerador de laptop de alto rendimiento con espuma de sellado hermético que fuerza aire presurizado a través de los conductos térmicos de la laptop, reduciendo hasta 20°C de temperatura.",
      categoria: "Accesorios",
      marca: "IETS",
      precio: 1450.00,
      imagen_url: "/assets/productos/base-enfriadora-iets-gt500.jpg",
      especificaciones: {"ventilador":"Turbina centrífuga industrial de hasta 5,000 RPM","control":"Perilla de velocidad variable continua","filtro":"Filtro antipolvo lavable desmontable","compatibilidad":"Laptops de 13 a 17.3 pulgadas con rejillas inferiores","sellado":"Espuma viscoelástica de adaptación magnética"},
      condiciones_envio: "Envío en caja reforzada con eliminador de corriente y sellos de repuesto.",
      stock: 20
    },
    {
      sku: "EM-ACC-052",
      nombre: "Lápiz Óptico Stylus Universal con Rechazo de Palma Baseus Smooth Writing",
      descripcion: "Pluma digital de alta precisión para tabletas iPad y Android con puntas de repuesto de POM intercambiables, carga rápida magnética y visualización de porcentaje de batería por Bluetooth.",
      categoria: "Accesorios",
      marca: "Baseus",
      precio: 599.00,
      imagen_url: "/assets/productos/lapiz-stylus-baseus-universal.jpg",
      especificaciones: {"precision":"Punta ultrafina de 1.5mm sin retraso ni descalibración","sensibilidadInclinacion":"Variación de trazo según ángulo como lápiz real","bateria":"Hasta 11 horas de escritura continua (carga en 30 min)","rechazoPalma":"Apoyo natural de la mano sobre la pantalla","peso":"14.7 gramos con fijación magnética"},
      condiciones_envio: "Envío en blíster sellado con 2 puntas de repuesto adicionales.",
      stock: 48
    },
    {
      sku: "EM-HOG-053",
      nombre: "Cafetera Automática Espresso con Molino Cerámico Philips LatteGo Serie 3300",
      descripcion: "Prepara 5 deliciosas bebidas de café caliente e infusionado en frío con granos frescos al pulsar un solo botón. Sistema de leche LatteGo sin tubos, el más fácil de limpiar del mercado en 15 segundos.",
      categoria: "Hogar",
      marca: "Philips",
      precio: 11499.00,
      imagen_url: "/assets/productos/cafetera-philips-lattego-3300.jpg",
      especificaciones: {"bebidas":"Espresso, Café clásico, Cappuccino, Latte Macchiato y Iced Coffee","molino":"Cerámica 100% resistente con 12 ajustes de molienda","presion":"Bomba de 15 bares italianos","filtroAgua":"AquaClean para hasta 5,000 tazas sin descalcificar","interfaz":"Pantalla táctil intuitiva con selector de aroma e intensidad"},
      condiciones_envio: "Envío asegurado en caja master reforzada con tira reactiva de dureza de agua.",
      stock: 14
    },
    {
      sku: "EM-HOG-054",
      nombre: "Aspiradora Inalámbrica de Alta Succión 240AW Dyson V15 Detect Absolute",
      descripcion: "La aspiradora inteligente más potente de Dyson. Láser revelador de polvo microscópico en pisos duros, sensor piezoeléctrico que mide y cuenta partículas y pantalla LCD con reporte en tiempo real.",
      categoria: "Hogar",
      marca: "Dyson",
      precio: 16999.00,
      imagen_url: "/assets/productos/aspiradora-dyson-v15-detect.jpg",
      especificaciones: {"motor":"Dyson Hyperdymium a 125,000 RPM","potenciaSuccion":"240 Watts de Aire (AW)","autonomia":"Hasta 60 minutos sin pérdida de potencia","filtracion":"HEPA multiciclónica avanzada que atrapa 99.99% de partículas de 0.3 micras","cabezales":"Digital Motorbar antienredos + Fluffy Optic con iluminación"},
      condiciones_envio: "Envío prioritario con seguro total y entrega personalizada con acuse de recibo.",
      stock: 11
    },
    {
      sku: "EM-HOG-055",
      nombre: "Horno Tostador de Convección con Freidora de Aire Smart Ninja Foodi XL Pro",
      descripcion: "Horno multifunción de convección envolvente de 1800W con 10 funciones en 1: freír con aire, asar, tostar, hornear, deshidratar y recalentar en dos niveles para alimentar a toda la familia.",
      categoria: "Hogar",
      marca: "Ninja",
      precio: 4899.00,
      imagen_url: "/assets/productos/horno-freidora-ninja-foodi-xl.jpg",
      especificaciones: {"capacidad":"2 niveles de cocción (pavo de 5 kg o 2 pizzas de 30 cm)","potencia":"1800W True Surround Convection","funciones":"Air Fry, Air Roast, Bake, Whole Roast, Broil, Toast, Bagel, Dehydrate, Reheat, Pizza","temperatura":"De 30°C a 230°C con precalentamiento ultra rápido en 90 seg","accesorios":"2 rejillas, 1 charola para hornear, 1 canastilla para freír"},
      condiciones_envio: "Envío terrestre especializado para electrodomésticos con seguro de tránsito.",
      stock: 21
    },
    {
      sku: "EM-HOG-056",
      nombre: "Cerradura Digital Inteligente Biométrica con Huella y Teclado Wi-Fi Yale Assure Lock 2",
      descripcion: "Cerradura electrónica para puerta principal con lector de huellas dactilares táctil, teclado retroiluminado anti-espía y módulo Wi-Fi integrado para control y apertura remota desde la app Yale Home.",
      categoria: "Hogar",
      marca: "Yale",
      precio: 4299.00,
      imagen_url: "/assets/productos/cerradura-yale-assure-lock-2.jpg",
      especificaciones: {"accesos":"Huella biométrica, código PIN numérico, app móvil y llave física de respaldo","conectividad":"Wi-Fi 2.4 GHz + Bluetooth sin necesidad de bridges adicionales","compatibilidad":"Apple Home, Amazon Alexa, Google Home","bloqueoAutomatico":"Auto-Lock configurable por sensor DoorSense","bateria":"4 baterías AA con alerta de batería baja en app"},
      condiciones_envio: "Envío rápido sellado de fábrica con plantilla de instalación y tornillería incluida.",
      stock: 25
    },
    {
      sku: "EM-HOG-057",
      nombre: "Robot Limpiacristales Automático con Pulverización Ultrasónica Hutt DDC55",
      descripcion: "Robot limpiador de ventanas y canceles de baño con sensor de presión inteligente, navegación AI y succión de vacío de 3800Pa que garantiza adherencia total a vidrios verticales.",
      categoria: "Hogar",
      marca: "Hutt",
      precio: 3199.00,
      imagen_url: "/assets/productos/robot-limpiacristales-hutt.jpg",
      especificaciones: {"potenciaSuccion":"De 2600 a 3800 Pa con ajuste dinámico de presión","sistemaSeguridad":"Batería UPS de respaldo de 20 min ante cortes de luz + cuerda de escalada de 150 kg","navegacion":"HUTTPLANING 2.0 con detección inteligente de marcos","control":"Control remoto por infrarrojos con modos manual y automático","accesorios":"6 pares de paños de microfibra lavables incluidos"},
      condiciones_envio: "Envío ExpressPrime con empaque antichoque reforzado.",
      stock: 17
    },
    {
      sku: "EM-HOG-058",
      nombre: "Sistema de Purificación de Agua por Ósmosis Inversa Waterdrop G3P800 800GPD",
      descripcion: "Purificador de agua sin tanque para debajo del fregadero con capacidad de filtrado rápido de 800 galones por día. Grifo inteligente con pantalla LED indicadora de TDS y vida útil de filtros.",
      categoria: "Hogar",
      marca: "Waterdrop",
      precio: 8999.00,
      imagen_url: "/assets/productos/purificador-agua-waterdrop-g3.jpg",
      especificaciones: {"flujo":"800 GPD (llena un vaso de agua pura en 6 segundos)","tasaDrenaje":"3:1 ultra eficiente de ahorro de agua","etapasFiltrado":"Membrana de ósmosis inversa de 0.0001 micras + carbón activado en bloque","reduccionContaminantes":"Elimina más de 1,000 impurezas: cloro, plomo, fluoruro, metales pesados y microplásticos","certificaciones":"NSF/ANSI 58 y 372 libre de plomo"},
      condiciones_envio: "Envío asegurado de carga pesada con kit de conexión rápida push-in.",
      stock: 12
    },
    {
      sku: "EM-HOG-059",
      nombre: "Lámpara de Escritorio LED con Control de Temperatura de Color Xiaomi Mi Desk Lamp Pro",
      descripcion: "Lámpara de trabajo profesional con brazo articulado en tres ejes, certificación TÜV Rheinland de luz azul reducida sin parpadeo estroboscópico y control por perilla o apps inteligentes.",
      categoria: "Hogar",
      marca: "Xiaomi",
      precio: 1099.00,
      imagen_url: "/assets/productos/lampara-xiaomi-desk-lamp-pro.jpg",
      especificaciones: {"brillo":"Hasta 700 lúmenes con índice de reproducción cromática Ra90","temperaturaColor":"Ajustable de 2500K (cálido) a 4800K (luz día)","areaIluminacion":"Círculo amplio de hasta 1.2 metros de diámetro","compatibilidad":"Apple HomeKit, Google Assistant y Amazon Alexa","vidaUtil":"25,000 horas de iluminación LED de grado médico"},
      condiciones_envio: "Envío en caja original con adaptador de corriente y soporte pesado antiderrapante.",
      stock: 35
    },
    {
      sku: "EM-GAM-060",
      nombre: "Control Inalámbrico Xbox Elite Serie 2 Core Blanco/Negro",
      descripcion: "Mando profesional de precisión con palancas de tensión ajustable, bloqueo de gatillos de alta sensibilidad, agarre envolvente de goma texturizada y componentes diseñados para durar.",
      categoria: "Videojuegos",
      marca: "Microsoft",
      precio: 2699.00,
      imagen_url: "/assets/productos/control-xbox-elite-series-2.jpg",
      especificaciones: {"conectividad":"Xbox Wireless, Bluetooth y USB-C","bateria":"Interna recargable de hasta 40 horas de duración","personalizacion":"Hasta 3 perfiles personalizados en memoria interna","gatillos":"Hair Trigger Locks de 3 posiciones","peso":"345 gramos"},
      condiciones_envio: "Envío ExpressPrime garantizado en caja sellada con herramienta de ajuste.",
      stock: 30
    },
    {
      sku: "EM-GAM-061",
      nombre: "Volante de Carreras y Pedales con Force Feedback Logitech G923 TRUEFORCE",
      descripcion: "Sistema de carreras para PC, PS5 y PS4 con tecnología de retroalimentación de fuerza TRUEFORCE de alta definición que se conecta directamente a los motores de físicas del juego a 4000 veces/seg.",
      categoria: "Videojuegos",
      marca: "Logitech",
      precio: 5799.00,
      imagen_url: "/assets/productos/volante-logitech-g923-force.jpg",
      especificaciones: {"rotacion":"900 grados de bloqueo a bloqueo con sensor de dirección hall","materiales":"Cuero cosido a mano y levas de cambio de acero inoxidable","pedales":"Pedal de freno progresivo no lineal de resorte calibrado","dobleEmbrague":"Control de asistencia de lanzamiento programable en juegos compatibles","compatibilidad":"PlayStation 5, PlayStation 4 y PC Windows 10/11"},
      condiciones_envio: "Envío en caja de protección pesada con fuente de poder y abrazaderas para escritorio.",
      stock: 16
    },
    {
      sku: "EM-GAM-062",
      nombre: "Tarjeta de Captura de Video 4K60 HDR10 Passthrough USB 3.0 Elgato HD60 X",
      descripcion: "Capturadora externa de baja latencia para transmisiones en Twitch y YouTube. Graba a 1080p60 HDR o 4K30 mientras juegas a 4K60 HDR10 o 1440p120 con tasa de refresco variable (VRR).",
      categoria: "Videojuegos",
      marca: "Elgato",
      precio: 3499.00,
      imagen_url: "/assets/productos/capturadora-elgato-hd60x.jpg",
      especificaciones: {"entradaSalida":"HDMI 2.0 (passthrough sin retardo hasta 4K60 HDR / 1440p120 / 1080p240)","interfazPC":"USB 3.0 Type-C de ultra baja latencia (<100ms)","resolucionCaptura":"Hasta 2160p30 o 1080p60 HDR10","soporteVRR":"Variable Refresh Rate sin desgarro de pantalla","software":"Compatible con OBS Studio, Streamlabs, Discord y Elgato 4KCU"},
      condiciones_envio: "Envío rápido con cable USB-C a USB-A 3.0 y cable HDMI de alta velocidad.",
      stock: 24
    },
    {
      sku: "EM-GAM-063",
      nombre: "Control Inalámbrico DualSense Edge para PlayStation 5 Perfiles Personalizables",
      descripcion: "El primer control de alto rendimiento ultra personalizable creado por PlayStation. Módulos de palancas reemplazables, botones traseros intercambiables y topes de gatillo ajustables.",
      categoria: "Videojuegos",
      marca: "Sony",
      precio: 4199.00,
      imagen_url: "/assets/productos/control-dualsense-edge-ps5.jpg",
      especificaciones: {"modulos":"Módulos de stick analógico intercambiables disponibles por separado","botonesPosteriores":"2 juegos de botones traseros intercambiables (palancas o semidomo)","retroalimentacion":"Gatillos adaptativos hápticos con ajuste de recorrido por palanca física","estuche":"Estuche rígido con puerto de carga pasante USB-C trenzado con bloqueo","perfiles":"Botón Fn dedicado para cambiar perfiles y volumen del juego sobre la marcha"},
      condiciones_envio: "Envío asegurado en estuche de viaje original con todos los accesorios completos.",
      stock: 18
    },
    {
      sku: "EM-GAM-064",
      nombre: "Headset Gamer Inalámbrico DTS Spatial Audio HyperX Cloud Alpha Wireless",
      descripcion: "Los primeros audífonos para juegos con una autonomía masiva de hasta 300 horas con una sola carga. Controladores de cámara doble de 50 mm y audio espacial DTS Headphone:X.",
      categoria: "Videojuegos",
      marca: "HyperX",
      precio: 3299.00,
      imagen_url: "/assets/productos/headset-hyperx-cloud-alpha.jpg",
      especificaciones: {"bateria":"Hasta 300 horas ininterrumpidas de uso","transductores":"HyperX Dual Chamber de 50 mm con imanes de neodimio","microfono":"Condensador desmontable con cancelación de ruido y LED de silencio","conectividad":"Inalámbrica de 2.4 GHz sin retardo con dongle USB","estructura":"Aluminio duradero con almohadillas de espuma viscoelástica y cuero sintético"},
      condiciones_envio: "Envío prioritario con dongle USB, cable de carga y filtro de micrófono pop.",
      stock: 27
    },
    {
      sku: "EM-GAM-065",
      nombre: "Base Soporte de Carga Rápida Doble para Controles PS5 Razer Quick Charging Stand",
      descripcion: "Estación de carga magnética de acoplamiento fácil con diseño curvo ergonómico a juego con la estética de PlayStation 5. Recarga mandos DualSense por completo en menos de 3 horas.",
      categoria: "Videojuegos",
      marca: "Razer",
      precio: 799.00,
      imagen_url: "/assets/productos/base-carga-razer-quick-ps5.jpg",
      especificaciones: {"tiempoCarga":"Menos de 3 horas para recarga al 100%","proteccion":"Protección contra sobrecarga, sobrecalentamiento y cortocircuitos","conexion":"Alimentación por puerto USB de la consola PS5 o eliminador USB","base":"Goma antideslizante de alta estabilidad para colocar y retirar con una mano"},
      condiciones_envio: "Envío en blíster sellado de fábrica con cable USB-C incluido.",
      stock: 45
    },
    {
      sku: "EM-ELE-066",
      nombre: "Smart TV 65\" OLED 4K UHD 120Hz Dolby Vision LG OLED evo C3 OLED65C3PSA",
      descripcion: "Pantalla OLED con píxeles autoemisivos para negros perfectos y contraste infinito. Procesador α9 AI Gen6 4K, 4 puertos HDMI 2.1 completos con compatibilidad G-Sync y FreeSync Premium.",
      categoria: "Electronica",
      marca: "LG",
      precio: 28999.00,
      imagen_url: "/assets/productos/pantalla-lg-oled-c3-65.jpg",
      especificaciones: {"panel":"OLED evo 4K Ultra HD (3840 x 2160) a 120Hz nativos","procesador":"α9 AI 4K Gen6 con Dynamic Tone Mapping Pro","formatos":"Dolby Vision IQ, HDR10 Pro, HLG y modo Filmmaker","sonido":"Dolby Atmos de 40W 2.2 canales con virtualización 9.1.2","gaming":"4x HDMI 2.1 (4K@120Hz, VRR, ALLM, eARC) y Game Dashboard"},
      condiciones_envio: "Envío terrestre especializado con seguro total y entrega programada en planta baja/alta.",
      stock: 10
    },
    {
      sku: "EM-ELE-067",
      nombre: "Proyector Portátil Inteligente Full HD con Android TV Samsung The Freestyle 2nd Gen",
      descripcion: "Proyector versátil con rotación de 180 grados para proyectar en paredes, pisos o techos de hasta 100 pulgadas. Nivelación y enfoque automático instantáneo con sonido envolvente 360°.",
      categoria: "Electronica",
      marca: "Samsung",
      precio: 11999.00,
      imagen_url: "/assets/productos/proyector-samsung-the-freestyle.jpg",
      especificaciones: {"tamanoPantalla":"De 30 a 100 pulgadas con resolución Full HD 1080p","calibracion":"Auto Keystone, Auto Focus y Auto Leveling en menos de 3 seg","sistema":"Smart TV Tizen con Netflix, Prime Video, Disney+ y Xbox Cloud Gaming integrado","sonido":"Bocina envolvente omnidireccional de 360 grados de 5W","alimentacion":"Compatible con cargadores USB-C PD de 50W y power banks"},
      condiciones_envio: "Envío prioritario con control remoto solar SolarCell y tapa de lente difusora.",
      stock: 15
    },
    {
      sku: "EM-ELE-068",
      nombre: "Lector de Libros Electrónicos Pantalla E-Ink Carta 6.8\" Kindle Paperwhite 16GB",
      descripcion: "Lector de e-books con pantalla antirreflejo de 300 ppi que se lee como papel impreso bajo la luz solar. Luz cálida ajustable, resistencia al agua IPX8 y semanas de duración de batería.",
      categoria: "Electronica",
      marca: "Amazon Kindle",
      precio: 2799.00,
      imagen_url: "/assets/productos/ereader-kindle-paperwhite-16gb.jpg",
      especificaciones: {"pantalla":"Amazon E-Ink de 6.8 pulgadas a 300 ppi con escala de 16 niveles de grises","luzFrontal":"17 LEDs con tono de luz cálida regulable blanco a ámbar","resistenciaAgua":"IPX8 (inmersión en agua dulce hasta 2 metros por 60 min)","almacenamiento":"16 GB (almacena miles de títulos y audiolibros)","duracionBateria":"Hasta 10 semanas con una sola carga por USB-C"},
      condiciones_envio: "Envío ExpressPrime garantizado en sobre acolchado con cable USB-C.",
      stock: 35
    },
    {
      sku: "EM-ELE-069",
      nombre: "Cámara de Seguridad Exterior Wi-Fi 2K Pan/Tilt Solar Eufy Security SoloCam S220",
      descripcion: "Cámara de videovigilancia sin cables con panel solar integrado que requiere solo 3 horas de sol al día para funcionar permanentemente. Resolución 2K, visión nocturna a color y sin cuotas mensuales.",
      categoria: "Electronica",
      marca: "Eufy",
      precio: 2299.00,
      imagen_url: "/assets/productos/camara-seguridad-eufy-s220.jpg",
      especificaciones: {"resolucion":"2K HD con lente gran angular F1.6 de gran luminosidad","energia":"Batería interna con recarga solar continua por panel fotovoltaico monocristalino","almacenamiento":"8 GB de almacenamiento local eMMC cifrado AES-128 sin suscripciones","deteccionIA":"Detección precisa de humanos por Inteligencia Artificial integrada","resistencia":"IP67 apta para lluvias torrenciales y sol directo extremo"},
      condiciones_envio: "Envío rápido con base de montaje ajustable de pared y taquetes de fijación.",
      stock: 28
    },
    {
      sku: "EM-ELE-070",
      nombre: "Enchufe Inteligente Wi-Fi Monitoreo de Energía Pack 4 Piezas TP-Link Tapo P110",
      descripcion: "Tomacorriente inteligente con medición de consumo eléctrico en tiempo real y cálculo de costo estimado. Programa encendidos automáticos, modo ausente y control por voz con Alexa y Google.",
      categoria: "Electronica",
      marca: "TP-Link",
      precio: 749.00,
      imagen_url: "/assets/productos/enchufes-smart-tplink-tapo.jpg",
      especificaciones: {"corrienteMaxima":"15 Amperes / 1800 Watts a 120V AC","monitoreo":"Gráficas de consumo histórico por día, mes y año en app Tapo","conectividad":"Wi-Fi 2.4 GHz directo sin hub adicional","funciones":"Temporizador, cuenta regresiva y modo fuera de casa con encendido aleatorio","diseno":"Carcasa ignífuga compacta que no obstruye el segundo tomacorriente"},
      condiciones_envio: "Envío express en caja sellada con 4 unidades y manual en español.",
      stock: 45
    },
    {
      sku: "EM-DEP-071",
      nombre: "Set de Mancuernas Ajustables de 2.5 kg a 24 kg Bowflex SelectTech 552",
      descripcion: "Par de mancuernas ajustables inteligentes que reemplazan hasta 15 pares de pesas individuales mediante un selector giratorio rápido. Molduras termoplásticas silenciosas para no dañar el piso.",
      categoria: "Deportes",
      marca: "Bowflex",
      precio: 7499.00,
      imagen_url: "/assets/productos/mancuernas-bowflex-selecttech.jpg",
      especificaciones: {"rangoPeso":"De 2.5 kg a 24 kg (5 a 52.5 lbs) por cada mancuerna","ajustes":"15 incrementos de peso fácilmente seleccionables con dial lateral","discos":"Placas de acero cubiertas con polímero termoplástico de absorción de impacto","dimensiones":"40 cm x 20 cm x 23 cm por pieza con base incluida","garantia":"2 años oficiales en piezas mecánicas"},
      condiciones_envio: "Envío en dos cajas reforzadas con protección de unicel industrial pesado.",
      stock: 14
    },
    {
      sku: "EM-DEP-072",
      nombre: "Reloj Deportivo Multideporte con GPS y Mapas Topográficos Garmin Fenix 7 Solar",
      descripcion: "Reloj GPS para triatlón y montañismo con lente de carga solar Power Glass que extiende la autonomía a semanas. Métricas avanzadas de entrenamiento, sensor de pulso óptico Gen 4 y altímetro barométrico.",
      categoria: "Deportes",
      marca: "Garmin",
      precio: 14999.00,
      imagen_url: "/assets/productos/reloj-garmin-fenix-7-solar.jpg",
      especificaciones: {"pantalla":"1.3\" visible a plena luz solar (260 x 260 píxeles transflectiva)","bateria":"Hasta 22 días en modo smartwatch con carga solar / 73 horas con GPS","navegacion":"Multi-GNSS (GPS, GLONASS, Galileo) con mapas TopoActive precargados","sensores":"Pulsioxímetro Pulse Ox, frecuencia cardíaca, brújula de 3 ejes y termómetro","resistenciaAgua":"10 ATM (sumergible hasta 100 metros)"},
      condiciones_envio: "Envío asegurado en caja sellada de fábrica con cable de carga de pines magnéticos.",
      stock: 16
    },
    {
      sku: "EM-DEP-073",
      nombre: "Tapete de Yoga Profesional Antideslizante Caucho Natural 5mm Lululemon The Mat",
      descripcion: "Esterilla de yoga de 5mm con base de caucho natural amortiguador y superficie superior de poliuretano suave absorbente que incrementa el agarre cuando las manos transpiran durante sesiones intensas.",
      categoria: "Deportes",
      marca: "Lululemon",
      precio: 1599.00,
      imagen_url: "/assets/productos/tapete-yoga-lululemon-mat.jpg",
      especificaciones: {"dimensiones":"180 cm x 66 cm con grosor premium de 5 mm","materiales":"Base de caucho natural con certificación FSC + capa superior de poliuretano","tratamiento":"Antimicrobiano integrado que previene moho y malos olores","peso":"2.38 kg para máxima estabilidad en piso sin enrollamiento en bordes","cuidado":"Fácil limpieza con paño húmedo y secado al aire libre"},
      condiciones_envio: "Envío en empaque tubular protegido con correa de transporte de cortesía.",
      stock: 35
    },
    {
      sku: "EM-DEP-074",
      nombre: "Bicicleta Fija de Spinning Magnética con Pantalla 10.1\" Yesoul S3 Pro",
      descripcion: "Bicicleta estática silenciosa de resistencia magnética inteligente con 100 niveles de ajuste. Pantalla HD táctil de 10.1 pulgadas para clases guiadas en vivo y métricas de potencia por vatios en tiempo real.",
      categoria: "Deportes",
      marca: "Yesoul",
      precio: 9299.00,
      imagen_url: "/assets/productos/bicicleta-spinning-yesoul-s3.jpg",
      especificaciones: {"volanteInercia":"Aluminio fundido de 7.5 kg con freno de emergencia por presión","resistencia":"Magnética de 100 niveles por perilla micrométrica silenciosa","transmision":"Banda acanalada de alta durabilidad sin mantenimiento de cadena","pantalla":"10.1 pulgadas táctil con app Yesoul Fitness y mirroring de pantalla","pesoSoportado":"Hasta 120 kg de usuario"},
      condiciones_envio: "Envío de carga terrestre con servicio a domicilio con caja flejada y kit de herramientas.",
      stock: 12
    },
    {
      sku: "EM-AUT-075",
      nombre: "Arrancador de Batería Portátil de Emergencia 2000A Jump Starter 12V NOCO Boost Plus GB40",
      descripcion: "Potente arrancador de litio ultra seguro de 2000 amperios con tecnología a prueba de chispas y protección de polaridad inversa para arrancar autos y camionetas de hasta 6.0L gasolina y 3.0L diésel.",
      categoria: "Automotriz",
      marca: "NOCO",
      precio: 2399.00,
      imagen_url: "/assets/productos/arrancador-noco-boost-gb40.jpg",
      especificaciones: {"corrientePico":"2,000 Amperios de arranque en frío","compatibilidad":"Motores a gasolina de hasta 6.0L y diésel de hasta 3.0L","linterna":"LED ultrabrillante de 100 lúmenes con 7 modos (SOS y estrobo)","salidas":"Puerto USB de 2.1A para recargar celulares y tablets en carretera","clasificacion":"IP65 resistente a lluvia y polvo con tapas de caucho"},
      condiciones_envio: "Envío ExpressPrime con pinzas de uso rudo Precision HD y bolsa de microfibra.",
      stock: 30
    },
    {
      sku: "EM-AUT-076",
      nombre: "Compresor de Aire Portátil Digital Inflador de Llantas 150 PSI Xiaomi Air Pump 2",
      descripcion: "Bomba de aire digital recargable de alta velocidad capaz de inflar una llanta de auto vacía en solo 8 minutos. Pantalla digital con apagado automático por detección precisa de presión preestablecida.",
      categoria: "Automotriz",
      marca: "Xiaomi",
      precio: 899.00,
      imagen_url: "/assets/productos/compresor-xiaomi-air-pump-2.jpg",
      especificaciones: {"presionMaxima":"Hasta 150 PSI (10.3 Bares) con precisión de ±1 PSI","modosPreestablecidos":"Coche, Moto, Bicicleta, Balón y Modo Libre configurable","bateria":"Batería de litio 2000 mAh recargable vía USB Type-C","luzAuxiliar":"Luz LED frontal para emergencias mecánicas nocturnas","adaptadores":"Válvula Schrader (auto), válvula Presta y aguja para balones"},
      condiciones_envio: "Envío inmediato en caja original con funda de transporte y boquillas.",
      stock: 45
    },
    {
      sku: "EM-AUT-077",
      nombre: "Cámara para Auto Dash Cam Frontal y Trasera 4K Ultra HD con GPS y Wi-Fi 70mai A810",
      descripcion: "Cámara de parabrisas con sensor Sony Starvis 2 IMX678 de visión nocturna HDR insuperable en 4K. Incluye cámara trasera 1080p, GPS integrado para registro de velocidad y modo estacionamiento 24/7.",
      categoria: "Automotriz",
      marca: "70mai",
      precio: 2799.00,
      imagen_url: "/assets/productos/dashcam-70mai-a810-4k.jpg",
      especificaciones: {"sensor":"Sony STARVIS 2 IMX678 con apertura F1.8 y 6 lentes de cristal","resolucion":"Frontal 4K UHD (3840x2160) a 60fps + Trasera 1080p HDR","anguloVision":"150 grados que cubre 3 carriles completos de tráfico","seguridadVial":"Sistema ADAS con alerta de cambio de carril y colisión frontal","conectividad":"Wi-Fi para descarga instantánea de videos al celular con la app 70mai"},
      condiciones_envio: "Envío prioritario con adhesivo electrostático para parabrisas y cargador de encendedor.",
      stock: 25
    },
    {
      sku: "EM-AUT-078",
      nombre: "Aspiradora Inalámbrica Portátil para Auto con Motor Ciclónico Baseus A3 15000Pa",
      descripcion: "Aspiradora de mano ultracompacta para interiores automotrices con 15,000 Pa de potencia de succión, filtro de acero inoxidable lavable combinado con filtro HEPA y luz LED integrada.",
      categoria: "Automotriz",
      marca: "Baseus",
      precio: 999.00,
      imagen_url: "/assets/productos/aspiradora-auto-baseus-a3.jpg",
      especificaciones: {"potenciaSuccion":"15,000 Pa en modo turbo / 10,000 Pa modo estándar","motor":"Motor sin escobillas Brushless a 80,000 RPM de 135W","autonomia":"Hasta 45 minutos de limpieza con batería de 8000 mAh","filtracion":"Doble filtro: malla metálica de acero + filtro HEPA lavable","accesorios":"Boquilla 2 en 1 con cepillo para rejillas de aire acondicionado y ranuras"},
      condiciones_envio: "Envío en blíster sellado con cable de carga rápida USB-C y bolsa de guardado.",
      stock: 38
    }
  ];

function seedDatabaseIfEmpty(db) {
  const countRow = db.prepare('SELECT COUNT(*) as total FROM usuarios').get();
  if (countRow && countRow.total > 0) return;

  const now = new Date().toISOString();

  // Crear usuarios para los 5 roles definidos en el apartado 18.1 del Manual de Calidad
  const seedUsers = [
    {
      email: 'admin@expressmart.mx',
      password: 'AdminPassword123!',
      nombre: 'Diego Alarcón (Administrador Plataforma)',
      rol: 'administrador',
      mfaEnabled: 1,
      mfaSecret: 'ADMINMFASECRET2026EXPRESSMART',
      direccion: 'Av. Reforma 450, Piso 12, CDMX',
      telefono: '+52 55 1234 5678'
    },
    {
      email: 'vendedor@expressmart.mx',
      password: 'VendedorPassword123!',
      nombre: 'Carlos Adair Bautista (Vendedor Oficial)',
      rol: 'vendedor',
      mfaEnabled: 1,
      mfaSecret: 'SELLERMFASECRET2026EXPRESSMART',
      direccion: 'Parque Industrial Vallejo, Nave 4, CDMX',
      telefono: '+52 55 8765 4321'
    },
    {
      email: 'cliente@expressmart.mx',
      password: 'ClientePassword123!',
      nombre: 'Cristopher Erik San Juan (Cliente Verificado)',
      rol: 'cliente',
      mfaEnabled: 0,
      mfaSecret: generateMfaSecret(),
      direccion: 'Insurgentes Sur 1602, Col. Crédito Constructor, CDMX, CP 03940',
      telefono: '+52 55 5555 1010'
    },
    {
      email: 'soporte@expressmart.mx',
      password: 'SoportePassword123!',
      nombre: 'Atención a Clientes y Operaciones',
      rol: 'soporte',
      mfaEnabled: 0,
      mfaSecret: generateMfaSecret(),
      direccion: 'Centro de Operaciones ExpressMart, CDMX',
      telefono: '+52 55 9000 0001'
    },
    {
      email: 'auditor@expressmart.mx',
      password: 'AuditorPassword123!',
      nombre: 'Sebastián Muñoz González (Auditor Líder ECTA-01)',
      rol: 'auditor',
      mfaEnabled: 0,
      mfaSecret: generateMfaSecret(),
      direccion: 'Comité de Auditoría Interna y Calidad SGC',
      telefono: '+52 55 9000 0002'
    }
  ];

  const insertUser = db.prepare(`
    INSERT INTO usuarios (email, password_hash, nombre, rol, mfa_enabled, mfa_secret, direccion_cifrada, telefono_cifrado, consentimiento_privacidad, aviso_privacidad_version, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'v1.0-2026', ?)
  `);

  for (const u of seedUsers) {
    insertUser.run(
      u.email,
      hashPassword(u.password),
      u.nombre,
      u.rol,
      u.mfaEnabled,
      u.mfaSecret,
      encryptData(u.direccion),
      encryptData(u.telefono),
      now
    );
  }

  const vendedorRow = db.prepare("SELECT id FROM usuarios WHERE rol = 'vendedor' LIMIT 1").get();
  const vendedorId = vendedorRow ? vendedorRow.id : 1;

    const insertProd = db.prepare(`
    INSERT INTO catalogo (sku, nombre, descripcion, categoria, marca, precio, imagen_url, especificaciones_json, condiciones_envio, vendedor_id, activo, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);
  const insertInv = db.prepare(`
    INSERT INTO inventario (producto_id, stock_disponible, stock_reservado, ubicacion_almacen, ultima_conciliacion, updated_at)
    VALUES (?, ?, 0, 'CEDIS-CDMX-NORTE', ?, ?)
  `);

  for (const p of catalogDataset) {
    const res = insertProd.run(
      p.sku,
      p.nombre,
      p.descripcion.trim(),
      p.categoria,
      p.marca,
      p.precio,
      p.imagen_url,
      JSON.stringify(p.especificaciones),
      p.condiciones_envio,
      vendedorId,
      now,
      now
    );
    insertInv.run(res.lastInsertRowid, p.stock, now, now);
  }

  // Cupones promocionales (RF-04)
  const insertCupon = db.prepare(`
    INSERT INTO cupones (codigo, descripcion, tipo, valor, monto_minimo, activo)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  insertCupon.run('BIENVENIDA10', '10% de descuento en tu compra', 'porcentaje', 10, 500);
  insertCupon.run('BUENFIN20', '20% de descuento en temporada promocional', 'porcentaje', 20, 2000);
  insertCupon.run('AHORRA250', '$250 MXN de descuento directo', 'monto_fijo', 250, 1500);
  insertCupon.run('ENVIOGRATIS', 'Envío gratuito sin mínimo de compra', 'envio_gratis', 99, 0);

  recordAuditLog(db, {
    usuarioId: 1,
    rol: 'sistema',
    accion: 'INICIALIZACION_SGC',
    modulo: 'Base de Datos',
    entidadId: 'MC-001',
    detalles: { mensaje: 'Almacenes D1..D8 inicializados conforme al Manual de Calidad ExpressMart v1.0' }
  });
}

const reviewsDataset = {
  'EM-LAP-001': [
    { calificacion: 5, comentario: 'Excelente equipo, llegó en menos de 24 horas y el empaque venía perfectamente sellado.' },
    { calificacion: 5, comentario: 'Rendimiento impresionante para compilar proyectos y la pantalla tiene una nitidez espectacular.' },
    { calificacion: 4, comentario: 'Muy buena laptop ultradelgada, la batería dura prácticamente toda mi jornada laboral.' }
  ],
  'EM-AUD-002': [
    { calificacion: 5, comentario: 'La cancelación de ruido es impresionante y el proceso de compra en 3 pasos fue rapidísimo.' },
    { calificacion: 5, comentario: 'Super cómodos para viajar en avión o metro, y el sonido Hi-Res se escucha con gran fidelidad.' },
    { calificacion: 4, comentario: 'Calidad de materiales premium y la duración de más de 60 horas es real.' }
  ],
  'EM-MON-003': [
    { calificacion: 5, comentario: 'El monitor curvo 4K con 144Hz es una joya para diseño y gaming en CDMX.' },
    { calificacion: 5, comentario: 'Colores precisos calibrados de fábrica, el puerto USB-C carga mi laptop mientras transmite video.' }
  ],
  'EM-SMT-004': [
    { calificacion: 5, comentario: 'El acabado en titanio y cristal de zafiro luce elegante. El sensor de ritmo y ECG es muy certero.' },
    { calificacion: 4, comentario: 'Excelente autonomía de 3 días con pantalla activa, resistente al agua comprobado.' }
  ],
  'EM-ACC-005': [
    { calificacion: 5, comentario: 'Distribución en español con la tecla Ñ perfecta, switches táctiles súper suaves y silenciosos.' },
    { calificacion: 5, comentario: 'La conectividad triple (Bluetooth y 2.4GHz) me permite alternar entre Mac y PC al instante.' }
  ],
  'EM-HOG-006': [
    { calificacion: 5, comentario: 'El café sale con una crema dorada perfecta a 20 bares. El molino integrado es muy consistente.' },
    { calificacion: 5, comentario: 'Calidad de cafetería italiana en casa. El espumador de leche hace microespuma profesional.' }
  ],
  'EM-HOG-007': [
    { calificacion: 5, comentario: 'El mapeo láser LiDAR evitó todas las patas de muebles y la base de autovaciado ahorra mucho tiempo.' },
    { calificacion: 4, comentario: 'Aspira muy bien el pelo de mascotas y friega de forma homogénea con la app.' }
  ],
  'EM-AUD-008': [
    { calificacion: 5, comentario: 'Gran potencia de 40W para reuniones en terraza, totalmente sumergible y resistente a salpicaduras.' },
    { calificacion: 5, comentario: 'Bajos profundos y sonido 360 grados nítido. La batería rinde todo el fin de semana.' }
  ],
  'EM-GAM-009': [
    { calificacion: 5, comentario: 'La pantalla OLED a 90Hz se ve increíble con negros puros. Corre juegos pesados con gran fluidez.' },
    { calificacion: 5, comentario: 'Increíble consola portátil, la ergonomía es perfecta para jugar horas sin cansar las manos.' }
  ],
  'EM-COM-010': [
    { calificacion: 5, comentario: 'Todo en uno elegante que ahorra espacio en mi escritorio. El Core i7 vuela con hojas de cálculo y edición.' },
    { calificacion: 4, comentario: 'Pantalla amplia de 24 pulgadas con gran brillo y la webcam retráctil brinda mucha privacidad.' }
  ],
  'EM-AUD-011': [
    { calificacion: 5, comentario: 'Micrófono con captura cardioide súper clara para juntas y streaming. El brazo articulado es robusto.' },
    { calificacion: 5, comentario: 'Fácil de conectar por USB-C y el botón táctil de mute es comodísimo.' }
  ],
  'EM-ACC-012': [
    { calificacion: 5, comentario: 'Se me quitó el dolor de muñeca por trabajar 8 horas seguidas. El ángulo vertical es sumamente natural.' },
    { calificacion: 5, comentario: 'Batería duradera y el cambio rápido entre Bluetooth y dongle 2.4GHz funciona perfecto.' }
  ],
  'EM-TEL-013': [
    { calificacion: 5, comentario: 'Las fotos con el lente de 108MP tienen un detalle cinematográfico. La carga de 120W llena la batería en 18 min.' },
    { calificacion: 5, comentario: 'Pantalla AMOLED fluida y conectividad 5G rapidísima con Telcel en CDMX.' }
  ],
  'EM-HOG-014': [
    { calificacion: 5, comentario: 'Tener dos canastas de 4L permite cocinar carne y guarnición a diferentes temperaturas al mismo tiempo.' },
    { calificacion: 5, comentario: 'Poco o nada de aceite y los alimentos quedan crujientes. La ventana para ver la cocción es un gran acierto.' }
  ],
  'EM-HOG-015': [
    { calificacion: 5, comentario: 'Tritura hielo y frutas congeladas en segundos. La campana silenciadora realmente disminuye el ruido.' },
    { calificacion: 4, comentario: 'Vaso de Tritan resistente y fácil de lavar. Muy recomendada para smoothies mañaneros.' }
  ],
  'EM-ACC-016': [
    { calificacion: 5, comentario: 'Silla ergonómica de primera calidad, el soporte lumbar 3D se ajusta a mi postura y la malla no da calor.' },
    { calificacion: 5, comentario: 'Gran compra para home office, los descansabrazos 3D y el pistón se sienten súper sólidos.' }
  ],
  'EM-COM-017': [
    { calificacion: 5, comentario: 'Monstruo de laptop: la RTX 4070 combinada con el i9 corre cualquier juego en ultra a más de 120 FPS.' },
    { calificacion: 5, comentario: 'Pantalla de 240Hz hipersuave y el sistema de ventilación mantiene las temperaturas estables.' }
  ],
  'EM-TEL-018': [
    { calificacion: 5, comentario: 'La pantalla 2K y el stylus incluido la hacen la mejor tablet calidad-precio para tomar apuntes y dibujar.' },
    { calificacion: 5, comentario: 'Audio cuádruple envolvente ideal para ver series y películas. La batería dura más de 10 horas.' }
  ],
  'EM-AUD-019': [
    { calificacion: 5, comentario: 'El sonido Dolby Atmos y el subwoofer inalámbrico hacen que la sala tiemble como en el cine.' },
    { calificacion: 5, comentario: 'Se conectó directo por HDMI eARC con la TV y el control del volumen se sincronizó al instante.' }
  ],
  'EM-HOG-020': [
    { calificacion: 5, comentario: 'El aire de la recámara se siente fresco y libre de olores de cocina y polvo. El sensor PM2.5 es muy útil.' },
    { calificacion: 5, comentario: 'En modo nocturno es completamente silencioso y la luz indicadora se apaga sola.' }
  ],
  'EM-TV-021': [
    { calificacion: 5, comentario: 'Pantalla enorme de 75 pulgadas, los colores 4K y el sonido son una maravilla en la sala.' },
    { calificacion: 5, comentario: 'Excelente compra, llegó perfectamente empacada por ExpressPrime y se configuró en minutos.' }
  ],
  'EM-GAM-022': [
    { calificacion: 5, comentario: '¡Increíble la Switch 2! La pantalla OLED a 120Hz se ve espectacular y los Joy-Con se sienten súper firmes.' },
    { calificacion: 5, comentario: 'Llegó sellada y en menos de 24 horas. Los juegos corren con una fluidez impresionante.' }
  ],
  'EM-GAM-023': [
    { calificacion: 5, comentario: 'La mejor relación calidad-precio. Silenciosa, rápida y con Game Pass es insuperable.' },
    { calificacion: 5, comentario: 'Muy compacta y bonita. Carga los juegos en cuestión de segundos gracias al SSD.' }
  ],
  'EM-GAM-024': [
    { calificacion: 5, comentario: '¡El regreso de Marcus y Dom! La preventa me llegó con el código de regalo al instante.' }
  ],
  'EM-LIB-025': [
    { calificacion: 5, comentario: 'Imprescindible para cualquier fan de Gears. La portada y la traducción al español son excelentes.' }
  ],
  'EM-PEL-026': [
    { calificacion: 5, comentario: '¡Qué joya de colección! Trae todos los capítulos clásicos de La Familia P. Luche con gran calidad de imagen.' }
  ],
  'EM-DEP-027': [
    { calificacion: 5, comentario: 'Excelente proteína, se disuelve al instante sin grumos y el sabor a chocolate es delicioso.' }
  ],
  'EM-AGR-028': [
    { calificacion: 5, comentario: 'Llanta de excelente agarre para el tractor en terracería y lodo. Muy resistente y llegó rápido al rancho.' }
  ]
};

function syncCatalogAndReviews(db) {
  const now = new Date().toISOString();
  const vendedorRow = db.prepare("SELECT id FROM usuarios WHERE rol = 'vendedor' LIMIT 1").get();
  const vendedorId = vendedorRow ? vendedorRow.id : 1;
  const clienteRow = db.prepare("SELECT id FROM usuarios WHERE rol = 'cliente' LIMIT 1").get();
  const clienteId = clienteRow ? clienteRow.id : 1;

  const insertProd = db.prepare(`
    INSERT INTO catalogo (sku, nombre, descripcion, categoria, marca, precio, imagen_url, especificaciones_json, condiciones_envio, vendedor_id, activo, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);
  const insertInv = db.prepare(`
    INSERT OR IGNORE INTO inventario (producto_id, stock_disponible, stock_reservado, ubicacion_almacen, ultima_conciliacion, updated_at)
    VALUES (?, ?, 0, 'CEDIS-CDMX-NORTE', ?, ?)
  `);

  for (const p of catalogDataset) {
    const existing = db.prepare('SELECT id FROM catalogo WHERE sku = ?').get(p.sku);
    let productId;
    if (!existing) {
      const res = insertProd.run(
        p.sku,
        p.nombre,
        p.descripcion.trim(),
        p.categoria,
        p.marca,
        p.precio,
        p.imagen_url,
        JSON.stringify(p.especificaciones),
        p.condiciones_envio,
        vendedorId,
        now,
        now
      );
      productId = Number(res.lastInsertRowid);
      insertInv.run(productId, p.stock, now, now);
    } else {
      productId = existing.id;
      db.prepare('UPDATE catalogo SET imagen_url = ?, precio = ?, nombre = ?, descripcion = ? WHERE id = ?').run(
        p.imagen_url,
        p.precio,
        p.nombre,
        p.descripcion.trim(),
        productId
      );
    }

    const revCount = db.prepare('SELECT COUNT(*) as total FROM resenas WHERE producto_id = ?').get(productId).total;
    if (revCount < 2) {
      const reviews = reviewsDataset[p.sku] || [
        { calificacion: 5, comentario: 'Excelente producto, cumple exactamente lo que promete y el envío fue sumamente rápido.' },
        { calificacion: 5, comentario: 'Gran calidad y atención al cliente. Totalmente recomendado.' }
      ];
      for (const r of reviews) {
        db.prepare(`
          INSERT INTO resenas (producto_id, usuario_id, pedido_id, calificacion, comentario, verificada, moderada, created_at)
          VALUES (?, ?, NULL, ?, ?, 1, 1, ?)
        `).run(productId, clienteId, r.calificacion, r.comentario, now);
      }
    }
  }
}

function seedSimulatedCardsIfEmpty(db) {
  const countRow = db.prepare('SELECT COUNT(*) as total FROM tarjetas_simuladas').get();
  if (countRow && countRow.total > 0) return;

  const now = new Date().toISOString();
  const seedCards = [
    {
      numero_tarjeta: '4111 1111 1111 4242',
      titular: 'CLIENTE EXPRESSMART',
      expiracion: '12/29',
      cvv: '123',
      saldo: 50000.00,
      saldo_inicial: 50000.00,
      marca: 'Visa',
      tipo: 'credito'
    },
    {
      numero_tarjeta: '5500 0000 0000 1234',
      titular: 'DIEGO ALARCON PRUEBAS',
      expiracion: '08/28',
      cvv: '456',
      saldo: 25000.00,
      saldo_inicial: 25000.00,
      marca: 'Mastercard',
      tipo: 'debito'
    },
    {
      numero_tarjeta: '3782 8224 6310 005',
      titular: 'EMPRESA EXPRESSMART S.A.',
      expiracion: '10/27',
      cvv: '789',
      saldo: 100000.00,
      saldo_inicial: 100000.00,
      marca: 'American Express',
      tipo: 'corporativa'
    },
    {
      numero_tarjeta: '4000 1234 5678 9010',
      titular: 'TARJETA SALDO INSUFICIENTE',
      expiracion: '05/26',
      cvv: '999',
      saldo: 50.00,
      saldo_inicial: 50.00,
      marca: 'Visa',
      tipo: 'debito'
    }
  ];

  const insertCard = db.prepare(`
    INSERT INTO tarjetas_simuladas (
      numero_tarjeta, titular, expiracion, cvv, saldo, saldo_inicial, marca, tipo, activa, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  for (const c of seedCards) {
    insertCard.run(
      c.numero_tarjeta,
      c.titular,
      c.expiracion,
      c.cvv,
      c.saldo,
      c.saldo_inicial,
      c.marca,
      c.tipo,
      now,
      now
    );
  }
}

function seedRefundRequestsIfEmpty(db) {
  try {
    const count = db.prepare('SELECT COUNT(*) as total FROM solicitudes_reembolso').get().total;
    if (count > 0) return;

    const orders = db.prepare('SELECT id, usuario_id, total, folio FROM pedidos WHERE estado IN (\'pagado\', \'enviado\', \'entregado\') ORDER BY id ASC LIMIT 2').all();
    const now = new Date().toISOString();

    if (orders.length > 0) {
      const o1 = orders[0];
      db.prepare(`
        INSERT INTO solicitudes_reembolso (pedido_id, usuario_id, monto, motivo, estado, fecha_solicitud, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'pendiente', ?, ?, ?)
      `).run(o1.id, o1.usuario_id, o1.total, 'El producto llegó con detalle estético en el empaque y solicito devolución bajo garantía LFPC.', now, now, now);
    }

    if (orders.length > 1) {
      const o2 = orders[1];
      db.prepare(`
        INSERT INTO solicitudes_reembolso (pedido_id, usuario_id, monto, motivo, estado, fecha_solicitud, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'pendiente', ?, ?, ?)
      `).run(o2.id, o2.usuario_id, o2.total, 'Compré dos unidades por equivocación en el checkout, solicito devolución de la orden.', now, now, now);
    }
  } catch (_) {
    // Si la tabla no está lista o pedidos está vacía
  }
}

module.exports = {
  initDatabase,
  getDb,
  recordAuditLog
};
