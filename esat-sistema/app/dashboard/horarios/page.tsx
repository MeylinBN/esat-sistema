'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const DIAS = ['L','M','X','J','V'] as const
const DIAS_LABEL: Record<string,string> = {L:'Lunes',M:'Martes',X:'Miércoles',J:'Jueves',V:'Viernes'}
const GRUPOS = [
  {rol:'Practicante',label:'🎓 Practicantes UNASAM',color:'#1e40af'},
  {rol:'SENATI',     label:'🔧 Practicantes Externos (SENATI)',color:'#92400e'},
  {rol:'Voluntario', label:'🤝 Voluntarios ESAT',color:'#15803d'},
  {rol:'Asistente',  label:'💼 Asistentes T. Completo',color:'#374151'},
]

function turnoCell(franjas: any[]) {
  if(!franjas.length) return {bg:'#f1f5f9',border:'#cbd5e1',txt:'—',detail:''}
  const m = franjas.some(f=>parseInt(f.hora_entrada)<13)
  const t = franjas.some(f=>parseInt(f.hora_entrada)>=13)
  const detail = franjas.map(f=>f.hora_entrada.slice(0,5)+'–'+f.hora_salida.slice(0,5)).join('\n')
  if(m&&t) return {bg:'#fef9c3',border:'#fde047',txt:'M+T',detail}
  if(m)    return {bg:'#dbeafe',border:'#93c5fd',txt:'M',detail}
  if(t)    return {bg:'#dcfce7',border:'#86efac',txt:'T',detail}
  return {bg:'#f1f5f9',border:'#cbd5e1',txt:'—',detail:''}
}

