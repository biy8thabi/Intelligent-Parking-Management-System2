import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sessions from './Sessions';
import { request } from '../services/api';

export default function Dashboard({ token, onUnauthorised }) {
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { setStats(await request('/api/parking/availability')); }
    catch (e) { setError(e.message || 'Unable to load parking statistics'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const items = stats ? [
    ['Total spaces', stats.total_spaces], ['Available', stats.available_count],
    ['Occupied', stats.occupied_count], ['Disabled', stats.disabled_count]
  ] : [];
  const total = Number(stats?.total_spaces || 0);
  const occupied = Number(stats?.occupied_count || 0);
  return <div className="page">
    <div className="title"><div><h1>Dashboard Overview</h1><p>Live ParkWise parking availability and active sessions.</p></div><button className="primary" onClick={refresh} disabled={loading}>Refresh statistics</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    {loading && <p>Loading parking statistics...</p>}
    {stats && <><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:14,marginBottom:20}}>{items.map(([label,value])=><section className="panel" key={label}><p>{label}</p><h2>{value ?? '—'}</h2></section>)}</div><section className="panel"><h3>Occupancy</h3><p>{total ? `${(occupied / total * 100).toFixed(1)}%` : 'No spaces configured'}</p><button className="secondary-button" onClick={()=>nav('/parking-slots')}>View parking slots</button></section></>}
    <button className="primary" onClick={()=>nav('/active-sessions')} style={{margin:'16px 0'}}>Open Active Sessions</button>
    <Sessions embedded token={token} onUnauthorised={onUnauthorised}/>
    <p className="setting-note">Revenue and payment totals require a separate administrator API.</p>
  </div>;
}
