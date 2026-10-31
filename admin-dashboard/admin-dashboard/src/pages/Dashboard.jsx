
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sessions from './Sessions';
import { request } from '../services/api';

const statCards = [
  {
    key: 'total_spaces',
    label: 'Total parking bays',
    icon: '▦',
    description: 'Configured parking capacity',
    color: '#a78bfa',
  },
  {
    key: 'available_count',
    label: 'Available bays',
    icon: '✓',
    description: 'Ready for incoming vehicles',
    color: '#34d399',
  },
  {
    key: 'occupied_count',
    label: 'Occupied bays',
    icon: '◈',
    description: 'Currently in use',
    color: '#c084fc',
  },
  {
    key: 'disabled_count',
    label: 'Unavailable bays',
    icon: '!',
    description: 'Disabled or out of service',
    color: '#fbbf24',
  },
];

export default function Dashboard({ token, onUnauthorised }) {
  const nav = useNavigate();

  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await request('/api/parking/availability');
      setStats(data);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message || 'Unable to load parking statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const total = Number(stats?.total_spaces || 0);
  const available = Number(stats?.available_count || 0);
  const occupied = Number(stats?.occupied_count || 0);
  const disabled = Number(stats?.disabled_count || 0);

  const occupancy = total > 0
    ? Math.min(100, Math.max(0, (occupied / total) * 100))
    : 0;

  const dateLabel = new Intl.DateTimeFormat('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const cardStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 20,
    minWidth: 0,
    boxShadow: 'var(--shadow)',
  };

  const actionStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    color: 'var(--text)',
    textAlign: 'left',
    width: '100%',
  };

  return (
    <div className="page" style={{ maxWidth: 1800 }}>
      {/* Welcome banner */}
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: '27px 28px',
          marginBottom: 24,
          borderRadius: 18,
          border: '1px solid #8b5cf644',
          background:
            'radial-gradient(ellipse at 90% 0%, #8b5cf633, transparent 45%), linear-gradient(120deg, var(--surface), var(--surface2))',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              color: '#a78bfa',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 2,
              marginBottom: 12,
            }}
          >
            PARKWISE / OPERATIONS CENTRE
          </div>

          <h1
            style={{
              fontSize: 'clamp(25px, 3vw, 36px)',
              letterSpacing: -1,
              margin: '0 0 10px',
            }}
          >
            Your parking overview.
          </h1>

          <p
            style={{
              color: 'var(--muted)',
              fontSize: 12,
              margin: 0,
              lineHeight: 1.8,
            }}
          >
            Monitor parking availability and manage active sessions from one
            place.
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 20,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                color: 'var(--text)',
                padding: '8px 11px',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 30,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  background: error ? '#f87171' : '#34d399',
                  borderRadius: '50%',
                }}
              />
              {error
                ? 'Connection issue'
                : loading
                  ? 'Checking parking data'
                  : 'Parking data loaded'}
            </span>

            <span style={{ color: 'var(--muted)', fontSize: 11 }}>
              {dateLabel}
            </span>
          </div>
        </div>

        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 24,
            bottom: -43,
            fontSize: 155,
            fontWeight: 900,
            lineHeight: 1,
            color: '#8b5cf6',
            opacity: 0.08,
            pointerEvents: 'none',
          }}
        >
          P
        </div>
      </section>

      {/* Page heading and refresh */}
      <div className="title">
        <div>
          <h1 style={{ fontSize: 21 }}>Live overview</h1>
          <p>Real parking availability from your connected backend.</p>
        </div>

        <button
          className="primary"
          onClick={refresh}
          disabled={loading}
        >
          <span aria-hidden="true">↻</span>
          {loading ? 'Refreshing…' : 'Refresh data'}
        </button>
      </div>

      {error && (
        <div className="error" role="alert" style={{ marginBottom: 18 }}>
          <b>Could not refresh parking data.</b>
          <p>{error}</p>
          <button className="secondary-button" onClick={refresh}>
            Try again
          </button>
        </div>
      )}

      {/* Live statistic cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))',
          gap: 15,
          marginBottom: 22,
        }}
      >
        {statCards.map((item) => (
          <section
            key={item.key}
            style={{
              ...cardStyle,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <p
                style={{
                  color: 'var(--muted)',
                  fontSize: 11,
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {item.label}
              </p>

              <span
                style={{
                  width: 36,
                  height: 36,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  borderRadius: 11,
                  background: `${item.color}20`,
                  color: item.color,
                  fontSize: 19,
                  fontWeight: 800,
                }}
              >
                {item.icon}
              </span>
            </div>

            <h2
              style={{
                fontSize: 34,
                letterSpacing: -1,
                margin: '17px 0 8px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {loading && !stats ? '—' : Number(stats?.[item.key] || 0)}
            </h2>

            <p
              style={{
                color: 'var(--muted)',
                fontSize: 10,
                margin: 0,
              }}
            >
              {item.description}
            </p>

            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '100%',
                height: 3,
                background: item.color,
                opacity: 0.75,
              }}
            />
          </section>
        ))}
      </div>

      {/* Occupancy and quick actions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: 18,
          marginBottom: 24,
        }}
      >
        <section style={cardStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ margin: '0 0 7px', fontSize: 15 }}>
                Parking occupancy
              </h3>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 11 }}>
                How much of your parking capacity is in use.
              </p>
            </div>

            <span
              style={{
                fontSize: 10,
                color: '#a78bfa',
                background: 'var(--purple-soft)',
                borderRadius: 7,
                padding: '7px 9px',
                whiteSpace: 'nowrap',
              }}
            >
              LIVE DATA
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
              flexWrap: 'wrap',
              padding: '28px 0 20px',
            }}
          >
            <div
              role="img"
              aria-label={`${occupancy.toFixed(1)} percent of parking bays occupied`}
              style={{
                width: 148,
                height: 148,
                borderRadius: '50%',
                background: total
                  ? `conic-gradient(#a78bfa ${occupancy}%, var(--surface3) ${occupancy}% 100%)`
                  : 'var(--surface3)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 116,
                  height: 116,
                  borderRadius: '50%',
                  background: 'var(--surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <strong style={{ fontSize: 27, letterSpacing: -1 }}>
                  {loading && !stats ? '—' : `${occupancy.toFixed(1)}%`}
                </strong>
                <span
                  style={{
                    color: 'var(--muted)',
                    fontSize: 10,
                    marginTop: 4,
                  }}
                >
                  occupied
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 16, minWidth: 130 }}>
              {[
                ['Occupied', occupied, '#a78bfa'],
                ['Available', available, '#34d399'],
                ['Unavailable', disabled, '#fbbf24'],
              ].map(([label, value, color]) => (
                <div
                  key={label}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '9px 1fr auto',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      background: color,
                      borderRadius: 3,
                    }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {label}
                  </span>
                  <strong style={{ fontSize: 12 }}>
                    {loading && !stats ? '—' : value}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 15,
              color: 'var(--muted)',
              fontSize: 11,
              lineHeight: 1.7,
            }}
          >
            {total === 0
              ? 'No parking capacity is currently configured.'
              : `${available} of ${total} bays are available for parking.`}
          </div>

          <button
            className="secondary-button"
            style={{ marginTop: 15, padding: '10px 13px' }}
            onClick={() => nav('/parking-slots')}
          >
            View parking bays →
          </button>
        </section>

        <section style={cardStyle}>
          <h3 style={{ margin: '0 0 7px', fontSize: 15 }}>
            Quick actions
          </h3>
          <p
            style={{
              margin: '0 0 20px',
              color: 'var(--muted)',
              fontSize: 11,
              lineHeight: 1.7,
            }}
          >
            Jump straight to the tools you use to manage ParkWise.
          </p>

          <div style={{ display: 'grid', gap: 11 }}>
            <button
              style={actionStyle}
              onClick={() => nav('/active-sessions')}
            >
              <span
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 11,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'var(--purple-soft)',
                  color: '#a78bfa',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                ◷
              </span>
              <span style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: 12 }}>
                  Active sessions
                </strong>
                <small
                  style={{
                    display: 'block',
                    color: 'var(--muted)',
                    fontSize: 10,
                    marginTop: 5,
                  }}
                >
                  View and manage current parking
                </small>
              </span>
              <span style={{ color: 'var(--muted)' }}>→</span>
            </button>

            <button
              style={actionStyle}
              onClick={() => nav('/parking-slots')}
            >
              <span
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 11,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(52,211,153,.12)',
                  color: '#34d399',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                ▦
              </span>
              <span style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: 12 }}>
                  Parking management
                </strong>
                <small
                  style={{
                    display: 'block',
                    color: 'var(--muted)',
                    fontSize: 10,
                    marginTop: 5,
                  }}
                >
                  Inspect the parking bay section
                </small>
              </span>
              <span style={{ color: 'var(--muted)' }}>→</span>
            </button>

            <button
              style={actionStyle}
              onClick={() => nav('/qr-tickets')}
            >
              <span
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 11,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(251,191,36,.12)',
                  color: '#fbbf24',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                ▦
              </span>
              <span style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: 12 }}>
                  QR tickets
                </strong>
                <small
                  style={{
                    display: 'block',
                    color: 'var(--muted)',
                    fontSize: 10,
                    marginTop: 5,
                  }}
                >
                  Open the ticket management section
                </small>
              </span>
              <span style={{ color: 'var(--muted)' }}>→</span>
            </button>
          </div>
        </section>
      </div>

      {/* Active sessions */}
      <section style={{ marginBottom: 18 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 14,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 19 }}>Parking activity</h2>
            <p
              style={{
                margin: '6px 0 0',
                color: 'var(--muted)',
                fontSize: 11,
              }}
            >
              Current sessions reported by the backend.
            </p>
          </div>

          {lastUpdated && (
            <span style={{ color: 'var(--muted)', fontSize: 10 }}>
              Updated {lastUpdated.toLocaleTimeString('en-ZA')}
            </span>
          )}
        </div>

        <Sessions
          embedded
          token={token}
          onUnauthorised={onUnauthorised}
        />
      </section>

      <p
        style={{
          padding: 14,
          borderRadius: 10,
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          color: 'var(--muted)',
          fontSize: 10,
          lineHeight: 1.7,
        }}
      >
        <strong style={{ color: 'var(--text)' }}>Financial reporting:</strong>{' '}
        Revenue and payment totals will be displayed when a verified
        administrator payments endpoint is available. No estimated revenue is
        included in these statistics.
      </p>
    </div>
  );
}
