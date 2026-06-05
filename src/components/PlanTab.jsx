import { THEME } from '../config/theme';

export default function PlanTab({ day }) {
  if (!day || !day.timeline) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: THEME.blueMuted }}>
        No plan available for this day.
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: THEME.blue, marginBottom: '0.8rem', letterSpacing: '0.08em' }}>
        ⏱ THE DAY AT A GLANCE
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.5rem' }}>
        {day.timeline.map(([time, what], i) => (
          <div key={i} style={{
            display: 'flex', gap: '0.8rem',
            background: THEME.rgba(THEME.base.white, 0.04),
            border: `1px solid ${THEME.rgba(THEME.base.gold, 0.1)}`,
            borderRadius: '8px',
            padding: '0.6rem 0.9rem',
          }}>
            <div style={{
              color: THEME.gold, fontSize: '0.7rem', fontWeight: 700,
              letterSpacing: '0.08em', minWidth: '90px', flexShrink: 0,
              paddingTop: '0.1rem',
            }}>
              {time.toUpperCase()}
            </div>
            <div style={{ color: THEME.sand, fontSize: '0.85rem', lineHeight: 1.5 }}>{what}</div>
          </div>
        ))}
      </div>

      {(day.activities.hiker || day.activities.biker) && (
        <>
          <div style={{ fontSize: '0.75rem', color: THEME.blue, marginBottom: '0.8rem', letterSpacing: '0.08em' }}>
            🥾 MORNING SPLIT
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
            {day.activities.hiker && (
              <div style={{
                background: THEME.rgba(THEME.base.green, 0.08),
                border: `1px solid ${THEME.rgba(THEME.base.green, 0.2)}`,
                borderRadius: '10px', padding: '0.8rem 1rem',
              }}>
                <div style={{ fontSize: '0.7rem', color: THEME.green, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.3rem' }}>
                  🥾 HIKERS
                </div>
                <div style={{ color: THEME.sand, fontSize: '0.85rem', lineHeight: 1.5 }}>{day.activities.hiker}</div>
              </div>
            )}
            {day.activities.biker && (
              <div style={{
                background: THEME.rgba(THEME.base.blueMarker, 0.08),
                border: `1px solid ${THEME.rgba(THEME.base.blueMarker, 0.2)}`,
                borderRadius: '10px', padding: '0.8rem 1rem',
              }}>
                <div style={{ fontSize: '0.7rem', color: THEME.blueAccent, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.3rem' }}>
                  🚴 BIKERS
                </div>
                <div style={{ color: THEME.sand, fontSize: '0.85rem', lineHeight: 1.5 }}>{day.activities.biker}</div>
              </div>
            )}
          </div>
        </>
      )}

      {day.activities.rendezvous && (
        <div style={{
          background: THEME.rgba(THEME.base.goldDeep, 0.06),
          border: `1px solid ${THEME.rgba(THEME.base.goldDeep, 0.2)}`,
          borderRadius: '10px', padding: '0.8rem 1rem', marginBottom: '1.5rem',
        }}>
          <div style={{ fontSize: '0.7rem', color: THEME.gold, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.3rem' }}>
            📍 RENDEZVOUS
          </div>
          <div style={{ color: THEME.sand, fontSize: '0.85rem', lineHeight: 1.5 }}>{day.activities.rendezvous}</div>
        </div>
      )}

      <div style={{ fontSize: '0.75rem', color: THEME.blue, marginBottom: '0.8rem', letterSpacing: '0.08em' }}>
        🍽 MEALS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div style={{
          background: THEME.rgba(THEME.base.white, 0.04),
          border: `1px solid ${THEME.rgba(THEME.base.gold, 0.1)}`,
          borderRadius: '8px', padding: '0.6rem 0.9rem',
          display: 'flex', gap: '0.8rem',
        }}>
          <div style={{ color: THEME.gold, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', minWidth: '60px', paddingTop: '0.1rem' }}>LUNCH</div>
          <div style={{ color: THEME.sand, fontSize: '0.85rem' }}>{day.meals.lunch}</div>
        </div>
        <div style={{
          background: THEME.rgba(THEME.base.white, 0.04),
          border: `1px solid ${THEME.rgba(THEME.base.gold, 0.1)}`,
          borderRadius: '8px', padding: '0.6rem 0.9rem',
          display: 'flex', gap: '0.8rem',
        }}>
          <div style={{ color: THEME.gold, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', minWidth: '60px', paddingTop: '0.1rem' }}>DINNER</div>
          <div style={{ color: THEME.sand, fontSize: '0.85rem' }}>{day.meals.dinner}</div>
        </div>
      </div>
    </div>
  );
}
