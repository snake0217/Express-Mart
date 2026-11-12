/**
 * Servicio de Logística, Almacenes y Envíos (Apartado 23, RF-07, DEV-09)
 * Soporta OpenStreetMap (OSM) y simulación en tiempo real de vehículos de reparto (Camión / Auto).
 */

const crypto = require('crypto');

// Catálogo Maestro de Centros de Distribución (CEDIS) y Almacenes ExpressMart con Direcciones Completas
const WAREHOUSES = [
  {
    codigo: 'CEDIS-CDMX-01',
    nombre: 'CEDIS ExpressMart CDMX Norte (Vallejo)',
    tipo: 'CEDIS Principal Hub',
    direccion: 'Av. Ceylán 450, Bodega Logística 4-B, Col. Industrial Vallejo, C.P. 02300, Azcapotzalco, CDMX',
    ciudad: 'Ciudad de México',
    estado: 'CDMX',
    latitud: 19.4895,
    longitud: -99.1645,
    telefono: '+52 55 5876 1100',
    horario: '24/7 Operaciones Continuas',
    capacidadM3: 25000,
    muellesCarga: 14,
    color: '#1d4e9a'
  },
  {
    codigo: 'CEDIS-CDMX-02',
    nombre: 'CEDIS ExpressMart CDMX Sur (Coyoacán)',
    tipo: 'CEDIS Metropolitano Sur',
    direccion: 'Calzada del Hueso 820, Nave Sur-12, Col. Granjas Coapa, C.P. 14330, Coyoacán, CDMX',
    ciudad: 'Ciudad de México',
    estado: 'CDMX',
    latitud: 19.3032,
    longitud: -99.1352,
    telefono: '+52 55 5678 2200',
    horario: '06:00 - 22:00 hrs',
    capacidadM3: 18000,
    muellesCarga: 10,
    color: '#0284c7'
  },
  {
    codigo: 'CEDIS-GDL-01',
    nombre: 'CEDIS ExpressMart Guadalajara (Occidente)',
    tipo: 'CEDIS Regional Occidente',
    direccion: 'Av. Solidaridad Iberoamericana 7020, Parque Industrial Occidente, C.P. 45680, El Salto, Jalisco',
    ciudad: 'Guadalajara / El Salto',
    estado: 'Jalisco',
    latitud: 20.5833,
    longitud: -103.3167,
    telefono: '+52 33 3890 3300',
    horario: '24/7 Operaciones Continuas',
    capacidadM3: 20000,
    muellesCarga: 12,
    color: '#0d9488'
  },
  {
    codigo: 'CEDIS-MTY-01',
    nombre: 'CEDIS ExpressMart Monterrey (Noreste)',
    tipo: 'CEDIS Regional Norte',
    direccion: 'Blvd. TLC 300, Parque Industrial Kronos, Nave 8, C.P. 66600, Apodaca, Nuevo León',
    ciudad: 'Monterrey / Apodaca',
    estado: 'Nuevo León',
    latitud: 25.7785,
    longitud: -100.1873,
    telefono: '+52 81 8320 4400',
    horario: '24/7 Operaciones Continuas',
    capacidadM3: 22000,
    muellesCarga: 12,
    color: '#7c3aed'
  },
  {
    codigo: 'CEDIS-PUE-01',
    nombre: 'CEDIS ExpressMart Puebla (Centro-Oriente)',
    tipo: 'CEDIS Regional FINSA',
    direccion: 'Autopista México-Puebla Km 115.5, Parque Industrial FINSA, Bodega 3, C.P. 72710, Cuautlancingo, Puebla',
    ciudad: 'Puebla',
    estado: 'Puebla',
    latitud: 19.1150,
    longitud: -98.2500,
    telefono: '+52 22 2240 5500',
    horario: '07:00 - 21:00 hrs',
    capacidadM3: 15000,
    muellesCarga: 8,
    color: '#e11d48'
  }
];

