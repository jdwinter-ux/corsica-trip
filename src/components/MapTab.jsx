import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MAP_LOCATIONS as LOCATIONS,
  DAILY_ROUTES,
  FULL_ROUTE,
  MAP_CENTER,
} from '../data/locations';
import { THEME } from '../config/theme';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons
function createIcon(color, isActive) {
  const size = isActive ? 14 : 10;
  const border = isActive ? 3 : 2;
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border: ${border}px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px ${THEME.rgba(THEME.base.black, 0.4)};
    "></div>`,
    iconSize: [size + border * 2, size + border * 2],
    iconAnchor: [(size + border * 2) / 2, (size + border * 2) / 2],
  });
}

// Component to fit bounds when day changes
function FitBounds({ locations }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length > 0) {
      const bounds = L.latLngBounds(locations.map(loc => [loc.lat, loc.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 11 });
    }
  }, [locations, map]);

  return null;
}

export default function MapTab({ day }) {
  // Handle case where day is undefined
  if (!day || !day.n) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: THEME.blueMuted }}>
        No day selected.
      </div>
    );
  }

  const dayNumber = day.n;
  const todayStops = DAILY_ROUTES[dayNumber] || [];
  const todayLocations = todayStops.map(key => LOCATIONS[key]);

  // Center on the trip's island group
  const center = MAP_CENTER;

  // Get route up to current day
  const routeUpToToday = [];
  for (let d = 1; d <= dayNumber; d++) {
    const dayRoute = DAILY_ROUTES[d] || [];
    dayRoute.forEach(key => {
      const loc = LOCATIONS[key];
      // Avoid duplicate consecutive points
      if (routeUpToToday.length === 0 ||
          routeUpToToday[routeUpToToday.length - 1].name !== loc.name) {
        routeUpToToday.push(loc);
      }
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Map container */}
      <div style={{
        height: '400px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: `1px solid ${THEME.rgba(THEME.base.gold, 0.2)}`,
      }}>
        <MapContainer
          center={center}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* Fit to today's locations */}
          <FitBounds locations={todayLocations.length > 1 ? todayLocations : Object.values(LOCATIONS)} />

          {/* Full route - faded */}
          <Polyline
            positions={FULL_ROUTE.map(loc => [loc.lat, loc.lng])}
            color={THEME.rgba(THEME.base.goldDeep, 0.2)}
            weight={2}
            dashArray="5,10"
          />

          {/* Route completed so far */}
          <Polyline
            positions={routeUpToToday.map(loc => [loc.lat, loc.lng])}
            color={THEME.gold}
            weight={3}
          />

          {/* Today's route - highlighted */}
          {todayLocations.length > 1 && (
            <Polyline
              positions={todayLocations.map(loc => [loc.lat, loc.lng])}
              color={THEME.goldLight}
              weight={4}
            />
          )}

          {/* All location markers */}
          {Object.entries(LOCATIONS).map(([key, loc]) => {
            const isToday = todayStops.includes(key);
            const isPast = routeUpToToday.some(r => r.name === loc.name);

            let color = THEME.rgba(THEME.base.blueGray, 0.6); // Future - gray
            if (isToday) color = THEME.goldLight; // Today - gold
            else if (isPast) color = THEME.gold; // Past - darker gold

            return (
              <Marker
                key={key}
                position={[loc.lat, loc.lng]}
                icon={createIcon(color, isToday)}
              >
                <Popup>
                  <div style={{ fontFamily: 'Georgia, serif', textAlign: 'center' }}>
                    <strong>{loc.name}</strong>
                    {isToday && <div style={{ fontSize: '0.8em', color: THEME.gray }}>Today</div>}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '0.8rem 1rem',
        background: THEME.rgba(THEME.base.white, 0.03),
        borderRadius: '10px',
        fontSize: '0.75rem',
        color: THEME.blue,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: 12, height: 12, background: THEME.goldLight, borderRadius: '50%', border: '2px solid white' }} />
          <span>Today</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: 10, height: 10, background: THEME.gold, borderRadius: '50%', border: '2px solid white' }} />
          <span>Visited</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: 10, height: 10, background: THEME.rgba(THEME.base.blueGray, 0.6), borderRadius: '50%', border: '2px solid white' }} />
          <span>Upcoming</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: 20, height: 3, background: THEME.gold }} />
          <span>Route taken</span>
        </div>
      </div>

      {/* Today's stops */}
      <div style={{
        padding: '1rem',
        background: THEME.rgba(THEME.base.goldDeep, 0.08),
        borderRadius: '10px',
        borderLeft: `3px solid ${THEME.gold}`,
      }}>
        <div style={{ fontSize: '0.7rem', color: THEME.gold, letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
          DAY {dayNumber} ROUTE
        </div>
        <div style={{ fontSize: '0.95rem', color: THEME.cream }}>
          {todayLocations.map((loc, i) => (
            <span key={loc.name}>
              {i > 0 && <span style={{ color: THEME.blueMuted }}> → </span>}
              {loc.name}
            </span>
          ))}
        </div>
      </div>

      {/* Island list */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '0.6rem',
      }}>
        {Object.entries(LOCATIONS)
          .filter(([_, loc]) => loc.type === 'island')
          .map(([key, loc]) => {
            const isToday = todayStops.includes(key);
            const isPast = routeUpToToday.some(r => r.name === loc.name);

            return (
              <div
                key={key}
                style={{
                  padding: '0.6rem 0.8rem',
                  background: isToday ? THEME.rgba(THEME.base.goldDeep, 0.15) : THEME.rgba(THEME.base.white, 0.03),
                  border: `1px solid ${isToday ? THEME.rgba(THEME.base.goldDeep, 0.3) : THEME.rgba(THEME.base.gold, 0.1)}`,
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  color: isToday ? THEME.goldLight : isPast ? THEME.gold : THEME.blueMuted,
                }}
              >
                {isToday && '📍 '}{loc.name}
              </div>
            );
          })}
      </div>
    </div>
  );
}
