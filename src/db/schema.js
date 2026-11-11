/**
 * Definición de Esquemas DDL y Migraciones de Base de Datos (SQLite)
 * Almacenes D1 a D9 conforme a SGC MC-001, ISO/IEC 25012 y OWASP ASVS
 */

function createAllTables(db) {
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
      latitud REAL DEFAULT 19.3789,
      longitud REAL DEFAULT -99.1670,
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
      almacen_direccion TEXT NOT NULL DEFAULT 'Av. Ceylán 450, Bodega Logística 4-B, Col. Industrial Vallejo, C.P. 02300, Azcapotzalco, CDMX',
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

    -- Tarjetas Simuladas para Compras y Saldo (PCI DSS / Sandbox Local / PayPal)
    CREATE TABLE IF NOT EXISTS tarjetas_simuladas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER DEFAULT NULL,
      numero_tarjeta TEXT UNIQUE NOT NULL,
      titular TEXT NOT NULL,
      expiracion TEXT NOT NULL,
      cvv TEXT NOT NULL,
      saldo REAL NOT NULL CHECK (saldo >= 0),
      saldo_inicial REAL NOT NULL DEFAULT 0,
      marca TEXT NOT NULL DEFAULT 'Visa',
      tipo TEXT NOT NULL DEFAULT 'credito',
      color_plastico TEXT NOT NULL DEFAULT '#1d4ed8',
      vinculada_paypal INTEGER NOT NULL DEFAULT 1,
      activa INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
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
    db.exec('ALTER TABLE tarjetas_simuladas ADD COLUMN usuario_id INTEGER DEFAULT NULL;');
  } catch (_) {}
  try {
    db.exec("ALTER TABLE tarjetas_simuladas ADD COLUMN color_plastico TEXT NOT NULL DEFAULT '#1d4ed8';");
  } catch (_) {}
  try {
    db.exec('ALTER TABLE tarjetas_simuladas ADD COLUMN vinculada_paypal INTEGER NOT NULL DEFAULT 1;');
  } catch (_) {}

  try {
    db.exec("ALTER TABLE usuarios ADD COLUMN foto_perfil TEXT DEFAULT '';");
  } catch (_) {}

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
  } catch (_) {}
}

module.exports = {
  createAllTables
};