// Zonas y coordenadas de destino de referencia en México
const REFERENCE_DESTINATIONS = [
  { clave: 'coyoacan', lat: 19.3458, lng: -99.1617, zona: 'Av. Miguel Ángel de Quevedo 420, Coyoacán, CDMX' },
  { clave: 'polanco', lat: 19.4326, lng: -99.1950, zona: 'Av. Presidente Masaryk 215, Polanco, Miguel Hidalgo, CDMX' },
  { clave: 'roma_condesa', lat: 19.4140, lng: -99.1680, zona: 'Av. Álvaro Obregón 154, Col. Roma Norte, Cuauhtémoc, CDMX' },
  { clave: 'del_valle', lat: 19.3789, lng: -99.1670, zona: 'Av. Insurgentes Sur 1180, Col. Del Valle, Benito Juárez, CDMX' },
  { clave: 'centro', lat: 19.4326, lng: -99.1332, zona: 'Av. Francisco I. Madero 55, Centro Histórico, CDMX' },
  { clave: 'santa_fe', lat: 19.3590, lng: -99.2590, zona: 'Av. Vasco de Quiroga 3800, Santa Fe, Cuajimalpa, CDMX' },
  { clave: 'guadalajara', lat: 20.6767, lng: -103.3496, zona: 'Av. Vallarta 1450, Col. Americana, Guadalajara, Jalisco' },
  { clave: 'monterrey', lat: 25.6866, lng: -100.3161, zona: 'Av. Constitución 950, Centro, Monterrey, Nuevo León' },
  { clave: 'puebla', lat: 19.0414, lng: -98.2063, zona: 'Av. Juárez 1905, Zona Esmeralda, Puebla, Pue.' }
];

/**
 * Busca un almacén CEDIS por código, alias o nombre; retorna null si no existe coincidencia
 */
function findWarehouseByCodeOrAlias(codeOrName = '') {
  const q = String(codeOrName || '').trim().toLowerCase();
  if (!q) return null;
  if (q === 'cedis-cdmx-norte' || q.includes('vallejo') || q === 'norte') {
    return WAREHOUSES[0];
  }
  if (q === 'cedis-cdmx-sur' || q.includes('coyoac') || q === 'coapa') {
    return WAREHOUSES[1];
  }
  return (
    WAREHOUSES.find(
      (w) =>
        w.codigo.toLowerCase() === q ||
        w.nombre.toLowerCase() === q ||
        w.nombre.toLowerCase().includes(q) ||
        q.includes(w.codigo.toLowerCase()) ||
        (q.includes('sur') && w.codigo === 'CEDIS-CDMX-02') ||
        (q.includes('guadalajara') && w.codigo === 'CEDIS-GDL-01') ||
        (q.includes('monterrey') && w.codigo === 'CEDIS-MTY-01') ||
        (q.includes('puebla') && w.codigo === 'CEDIS-PUE-01')
    ) || null
  );
}

/**
 * Obtiene los detalles completos del almacén por código o nombre (con fallback al hub Vallejo)
 */
function getWarehouseDetails(codeOrName = '') {
  return findWarehouseByCodeOrAlias(codeOrName) || WAREHOUSES[0];
}

/**
 * Deduce o asigna coordenadas geográficas realistas a partir de la dirección de entrega
 */
