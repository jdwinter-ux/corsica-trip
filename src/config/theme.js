// Single source of truth for the app's visual identity.
// To re-skin for a different trip, change the values here — components reference
// these tokens instead of inline color literals.
//
// NOTE: static files can't import this module. When forking, also update the
// matching values in index.html (theme-color) and public/manifest.json.

// Base RGB tuples for colors used at varying opacity (see `rgba` helper below).
const BASE = {
  gold: '255, 200, 80',     // bright gold — borders, glows, highlights
  goldDeep: '200, 168, 75', // the solid gold accent (#c8a84b) at opacity
  white: '255, 255, 255',   // light surface overlays
  blueGray: '139, 172, 200',// muted blue (tips, info panels)
  red: '220, 80, 60',       // errors / warnings
  blueDeep: '0, 80, 160',   // deep sea glow (decorative)
  green: '80, 160, 100',    // hiker / nature accent
  blueMarker: '80, 140, 200',// map markers / biker accent
  amber: '255, 180, 50',    // warm radial glow (decorative)
  black: '0, 0, 0',         // shadows
};

export const THEME = {
  // === Solid colors ===
  bgDeep: '#0a1628',     // deepest navy (page base, on-gold text)
  bgMid: '#0d2444',      // mid navy (gradient stop)
  gold: '#c8a84b',       // primary gold accent
  goldLight: '#e8c87a',  // gradient light gold
  goldMuted: '#a89860',  // muted gold (tag text)
  goldDark: '#8a7848',   // dark gold
  cream: '#f5e6c8',      // headings
  parchment: '#e8dcc8',  // primary body text on dark
  sand: '#d8c8a8',       // note / quote text
  blue: '#8bacc8',       // secondary text
  blueMuted: '#6a8898',  // muted labels / metadata
  blueDim: '#4a6888',    // dim / empty-state text
  blueLight: '#a8c0d8',  // light blue text
  blueSky: '#b8c8d8',    // section body text
  blueSoft: '#9ab8c8',   // tips text
  bluePale: '#c8d8e8',   // pale blue
  blueAccent: '#7fa3d8', // blue accent (markers/legend)
  green: '#7fb38a',      // green accent (markers/legend)
  error: '#f0a090',      // error text
  errorStrong: '#e88070',// stronger error text
  gray: '#666',          // neutral gray

  // Raw base tuples (rarely needed directly)
  base: BASE,

  // Build an rgba() string from a base tuple: THEME.rgba(THEME.base.gold, 0.2)
  rgba: (base, alpha) => `rgba(${base}, ${alpha})`,
};

// App-shell identity. Trip-facing title/subtitle live in src/data/trip.js (TRIP);
// these are the PWA / document-level names that also appear in the static files.
export const BRAND = {
  appName: 'Corsica & Nice Voyage Journal',
  shortName: 'Corsica Trip',
  description: "Shared travel journal for the Corsica & Côte d'Azur charter",
  themeColor: '#0a1628',
};
