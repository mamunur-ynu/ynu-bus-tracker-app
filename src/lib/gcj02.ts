// Converting between WGS-84 and GCJ-02.
//
// This is the least obvious and most important piece of the Amap work, so it
// is worth stating plainly what the problem is.
//
// The browser's Geolocation API returns WGS-84 - the coordinate system GPS
// satellites actually use, and the same one Leaflet and OpenStreetMap expect.
// Chinese law requires public maps to be published in an offset system called
// GCJ-02, and Amap (like Baidu and Tencent) renders in it. The offset is not a
// constant: it is a deterministic function of position, and inside China it
// moves a point by roughly 100 to 700 metres.
//
// So if a raw GPS reading is handed straight to Amap, the bus is drawn a
// couple of streets away from where it is. Nothing errors, nothing warns - the
// map just quietly lies, which is the worst kind of bug for a tracking app.
// Every coordinate crossing into Amap goes through wgs84ToGcj02 first, and
// every coordinate coming back out of Amap goes through gcj02ToWgs84.
//
// The transform below is the standard published algorithm. It is an
// approximation of an undisclosed official one and lands within a few metres,
// which is well inside GPS's own error for this purpose. Amap also exposes
// AMap.convertFrom() as an authoritative network call; it is not used here
// because a bus position arrives every few seconds and a network round trip
// per point would be both slow and pointless at this accuracy.

export interface LatLng {
  latitude: number;
  longitude: number;
}

const A = 6378245.0; // Krasovsky 1940 semi-major axis, used by the algorithm
const EE = 0.00669342162296594323; // and its eccentricity squared

function transformLat(x: number, y: number): number {
  let ret =
    -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLon(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
  return ret;
}

/**
 * Is this point outside mainland China?
 *
 * The offset is only applied inside China. A rough bounding box is what the
 * standard algorithm uses, and it is the right call here: getting the boundary
 * slightly wrong for a point in the sea near Hong Kong matters far less than
 * silently shifting a campus in Kunming, which sits well inside the box.
 */
export function outsideChina({ latitude, longitude }: LatLng): boolean {
  if (longitude < 72.004 || longitude > 137.8347) return true;
  if (latitude < 0.8293 || latitude > 55.8271) return true;
  return false;
}

/** The offset to add to a WGS-84 point to get GCJ-02, in degrees. */
function offset({ latitude, longitude }: LatLng): LatLng {
  const dLat0 = transformLat(longitude - 105.0, latitude - 35.0);
  const dLon0 = transformLon(longitude - 105.0, latitude - 35.0);
  const radLat = (latitude / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  return {
    latitude: (dLat0 * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * Math.PI),
    longitude: (dLon0 * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * Math.PI),
  };
}

/** GPS reading -> the coordinate Amap expects. */
export function wgs84ToGcj02(point: LatLng): LatLng {
  if (outsideChina(point)) return { ...point };
  const d = offset(point);
  return {
    latitude: point.latitude + d.latitude,
    longitude: point.longitude + d.longitude,
  };
}

/**
 * A coordinate Amap gave us -> a real GPS coordinate.
 *
 * The forward transform cannot be inverted in closed form, so this subtracts
 * the offset computed at the shifted point. That is slightly wrong, because
 * the offset should be evaluated at the true point - hence the refinement
 * pass, which converges to well under a metre. It matters because a POI the
 * student picks on the map has to be stored as WGS-84 alongside the GPS
 * readings, or the two systems drift apart in the database.
 */
export function gcj02ToWgs84(point: LatLng): LatLng {
  if (outsideChina(point)) return { ...point };
  let guess = {
    latitude: point.latitude - offset(point).latitude,
    longitude: point.longitude - offset(point).longitude,
  };
  // Two refinements are plenty; each cuts the error by roughly a thousandfold.
  for (let i = 0; i < 2; i++) {
    const shifted = wgs84ToGcj02(guess);
    guess = {
      latitude: guess.latitude + (point.latitude - shifted.latitude),
      longitude: guess.longitude + (point.longitude - shifted.longitude),
    };
  }
  return guess;
}

/** Amap wants [longitude, latitude]; almost everything else wants the reverse. */
export function toAmapLngLat(point: LatLng): [number, number] {
  const g = wgs84ToGcj02(point);
  return [g.longitude, g.latitude];
}