function resolveDestinationCoordinates(direccion = '', explicitLat = null, explicitLng = null) {
  const numLat = Number(explicitLat);
  const numLng = Number(explicitLng);
  if (Number.isFinite(numLat) && Number.isFinite(numLng) && Math.abs(numLat) > 1 && Math.abs(numLng) > 1) {
    return {
      lat: Number(numLat.toFixed(6)),
      lng: Number(numLng.toFixed(6)),
      zona: direccion || 'Ubicación seleccionada en Mapa OpenStreetMap'
    };
  }

  // Extraer coordenadas si vienen embebidas en el texto de la dirección: "[Lat: 19.4326, Lng: -99.1332]"
  const coordMatch = String(direccion).match(/lat[:\s]*(-?\d+\.\d+)[,\s]+(?:lng|lon)[:\s]*(-?\d+\.\d+)/i);
  if (coordMatch) {
    return {
      lat: Number(parseFloat(coordMatch[1]).toFixed(6)),
      lng: Number(parseFloat(coordMatch[2]).toFixed(6)),
      zona: direccion
    };
  }

  const dirLow = String(direccion).toLowerCase();
  if (dirLow.includes('coyoac') || dirLow.includes('universidad') || dirLow.includes('coapa')) {
    return { lat: 19.3458, lng: -99.1617, zona: 'Coyoacán, CDMX' };
  }
  if (dirLow.includes('polanco') || dirLow.includes('reforma') || dirLow.includes('miguel hidalgo')) {
    return { lat: 19.4326, lng: -99.1950, zona: 'Polanco, CDMX' };
  }
  if (dirLow.includes('roma') || dirLow.includes('condesa') || dirLow.includes('insurgentes')) {
    return { lat: 19.4140, lng: -99.1680, zona: 'Roma Norte, CDMX' };
  }
  if (dirLow.includes('valle') || dirLow.includes('benito ju') || dirLow.includes('narvarte')) {
    return { lat: 19.3789, lng: -99.1670, zona: 'Col. Del Valle, CDMX' };
  }
  if (dirLow.includes('guadalajara') || dirLow.includes('jalisco') || dirLow.includes('zapopan')) {
    return { lat: 20.6767, lng: -103.3496, zona: 'Guadalajara, Jalisco' };
  }
  if (dirLow.includes('monterrey') || dirLow.includes('nuevo le') || dirLow.includes('san pedro')) {
    return { lat: 25.6866, lng: -100.3161, zona: 'Monterrey, NL' };
  }
  if (dirLow.includes('puebla') || dirLow.includes('cholula')) {
    return { lat: 19.0414, lng: -98.2063, zona: 'Puebla Centro' };
  }

  // Si no coincide con palabras clave, genera un destino determinista pero variado en CDMX
  const hash = crypto.createHash('md5').update(direccion || 'CDMX').digest('hex');
  const latOffset = ((parseInt(hash.slice(0, 4), 16) % 120) - 60) / 1000;
  const lngOffset = ((parseInt(hash.slice(4, 8), 16) % 120) - 60) / 1000;
  return {
    lat: Number((19.3900 + latOffset).toFixed(5)),
    lng: Number((-99.1600 + lngOffset).toFixed(5)),
    zona: 'Área Metropolitana de la CDMX'
  };
}

/**
 * Selecciona el almacén CEDIS óptimo para despachar el pedido
 */
function resolveWarehouseForDestination(destCoords) {
  let closest = WAREHOUSES[0];
  let minDistance = Infinity;

  for (const wh of WAREHOUSES) {
    const dLat = wh.latitud - destCoords.lat;
    const dLng = wh.longitud - destCoords.lng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDistance) {
      minDistance = distSq;
      closest = wh;
    }
  }

  return closest;
}

/**
 * Genera una serie de coordenadas suaves (waypoints) a lo largo de una ruta urbana realista
 */
function generateRouteCoordinates(origin, destination, waypointCount = 40) {
  const points = [];
  const startLat = Number(origin.latitud || origin.lat || 19.4895);
  const startLng = Number(origin.longitud || origin.lng || -99.1645);
  const endLat = Number(destination.lat || destination.latitud || 19.3458);
  const endLng = Number(destination.lng || destination.longitud || -99.1617);

  const totalSteps = Math.max(20, Math.min(80, waypointCount));
  const seed = Math.abs(startLat * 1000 + endLng * 1000);
  const midLat = (startLat + endLat) / 2 + Math.sin(seed) * 0.012;
  const midLng = (startLng + endLng) / 2 + Math.cos(seed) * 0.012;

  for (let i = 0; i <= totalSteps; i++) {
    const t = i / totalSteps;
    const lat = (1 - t) * (1 - t) * startLat + 2 * (1 - t) * t * midLat + t * t * endLat;
    const lng = (1 - t) * (1 - t) * startLng + 2 * (1 - t) * t * midLng + t * t * endLng;

    const microJitterLat = Math.sin(i * 1.5) * 0.0004;
    const microJitterLng = Math.cos(i * 1.5) * 0.0004;

    points.push([
      Number((lat + (i > 0 && i < totalSteps ? microJitterLat : 0)).toFixed(6)),
      Number((lng + (i > 0 && i < totalSteps ? microJitterLng : 0)).toFixed(6))
    ]);
  }

  return points;
}

/**
 * Avanza automáticamente las simulaciones activas en la base de datos según el tiempo transcurrido
 */
