// Geographic coordinates mapping for GlobalPath Ethical AI Infrastructure
// Used for Safety Map heat visualization

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationData {
  coordinates: Coordinates;
  region: string;
  country: string;
}

// Static mapping of common locations to coordinates
export const locationCoordinates: Record<string, LocationData> = {
  // GCC Corridor
  'dubai': {
    coordinates: { lat: 25.2048, lng: 55.2708 },
    region: 'GCC',
    country: 'UAE'
  },
  'abu dhabi': {
    coordinates: { lat: 24.4539, lng: 54.3773 },
    region: 'GCC',
    country: 'UAE'
  },
  'uae': {
    coordinates: { lat: 23.4241, lng: 53.8478 },
    region: 'GCC',
    country: 'UAE'
  },
  'qatar': {
    coordinates: { lat: 25.3548, lng: 51.1839 },
    region: 'GCC',
    country: 'Qatar'
  },
  'doha': {
    coordinates: { lat: 25.2854, lng: 51.5310 },
    region: 'GCC',
    country: 'Qatar'
  },
  'kuwait': {
    coordinates: { lat: 29.3117, lng: 47.4818 },
    region: 'GCC',
    country: 'Kuwait'
  },
  'kuwait city': {
    coordinates: { lat: 29.3759, lng: 47.9774 },
    region: 'GCC',
    country: 'Kuwait'
  },
  'bahrain': {
    coordinates: { lat: 26.0667, lng: 50.5577 },
    region: 'GCC',
    country: 'Bahrain'
  },
  'manama': {
    coordinates: { lat: 26.2285, lng: 50.5861 },
    region: 'GCC',
    country: 'Bahrain'
  },
  
  // EU Corridor
  'luxembourg': {
    coordinates: { lat: 49.6116, lng: 6.1319 },
    region: 'EU',
    country: 'Luxembourg'
  },
  'germany': {
    coordinates: { lat: 51.1657, lng: 10.4515 },
    region: 'EU',
    country: 'Germany'
  },
  'berlin': {
    coordinates: { lat: 52.5200, lng: 13.4050 },
    region: 'EU',
    country: 'Germany'
  },
  'munich': {
    coordinates: { lat: 48.1351, lng: 11.5820 },
    region: 'EU',
    country: 'Germany'
  },
  'poland': {
    coordinates: { lat: 51.9194, lng: 19.1451 },
    region: 'EU',
    country: 'Poland'
  },
  'warsaw': {
    coordinates: { lat: 52.2297, lng: 21.0122 },
    region: 'EU',
    country: 'Poland'
  },
  
  // Western Corridor
  'canada': {
    coordinates: { lat: 56.1304, lng: -106.3468 },
    region: 'Western',
    country: 'Canada'
  },
  'toronto': {
    coordinates: { lat: 43.6532, lng: -79.3832 },
    region: 'Western',
    country: 'Canada'
  },
  'vancouver': {
    coordinates: { lat: 49.2827, lng: -123.1207 },
    region: 'Western',
    country: 'Canada'
  },
  
  // UK Corridor
  'uk': {
    coordinates: { lat: 55.3781, lng: -3.4360 },
    region: 'UK',
    country: 'United Kingdom'
  },
  'london': {
    coordinates: { lat: 51.5074, lng: -0.1278 },
    region: 'UK',
    country: 'United Kingdom'
  },
  'manchester': {
    coordinates: { lat: 53.4808, lng: -2.2426 },
    region: 'UK',
    country: 'United Kingdom'
  },
  
  // Uganda (Source)
  'uganda': {
    coordinates: { lat: 1.3733, lng: 32.2903 },
    region: 'Source',
    country: 'Uganda'
  },
  'kampala': {
    coordinates: { lat: 0.3476, lng: 32.5825 },
    region: 'Source',
    country: 'Uganda'
  }
};

// Helper function to extract coordinates from location string
export const getCoordinates = (location: string): LocationData | null => {
  if (!location) return null;
  
  const normalizedLocation = location.toLowerCase().trim();
  
  // Direct match
  if (locationCoordinates[normalizedLocation]) {
    return locationCoordinates[normalizedLocation];
  }
  
  // Partial match for location strings
  for (const [key, data] of Object.entries(locationCoordinates)) {
    if (normalizedLocation.includes(key) || key.includes(normalizedLocation)) {
      return data;
    }
  }
  
  // Default to Uganda if no match found
  return locationCoordinates['uganda'];
};

// Helper function to get all coordinates for heat map
export const getAllCoordinates = (locations: string[]): LocationData[] => {
  return locations
    .map(loc => getCoordinates(loc))
    .filter((coord): coord is LocationData => coord !== null);
};

// Helper function to get region-specific coordinates
export const getRegionCoordinates = (region: string): LocationData[] => {
  return Object.values(locationCoordinates).filter(loc => 
    loc.region.toLowerCase() === region.toLowerCase()
  );
};
