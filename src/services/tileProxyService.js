/**
 * Servicio Proxy de Mosaicos Cartográficos con Caché y Respaldo Multi-Proveedor
 * Cumple con OpenStreetMap Tile Usage Policy (§1 URL canónica sin {s}, §3.1 User-Agent
 * identificable y §5 Caché TTL 7 días), descartando respuestas HTTP 200 marcadas con `x-blocked`.
 */

const MAX_TILE_ZOOM = 19;
const MAX_CACHE_ENTRIES = 800;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const EXPRESSMART_TILE_UA = 'ExpressMartLogistica/1.0 (+https://expressmart.mx; soporte@expressmart.mx)';

const tileMemoryCache = new Map();

function validateTileCoords(zRaw, xRaw, yRaw) {
  const z = Number(zRaw);
  const x = Number(xRaw);
  const yClean = String(yRaw || '').replace(/\.png$/i, '');
  const y = Number(yClean);

  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) {
    return { valid: false, error: 'Coordenadas de mosaico inválidas (deben ser enteros).' };
  }
  if (z < 0 || z > MAX_TILE_ZOOM) {
    return { valid: false, error: `Nivel de zoom fuera de rango (0-${MAX_TILE_ZOOM}).` };
  }
  const maxAxis = 2 ** z;
  if (x < 0 || x >= maxAxis || y < 0 || y >= maxAxis) {
    return { valid: false, error: 'Índice x/y fuera de los límites del nivel de zoom.' };
  }
  return { valid: true, z, x, y };
}

function buildUpstreamProviders(z, x, y) {
  return [
    {
      name: 'openstreetmap',
      url: `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
      requiresOsmIdentity: true
    },
    {
      name: 'esri-world-street',
      url: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`,
      requiresOsmIdentity: false
    },
    {
      name: 'openstreetmap-de',
      url: `https://tile.openstreetmap.de/${z}/${x}/${y}.png`,
      requiresOsmIdentity: false
    }
  ];
}

function getCachedTile(cacheKey, now = Date.now()) {
  const cached = tileMemoryCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    tileMemoryCache.delete(cacheKey);
    return null;
  }
  // Renovar posición LRU
  tileMemoryCache.delete(cacheKey);
  tileMemoryCache.set(cacheKey, cached);
  return cached;
}

function setCachedTile(cacheKey, entry) {
  if (tileMemoryCache.has(cacheKey)) {
    tileMemoryCache.delete(cacheKey);
  }
  while (tileMemoryCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = tileMemoryCache.keys().next().value;
    if (oldestKey === undefined) break;
    tileMemoryCache.delete(oldestKey);
  }
  tileMemoryCache.set(cacheKey, entry);
}

function clearTileCache() {
  tileMemoryCache.clear();
}

function getHeaderCaseInsensitive(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') {
    return headers.get(name);
  }
  const lower = name.toLowerCase();
  const matchedKey = Object.keys(headers).find((k) => k.toLowerCase() === lower);
  return matchedKey ? headers[matchedKey] : null;
}

function isBlockedOrInvalidTileResponse(response, contentType, byteLength) {
  if (!response || !response.ok) return true;
  if (getHeaderCaseInsensitive(response.headers, 'x-blocked')) return true;
  if (!contentType || !String(contentType).toLowerCase().startsWith('image/')) return true;
  if (!byteLength || byteLength < 32) return true;
  return false;
}

/**
 * Obtiene un mosaico cartográfico (desde caché o proveedores en cascada),
 * descartando cualquier imagen de bloqueo enviada con HTTP 200 por OSM (`x-blocked`).
 */
async function fetchMapTile(z, x, y, options = {}) {
  const fetchFn = options.fetchImpl || globalThis.fetch;
  const refererHeader = options.referer || 'https://expressmart.mx/';
  const cacheKey = `${z}/${x}/${y}`;

  if (!options.bypassCache) {
    const cached = getCachedTile(cacheKey);
    if (cached) {
      return { ...cached, cacheStatus: 'HIT' };
    }
  }

  const providers = buildUpstreamProviders(z, x, y);
  let lastReason = 'Ningún proveedor cartográfico respondió.';

  for (const provider of providers) {
    try {
      const headers = {
        'User-Agent': EXPRESSMART_TILE_UA,
        Accept: 'image/png,image/jpeg,image/*;q=0.8'
      };
      if (provider.requiresOsmIdentity && refererHeader) {
        headers.Referer = refererHeader;
      }

      const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(5000)
        : undefined;

      const resp = await fetchFn(provider.url, { headers, signal });
      const contentType = getHeaderCaseInsensitive(resp?.headers, 'content-type') || 'image/png';
      const arrayBuf = resp && typeof resp.arrayBuffer === 'function' ? await resp.arrayBuffer() : null;
      const buffer = arrayBuf ? Buffer.from(arrayBuf) : Buffer.alloc(0);

      if (isBlockedOrInvalidTileResponse(resp, contentType, buffer.length)) {
        const blockedHeader = getHeaderCaseInsensitive(resp?.headers, 'x-blocked');
        lastReason = blockedHeader
          ? `${provider.name} bloqueado (${blockedHeader})`
          : `${provider.name} HTTP ${resp?.status || 'sin respuesta'}`;
        continue;
      }

      const entry = {
        buffer,
        contentType: String(contentType).split(';')[0].trim(),
        provider: provider.name,
        expiresAt: Date.now() + SEVEN_DAYS_MS
      };
      setCachedTile(cacheKey, entry);
      return { ...entry, cacheStatus: 'MISS' };
    } catch (err) {
      lastReason = `${provider.name}: ${err.message}`;
    }
  }

  return { error: lastReason };
}

module.exports = {
  validateTileCoords,
  fetchMapTile,
  clearTileCache,
  EXPRESSMART_TILE_UA
};
