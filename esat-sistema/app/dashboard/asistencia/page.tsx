'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const DIAS: Record<number,string> = {1:'L',2:'M',3:'X',4:'J',5:'V',6:'S',0:'D'}
const GRUPOS = [
  {key:'Practicante', label:'🎓 Practicantes UNASAM', color:'#1e40af'},
  {key:'SENATI',      label:'🔧 Practicantes Externos (SENATI)', color:'#92400e'},
  {key:'Voluntario',  label:'🤝 Voluntarios ESAT', color:'#15803d'},
  {key:'Asistente',   label:'💼 Asistentes T. Completo', color:'#374151'},
]

function turnoLabel(franjas: any[]) {
  if (!franjas.length) return '—'
  const m = franjas.some(f=>parseInt(f.hora_entrada)<13)
  const t = franjas.some(f=>parseInt(f.hora_entrada)>=13)
  if (m&&t) return `M+T ${franjas.map(f=>f.hora_entrada.slice(0,5)+'–'+f.hora_salida.slice(0,5)).join(' ')}`
  if (m) return `Mañana ${franjas[0].hora_entrada.slice(0,5)}–${franjas[0].hora_salida.slice(0,5)}`
  if (t) return `Tarde ${franjas[0].hora_entrada.slice(0,5)}–${franjas[0].hora_salida.slice(0,5)}`
  return '—'
}

const ESTADO_CFG: Record<string,{bg:string,border:string,pill:string,ptxt:string,label:string}> = {
  presente:          {bg:'#f0fdf4',border:'#86efac',pill:'#dcfce7',ptxt:'#15803d',label:'PRESENTE'},
  tarde:             {bg:'#fff7ed',border:'#fed7aa',pill:'#ffedd5',ptxt:'#c2410c',label:'TARDANZA'},
  ausente:           {bg:'#fef2f2',border:'#fca5a5',pill:'#fee2e2',ptxt:'#b91c1c',label:'AUSENTE'},
  permiso:           {bg:'#fffbeb',border:'#fde68a',pill:'#fef3c7',ptxt:'#b45309',label:'PERMISO'},
  falta_justificada: {bg:'#eff6ff',border:'#93c5fd',pill:'#dbeafe',ptxt:'#1d4ed8',label:'F.JUSTIF.'},
  sin_registrar:     {bg:'white',  border:'#e2e8f0',pill:'#f1f5f9',ptxt:'#94a3b8',label:'—'},
}

