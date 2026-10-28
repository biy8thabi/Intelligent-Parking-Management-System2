import { useCallback, useEffect, useState } from 'react';
import { request } from '../services/api';

function Table({ rows, columns, empty }) {
  if (!rows.length) return <p>{empty}</p>;
  return <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderSpacing:12}}><thead><tr>{columns.map(c=><th key={c.label}>{c.label}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id ?? i}>{columns.map(c=><td key={c.label}>{c.value(r) ?? '—'}</td>)}</tr>)}</tbody></table></div>;
}
const date = v => v ? new Date(v).toLocaleString() : '—';
export default function CrudPage({ title }) {
  const [availability,setAvailability] = useState(null);
  const [sessions,setSessions] = useState([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [sessionId,setSessionId] = useState('');
  const [ticket,setTicket] = useState(null);
  const [ticketError,setTicketError] = useState('');
  const [ticketLoading,setTicketLoading] = useState(false);
  const token = sessionStorage.getItem('pw_admin_token');
  const needsSpaces = ['Parking Lots','Parking Slots'].includes(title);
  const needsSessions = ['Bookings','Drivers','Vehicles','Payments'].includes(title);
  const load = useCallback(async () => {
    if (!needsSpaces && !needsSessions) return;
    setLoading(true); setError('');
    try {
      if (needsSpaces) setAvailability(await request('/api/parking/availability'));
      if (needsSessions) {
        if (!token) throw new Error('Administrator login required');
        const result = await request('/api/admin/sessions/active',{token});
        if (!Array.isArray(result.active_sessions)) throw new Error('Unexpected active sessions response');
        setSessions(result.active_sessions);
      }
    } catch(e) { setError(e.message || 'Unable to load data'); }
    finally { setLoading(false); }
  },[needsSpaces,needsSessions,token]);
  useEffect(()=>{load();},[load]);
  const spaces = availability?.available_spaces || [];
  const zones = [...new Set(spaces.map(s=>s.zone).filter(Boolean))].map(z=>({id:z,zone:z,available:spaces.filter(s=>s.zone===z).length}));
  const drivers = [...new Map(sessions.filter(s=>s.users?.email).map(s=>[s.users.email,{id:s.users.email,name:s.users.full_name,email:s.users.email}])).values()];
  const vehicles = [...new Map(sessions.filter(s=>s.vehicle_registration_number).map(s=>[s.vehicle_registration_number,{id:s.vehicle_registration_number,registration:s.vehicle_registration_number,driver:s.users?.full_name}])).values()];
  async function ticketAction(mode) {
    const id=sessionId.trim(); setTicketError(''); setTicket(null);
    if(!id) {setTicketError('Enter a parking session ID');return;}
    if(!token) {setTicketError('Administrator login required');return;}
    if(mode==='generate' && !window.confirm('Generate a new QR ticket for this real parking session? This creates a database record.')) return;
    setTicketLoading(true);
    try {
      const result = mode==='generate'
        ? await request('/api/tickets/generate',{token,method:'POST',body:JSON.stringify({session_id:id})})
        : await request(`/api/tickets/${encodeURIComponent(id)}`,{token});
      if(!result.ticket) throw new Error('Ticket missing from backend response');
      setTicket(result.ticket);
    } catch(e) {setTicketError(e.message || 'Ticket request failed');}
    finally {setTicketLoading(false);}
  }
  return <div className="page">
    <div className="title"><div><h1>{title}</h1><p>ParkWise administrator workspace</p></div>{(needsSpaces||needsSessions)&&<button className="primary" onClick={load} disabled={loading}>Refresh</button>}</div>
    {error&&<p className="error" role="alert">{error}</p>}{loading&&<p>Loading live data...</p>}
    {!loading&&!error&&title==='Parking Slots'&&<section className="panel"><h3>Parking availability</h3><p>Total: {availability?.total_spaces ?? '—'} | Available: {availability?.available_count ?? '—'} | Occupied: {availability?.occupied_count ?? '—'} | Disabled: {availability?.disabled_count ?? '—'}</p><h3>Available bays</h3><Table rows={spaces} empty="No available bays found" columns={[{label:'Zone',value:s=>s.zone},{label:'Bay',value:s=>s.bay_number},{label:'Status',value:s=>s.status}]}/><p>Occupied and disabled bay details, and editing, require additional admin endpoints.</p></section>}
    {!loading&&!error&&title==='Parking Lots'&&<section className="panel"><h3>Parking zones</h3><p>Zones are derived from currently available bays, not separate lot records.</p><Table rows={zones} empty="No zones with available bays" columns={[{label:'Zone',value:z=>z.zone},{label:'Available bays',value:z=>z.available}]}/><p>Creating and editing lots requires a backend management API.</p></section>}
    {!loading&&!error&&title==='Bookings'&&<section className="panel"><h3>Active bookings</h3><Table rows={sessions} empty="No active bookings" columns={[{label:'Session ID',value:s=>s.id},{label:'Vehicle',value:s=>s.vehicle_registration_number},{label:'Driver',value:s=>s.users?.full_name},{label:'Bay',value:s=>[s.parking_spaces?.zone,s.parking_spaces?.bay_number].filter(Boolean).join('-')},{label:'Started',value:s=>date(s.entry_time)}]}/></section>}
    {!loading&&!error&&title==='Drivers'&&<section className="panel"><h3>Drivers with active sessions</h3><Table rows={drivers} empty="No drivers in active sessions" columns={[{label:'Name',value:s=>s.name},{label:'Email',value:s=>s.email}]}/><p>All registered drivers require GET /api/admin/users from the backend developer.</p></section>}
    {!loading&&!error&&title==='Vehicles'&&<section className="panel"><h3>Currently parked vehicles</h3><Table rows={vehicles} empty="No vehicles in active sessions" columns={[{label:'Registration',value:s=>s.registration},{label:'Driver',value:s=>s.driver}]}/></section>}
    {!loading&&!error&&title==='Payments'&&<section className="panel"><h3>Payments</h3><p>There are {sessions.length} active sessions. Completed-session fees and verified payments require an admin payment/history endpoint. A calculated parking fee is not proof of payment.</p></section>}
    {title==='QR Tickets'&&<section className="panel"><h3>QR ticket management</h3><p>Enter a real session ID. You can copy it from Bookings while a session is active.</p><input value={sessionId} onChange={e=>setSessionId(e.target.value)} placeholder="Parking session ID" aria-label="Parking session ID" style={{padding:12,maxWidth:420,width:'100%',marginBottom:12}}/><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button className="primary" disabled={ticketLoading} onClick={()=>ticketAction('find')}>Find ticket</button><button className="secondary-button" disabled={ticketLoading} onClick={()=>ticketAction('generate')}>Generate new ticket</button></div>{ticketLoading&&<p>Loading ticket...</p>}{ticketError&&<p className="error" role="alert">{ticketError}</p>}{ticket&&<div style={{marginTop:20}}><h3>Ticket</h3><p>Code: {ticket.ticket_code || '—'}</p><p>Session: {ticket.session_id || sessionId}</p>{typeof ticket.qr_code_url==='string'&&ticket.qr_code_url.startsWith('data:image/')?<img src={ticket.qr_code_url} alt="Parking ticket QR code" style={{width:220,maxWidth:'100%',background:'white',padding:10}}/>:<p>QR image unavailable in the response.</p>}</div>}<p>Generating a ticket creates a real record. Avoid generating duplicates for the same session.</p></section>}
  </div>;
}
