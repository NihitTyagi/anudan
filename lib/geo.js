export const DEFAULT_REGION = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export const NEARBY_RADIUS_M = 2000;

export function isValidCoordinate(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const a = Number(lat);
  const b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180;
}

export function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function haversineMeters(aLat, aLng, bLat, bLng) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const sa = Math.sin(dLat / 2) ** 2;
  const sb = Math.sin(dLng / 2) ** 2;
  const c =
    2 *
    Math.atan2(
      Math.sqrt(sa + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sb),
      Math.sqrt(1 - (sa + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sb))
    );
  return R * c;
}

export function isWithinRadiusMeters(origin, lat, lng, radiusM = NEARBY_RADIUS_M) {
  if (!origin || !isValidCoordinate(origin.latitude, origin.longitude) || !isValidCoordinate(lat, lng)) {
    return false;
  }
  return haversineMeters(origin.latitude, origin.longitude, Number(lat), Number(lng)) <= radiusM;
}

export function normalizeSearch(text) {
  return String(text || '').trim().toLowerCase();
}

export function formatDistance(meters) {
  if (meters === null || meters === undefined) return '';
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)}km`;
}

/**
 * Decodes Google's Encoded Polyline Algorithm Format
 * @param {string} encoded 
 * @returns {Array<{latitude: number, longitude: number}>}
 */
export function decodePolyline(encoded) {
  if (!encoded) return [];
  let poly = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return poly;
}
