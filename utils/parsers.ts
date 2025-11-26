import { CyclingDataPoint } from '../types';

// Haversine formula to calculate distance between two lat/lon points
const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

const deg2rad = (deg: number) => {
  return deg * (Math.PI / 180);
}

export const parseTrainingFile = async (file: File): Promise<CyclingDataPoint[]> => {
  const text = await file.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, "text/xml");

  if (file.name.endsWith('.gpx')) {
    return parseGPX(xmlDoc);
  } else if (file.name.endsWith('.tcx')) {
    return parseTCX(xmlDoc);
  }
  throw new Error("Unsupported file format");
};

const parseGPX = (xmlDoc: Document): CyclingDataPoint[] => {
  const trkpts = xmlDoc.getElementsByTagName('trkpt');
  const data: CyclingDataPoint[] = [];
  let startTime = 0;
  let totalDist = 0;

  for (let i = 0; i < trkpts.length; i++) {
    const pt = trkpts[i];
    const lat = parseFloat(pt.getAttribute('lat') || '0');
    const lon = parseFloat(pt.getAttribute('lon') || '0');
    const ele = parseFloat(pt.getElementsByTagName('ele')[0]?.textContent || '0');
    const timeStr = pt.getElementsByTagName('time')[0]?.textContent;
    const time = timeStr ? new Date(timeStr).getTime() / 1000 : 0;

    // Extensions for HR/Power/Cadence (often in ns3:TrackPointExtension)
    // Note: Parsing extensions in GPX is tricky due to varying namespaces.
    // We try a generic approach looking for tag names.
    const hr = parseFloat(pt.getElementsByTagName('gpxtpx:hr')[0]?.textContent || pt.getElementsByTagName('ns3:hr')[0]?.textContent || '0');
    const power = parseFloat(pt.getElementsByTagName('power')[0]?.textContent || '0');

    if (i === 0) {
      startTime = time;
    } else {
      const prev = data[i - 1];
      const dist = getDistanceFromLatLonInKm(prev.lat!, prev.lon!, lat, lon);
      totalDist += dist;
    }

    // Calculate Lat/Lon based speed if not present, but for now we rely on post-calculation
    const duration = time - startTime;

    data.push({
      time: duration,
      elevation: ele,
      speed: 0, // Calculated later for smoothness
      power: power || 0,
      heartRate: hr || 0,
      distance: totalDist,
      lat,
      lon
    });
  }
  
  // Post-process for speed (km/h)
  for(let i = 1; i < data.length; i++) {
     const distDiff = data[i].distance - data[i-1].distance; // km
     const timeDiff = (data[i].time - data[i-1].time) / 3600; // hours
     if(timeDiff > 0) {
         data[i].speed = distDiff / timeDiff;
     }
  }

  return data;
};

const parseTCX = (xmlDoc: Document): CyclingDataPoint[] => {
  const trackpoints = xmlDoc.getElementsByTagName('Trackpoint');
  const data: CyclingDataPoint[] = [];
  let startTime = 0;

  for (let i = 0; i < trackpoints.length; i++) {
    const pt = trackpoints[i];
    const timeStr = pt.getElementsByTagName('Time')[0]?.textContent;
    const time = timeStr ? new Date(timeStr).getTime() / 1000 : 0;
    
    const alt = parseFloat(pt.getElementsByTagName('AltitudeMeters')[0]?.textContent || '0');
    const dist = parseFloat(pt.getElementsByTagName('DistanceMeters')[0]?.textContent || '0') / 1000; // to km
    const hr = parseFloat(pt.getElementsByTagName('HeartRateBpm')[0]?.getElementsByTagName('Value')[0]?.textContent || '0');
    const power = parseFloat(pt.getElementsByTagName('Watts')[0]?.textContent || '0');
    // Speed usually in m/s in TCX extensions
    const speedMs = parseFloat(pt.getElementsByTagName('Speed')[0]?.textContent || pt.getElementsByTagName('ns3:Speed')[0]?.textContent || '0');

    if (i === 0) startTime = time;

    data.push({
      time: time - startTime,
      elevation: alt,
      distance: dist,
      speed: speedMs * 3.6, // convert m/s to km/h
      power: power,
      heartRate: hr
    });
  }
  return data;
};