function advanceActiveSimulations(db, filterPedidoId = null) {
  try {
    let sql = 'SELECT * FROM envios WHERE simulacion_activa = 1';
    const params = [];
    if (filterPedidoId) {
      sql += ' AND pedido_id = ?';
      params.push(Number(filterPedidoId));
    }
    const activeRows = db.prepare(sql).all(...params);
    if (!activeRows || activeRows.length === 0) return;

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    for (const row of activeRows) {
      let updatedMs = row.updated_at ? Date.parse(row.updated_at) : nowMs - 2000;
      if (Number.isNaN(updatedMs)) updatedMs = nowMs - 2000;
      const elapsedSec = Math.max(0, (nowMs - updatedMs) / 1000);

      // Si han pasado al menos 0.8 segundos desde el último paso, avanzamos la simulación (~4% por segundo)
      if (elapsedSec < 0.8) continue;

      const wh = getWarehouseDetails(row.almacen_codigo || row.almacen_origen);
      const origin = { latitud: row.lat_origen || wh.latitud, longitud: row.lng_origen || wh.longitud };
      const dest = { lat: row.lat_destino || 19.3458, lng: row.lng_destino || -99.1617 };

      let route = [];
      try {
        route = JSON.parse(row.ruta_puntos_json || '[]');
      } catch (_) {
        route = [];
      }
      if (!Array.isArray(route) || route.length < 2) {
        route = generateRouteCoordinates(origin, dest, 40);
      }

      const currentProgress = Number(row.progreso_simulacion || 0);
      const deltaProgress = Math.min(25, Math.max(3.5, elapsedSec * 4.5));
      const nextProgress = Math.min(100, Number((currentProgress + deltaProgress).toFixed(1)));

      // Interpolar posición sobre la polilínea de ruta
      const exactIdx = (nextProgress / 100) * (route.length - 1);
      const lowIdx = Math.max(0, Math.min(route.length - 1, Math.floor(exactIdx)));
      const highIdx = Math.max(0, Math.min(route.length - 1, Math.ceil(exactIdx)));
      const frac = exactIdx - lowIdx;

      const p1 = Array.isArray(route[lowIdx]) ? route[lowIdx] : [route[lowIdx]?.lat || origin.latitud, route[lowIdx]?.lng || origin.longitud];
      const p2 = Array.isArray(route[highIdx]) ? route[highIdx] : [route[highIdx]?.lat || dest.lat, route[highIdx]?.lng || dest.lng];

      const nextLat = Number((Number(p1[0]) + (Number(p2[0]) - Number(p1[0])) * frac).toFixed(6));
      const nextLng = Number((Number(p1[1]) + (Number(p2[1]) - Number(p1[1])) * frac).toFixed(6));

      if (nextProgress >= 100) {
        db.prepare(`
          UPDATE envios
          SET progreso_simulacion = 100.0, simulacion_activa = 0, estado_envio = 'entregado',
              lat_actual = ?, lng_actual = ?, ruta_puntos_json = ?, updated_at = ?
          WHERE id = ?
        `).run(dest.lat, dest.lng, JSON.stringify(route), nowIso, row.id);
        db.prepare("UPDATE pedidos SET estado = 'entregado', updated_at = ? WHERE id = ?").run(nowIso, row.pedido_id);
      } else {
        db.prepare(`
          UPDATE envios
          SET progreso_simulacion = ?, estado_envio = 'en_transito',
              lat_actual = ?, lng_actual = ?, ruta_puntos_json = ?, updated_at = ?
          WHERE id = ?
        `).run(nextProgress, nextLat, nextLng, JSON.stringify(route), nowIso, row.id);
      }
    }
  } catch (_) {}
}

/**
 * Inicializa la tabla almacenes y sincroniza las direcciones falsas completas de los CEDIS
 */
function ensureWarehousesTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS almacenes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'CEDIS Principal Hub',
      direccion TEXT NOT NULL,
      ciudad TEXT NOT NULL,
      estado TEXT NOT NULL,
      latitud REAL NOT NULL,
      longitud REAL NOT NULL,
      telefono TEXT NOT NULL,
      horario TEXT NOT NULL,
      capacidad_m3 REAL NOT NULL DEFAULT 20000,
      muelles_carga INTEGER NOT NULL DEFAULT 10,
      color TEXT NOT NULL DEFAULT '#1d4e9a',
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
  `);

  const now = new Date().toISOString();
  const upsertWh = db.prepare(`
    INSERT INTO almacenes (
      codigo, nombre, tipo, direccion, ciudad, estado, latitud, longitud, telefono, horario, capacidad_m3, muelles_carga, color, activo, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(codigo) DO UPDATE SET
      nombre = excluded.nombre,
      direccion = excluded.direccion,
      latitud = excluded.latitud,
      longitud = excluded.longitud,
      telefono = excluded.telefono,
      horario = excluded.horario
  `);

  for (const w of WAREHOUSES) {
    upsertWh.run(
      w.codigo,
      w.nombre,
      w.tipo,
      w.direccion,
      w.ciudad,
      w.estado,
      w.latitud,
      w.longitud,
      w.telefono,
      w.horario,
      w.capacidadM3,
      w.muellesCarga,
      w.color,
      now
    );
  }

  // Normalizar inventarios heredados con el código antiguo 'CEDIS-CDMX-NORTE' hacia los 5 CEDIS oficiales
  try {
    const legacyRows = db.prepare("SELECT producto_id FROM inventario WHERE ubicacion_almacen = 'CEDIS-CDMX-NORTE' ORDER BY producto_id ASC").all();
    if (legacyRows.length > 0) {
      const updInv = db.prepare('UPDATE inventario SET ubicacion_almacen = ? WHERE producto_id = ?');
      legacyRows.forEach((row, idx) => {
        const wh = WAREHOUSES[idx % WAREHOUSES.length];
        updInv.run(wh.codigo, row.producto_id);
      });
    }
  } catch (_) {}
}

/**
 * Asegura que las tablas envios y usuarios contengan los campos requeridos para OpenStreetMap y simulación
 */
function ensureShipmentsTableExtended(db) {
  try { db.exec('ALTER TABLE usuarios ADD COLUMN latitud REAL DEFAULT 19.3789;'); } catch (_) {}
  try { db.exec('ALTER TABLE usuarios ADD COLUMN longitud REAL DEFAULT -99.1670;'); } catch (_) {}
  try { db.exec("ALTER TABLE envios ADD COLUMN almacen_origen TEXT DEFAULT 'CEDIS ExpressMart CDMX Norte (Vallejo)';"); } catch (_) {}
  try { db.exec("ALTER TABLE envios ADD COLUMN almacen_codigo TEXT DEFAULT 'CEDIS-CDMX-01';"); } catch (_) {}
  try { db.exec("ALTER TABLE envios ADD COLUMN almacen_direccion TEXT DEFAULT 'Av. Ceylán 450, Bodega Logística 4-B, Col. Industrial Vallejo, C.P. 02300, Azcapotzalco, CDMX';"); } catch (_) {}
  try { db.exec('ALTER TABLE envios ADD COLUMN lat_origen REAL DEFAULT 19.4895;'); } catch (_) {}
  try { db.exec('ALTER TABLE envios ADD COLUMN lng_origen REAL DEFAULT -99.1645;'); } catch (_) {}
  try { db.exec('ALTER TABLE envios ADD COLUMN lat_destino REAL DEFAULT 19.3458;'); } catch (_) {}
  try { db.exec('ALTER TABLE envios ADD COLUMN lng_destino REAL DEFAULT -99.1617;'); } catch (_) {}
  try { db.exec('ALTER TABLE envios ADD COLUMN lat_actual REAL DEFAULT 19.4895;'); } catch (_) {}
  try { db.exec('ALTER TABLE envios ADD COLUMN lng_actual REAL DEFAULT -99.1645;'); } catch (_) {}
  try { db.exec('ALTER TABLE envios ADD COLUMN progreso_simulacion REAL DEFAULT 0.0;'); } catch (_) {}
  try { db.exec('ALTER TABLE envios ADD COLUMN simulacion_activa INTEGER DEFAULT 0;'); } catch (_) {}
  try { db.exec("ALTER TABLE envios ADD COLUMN tipo_vehiculo TEXT DEFAULT 'camion';"); } catch (_) {}
  try { db.exec("ALTER TABLE envios ADD COLUMN ruta_puntos_json TEXT DEFAULT '[]';"); } catch (_) {}

  // Poblar rutas y direcciones de almacén faltantes
  const allEnvios = db.prepare('SELECT * FROM envios').all();
  for (const s of allEnvios) {
    const wh = getWarehouseDetails(s.almacen_codigo || s.almacen_origen);
    const origin = { latitud: s.lat_origen || wh.latitud, longitud: s.lng_origen || wh.longitud };
    const dest = { lat: s.lat_destino || 19.3458, lng: s.lng_destino || -99.1617 };

    let pts = [];
    try {
      pts = JSON.parse(s.ruta_puntos_json || '[]');
    } catch (_) {
      pts = [];
    }
    if (!Array.isArray(pts) || pts.length < 2) {
      pts = generateRouteCoordinates(origin, dest, 40);
    }

    if (!s.almacen_direccion || !s.ruta_puntos_json || s.ruta_puntos_json === '[]') {
      db.prepare(`
        UPDATE envios
        SET almacen_origen = ?, almacen_codigo = ?, almacen_direccion = ?,
            lat_origen = ?, lng_origen = ?, ruta_puntos_json = ?,
            lat_actual = COALESCE(lat_actual, ?), lng_actual = COALESCE(lng_actual, ?)
        WHERE id = ?
      `).run(
        wh.nombre,
        wh.codigo,
        wh.direccion,
        origin.latitud,
        origin.longitud,
        JSON.stringify(pts),
        pts[0][0],
        pts[0][1],
        s.id
      );
    }
  }
}

/**
 * Calcula el nombre de la calle, número exterior, colonia, C.P. y alcaldía/ciudad
 * a partir de las coordenadas (lat, lng) seleccionadas en el mapa OpenStreetMap.
 */
function resolveStreetNameFromCoordinates(lat, lng) {
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) {
    return {
      calle: 'Av. Insurgentes Sur',
      numero: '1602',
      colonia: 'Col. Crédito Constructor',
      cp: '03940',
      ciudad: 'Benito Juárez, CDMX',
      direccionCompleta: 'Av. Insurgentes Sur 1602, Col. Crédito Constructor, C.P. 03940, Benito Juárez, CDMX'
    };
  }

  const zones = [
    { lat: 19.4895, lng: -99.1645, calles: ['Av. Ceylán', 'Calz. Vallejo', 'Av. Poniente 140', 'Norte 45'], colonia: 'Col. Industrial Vallejo', cp: '02300', ciudad: 'Azcapotzalco, CDMX' },
    { lat: 19.4326, lng: -99.1332, calles: ['Av. Paseo de la Reforma', 'Av. Juárez', 'Calle Francisco I. Madero', 'Eje Central Lázaro Cárdenas'], colonia: 'Col. Centro Histórico', cp: '06000', ciudad: 'Cuauhtémoc, CDMX' },
    { lat: 19.4326, lng: -99.1950, calles: ['Av. Presidente Masaryk', 'Av. Horacio', 'Calle Homero', 'Av. Ejército Nacional'], colonia: 'Col. Polanco V Sección', cp: '11560', ciudad: 'Miguel Hidalgo, CDMX' },
    { lat: 19.4140, lng: -99.1680, calles: ['Av. Álvaro Obregón', 'Av. Sonora', 'Calle Orizaba', 'Av. Tamaulipas'], colonia: 'Col. Roma Norte / Condesa', cp: '06700', ciudad: 'Cuauhtémoc, CDMX' },
    { lat: 19.3907, lng: -99.1636, calles: ['Av. Insurgentes Sur', 'Av. División del Norte', 'Calle Pilares', 'Eje 5 Sur Eugenia'], colonia: 'Col. Del Valle Centro', cp: '03100', ciudad: 'Benito Juárez, CDMX' },
    { lat: 19.3458, lng: -99.1617, calles: ['Av. Miguel Ángel de Quevedo', 'Av. Universidad', 'Calle Francisco Sosa', 'Av. Pacífico'], colonia: 'Col. Villa Coyoacán', cp: '04000', ciudad: 'Coyoacán, CDMX' },
    { lat: 19.3032, lng: -99.1352, calles: ['Calz. del Hueso', 'Av. Canal de Miramontes', 'Calz. Acoxpa', 'Av. Cafetales'], colonia: 'Col. Granjas Coapa', cp: '14330', ciudad: 'Tlalpan / Coyoacán, CDMX' },
    { lat: 19.3590, lng: -99.2590, calles: ['Av. Vasco de Quiroga', 'Av. Santa Fe', 'Prol. Paseo de la Reforma', 'Av. Javier Barros Sierra'], colonia: 'Col. Lomas de Santa Fe', cp: '01219', ciudad: 'Cuajimalpa, CDMX' },
    { lat: 19.3621, lng: -99.0721, calles: ['Calz. Ermita Iztapalapa', 'Calz. Ignacio Zaragoza', 'Av. Rojo Gómez', 'Eje 6 Sur'], colonia: 'Col. Barrio San Miguel', cp: '09360', ciudad: 'Iztapalapa, CDMX' },
    { lat: 20.6736, lng: -103.3440, calles: ['Av. Ignacio L. Vallarta', 'Av. Chapultepec Sur', 'Av. Américas', 'Av. López Mateos Sur'], colonia: 'Col. Americana', cp: '44160', ciudad: 'Guadalajara, Jalisco' },
    { lat: 25.6714, lng: -100.3090, calles: ['Av. Constitución', 'Av. Eugenio Garza Sada', 'Av. Gonzalitos', 'Calz. del Valle'], colonia: 'Col. Centro / Obispado', cp: '64000', ciudad: 'Monterrey, Nuevo León' },
    { lat: 19.0414, lng: -98.2063, calles: ['Av. Juárez', 'Blvd. Héroes del 5 de Mayo', 'Av. Reforma', 'Vía Atlixcáyotl'], colonia: 'Col. Centro / La Paz', cp: '72000', ciudad: 'Puebla, Pue.' }
  ];

  let closest = zones[0];
  let minD = Infinity;
  for (const z of zones) {
    const d = Math.hypot(z.lat - numLat, z.lng - numLng);
    if (d < minD) {
      minD = d;
      closest = z;
    }
  }

  const seed = Math.abs(Math.round(numLat * 10000) + Math.round(numLng * 10000));
  const calle = closest.calles[seed % closest.calles.length];
  const numero = String(104 + (seed % 1890));
  const direccionCompleta = `${calle} ${numero}, ${closest.colonia}, C.P. ${closest.cp}, ${closest.ciudad}`;

  return {
    calle,
    numero,
    colonia: closest.colonia,
    cp: closest.cp,
    ciudad: closest.ciudad,
    lat: Number(numLat.toFixed(5)),
    lng: Number(numLng.toFixed(5)),
    direccionCompleta
  };
}

/**
 * Resuelve y valida un almacén CEDIS activo en base de datos o catálogo maestro.
 * Retorna null si se proporcionó un código explícito que no corresponde a ningún almacén.
 */
function resolveValidWarehouse(db, codeOrName = '') {
  const raw = String(codeOrName || '').trim();
  if (!raw) return null;

  try {
    const row = db.prepare(`
      SELECT * FROM almacenes
      WHERE activo = 1 AND (LOWER(codigo) = LOWER(?) OR LOWER(nombre) = LOWER(?))
      LIMIT 1
    `).get(raw, raw);
    if (row) return row;
  } catch (_) {}

  return findWarehouseByCodeOrAlias(raw);
}

/**
 * Obtiene el catálogo completo de almacenes CEDIS junto con sus métricas de envíos y
 * la lista de productos almacenados en cada uno.
 */
function getWarehousesWithInventory(db, { almacen = '', q = '', categoria = '' } = {}) {
  let whRows = [];
  try {
    whRows = db.prepare('SELECT * FROM almacenes WHERE activo = 1 ORDER BY id ASC').all();
  } catch (_) {
    whRows = [];
  }
  if (!whRows.length) {
    whRows = WAREHOUSES.map((w, idx) => ({
      id: idx + 1,
      codigo: w.codigo,
      nombre: w.nombre,
      tipo: w.tipo,
      direccion: w.direccion,
      ciudad: w.ciudad,
      estado: w.estado,
      latitud: w.latitud,
      longitud: w.longitud,
      telefono: w.telefono,
      horario: w.horario,
      capacidad_m3: w.capacidadM3,
      muelles_carga: w.muellesCarga,
      color: w.color,
      activo: 1
    }));
  }

  const productRows = db.prepare(`
    SELECT c.id, c.sku, c.nombre, c.descripcion, c.categoria, c.marca, c.precio,
           c.imagen_url, c.vendedor_id, c.activo, c.updated_at,
           COALESCE(i.stock_disponible, 0) AS stock_disponible,
           COALESCE(i.stock_reservado, 0) AS stock_reservado,
           COALESCE(i.ubicacion_almacen, 'CEDIS-CDMX-01') AS ubicacion_almacen,
           i.ultima_conciliacion,
           COALESCE(u.nombre, 'Vendedor ExpressMart') AS vendedor_nombre
    FROM catalogo c
    LEFT JOIN inventario i ON i.producto_id = c.id
    LEFT JOIN usuarios u ON u.id = c.vendedor_id
    WHERE c.activo = 1
    ORDER BY c.id DESC
  `).all();

  const whMap = new Map(whRows.map((w) => [w.codigo, w]));
  const productsByWh = new Map(whRows.map((w) => [w.codigo, []]));

  for (const prod of productRows) {
    const resolvedWh = getWarehouseDetails(prod.ubicacion_almacen);
    const codigo = whMap.has(resolvedWh.codigo) ? resolvedWh.codigo : whRows[0].codigo;
    const whInfo = whMap.get(codigo) || resolvedWh;
    const list = productsByWh.get(codigo);
    if (list) {
      list.push({
        ...prod,
        almacen_codigo: whInfo.codigo,
        almacen_nombre: whInfo.nombre,
        almacen_ciudad: whInfo.ciudad || '',
        almacen_direccion: whInfo.direccion,
        almacen_color: whInfo.color || '#1d4e9a'
      });
    }
  }

  const filterWh = almacen ? findWarehouseByCodeOrAlias(almacen) || { codigo: String(almacen).trim() } : null;
  const searchQ = String(q || '').trim().toLowerCase();
  const catQ = String(categoria || '').trim().toLowerCase();

  const matchesProductFilter = (p) => {
    if (catQ && String(p.categoria || '').toLowerCase() !== catQ) return false;
    if (searchQ) {
      const hay = `${p.nombre || ''} ${p.sku || ''} ${p.marca || ''} ${p.categoria || ''} ${p.almacen_nombre || ''}`.toLowerCase();
      if (!hay.includes(searchQ)) return false;
    }
    return true;
  };

  const enrichedWarehouses = whRows.map((wh) => {
    const details = getWarehouseDetails(wh.codigo || wh.nombre);
    const allInWh = productsByWh.get(wh.codigo) || [];
    const filteredInWh = allInWh.filter(matchesProductFilter);

    let stats = { totalPedidos: 0, preparando: 0, enTransito: 0, entregados: 0 };
    try {
      const counts = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN estado_envio = 'preparando' THEN 1 ELSE 0 END) as preparando,
          SUM(CASE WHEN estado_envio = 'en_transito' THEN 1 ELSE 0 END) as enTransito,
          SUM(CASE WHEN estado_envio = 'entregado' THEN 1 ELSE 0 END) as entregados
        FROM envios
        WHERE almacen_codigo = ? OR almacen_origen LIKE '%' || ? || '%'
      `).get(wh.codigo, wh.codigo);
      if (counts) {
        stats = {
          totalPedidos: Number(counts.total || 0),
          preparando: Number(counts.preparando || 0),
          enTransito: Number(counts.enTransito || 0),
          entregados: Number(counts.entregados || 0)
        };
      }
    } catch (_) {}

    const stockTotal = allInWh.reduce((acc, p) => acc + Number(p.stock_disponible || 0), 0);
    const valorInventarioMxn = Number(
      allInWh.reduce((acc, p) => acc + Number(p.precio || 0) * Number(p.stock_disponible || 0), 0).toFixed(2)
    );

    return {
      ...wh,
      direccion: wh.direccion || details.direccion,
      stats,
      productosCount: allInWh.length,
      stockTotal,
      valorInventarioMxn,
      productos: filteredInWh
    };
  });

  const flatProducts = enrichedWarehouses
    .filter((w) => !filterWh || w.codigo.toLowerCase() === String(filterWh.codigo || '').toLowerCase())
    .flatMap((w) => w.productos);

  return {
    warehouses: enrichedWarehouses,
    productos: flatProducts
  };
}

module.exports = {
  WAREHOUSES,
  REFERENCE_DESTINATIONS,
  findWarehouseByCodeOrAlias,
  getWarehouseDetails,
  resolveValidWarehouse,
  getWarehousesWithInventory,
  resolveDestinationCoordinates,
  resolveWarehouseForDestination,
  generateRouteCoordinates,
  advanceActiveSimulations,
  ensureWarehousesTable,
  ensureShipmentsTableExtended,
  resolveStreetNameFromCoordinates
};