export default function AsistenciaPage() {
  const supabase = createClient()
  const hoy = format(new Date(),'yyyy-MM-dd')
  const diaKey = DIAS[new Date().getDay()]

  const [personas, setPersonas]       = useState<any[]>([])
  const [asistencias, setAsistencias] = useState<any[]>([])
  const [horarios, setHorarios]       = useState<any[]>([])
  const [tareas, setTareas]           = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [modal, setModal]             = useState(false)
  const [mPerId, setMPerId]           = useState('')
  const [mTipo, setMTipo]             = useState<'entrada'|'salida'>('entrada')
  const [mHora, setMHora]             = useState(format(new Date(),'HH:mm'))
  const [mEstado, setMEstado]         = useState('presente')
  const [mObs, setMObs]               = useState('')
  const [saving, setSaving]           = useState(false)
  const [verLista, setVerLista]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [p,a,h,t] = await Promise.all([
      supabase.from('personas').select('*').eq('activo',true).order('nombre'),
      supabase.from('asistencias').select('*').eq('fecha',hoy),
      supabase.from('horarios').select('*'),
      supabase.from('tareas').select('persona_id,estado'),
    ])
    setPersonas(p.data??[])
    setAsistencias(a.data??[])
    setHorarios(h.data??[])
    setTareas(t.data??[])
    setLoading(false)
  },[hoy])

  useEffect(()=>{load()},[load])

  function getA(pid:string){return asistencias.find(a=>a.persona_id===pid)}
  function getHoy(pid:string){return horarios.filter(h=>h.persona_id===pid&&h.dia===diaKey)}
  function tareasActivas(pid:string){return tareas.filter(t=>t.persona_id===pid&&t.estado==='en_progreso').length}

  async function guardar(){
    if(!mPerId){return}
    setSaving(true)
    const hora = mHora+':00'
    const asist = getA(mPerId)
    const persona = personas.find(p=>p.id===mPerId)
    let tard=0
    if(persona?.hora_ingreso&&mTipo==='entrada'){
      const [hE,mE]=persona.hora_ingreso.split(':').map(Number)
      const [hR,mR]=mHora.split(':').map(Number)
      tard=Math.max(0,(hR*60+mR)-(hE*60+mE)-(persona.tolerancia??10))
    }
    if(!asist){
      const estado = mEstado!=='presente' ? mEstado : tard>0?'tarde':'presente'
      await supabase.from('asistencias').insert({
        persona_id:mPerId,fecha:hoy,
        hora_entrada:mTipo==='entrada'?hora:null,
        hora_salida:mTipo==='salida'?hora:null,
        estado,tardanza_min:tard,observacion:mObs||null
      })
    } else {
      const upd:any={observacion:mObs||asist.observacion}
      if(mTipo==='entrada'){upd.hora_entrada=hora;if(tard>0)upd.estado='tarde'}
      else upd.hora_salida=hora
      await supabase.from('asistencias').update(upd).eq('id',asist.id)
    }
    setModal(false);setMObs('');setSaving(false);load()
  }

  const esat  = personas.filter(p=>p.grupo==='ESAT')
  const eco   = personas.filter(p=>p.grupo==='EcoBIOTEM')
  const total = esat.length
  const presentes = asistencias.filter(a=>['presente','tarde'].includes(a.estado)).length
  const tardanzas = asistencias.filter(a=>a.estado==='tarde').length

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando asistencia...</div>

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Lora,serif',fontSize:24,color:'#002F6C',fontWeight:600}}>Control de asistencia</h1>
          <p style={{fontSize:12,color:'#475569',marginTop:3,textTransform:'capitalize'}}>{format(new Date(),"EEEE d 'de' MMMM yyyy",{locale:es})}</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <button onClick={()=>setVerLista(!verLista)} className="btn btn-s btn-sm">{verLista?'Ver tarjetas':'Ver lista completa'}</button>
          <button onClick={()=>{setModal(true);setMHora(format(new Date(),'HH:mm'))}} className="btn btn-p">+ Registrar</button>
        </div>
      </div>

      {/* Métricas */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
        {[
          {l:'Total equipo',v:total,s:'ESAT activos',c:'m-azul',i:'👥'},
          {l:'Presentes hoy',v:presentes,s:`${total>0?Math.round(presentes/total*100):0}% asistencia`,c:'m-verde',i:'✅'},
          {l:'Tardanzas',v:tardanzas,s:'llegaron tarde',c:'m-dorado',i:'⏰'},
          {l:'Ausentes',v:total-presentes,s:'sin registrar o ausentes',c:'m-rojo',i:'⚠️'},
        ].map(m=>(
          <div key={m.l} className={`metric ${m.c}`}>
            <div className="metric-lbl">{m.l}</div>
            <div className="metric-val">{m.v}</div>
            <div className="metric-sub">{m.s}</div>
            <div className="metric-icon">{m.i}</div>
          </div>
        ))}
      </div>

      {!verLista ? (
        <>
          {GRUPOS.map(grupo=>{
            const gpersonas = esat.filter(p=>p.rol===grupo.key)
            if(!gpersonas.length) return null
            const gpresentes = gpersonas.filter(p=>['presente','tarde'].includes(getA(p.id)?.estado??'')).length
            return (
              <div key={grupo.key} style={{marginBottom:24}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <h2 style={{fontSize:13,fontWeight:600,color:grupo.color,textTransform:'uppercase',letterSpacing:'.06em'}}>{grupo.label}</h2>
                  <span style={{fontSize:11,color:'#94a3b8'}}>{gpresentes}/{gpersonas.length} presentes</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:12}}>
                  {gpersonas.map(p=>{
                    const a=getA(p.id)
                    const estado=a?.estado??'sin_registrar'
                    const cfg=ESTADO_CFG[estado]??ESTADO_CFG.sin_registrar
                    const franjas=getHoy(p.id)
                    const turno=turnoLabel(franjas)
                    const tAct=tareasActivas(p.id)
                    return (
                      <div key={p.id} onClick={()=>{setMPerId(p.id);setModal(true);setMHora(format(new Date(),'HH:mm'))}}
                        style={{background:cfg.bg,border:`1.5px solid ${cfg.border}`,borderRadius:12,padding:14,cursor:'pointer',transition:'all .2s',position:'relative'}}
                        onMouseEnter={e=>(e.currentTarget as any).style.boxShadow='0 4px 16px rgba(0,0,0,.1)'}
                        onMouseLeave={e=>(e.currentTarget as any).style.boxShadow=''}>
                        <span style={{position:'absolute',top:10,right:10,padding:'2px 8px',borderRadius:20,fontSize:9,fontWeight:700,background:cfg.pill,color:cfg.ptxt}}>{cfg.label}</span>
                        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:8}}>
                          <div style={{width:38,height:38,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,color:'white',flexShrink:0,position:'relative'}}>
                            {p.nombre.charAt(0)}
                            <div style={{position:'absolute',inset:-2,borderRadius:'50%',border:`2px solid ${cfg.border}`}}/>
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.nombre}</div>
                            <div style={{fontSize:9,color:'#94a3b8',marginTop:1}}>
                              {p.rol==='SENATI'?`Prac. SENATI · ${p.subrol}`:p.rol==='Practicante'?`Prac. UNASAM · ${p.subrol}`:p.rol}
                            </div>
                          </div>
                        </div>
                        <div style={{borderTop:'1px solid rgba(0,0,0,.06)',paddingTop:8,display:'flex',justifyContent:'space-between'}}>
                          <div style={{textAlign:'center'}}>
                            <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.04em'}}>ENTRADA</div>
                            <div style={{fontSize:12,fontWeight:600}}>{a?.hora_entrada?.slice(0,5)??'—'}</div>
                          </div>
                          <div style={{textAlign:'center'}}>
                            <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.04em'}}>SALIDA</div>
                            <div style={{fontSize:12,fontWeight:600}}>{a?.hora_salida?.slice(0,5)??'—'}</div>
                          </div>
                          <div style={{textAlign:'center'}}>
                            <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.04em'}}>TAREAS</div>
                            <div style={{fontSize:12,fontWeight:600,color:'#002F6C'}}>{tAct}</div>
                          </div>
                        </div>
                        {a?.tardanza_min>0&&<div style={{fontSize:10,color:'#ea580c',fontWeight:600,textAlign:'center',marginTop:4}}>+{a.tardanza_min} min tardanza</div>}
                        <div style={{fontSize:10,color:'#94a3b8',textAlign:'center',marginTop:4}}>
                          {turno!=='—'?turno:p.hora_ingreso?`Esp: ${p.hora_ingreso.slice(0,5)}`:'Sin horario hoy'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* EcoBIOTEM */}
          {eco.length>0&&(
            <div className="card" style={{border:'2px solid #86efac',marginBottom:24}}>
              <div className="card-body">
                <div className="card-title"><span className="dot" style={{background:'#15803d'}}/>🌿 GI EcoBIOTEM — Horario flexible</div>
                <p style={{fontSize:13,color:'#475569',lineHeight:1.7,marginBottom:12}}>Los miembros del GI EcoBIOTEM <strong>no tienen horario fijo</strong>. Registran horas desde su panel personal. <strong>{eco.length} miembros activos.</strong></p>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Vista lista completa */
        <div className="card">
          <div className="card-body">
            <div className="card-title"><span className="dot" style={{background:'#002F6C'}}/>Registro completo del día</div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:'#f1f5f9'}}>
                    {['Nombre','Horario hoy','Entrada','Salida / Extra','Estado','Tardanza','Obs.'].map(h=>(
                      <th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:11,fontWeight:600,color:'#475569',textTransform:'uppercase',letterSpacing:'.06em',borderBottom:'2px solid #e2e8f0'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {esat.map((p,i)=>{
                    const a=getA(p.id)
                    const cfg=ESTADO_CFG[a?.estado??'sin_registrar']??ESTADO_CFG.sin_registrar
                    const franjas=getHoy(p.id)
                    return (
                      <tr key={p.id} style={{background:i%2===0?'white':'#f8fafc'}}>
                        <td style={{padding:'10px 12px',borderBottom:'1px solid #e2e8f0'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{width:28,height:28,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white'}}>{p.nombre.charAt(0)}</div>
                            <div>
                              <div style={{fontSize:12,fontWeight:600}}>{p.nombre}</div>
                              <div style={{fontSize:10,color:'#94a3b8'}}>{p.rol==='SENATI'?'SENATI':p.rol==='Practicante'?`UNASAM · ${p.subrol}`:p.rol}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{padding:'10px 12px',borderBottom:'1px solid #e2e8f0',fontSize:11,color:'#475569'}}>{turnoLabel(franjas)}</td>
                        <td style={{padding:'10px 12px',borderBottom:'1px solid #e2e8f0',fontSize:12,fontWeight:600}}>{a?.hora_entrada?.slice(0,5)??'—'}</td>
                        <td style={{padding:'10px 12px',borderBottom:'1px solid #e2e8f0',fontSize:12}}>{a?.hora_salida?.slice(0,5)??'—'}</td>
                        <td style={{padding:'10px 12px',borderBottom:'1px solid #e2e8f0'}}>
                          <span style={{padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:700,background:cfg.pill,color:cfg.ptxt}}>{cfg.label}</span>
                        </td>
                        <td style={{padding:'10px 12px',borderBottom:'1px solid #e2e8f0',fontSize:11,color:'#ea580c',fontWeight:600}}>{a?.tardanza_min>0?`+${a.tardanza_min} min`:'—'}</td>
                        <td style={{padding:'10px 12px',borderBottom:'1px solid #e2e8f0',fontSize:11,color:'#94a3b8'}}>{a?.observacion??'—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal&&(
        <div className="mo" onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div className="mo-box">
            <div className="mo-head"><h3>Registrar asistencia</h3><button className="mo-close" onClick={()=>setModal(false)}>×</button></div>
            <div className="ig" style={{marginBottom:12}}>
              <label>Persona</label>
              <select value={mPerId} onChange={e=>setMPerId(e.target.value)}>
                <option value="">Seleccionar...</option>
                {personas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div className="ig"><label>Tipo</label>
                <select value={mTipo} onChange={e=>setMTipo(e.target.value as any)}>
                  <option value="entrada">Entrada</option>
                  <option value="salida">Salida</option>
                </select>
              </div>
              <div className="ig"><label>Hora</label><input type="time" value={mHora} onChange={e=>setMHora(e.target.value)}/></div>
            </div>
            <div className="ig" style={{marginBottom:12}}>
              <label>Estado</label>
              <select value={mEstado} onChange={e=>setMEstado(e.target.value)}>
                <option value="presente">Presente</option>
                <option value="tarde">Tardanza</option>
                <option value="ausente">Ausente</option>
                <option value="permiso">Permiso</option>
                <option value="falta_justificada">Falta justificada</option>
                <option value="falta_injustificada">Falta injustificada</option>
              </select>
            </div>
            <div className="ig" style={{marginBottom:16}}>
              <label>Observación (opcional)</label>
              <input type="text" value={mObs} onChange={e=>setMObs(e.target.value)} placeholder="Ej: llegó por problemas de transporte"/>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-s" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={guardar} disabled={saving||!mPerId}>{saving?'Guardando...':'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
