// All geographic data for the trip, in one place.
//  - MAP_LOCATIONS / DAILY_ROUTES / FULL_ROUTE / MAP_CENTER drive the Map tab.
//  - DAY_LOCATIONS gives the photo-identification API per-day location context.
// Shared by src/components/MapTab.jsx and api/identify.js.
// Coordinates are approximate (good enough to frame the map); verify if needed.

// Stops & coordinates for the map
export const MAP_LOCATIONS = {
  bastia:     { lat: 42.7028, lng: 9.4503, name: 'Bastia', type: 'port' },
  macinaggio: { lat: 42.9620, lng: 9.4530, name: 'Macinaggio', type: 'port' },
  tomino:     { lat: 42.9540, lng: 9.4430, name: 'Tomino', type: 'village' },
  rogliano:   { lat: 42.9510, lng: 9.4180, name: 'Rogliano', type: 'village' },
  centuri:    { lat: 42.9690, lng: 9.3530, name: 'Centuri', type: 'village' },
  nonza:      { lat: 42.7790, lng: 9.3380, name: 'Nonza', type: 'village' },
  patrimonio: { lat: 42.7010, lng: 9.3500, name: 'Patrimonio', type: 'village' },
  bonifacio:  { lat: 41.3874, lng: 9.1593, name: 'Bonifacio', type: 'port' },
  lavezzi:    { lat: 41.3328, lng: 9.2543, name: 'Îles Lavezzi', type: 'island' },
  figari:     { lat: 41.5006, lng: 9.0978, name: 'Figari', type: 'airport' },
  nice:       { lat: 43.6950, lng: 7.2720, name: 'Nice', type: 'port' },
};

// Route stops for each day (keys into MAP_LOCATIONS)
export const DAILY_ROUTES = {
  1: ['bastia', 'macinaggio', 'tomino'],
  2: ['macinaggio', 'rogliano', 'centuri', 'nonza', 'patrimonio'],
  3: ['macinaggio', 'bonifacio'],
  4: ['bonifacio', 'lavezzi'],
  5: ['bonifacio', 'figari', 'nice'],
};

// Full ordered route for the overview polyline (major movements)
export const FULL_ROUTE = [
  MAP_LOCATIONS.bastia,
  MAP_LOCATIONS.macinaggio,
  MAP_LOCATIONS.bonifacio,
  MAP_LOCATIONS.lavezzi,
  MAP_LOCATIONS.nice,
];

// Default map center [lat, lng] — frames Corsica + the Côte d'Azur
export const MAP_CENTER = [42.5, 8.4];

// Per-day location knowledge to prime AI photo identification
export const DAY_LOCATIONS = {
  1: {
    islands: ['Cap Corse', 'Macinaggio', 'Tomino', 'Rogliano'],
    landmarks: ['Hôtel Le Tomino', 'Macinaggio marina', 'Genoese watchtowers', 'Rogliano castle ruins', "Sant'Agnellu church"],
    activities: ['arrival', 'driving the cape', 'terrace dinner'],
  },
  2: {
    islands: ['Cap Corse', 'Macinaggio', 'Centuri', 'Nonza', 'Patrimonio'],
    landmarks: ['Sentier des Douaniers', 'Tamarone beach', 'Santa Maria tower', 'Finocchiarola islets', 'Nonza black-pebble beach', 'Patrimonio vineyards'],
    activities: ['coastal hiking', 'beach', 'wine tasting', 'e-biking'],
  },
  3: {
    islands: ['Bonifacio'],
    landmarks: ['Haute Ville citadel', 'Bonifacio limestone cliffs', 'marine cemetery', 'Hotel Cala di Greco', 'the marina'],
    activities: ['driving south', 'citadel walk', 'sunset on the ramparts'],
  },
  4: {
    islands: ['Bonifacio', 'Îles Lavezzi'],
    landmarks: ["King of Aragon's Staircase", "Bastion de l'Étendard", 'Grain de Sable', 'Sdragonato sea cave', 'Lavezzi granite coves', 'Pertusato lighthouse'],
    activities: ['cliffs-and-caves boat tour', 'snorkeling', 'swimming'],
  },
  5: {
    islands: ['Nice', "Côte d'Azur"],
    landmarks: ['Promenade des Anglais', 'Vieux Nice', 'Place Rossetti', 'Cours Saleya', 'Castle Hill', 'Hotel Negresco'],
    activities: ['old town walk', 'socca', 'flower market'],
  },
};
