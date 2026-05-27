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
    
    // ✅ HORA AUTOMÁTICA DEL SISTEMA
    const ahora = format(new Date(),'HH:mm:ss')
    
    const asist = getA(mPerId)
    const persona = personas.find(p=>p.id===mPerId)
    let tard=0
    
    if(persona?.hora_ingreso&&mTipo==='entrada'){
      const [hE,mE]=persona.hora_ingreso.split(':').map(Number)
      const [hR,mR]=ahora.split(':').map(Number)
      tard=Math.max(0,(hR*60+mR)-(hE*60+mE)-(persona.tolerancia??10))
    }
    
    if(!asist){
      const estado = mTipo==='entrada' ? (tard>0?'tarde':'presente') : 'presente'
      await supabase.from('asistencias').insert({
        persona_id:mPerId,fecha:hoy,
        hora_entrada:mTipo==='entrada'?ahora:null,
        hora_salida:mTipo==='salida'?ahora:null,
        estado,tardanza_min:tard,observacion:mObs||null
      })
    } else {
      const upd:any={observacion:mObs||asist.observacion}
      if(mTipo==='entrada'){
        upd.hora_entrada=ahora
        if(tard>0) upd.estado='tarde'
      } else {
        upd.hora_salida=ahora
      }
      await supabase.from('asistencias').update(upd).eq('id',asist.id)
    }
    
    setModal(false)
    setMObs('')
    setSaving(false)
    load()
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
        <p style={{fontSize:12,color:'#475569',marginTop:3,textTransform:'capitalize'}}>
  {format(new Date(),"EEEE d 'de' MMMM 'del' yyyy",{locale:es})}
