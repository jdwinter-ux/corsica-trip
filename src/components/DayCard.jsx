import { THEME } from '../config/theme';

export default function DayCard({ day }) {
  if (!day) {
    return null;
  }

  return (
    <div style={{
      background: THEME.rgba(THEME.base.white, 0.03),
      border: `1px solid ${THEME.rgba(THEME.base.gold, 0.15)}`,
      borderRadius: '12px',
      padding: '1.2rem 1.4rem',
      marginBottom: '1.2rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <div>
          <div style={{ color: THEME.gold, fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Day {day.n} · {day.weekday}, {day.date}
          </div>
          <div style={{ fontSize: '1.4rem', color: THEME.cream, marginTop: '0.2rem' }}>{day.title}</div>
          <div style={{ fontSize: '0.8rem', color: THEME.blue, marginTop: '0.1rem' }}>📍 {day.route}</div>
        </div>
        {day.featured && (
          <div style={{
            fontSize: '0.6rem', color: THEME.gold, letterSpacing: '0.15em',
            background: THEME.rgba(THEME.base.goldDeep, 0.1), border: `1px solid ${THEME.rgba(THEME.base.goldDeep, 0.3)}`,
            padding: '0.3rem 0.6rem', borderRadius: '20px', fontWeight: 700,
            whiteSpace: 'nowrap',
          }}>
            {day.featured}
          </div>
        )}
      </div>
      <div style={{ fontSize: '0.85rem', color: THEME.blueLight, fontStyle: 'italic', lineHeight: 1.5, marginTop: '0.6rem', borderTop: `1px solid ${THEME.rgba(THEME.base.goldDeep, 0.1)}`, paddingTop: '0.6rem' }}>
        {day.hero}
      </div>
    </div>
  );
}
