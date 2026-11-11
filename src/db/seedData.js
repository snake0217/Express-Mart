/**
 * Semillas de Usuarios, Cupones, Reseñas, Tarjetas y Reembolsos Iniciales
 * Conforme a SGC MC-001 (Apartados 18.1, 18.2, 19, 23)
 */

const { hashPassword, generateMfaSecret, encryptData } = require('../utils/crypto');
const { catalogDataset } = require('./seedCatalog');
const { recordAuditLog } = require('./auditLog');

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
  if (countRow && countRow.total > 0) {
    // Asegurar que las tarjetas existentes tengan usuario_id y color_plastico asignados
    try {
      db.prepare("UPDATE tarjetas_simuladas SET usuario_id = 3, color_plastico = '#1d4ed8' WHERE numero_tarjeta = '4111 1111 1111 4242' AND usuario_id IS NULL").run();
      db.prepare("UPDATE tarjetas_simuladas SET usuario_id = 1, color_plastico = '#22c55e' WHERE numero_tarjeta = '5500 0000 0000 1234' AND usuario_id IS NULL").run();
      db.prepare("UPDATE tarjetas_simuladas SET usuario_id = 2, color_plastico = '#0f172a' WHERE numero_tarjeta = '3782 8224 6310 005' AND usuario_id IS NULL").run();
      db.prepare("UPDATE tarjetas_simuladas SET usuario_id = 3, color_plastico = '#e11d48' WHERE numero_tarjeta = '4000 1234 5678 9010' AND usuario_id IS NULL").run();
    } catch (_) {}
    return;
  }

  const now = new Date().toISOString();
  const seedCards = [
    {
      usuario_id: 3,
      numero_tarjeta: '4111 1111 1111 4242',
      titular: 'CRISTOPHER ERIK SAN JUAN',
      expiracion: '12/29',
      cvv: '123',
      saldo: 50000.00,
      saldo_inicial: 50000.00,
      marca: 'Visa',
      tipo: 'credito',
      color_plastico: '#1d4ed8',
      vinculada_paypal: 1
    },
    {
      usuario_id: 1,
      numero_tarjeta: '5500 0000 0000 1234',
      titular: 'DIEGO ALARCON PRUEBAS',
      expiracion: '08/28',
      cvv: '456',
      saldo: 25000.00,
      saldo_inicial: 25000.00,
      marca: 'Mastercard',
      tipo: 'debito',
      color_plastico: '#22c55e',
      vinculada_paypal: 1
    },
    {
      usuario_id: 2,
      numero_tarjeta: '3782 8224 6310 005',
      titular: 'CARLOS ADAIR BAUTISTA',
      expiracion: '10/27',
      cvv: '789',
      saldo: 100000.00,
      saldo_inicial: 100000.00,
      marca: 'American Express',
      tipo: 'corporativa',
      color_plastico: '#0f172a',
      vinculada_paypal: 1
    },
    {
      usuario_id: 3,
      numero_tarjeta: '4000 1234 5678 9010',
      titular: 'TARJETA SALDO INSUFICIENTE',
      expiracion: '05/26',
      cvv: '999',
      saldo: 50.00,
      saldo_inicial: 50.00,
      marca: 'Visa',
      tipo: 'debito',
      color_plastico: '#e11d48',
      vinculada_paypal: 1
    }
  ];

  const insertCard = db.prepare(`
    INSERT INTO tarjetas_simuladas (
      usuario_id, numero_tarjeta, titular, expiracion, cvv, saldo, saldo_inicial, marca, tipo, color_plastico, vinculada_paypal, activa, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  for (const c of seedCards) {
    insertCard.run(
      c.usuario_id,
      c.numero_tarjeta,
      c.titular,
      c.expiracion,
      c.cvv,
      c.saldo,
      c.saldo_inicial,
      c.marca,
      c.tipo,
      c.color_plastico,
      c.vinculada_paypal,
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
  seedDatabaseIfEmpty,
  syncCatalogAndReviews,
  seedSimulatedCardsIfEmpty,
  seedRefundRequestsIfEmpty
};
