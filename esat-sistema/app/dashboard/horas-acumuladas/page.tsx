'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export default function HorasAcumuladasPage() {
  const supabase = createClient()
  const [personas,    setPersonas]    = useState<any[]>([])
  const [asistencias, setAsistencias] = useState<any[]>([])
  const [sesiones,    setSesiones]    = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [mes,         setMes]         = useState(format(new Date(),'yyyy-MM'))

  useEffect(()=>{load()},[mes])

  async function load(){
    setLoading(true)
    const [year,month]=mes.split('-').map(Number)
    const ini=format(startOfMonth(new Date(year,month-1)),'yyyy-MM-dd')
    const fin=format(endOfMonth(new Date(year,month-1)),'yyyy-MM-dd')
    const [p,a,s]=await Promise.all([
      supabase.from('personas').select('*').eq('activo',true).order('nombre'),
      supabase.from('asistencias').select('*').gte('fecha',ini).lte('fecha',fin),
      supabase.from('sesiones_eco').select('*').gte('fecha',ini).lte('fecha',fin),
    ])
    setPersonas(p.data??[]);setAsistencias(a.data??[]);setSesiones(s.data??[])
    setLoading(false)
  }

  function horasPersona(pid:string){
    return asistencias.filter(a=>a.persona_id===pid&&a.hora_entrada&&a.hora_salida).reduce((acc,a)=>{
      const [he,me]=a.hora_entrada.split(':').map(Number)
      const [hs,ms]=a.hora_salida.split(':').map(Number)
      const diff=((hs*60+ms)-(he*60+me))/60
      return acc+(diff>0?diff:0)
    },0)
  }

  function horasEco(pid:string){
    return sesiones.filter(s=>s.persona_id===pid&&s.minutos).reduce((acc,s)=>acc+s.minutos/60,0)
  }

  function diasPersona(pid:string){
    return asistencias.filter(a=>a.persona_id===pid&&['presente','tarde'].includes(a.estado)).length
  }

  const esat=personas.filter(p=>p.grupo==='ESAT')
  const eco =personas.filter(p=>p.grupo==='EcoBIOTEM')
  const meses=Array.from({length:12},(_,i)=>({v:`2026-${String(i+1).padStart(2,'0')}`,l:['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][i]}))

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando horas...</div>

  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Lora,serif',fontSize:24,color:'#002F6C',fontWeight:600}}>Horas Acumuladas</h1>
          <p style={{fontSize:12,color:'#475569',marginTop:3}}>Horas trabajadas registradas en asistencia</p>
        </div>
        <select value={mes} onChange={e=>setMes(e.target.value)} style={{padding:'8px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13,fontFamily:'inherit'}}>
          {meses.map(m=><option key={m.v} value={m.v}>{m.l} 2026</option>)}
        </select>
      </div>

      {/* ESAT */}
      <h2 style={{fontSize:13,fontWeight:600,color:'#475569',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:12}}>Equipo ESAT</h2>
      <div className="card" style={{marginBottom:24}}>
        <div className="card-body">
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'#f8fafc'}}>
                  {['Persona','Rol','Días asistidos','Horas registradas','Horas esperadas','Cumplimiento'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:'#475569',textTransform:'uppercase',borderBottom:'2px solid #e2e8f0'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {esat.map((p,i)=>{
                  const hr=horasPersona(p.id)
                  const dias=diasPersona(p.id)
                  const esperadas=(p.hs_semanales??0)*4
                  const pct=esperadas>0?Math.min(150,Math.round(hr/esperadas*100)):0
                  const color=pct>=90?'#15803d':pct>=70?'#d97706':'#b91c1c'
                  return (
                    <tr key={p.id} style={{background:i%2===0?'white':'#f8fafc'}}>
                      <td style={{padding:'10px 14px',borderBottom:'1px solid #e2e8f0'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:28,height:28,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white'}}>{p.nombre.charAt(0)}</div>
                          <span style={{fontSize:12,fontWeight:600}}>{p.nombre}</span>
                        </div>
                      </td>
                      <td style={{padding:'10px 14px',borderBottom:'1px solid #e2e8f0',fontSize:11,color:'#94a3b8'}}>{p.rol==='SENATI'?`SENATI`:p.rol}</td>
                      <td style={{padding:'10px 14px',borderBottom:'1px solid #e2e8f0',fontSize:12,fontWeight:600,textAlign:'center'}}>{dias}</td>
                      <td style={{padding:'10px 14px',borderBottom:'1px solid #e2e8f0',fontSize:12,fontWeight:700,color:'#002F6C',textAlign:'center'}}>{hr.toFixed(1)}h</td>
                      <td style={{padding:'10px 14px',borderBottom:'1px solid #e2e8f0',fontSize:12,color:'#94a3b8',textAlign:'center'}}>{esperadas.toFixed(0)}h</td>
                      <td style={{padding:'10px 14px',borderBottom:'1px solid #e2e8f0'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{flex:1,height:6,background:'#e2e8f0',borderRadius:10,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${Math.min(100,pct)}%`,background:color,borderRadius:10}}/>
                          </div>
                          <span style={{fontSize:11,fontWeight:700,color,minWidth:36}}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* EcoBIOTEM */}
      {eco.length>0&&(
        <>
          <h2 style={{fontSize:13,fontWeight:600,color:'#15803d',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:12}}>🌿 GI EcoBIOTEM</h2>
          <div className="card">
            <div className="card-body">
              <p style={{fontSize:13,color:'#475569',marginBottom:14}}>Horas registradas via temporizador de sesión. Sin horario fijo.</p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
                {eco.map(p=>{
                  const hr=horasEco(p.id)
                  const ss=sesiones.filter(s=>s.persona_id===p.id&&s.minutos)
                  return (
                    <div key={p.id} style={{padding:'12px 14px',background:'#f0fdf4',borderRadius:10,border:'1px solid #86efac'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                        <div style={{width:30,height:30,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white'}}>{p.nombre.charAt(0)}</div>
                        <div style={{fontSize:12,fontWeight:600}}>{p.nombre}</div>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#475569'}}>
                        <span>Sesiones: {ss.length}</span>
                        <span style={{fontWeight:700,color:'#15803d'}}>{hr.toFixed(1)}h</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
