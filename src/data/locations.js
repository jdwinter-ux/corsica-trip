// All geographic data for the trip, in one place.
//  - MAP_LOCATIONS / DAILY_ROUTES / FULL_ROUTE / MAP_CENTER drive the Map tab.
//  - DAY_LOCATIONS gives the photo-identification API per-day location context.
// Shared by src/components/MapTab.jsx and api/identify.js.
// Coordinates are approximate (good enough to frame the map); verify if needed.

// Stops & coordinates for the map
export const MAP_LOCATIONS = {
  nice:         { lat: 43.6950, lng: 7.2720, name: 'Nice', type: 'port' },
  calvi:        { lat: 42.5667, lng: 8.7575, name: 'Calvi', type: 'port' },
  scandola:     { lat: 42.3597, lng: 8.5547, name: 'Scandola Reserve', type: 'reserve' },
  girolata:     { lat: 42.3539, lng: 8.6186, name: 'Girolata', type: 'anchorage' },
  piana:        { lat: 42.2456, lng: 8.6294, name: 'Calanques de Piana', type: 'landmark' },
  cargese:      { lat: 42.1378, lng: 8.5961, name: 'Cargèse', type: 'port' },
  ajaccio:      { lat: 41.9192, lng: 8.7386, name: 'Ajaccio', type: 'port' },
  sanguinaires: { lat: 41.8800, lng: 8.5870, name: 'Îles Sanguinaires', type: 'island' },
  bonifacio:    { lat: 41.3874, lng: 9.1593, name: 'Bonifacio', type: 'port' },
  lavezzi:      { lat: 41.3328, lng: 9.2543, name: 'Îles Lavezzi', type: 'island' },
  portovecchio: { lat: 41.5912, lng: 9.2795, name: 'Porto-Vecchio', type: 'port' },
  lerins:       { lat: 43.5145, lng: 7.0480, name: 'Îles de Lérins', type: 'island' },
};

// Route stops for each day (keys into MAP_LOCATIONS)
export const DAILY_ROUTES = {
  1: ['nice'],
  2: ['calvi'],
  3: ['calvi', 'scandola', 'girolata', 'piana'],
  4: ['girolata', 'cargese', 'ajaccio', 'sanguinaires'],
  5: ['ajaccio', 'bonifacio'],
  6: ['bonifacio', 'lavezzi', 'portovecchio'],
  7: ['portovecchio', 'lerins'],
  8: ['lerins', 'nice'],
};

// Full ordered route for the overview polyline
export const FULL_ROUTE = [
  MAP_LOCATIONS.nice,
  MAP_LOCATIONS.calvi,
  MAP_LOCATIONS.scandola,
  MAP_LOCATIONS.girolata,
  MAP_LOCATIONS.piana,
  MAP_LOCATIONS.cargese,
  MAP_LOCATIONS.ajaccio,
  MAP_LOCATIONS.sanguinaires,
  MAP_LOCATIONS.bonifacio,
  MAP_LOCATIONS.lavezzi,
  MAP_LOCATIONS.portovecchio,
  MAP_LOCATIONS.lerins,
  MAP_LOCATIONS.nice,
];

// Default map center [lat, lng] — between the Riviera and Corsica
export const MAP_CENTER = [42.6, 8.3];

// Per-day location knowledge to prime AI photo identification
export const DAY_LOCATIONS = {
  1: {
    islands: ['Nice', "Côte d'Azur"],
    landmarks: ['Baie des Anges', 'Promenade des Anglais', 'Port of Nice'],
    activities: ['boarding the yacht', 'welcome dinner', 'socca and rosé'],
  },
  2: {
    islands: ['Calvi', 'Corsica'],
    landmarks: ['Calvi citadel', 'Genoese ramparts', 'Notre-Dame de la Serra', 'Calvi beach', 'La Signoria'],
    activities: ['citadel walk', 'swimming', 'charcuterie tasting'],
  },
  3: {
    islands: ['Scandola Reserve', 'Girolata', 'Calanques de Piana'],
    landmarks: ['red porphyry cliffs', 'sea caves', 'Girolata fort', 'ochre rock spires'],
    activities: ['tender tour', 'snorkeling', 'hiking the Sentier du facteur'],
  },
  4: {
    islands: ['Ajaccio', 'Cargèse'],
    landmarks: ['Maison Bonaparte', 'Ajaccio old town', 'Îles Sanguinaires', 'Pointe de la Parata'],
    activities: ['old town walk', 'market', 'sunset at the Sanguinaires'],
  },
  5: {
    islands: ['Bonifacio'],
    landmarks: ['chalk cliffs', 'Haute Ville citadel', "Escalier du Roi d'Aragon", 'Pertusato lighthouse', 'Bouches de Bonifacio'],
    activities: ['citadel walk', 'swimming', 'Michelin dinner'],
  },
  6: {
    islands: ['Îles Lavezzi', 'Porto-Vecchio'],
    landmarks: ['Lavezzi granite coves', 'Palombaggia beach', 'Santa Giulia', 'Casadelmar'],
    activities: ['snorkeling', 'beach', 'paddleboarding'],
  },
  7: {
    islands: ['Îles de Lérins', 'Sainte-Marguerite', 'Saint-Honorat'],
    landmarks: ['Lérins monastery', 'Fort Royal', 'monastery vineyard'],
    activities: ['island walk', 'passage day', 'farewell dinner'],
  },
  8: {
    islands: ['Nice'],
    landmarks: ['Port of Nice', 'Promenade des Anglais'],
    activities: ['disembarkation', 'departure'],
  },
};
