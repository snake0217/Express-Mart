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
      metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('tarjeta', 'wallet', 'msi')),
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

    -- D6: Envíos y Logística
    CREATE TABLE IF NOT EXISTS envios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER UNIQUE NOT NULL,
      proveedor_paqueteria TEXT NOT NULL,
      numero_guia TEXT UNIQUE NOT NULL,
      estado_envio TEXT NOT NULL CHECK (estado_envio IN ('preparando', 'en_transito', 'en_reparto', 'entregado', 'devuelto')),
      fecha_estimada TEXT NOT NULL,
      historial_rastreo_json TEXT NOT NULL,
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
  `);

  try {
    db.exec("ALTER TABLE usuarios ADD COLUMN foto_perfil TEXT DEFAULT '';");
  } catch (_) {
    // Columna foto_perfil ya existe
  }

  dbInstance = db;
  seedDatabaseIfEmpty(db);
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
      imagen_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
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
      imagen_url: 'https://images.unsplash.com/photo-1547082299-de196ea013d6?auto=format&fit=crop&w=800&q=80',
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
      imagen_url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=800&q=80',
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
      imagen_url: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80',
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
      imagen_url: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=800&q=80',
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
      imagen_url: 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=800&q=80',
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
      imagen_url: 'https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=800&q=80',
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
      imagen_url: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=800&q=80',
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
      imagen_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=800&q=80',
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
      imagen_url: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80',
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
      imagen_url: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=800&q=80',
      especificaciones: { filtro: 'True HEPA H13 + Carbón activado', cad: '380 m³/h', nivelRuido: 'Desde 22 dB en modo noche', garantia: '24 meses' },
      condiciones_envio: 'Envío ExpressPrime gratis a toda la República Mexicana.',
      stock: 26
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

module.exports = {
  initDatabase,
  getDb,
  recordAuditLog
};