export default function HorariosPage() {
  const supabase = createClient()
  const [personas,  setPersonas]  = useState<any[]>([])
  const [horarios,  setHorarios]  = useState<any[]>([])
  const [permisos,  setPermisos]  = useState<any[]>([])
  const [cambios,   setCambios]   = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modalH,    setModalH]    = useState(false)
  const [mPerId,    setMPerId]    = useState('')
  const [mDia,      setMDia]      = useState('L')
  const [mEntrada,  setMEntrada]  = useState('08:30')
  const [mSalida,   setMSalida]   = useState('13:00')
  const [saving,    setSaving]    = useState(false)

  useEffect(()=>{load()},[])

  async function load(){
    setLoading(true)
    const [p,h,pe,c] = await Promise.all([
      supabase.from('personas').select('*').eq('activo',true).order('nombre'),
      supabase.from('horarios').select('*'),
      supabase.from('permisos').select('*,personas(nombre)').order('created_at',{ascending:false}).limit(20),
      supabase.from('cambios_horario').select('*,personas(nombre)').order('created_at',{ascending:false}).limit(10),
    ])
    setPersonas(p.data??[])
    setHorarios(h.data??[])
    setPermisos(pe.data??[])
    setCambios(c.data??[])
    setLoading(false)
  }

  function franjas(pid:string,dia:string){return horarios.filter(h=>h.persona_id===pid&&h.dia===dia)}
  function totalHs(pid:string){
    return horarios.filter(h=>h.persona_id===pid).reduce((acc,h)=>{
      const [he,me]=h.hora_entrada.split(':').map(Number)
      const [hs,ms]=h.hora_salida.split(':').map(Number)
      return acc+((hs*60+ms)-(he*60+me))/60
    },0)
  }
  function resumenHorario(pid:string){
    return DIAS.map(d=>{
      const ff=franjas(pid,d)
      if(!ff.length) return null
      return `${DIAS_LABEL[d].slice(0,3)}: ${ff.map(f=>f.hora_entrada.slice(0,5)+'–'+f.hora_salida.slice(0,5)).join(', ')}`
    }).filter(Boolean).join(' | ')
  }

  async function guardarFranja(){
    if(!mPerId) return
    setSaving(true)
    await supabase.from('horarios').insert({persona_id:mPerId,dia:mDia,hora_entrada:mEntrada+':00',hora_salida:mSalida+':00'})
    setSaving(false);setModalH(false);load()
  }

  async function eliminarFranja(id:string){
    if(!confirm('¿Eliminar esta franja?')) return
    await supabase.from('horarios').delete().eq('id',id)
    load()
  }

  const esat = personas.filter(p=>p.grupo==='ESAT')
  const eco  = personas.filter(p=>p.grupo==='EcoBIOTEM')

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando horarios...</div>

  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Lora,serif',fontSize:24,color:'#002F6C',fontWeight:600}}>Horarios</h1>
          <p style={{fontSize:12,color:'#475569',marginTop:3}}>M = Mañana (entra antes 1pm) · T = Tarde (entra 1pm+) · M+T = doble turno separado</p>
        </div>
        <button className="btn btn-p" onClick={()=>setModalH(true)}>+ Agregar franja</button>
      </div>

      {/* Leyenda */}
      <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
        {[['M','Mañana','#dbeafe','#93c5fd'],['T','Tarde','#dcfce7','#86efac'],['M+T','Doble turno (sale a almorzar y vuelve)','#fef9c3','#fde047']].map(([k,l,bg,b])=>(
          <div key={k} style={{display:'flex',alignItems:'center',gap:7,padding:'5px 12px',background:bg as string,border:`1.5px solid ${b}`,borderRadius:8,fontSize:11}}>
            <strong>{k}</strong> — {l}
          </div>
        ))}
      </div>

      {GRUPOS.map(grupo=>{
        const gpersonas = esat.filter(p=>p.rol===grupo.rol)
        if(!gpersonas.length) return null
        return (
          <div key={grupo.rol} style={{marginBottom:28}}>
            <h2 style={{fontSize:13,fontWeight:600,color:grupo.color,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:12}}>{grupo.label}</h2>
            <div className="card" style={{overflowX:'auto',marginBottom:0}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:'#f8fafc'}}>
                    <th style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:'#475569',textTransform:'uppercase',letterSpacing:'.06em',borderBottom:'2px solid #e2e8f0'}}>Persona</th>
                    {DIAS.map(d=>(
                      <th key={d} style={{padding:'10px 14px',textAlign:'center',fontSize:11,fontWeight:600,color:'#475569',textTransform:'uppercase',letterSpacing:'.06em',borderBottom:'2px solid #e2e8f0'}}>{DIAS_LABEL[d]}</th>
                    ))}
                    <th style={{padding:'10px 14px',textAlign:'center',fontSize:11,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Hrs/sem</th>
                  </tr>
                </thead>
                <tbody>
                  {gpersonas.map((p,i)=>(
                    <tr key={p.id} style={{background:i%2===0?'white':'#f8fafc'}}>
                      <td style={{padding:'10px 14px',borderBottom:'1px solid #e2e8f0'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:30,height:30,borderRadius:8,background:p.color+'25',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,color:p.color,flexShrink:0}}>{p.nombre.charAt(0)}</div>
                          <div>
                            <div style={{fontSize:12,fontWeight:600}}>{p.nombre}</div>
                            <div style={{fontSize:9,color:'#94a3b8'}}>{p.rol==='SENATI'?`SENATI · ${p.subrol}`:p.subrol??p.rol}</div>
                          </div>
                        </div>
                      </td>
                      {DIAS.map(d=>{
                        const ff=franjas(p.id,d)
                        const tc=turnoCell(ff)
                        return (
                          <td key={d} style={{padding:'8px',textAlign:'center',borderBottom:'1px solid #e2e8f0'}}>
                            {ff.length>0?(
                              <div title={tc.detail} style={{display:'inline-flex',flexDirection:'column',alignItems:'center',background:tc.bg,border:`1.5px solid ${tc.border}`,borderRadius:7,padding:'4px 8px',cursor:'help',minWidth:54}}>
                                <span style={{fontSize:11,fontWeight:700}}>{tc.txt}</span>
                                <span style={{fontSize:8,color:'#94a3b8',marginTop:1,whiteSpace:'pre',textAlign:'center',lineHeight:1.4}}>{tc.detail}</span>
                              </div>
                            ):(
                              <span style={{fontSize:11,color:'#cbd5e1'}}>—</span>
                            )}
                          </td>
                        )
                      })}
                      <td style={{padding:'10px 14px',textAlign:'center',borderBottom:'1px solid #e2e8f0',fontSize:12,fontWeight:600,color:'#002F6C'}}>{totalHs(p.id).toFixed(1)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* EcoBIOTEM */}
      <div className="card" style={{border:'2px solid #86efac',marginBottom:28}}>
        <div className="card-body">
          <div className="card-title"><span className="dot" style={{background:'#15803d'}}/>🌿 GI EcoBIOTEM — Horario flexible</div>
          <p style={{fontSize:13,color:'#475569',lineHeight:1.7,marginBottom:14}}>Los miembros del GI EcoBIOTEM <strong>no tienen horario fijo</strong>. Lo que importa son las <strong>horas acumuladas y el avance en sus proyectos</strong>. Total activos: <strong>{eco.length}</strong></p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:8}}>
            {eco.map(p=>(
              <div key={p.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:'#dcfce7',borderRadius:9,border:'1px solid #86efac'}}>
                <div style={{width:26,height:26,borderRadius:7,background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white'}}>{p.nombre.charAt(0)}</div>
                <div style={{fontSize:11,fontWeight:500}}>{p.nombre}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Permisos y cambios registrados */}
      <div className="card" style={{marginBottom:24}}>
        <div className="card-body">
          <div className="card-title"><span className="dot" style={{background:'#d97706'}}/>📋 Permisos y cambios de horario registrados</div>
          {permisos.length===0&&cambios.length===0&&(
            <p style={{fontSize:13,color:'#94a3b8',textAlign:'center',padding:'16px 0'}}>Sin registros recientes</p>
          )}
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {cambios.map(c=>(
              <div key={c.id} style={{padding:'10px 14px',background:'#eff6ff',borderRadius:9,borderLeft:'3px solid #93c5fd',fontSize:12}}>
                <strong>{c.personas?.nombre}</strong> — Cambio de horario{c.dia?` (${DIAS_LABEL[c.dia]})`:''}{c.motivo?`: ${c.motivo}`:''}
                <span style={{fontSize:10,color:'#94a3b8',marginLeft:8}}>{c.fecha_cambio}</span>
              </div>
            ))}
            {permisos.map(p=>(
              <div key={p.id} style={{padding:'10px 14px',background:'#fffbeb',borderRadius:9,borderLeft:'3px solid #fde68a',fontSize:12}}>
                <strong>{p.personas?.nombre}</strong> — {p.tipo.replace('_',' ')} · {p.fecha_inicio}{p.fecha_fin!==p.fecha_inicio?` → ${p.fecha_fin}`:''}
                {p.dias_recuperacion&&<span style={{color:'#15803d',marginLeft:8}}>🔁 Recupera: {p.dias_recuperacion}</span>}
                <span style={{fontSize:10,marginLeft:8,padding:'2px 8px',borderRadius:20,background:p.estado==='aprobado'?'#dcfce7':p.estado==='pendiente'?'#fef3c7':'#fee2e2',color:p.estado==='aprobado'?'#15803d':p.estado==='pendiente'?'#b45309':'#b91c1c'}}>{p.estado}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resúmenes de horario individuales */}
      <div className="card">
        <div className="card-body">
          <div className="card-title"><span className="dot" style={{background:'#002F6C'}}/>📅 Resumen de horario por persona</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:10}}>
            {esat.map(p=>{
              const res=resumenHorario(p.id)
              return (
                <div key={p.id} style={{padding:'10px 12px',background:'#f8fafc',borderRadius:9,border:'1px solid #e2e8f0'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                    <div style={{width:26,height:26,borderRadius:7,background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white'}}>{p.nombre.charAt(0)}</div>
                    <span style={{fontSize:12,fontWeight:600}}>{p.nombre}</span>
                    <span style={{marginLeft:'auto',fontSize:11,fontWeight:600,color:'#002F6C'}}>{totalHs(p.id).toFixed(1)}h</span>
                  </div>
                  <div style={{fontSize:10,color:'#475569',lineHeight:1.7}}>{res||'Sin horario asignado'}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modal agregar franja */}
      {modalH&&(
        <div className="mo" onClick={e=>{if(e.target===e.currentTarget)setModalH(false)}}>
          <div className="mo-box">
            <div className="mo-head"><h3>Agregar franja de horario</h3><button className="mo-close" onClick={()=>setModalH(false)}>×</button></div>
            <div className="ig" style={{marginBottom:12}}>
              <label>Persona</label>
              <select value={mPerId} onChange={e=>setMPerId(e.target.value)}>
                <option value="">Seleccionar...</option>
                {personas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16}}>
              <div className="ig"><label>Día</label>
                <select value={mDia} onChange={e=>setMDia(e.target.value)}>
                  {DIAS.map(d=><option key={d} value={d}>{DIAS_LABEL[d]}</option>)}
                </select>
              </div>
              <div className="ig"><label>Entrada</label><input type="time" value={mEntrada} onChange={e=>setMEntrada(e.target.value)}/></div>
              <div className="ig"><label>Salida</label><input type="time" value={mSalida} onChange={e=>setMSalida(e.target.value)}/></div>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-s" onClick={()=>setModalH(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={guardarFranja} disabled={saving||!mPerId}>{saving?'Guardando...':'Guardar franja'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