</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <button onClick={()=>setVerLista(!verLista)} style={{padding:'8px 16px',background:'white',border:'1.5px solid #e2e8f0',borderRadius:8,cursor:'pointer',fontWeight:600}}>{verLista?'Ver tarjetas':'Ver lista completa'}</button>
          <button onClick={()=>{setMPerId('');setModal(true)}} style={{padding:'8px 16px',background:'#002F6C',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600}}>+ Registrar</button>
        </div>
      </div>

      {/* Métricas */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
        {[
          {l:'Total equipo',v:total,s:'ESAT activos',c:'#002F6C',i:'👥'},
          {l:'Presentes hoy',v:presentes,s:`${total>0?Math.round(presentes/total*100):0}% asistencia`,c:'#15803d',i:'✅'},
          {l:'Tardanzas',v:tardanzas,s:'llegaron tarde',c:'#d97706',i:'⏰'},
          {l:'Ausentes',v:total-presentes,s:'sin registrar o ausentes',c:'#dc2626',i:'⚠️'},
        ].map(m=>(
          <div key={m.l} style={{background:'white',borderRadius:12,padding:'16px 18px',border:`1.5px solid ${m.c}22`,boxShadow:'0 1px 3px rgba(0,0,0,.06)',position:'relative',overflow:'hidden'}}>
            <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',marginBottom:6}}>{m.l}</div>
            <div style={{fontSize:30,fontWeight:700,color:m.c,lineHeight:1}}>{m.v}</div>
            <div style={{fontSize:11,color:'#94a3b8',marginTop:4}}>{m.s}</div>
            <div style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',fontSize:28,opacity:.15}}>{m.i}</div>
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
                    const asistPersona = asistencias.filter(a => a.persona_id === p.id)
                    const asist1 = asistPersona[0]
                    const asist2 = asistPersona[1]
                    
                    const estado = asistPersona.length > 0 
                      ? (asistPersona.some(a => a.estado === 'tarde') ? 'tarde' : asistPersona[0].estado)
                      : 'sin_registrar'

                    const cfg = ESTADO_CFG[estado] ?? ESTADO_CFG.sin_registrar
                    const franjas = getHoy(p.id)
                    const turno = turnoLabel(franjas)
                    const tAct = tareasActivas(p.id)

                    return (
                      <div key={p.id} onClick={()=>{setMPerId(p.id);setModal(true)}}
                        style={{background:cfg.bg,border:`1.5px solid ${cfg.border}`,borderRadius:12,padding:14,cursor:'pointer',transition:'all .2s',position:'relative'}}
                        onMouseEnter={e=>(e.currentTarget as any).style.boxShadow='0 4px 16px rgba(0,0,0,.1)'}
                        onMouseLeave={e=>(e.currentTarget as any).style.boxShadow=''}>
                        
                        <span style={{position:'absolute',top:10,right:10,padding:'2px 8px',borderRadius:20,fontSize:9,fontWeight:700,background:cfg.pill,color:cfg.ptxt}}>
                          {cfg.label}
                        </span>

                        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:8, paddingRight: '65px'}}> 
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
                          <div style={{textAlign:'center', flex: 1}}>
                            <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.04em'}}>ENTRADA</div>
                            <div style={{fontSize:11,fontWeight:700,color:'#0f172a'}}>{asist1?.hora_entrada?.slice(0,5) ?? '—'}</div>
                            {asist2 && <div style={{fontSize:9, color:'#64748b',marginTop:2}}>{asist2.hora_entrada?.slice(0,5)}</div>}
                          </div>
                          <div style={{textAlign:'center', flex: 1}}>
                            <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.04em'}}>SALIDA</div>
                            <div style={{fontSize:11,fontWeight:700,color:'#0f172a'}}>{asist1?.hora_salida?.slice(0,5) ?? '—'}</div>
                            {asist2 && <div style={{fontSize:9, color:'#64748b',marginTop:2}}>{asist2.hora_salida?.slice(0,5)}</div>}
                          </div>
                          <div style={{textAlign:'center', flex: 1}}>
                            <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.04em'}}>TAREAS</div>
                            <div style={{fontSize:12,fontWeight:600,color:'#002F6C'}}>{tAct}</div>
                          </div>
                        </div>

                        {asist1?.tardanza_min>0 && <div style={{fontSize:10,color:'#ea580c',fontWeight:600,textAlign:'center',marginTop:4}}>+{asist1.tardanza_min} min tardanza</div>}
                        
                        <div style={{fontSize:10,color:'#94a3b8',textAlign:'center',marginTop:4, borderTop:'1px dashed #e2e8f0', paddingTop:4}}>
                          {turno!=='—' ? turno : (p.hora_ingreso ? `Esp: ${p.hora_ingreso.slice(0,5)}` : 'Sin horario hoy')}
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
            <div style={{background:'white',borderRadius:14,border:'2px solid #86efac',marginBottom:24,padding:20}}>
              <div style={{fontSize:14,fontWeight:600,color:'#0f172a',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:'#15803d'}}/>🌿 GI EcoBIOTEM — Horario flexible
              </div>
              <p style={{fontSize:13,color:'#475569',lineHeight:1.7,margin:0}}>
                Los miembros del GI EcoBIOTEM <strong>no tienen horario fijo</strong>. Registran horas desde su panel personal. <strong>{eco.length} miembros activos.</strong>
              </p>
            </div>
          )}
        </>
      ) : (
        /* Vista lista completa */
        <div style={{background:'white',borderRadius:14,border:'1.5px solid #e2e8f0',overflow:'hidden'}}>
          <div style={{padding:20,borderBottom:'1px solid #e2e8f0',display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#002F6C'}}/>
            <span style={{fontSize:14,fontWeight:600,color:'#0f172a'}}>Registro completo del día</span>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'#f8fafc'}}>
                  {['Nombre','Horario hoy','Entrada','Salida','Estado','Tardanza','Obs.'].map(h=>(
                    <th key={h} style={{padding:'12px',textAlign:'left',fontSize:11,fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {esat.map((p,i)=>{
                  const a=getA(p.id)
                  const cfg=ESTADO_CFG[a?.estado??'sin_registrar']??ESTADO_CFG.sin_registrar
                  const franjas=getHoy(p.id)
                  return (
                    <tr key={p.id} style={{background:i%2===0?'white':'#f8fafc',borderBottom:'1px solid #f1f5f9'}}>
                      <td style={{padding:'10px 12px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:28,height:28,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white'}}>{p.nombre.charAt(0)}</div>
                          <div>
                            <div style={{fontSize:12,fontWeight:600}}>{p.nombre}</div>
                            <div style={{fontSize:10,color:'#94a3b8'}}>{p.rol==='SENATI'?'SENATI':p.rol==='Practicante'?`UNASAM · ${p.subrol}`:p.rol}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{padding:'10px 12px',fontSize:11,color:'#475569'}}>{turnoLabel(franjas)}</td>
                      <td style={{padding:'10px 12px',fontSize:12,fontWeight:600}}>{a?.hora_entrada?.slice(0,5)??'—'}</td>
                      <td style={{padding:'10px 12px',fontSize:12}}>{a?.hora_salida?.slice(0,5)??'—'}</td>
                      <td style={{padding:'10px 12px'}}>
                        <span style={{padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:700,background:cfg.pill,color:cfg.ptxt}}>{cfg.label}</span>
                      </td>
                      <td style={{padding:'10px 12px',fontSize:11,color:'#ea580c',fontWeight:600}}>{a?.tardanza_min>0?`+${a.tardanza_min} min`:'—'}</td>
                      <td style={{padding:'10px 12px',fontSize:11,color:'#94a3b8'}}>{a?.observacion??'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal SIMPLIFICADO - Sin reloj manual */}
      {modal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div style={{background:'white',borderRadius:18,padding:24,width:'100%',maxWidth:400,boxShadow:'0 24px 80px rgba(0,0,0,.25)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{fontSize:16,fontWeight:700,margin:0}}>Registrar asistencia</h3>
              <button onClick={()=>setModal(false)} style={{width:28,height:28,borderRadius:'50%',border:'none',background:'#f1f5f9',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            
            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Persona</label>
              <select value={mPerId} onChange={e=>setMPerId(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}>
                <option value="">Seleccionar...</option>
                {personas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            
            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Tipo de registro</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <button 
                  onClick={()=>setMTipo('entrada')}
                  style={{
                    padding:'12px',
                    background:mTipo==='entrada'?'#15803d':'white',
                    color:mTipo==='entrada'?'white':'#475569',
                    border:`2px solid ${mTipo==='entrada'?'#15803d':'#e2e8f0'}`,
                    borderRadius:10,
                    cursor:'pointer',
                    fontWeight:600,
                    fontSize:13,
                    transition:'all .2s'
                  }}>
                  ✅ Marcar Entrada
                </button>
                <button 
                  onClick={()=>setMTipo('salida')}
                  style={{
                    padding:'12px',
                    background:mTipo==='salida'?'#dc2626':'white',
                    color:mTipo==='salida'?'white':'#475569',
                    border:`2px solid ${mTipo==='salida'?'#dc2626':'#e2e8f0'}`,
                    borderRadius:10,
                    cursor:'pointer',
                    fontWeight:600,
                    fontSize:13,
                    transition:'all .2s'
                  }}>
                  🚪 Marcar Salida
                </button>
              </div>
            </div>
            
            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Observación (opcional)</label>
              <input type="text" value={mObs} onChange={e=>setMObs(e.target.value)} placeholder="Ej: llegó tarde por transporte" style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}/>
            </div>
            
            <div style={{background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:9,padding:'10px 12px',marginBottom:16}}>
              <div style={{fontSize:11,color:'#0369a1'}}>
                ⏰ <strong>Hora automática:</strong> {format(new Date(),'HH:mm:ss')}
              </div>
            </div>
            
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setModal(false)} style={{padding:'8px 16px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'white',cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>Cancelar</button>
              <button onClick={guardar} disabled={saving||!mPerId} style={{padding:'8px 18px',borderRadius:9,border:'none',background:'#002F6C',color:'white',cursor:(!mPerId||saving)?'not-allowed':'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit',opacity:(!mPerId||saving)?.6:1}}>
                {saving?'Guardando...':'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}