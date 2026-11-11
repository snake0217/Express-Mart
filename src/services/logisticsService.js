/**
 * Servicio de Logística, Almacenes y Envíos (Apartado 23, RF-07, DEV-09)
 * Soporta OpenStreetMap (OSM) y simulación en tiempo real de vehículos de reparto (Camión / Auto).
 */

const crypto = require('crypto');

// Catálogo Maestro de Centros de Distribución (CEDIS) y Almacenes ExpressMart
const WAREHOUSES = [
  {
    codigo: 'CEDIS-CDMX-01',
    nombre: 'CEDIS ExpressMart CDMX Norte (Vallejo)',
    tipo: 'CEDIS Principal Hub',
    direccion: 'Av. Ceylán 450, Col. Industrial Vallejo, Azcapotzalco, CDMX',
    ciudad: 'Ciudad de México',
    estado: 'CDMX',
    latitud: 19.5186,
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
    direccion: 'Calzada del Hueso 800, Granjas Coapa, Coyoacán, CDMX',
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
    direccion: 'Av. de la Solidaridad Iberoamericana 7000, El Salto, Jalisco',
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
    direccion: 'Parque Industrial Kronos, Apodaca, Nuevo León',
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
    direccion: 'Autopista México-Puebla Km 115, Parque FINSA, Cuautlancingo, Puebla',
    ciudad: 'Puebla',
    estado: 'Puebla',
    latitud: 19.0833,
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
  { clave: 'coyoacan', lat: 19.3458, lng: -99.1617, zona: 'Coyoacán / Universidad, CDMX' },
  { clave: 'polanco', lat: 19.4326, lng: -99.1950, zona: 'Polanco / Miguel Hidalgo, CDMX' },
  { clave: 'roma_condesa', lat: 19.4140, lng: -99.1680, zona: 'Roma Norte / Cuauhtémoc, CDMX' },
  { clave: 'del_valle', lat: 19.3789, lng: -99.1670, zona: 'Col. Del Valle / Benito Juárez, CDMX' },
  { clave: 'centro', lat: 19.4326, lng: -99.1332, zona: 'Centro Histórico, CDMX' },
  { clave: 'santa_fe', lat: 19.3590, lng: -99.2590, zona: 'Santa Fe / Cuajimalpa, CDMX' },
  { clave: 'guadalajara', lat: 20.6767, lng: -103.3496, zona: 'Guadalajara Centro, Jalisco' },
  { clave: 'monterrey', lat: 25.6866, lng: -100.3161, zona: 'Monterrey Centro, Nuevo León' },
  { clave: 'puebla', lat: 19.0414, lng: -98.2063, zona: 'Puebla Centro, Puebla' }
];

/**
 * Deduce o asigna coordenadas geográficas realistas a partir de la dirección de entrega
 */
function resolveDestinationCoordinates(direccion = '') {
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
  const latOffset = (parseInt(hash.slice(0, 4), 16) % 120 - 60) / 1000; // +- 0.06
  const lngOffset = (parseInt(hash.slice(4, 8), 16) % 120 - 60) / 1000;
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
  const startLat = origin.latitud || origin.lat;
  const startLng = origin.longitud || origin.lng;
  const endLat = destination.lat;
  const endLng = destination.lng;

  // Calculamos vector base
  const totalSteps = Math.max(20, Math.min(80, waypointCount));

  // Generamos pequeños desvíos simulando avenidas y giros vehiculares (Manhattan-like o curvas suaves)
  const seed = Math.abs(startLat * 1000 + endLng * 1000);
  const midLat = (startLat + endLat) / 2 + Math.sin(seed) * 0.012;
  const midLng = (startLng + endLng) / 2 + Math.cos(seed) * 0.012;

  for (let i = 0; i <= totalSteps; i++) {
    const t = i / totalSteps;
    // Curva cuadrática de Bézier para emular trazo de avenida
    const lat = (1 - t) * (1 - t) * startLat + 2 * (1 - t) * t * midLat + t * t * endLat;
    const lng = (1 - t) * (1 - t) * startLng + 2 * (1 - t) * t * midLng + t * t * endLng;

    // Pequeño jitter para realismo de calles
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
 * Inicializa la tabla almacenes y siembra los CEDIS si la tabla está vacía
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

  const count = db.prepare('SELECT COUNT(*) as total FROM almacenes').get().total;
  if (count === 0) {
    const now = new Date().toISOString();
    const insertWh = db.prepare(`
      INSERT INTO almacenes (
        codigo, nombre, tipo, direccion, ciudad, estado, latitud, longitud, telefono, horario, capacidad_m3, muelles_carga, color, activo, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    for (const w of WAREHOUSES) {
      insertWh.run(
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
  }
}

/**
 * Asegura que la tabla envios contenga los campos requeridos para OpenStreetMap y simulación
 */
function ensureShipmentsTableExtended(db) {
  try { db.exec("ALTER TABLE envios ADD COLUMN almacen_origen TEXT DEFAULT 'CEDIS CDMX Norte (Vallejo)';"); } catch (_) {}
  try { db.exec("ALTER TABLE envios ADD COLUMN almacen_codigo TEXT DEFAULT 'CEDIS-CDMX-01';"); } catch (_) {}
  try { db.exec("ALTER TABLE envios ADD COLUMN lat_origen REAL DEFAULT 19.5186;"); } catch (_) {}
  try { db.exec("ALTER TABLE envios ADD COLUMN lng_origen REAL DEFAULT -99.1645;"); } catch (_) {}
  try { db.exec("ALTER TABLE envios ADD COLUMN lat_destino REAL DEFAULT 19.3458;"); } catch (_) {}
  try { db.exec("ALTER TABLE envios ADD COLUMN lng_destino REAL DEFAULT -99.1617;"); } catch (_) {}
  try { db.exec("ALTER TABLE envios ADD COLUMN lat_actual REAL DEFAULT 19.5186;"); } catch (_) {}
  try { db.exec("ALTER TABLE envios ADD COLUMN lng_actual REAL DEFAULT -99.1645;"); } catch (_) {}
  try { db.exec("ALTER TABLE envios ADD COLUMN progreso_simulacion REAL DEFAULT 0.0;"); } catch (_) {}
  try { db.exec("ALTER TABLE envios ADD COLUMN simulacion_activa INTEGER DEFAULT 0;"); } catch (_) {}
  try { db.exec("ALTER TABLE envios ADD COLUMN tipo_vehiculo TEXT DEFAULT 'camion';"); } catch (_) {}
  try { db.exec("ALTER TABLE envios ADD COLUMN ruta_puntos_json TEXT DEFAULT '[]';"); } catch (_) {}

  // Si existen envíos sin ruta de coordenadas calculada, poblarlas
  const emptyRoutes = db.prepare("SELECT id, pedido_id, lat_origen, lng_origen, lat_destino, lng_destino FROM envios WHERE ruta_puntos_json IS NULL OR ruta_puntos_json = '[]' OR ruta_puntos_json = ''").all();
  for (const s of emptyRoutes) {
    const origin = { latitud: s.lat_origen || 19.5186, longitud: s.lng_origen || -99.1645 };
    const dest = { lat: s.lat_destino || 19.3458, lng: s.lng_destino || -99.1617 };
    const pts = generateRouteCoordinates(origin, dest, 40);
    db.prepare('UPDATE envios SET ruta_puntos_json = ?, lat_actual = ?, lng_actual = ? WHERE id = ?').run(
      JSON.stringify(pts),
      pts[0][0],
      pts[0][1],
      s.id
    );
  }
}

module.exports = {
  WAREHOUSES,
  REFERENCE_DESTINATIONS,
  resolveDestinationCoordinates,
  resolveWarehouseForDestination,
  generateRouteCoordinates,
  ensureWarehousesTable,
  ensureShipmentsTableExtended
};
