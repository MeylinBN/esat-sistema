'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, addDays, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

// Inicio del año operativo: Semana 1 = 12 de Enero
const DIA_INICIO_SEMANA_1 = 12

function getSemanaInfo(fecha: Date) {
    const year = fecha.getFullYear()
    const inicioAnio = new Date(year, 0, DIA_INICIO_SEMANA_1)
    const diffTime = fecha.getTime() - inicioAnio.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const numSemana = Math.max(1, Math.floor(diffDays / 7) + 1)
    const lunes = new Date(inicioAnio)
    lunes.setDate(inicioAnio.getDate() + (numSemana - 1) * 7)
    const viernes = new Date(lunes)
    viernes.setDate(lunes.getDate() + 4)
    return {
        numSemana,
        key: `${year}-${numSemana}`,
        label: `Semana ${numSemana} (${format(lunes, 'dd/MM')} - ${format(viernes, 'dd/MM')})`,
        inicio: lunes,
        fin: viernes
    }
}

function formatSemanaLabel(semanaKey: string, fechaRegistro?: string) {
    try {
        if (!semanaKey || !semanaKey.includes('-')) return 'Semana no especificada'
        const [yearStr, weekStr] = semanaKey.split('-')
        const year = parseInt(yearStr)
        const week = parseInt(weekStr)
        if (isNaN(year) || isNaN(week)) return 'Semana inválida'
        const inicioAnio = new Date(year, 0, DIA_INICIO_SEMANA_1)
        const lunes = new Date(inicioAnio)
        lunes.setDate(inicioAnio.getDate() + (week - 1) * 7)
        const viernes = new Date(lunes)
        viernes.setDate(lunes.getDate() + 4)
        let diaTexto = ''
        if (fechaRegistro) {
            const fechaReg = new Date(fechaRegistro)
            const diffDays = Math.floor((fechaReg.getTime() - lunes.getTime()) / (1000 * 60 * 60 * 24))
            const diaSemana = diffDays + 1
            if (diaSemana >= 1 && diaSemana <= 5) {
                diaTexto = ` · día ${diaSemana}`
            }
        }
        return `Semana ${week} (${format(lunes, 'dd/MM')} - ${format(viernes, 'dd/MM')})${diaTexto}`
    } catch (error) {
        console.error('Error formateando semana:', semanaKey, error)
        return semanaKey || 'Semana desconocida'
    }
}

const ESTADO_CFG: Record<string,{bg:string,txt:string,label:string,border:string}> = {
  asignado:            {bg:'#e0f2fe',txt:'#0369a1',label:'📋 Asignado', border:'#bae6fd'},
  en_progreso:         {bg:'#dbeafe',txt:'#1d4ed8',label:'⚙️ En progreso', border:'#93c5fd'},
  pendiente_revision:  {bg:'#fef3c7',txt:'#b45309',label:'👁 Pendiente revisión', border:'#fcd34d'},
  subsanacion:         {bg:'#fce7f3',txt:'#be185d',label:'🔧 Subsanación', border:'#f9a8d4'},
  completada:          {bg:'#dcfce7',txt:'#15803d',label:'✅ Completada', border:'#86efac'},
  cancelada:           {bg:'#f1f5f9',txt:'#64748b',label:'❌ Cancelada', border:'#cbd5e1'},
}

export default function AvanceSemanalPage() {
  const supabase = createClient()
  const [personas, setPersonas] = useState<any[]>([])
  const [tareas, setTareas] = useState<any[]>([])
  const [avances, setAvances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selPer, setSelPer] = useState('')
  
  const [modalAv, setModalAv] = useState(false)
  const [mTarea, setMTarea] = useState<any>(null)
  const [mPct, setMPct] = useState(0)
  const [mSem, setMSem] = useState('')
  const [mEstado, setMEstado] = useState('')
  const [mComentario, setMComentario] = useState('')
  const [saving, setSaving] = useState(false)
  
  const [seccionesDesplegadas, setSeccionesDesplegadas] = useState<Record<string, boolean>>({})

  useEffect(()=>{load()},[])

  async function load(){
    try {
        const [p,t,a]=await Promise.all([
          supabase.from('personas').select('id,nombre,color,rol,subrol').eq('activo',true).order('nombre'),
          supabase.from('tareas').select('*,personas(nombre,color)').neq('estado','cancelada').order('created_at',{ascending:false}),
          supabase.from('avances_semanales').select('*').order('semana',{ascending:false}),
        ])
        setPersonas(p.data??[]);setTareas(t.data??[]);setAvances(a.data??[])
    } catch (error) {
        console.error('Error cargando datos:', error)
    } finally {
        setLoading(false)
    }
  }

  async function guardar(){
    if(!mTarea||!mSem) return
    setSaving(true)
    try {
        await supabase.from('avances_semanales').upsert(
          {tarea_id:mTarea.id,semana:mSem,porcentaje:mPct},
          {onConflict:'tarea_id,semana'}
        )
        // Si se cambió el estado en el modal, actualizarlo
        if(mEstado && mEstado !== mTarea.estado) {
          const updateData: any = {estado: mEstado}
          if(mEstado === 'subsanacion' && mComentario) {
            updateData.comentario_subsanacion = mComentario
          }
          await supabase.from('tareas').update(updateData).eq('id', mTarea.id)
        }
        if(mPct>=100) await supabase.from('tareas').update({estado:'completada'}).eq('id',mTarea.id)
    } catch (error) {
        console.error('Error guardando:', error)
    } finally {
        setModalAv(false);setSaving(false);load()
    }
  }

  function ultimoAv(tid:string){ 
    return avances.filter(a=>a.tarea_id===tid).sort((a,b)=>b.semana.localeCompare(a.semana))[0] 
  }

  function avancesPorSemana(tid:string) {
    const avancesTarea = avances.filter(a => a.tarea_id === tid)
    const porSemana: Record<string, any> = {}
    avancesTarea.forEach(av => {
      if (!porSemana[av.semana] || av.created_at > porSemana[av.semana].created_at) {
        porSemana[av.semana] = av
      }
    })
    return Object.values(porSemana).sort((a, b) => b.semana.localeCompare(a.semana))
  }

  function generarSemanasDisponibles() {
    const hoy = new Date()
    const infoHoy = getSemanaInfo(hoy)
    const semanas: any[] = []
    const infoAnterior = getSemanaInfo(subDays(infoHoy.inicio, 7))
    semanas.push({ ...infoAnterior, esAnterior: true, esActual: false })
    for (let i = 0; i <= 4; i++) {
      const fechaIteracion = addDays(infoHoy.inicio, i * 7)
      semanas.push({ ...getSemanaInfo(fechaIteracion), esAnterior: false, esActual: i === 0 })
    }
    return semanas
  }

  function toggleSeccion(personaId:string, estado:string){
    setSeccionesDesplegadas(prev=>({...prev,[`${personaId}-${estado}`]:!prev[`${personaId}-${estado}`]}))
  }

  const personasFiltro = selPer ? personas.filter(p=>p.id===selPer) : personas
  const tareasVistaPer = selPer ? tareas.filter(t=>t.persona_id===selPer) : tareas

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando avances...</div>

  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,color:'#002F6C'}}>Avance Semanal</h1>
          <p style={{fontSize:12,color:'#94a3b8',marginTop:2}}>Registro de progreso por semana</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <select value={selPer} onChange={e=>setSelPer(e.target.value)} style={{padding:'8px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13,fontFamily:'inherit',maxWidth:200}}>
            <option value="">Todas las personas</option>
            {personas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        {personasFiltro.filter(p=>tareasVistaPer.some(t=>t.persona_id===p.id)).map(p=>{
          const tpers=tareasVistaPer.filter(t=>t.persona_id===p.id)
          const stats = {
            total: tpers.length,
            asignadas: tpers.filter(t=>t.estado==='asignado').length,
            en_progreso: tpers.filter(t=>t.estado==='en_progreso').length,
            pendiente_revision: tpers.filter(t=>t.estado==='pendiente_revision').length,
            subsanacion: tpers.filter(t=>t.estado==='subsanacion').length,
            completadas: tpers.filter(t=>t.estado==='completada').length
          }
          
          return (
            <div key={p.id} style={{background:'white',borderRadius:14,border:'1.5px solid #e2e8f0',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
              {/* Header persona */}
              <div style={{padding:'14px 20px',borderBottom:'1px solid #e2e8f0',background:'#f8fafc',display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:38,height:38,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'white'}}>{p.nombre.charAt(0)}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:600}}>{p.nombre}</div>
                  <div style={{fontSize:11,color:'#94a3b8'}}>{p.rol==='SENATI'?`SENATI · ${p.subrol}`:p.subrol??p.rol}</div>
                </div>
                <div style={{display:'flex',gap:12}}>
                  <div style={{textAlign:'center'}}><div style={{fontSize:16,fontWeight:700,color:'#0369a1'}}>{stats.asignadas}</div><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>Asignadas</div></div>
                  <div style={{textAlign:'center'}}><div style={{fontSize:16,fontWeight:700,color:'#1d4ed8'}}>{stats.en_progreso}</div><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>Progreso</div></div>
                  <div style={{textAlign:'center'}}><div style={{fontSize:16,fontWeight:700,color:'#be185d'}}>{stats.subsanacion}</div><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>Subsanación</div></div>
                  <div style={{textAlign:'center'}}><div style={{fontSize:16,fontWeight:700,color:'#15803d'}}>{stats.completadas}</div><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>Completadas</div></div>
                </div>
              </div>

              <div style={{padding:'16px 20px'}}>
                {/* ASIGNADAS */}
                {stats.asignadas > 0 && (
                  <div style={{marginBottom:16}}>
                    <button onClick={()=>toggleSeccion(p.id,'asignado')} style={{width:'100%',padding:'10px',background:'#e0f2fe',border:'none',borderRadius:8,fontSize:12,fontWeight:600,color:'#0369a1',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span>📋 Asignadas ({stats.asignadas})</span>
                      <span>{seccionesDesplegadas[`${p.id}-asignado`]?'▲':'▼'}</span>
                    </button>
                    {seccionesDesplegadas[`${p.id}-asignado`] && (
                      <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6}}>
                        {tpers.filter(t=>t.estado==='asignado').map(t=>(
                          <div key={t.id} style={{padding:'10px',background:'#f0f9ff',borderRadius:8,border:'1px solid #bae6fd'}}>
                            <div style={{fontSize:12,fontWeight:600}}>{t.titulo}</div>
                            {t.fecha_limite && <div style={{fontSize:10,color:'#64748b',marginTop:2}}>📅 {format(new Date(t.fecha_limite+'T12:00:00'),"d MMM",{locale:es})}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* EN PROGRESO */}
                {stats.en_progreso > 0 && (
                  <div style={{marginBottom:16}}>
                    <button onClick={()=>toggleSeccion(p.id,'en_progreso')} style={{width:'100%',padding:'10px',background:'#dbeafe',border:'none',borderRadius:8,fontSize:12,fontWeight:600,color:'#1d4ed8',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span>⚙️ En progreso ({stats.en_progreso})</span>
                      <span>{seccionesDesplegadas[`${p.id}-en_progreso`]?'▲':'▼'}</span>
                    </button>
                    {seccionesDesplegadas[`${p.id}-en_progreso`] && (
                      <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6}}>
                        {tpers.filter(t=>t.estado==='en_progreso').map(t=>{
                          const avancesSemana = avancesPorSemana(t.id)
                          const ultimo = ultimoAv(t.id)
                          return (
                            <div key={t.id} style={{padding:'10px',background:'#eff6ff',borderRadius:8,border:'1px solid #bfdbfe'}}>
                              <div style={{fontSize:12,fontWeight:600}}>{t.titulo}</div>
                              {ultimo && <div style={{fontSize:10,color:'#1d4ed8',marginTop:2}}>{ultimo.porcentaje}% · {formatSemanaLabel(ultimo.semana, ultimo.created_at)}</div>}
                              <button onClick={()=>{setMTarea(t);setMPct(ultimo?.porcentaje??0);setMSem('');setMEstado(t.estado);setMComentario('');setModalAv(true)}} 
                                style={{marginTop:6,padding:'4px 8px',background:'#dbeafe',color:'#1d4ed8',border:'1px solid #93c5fd',borderRadius:6,fontSize:10,cursor:'pointer',fontWeight:600}}>
                                + Registrar avance
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
                
                {/* PENDIENTE REVISIÓN */}
                {stats.pendiente_revision > 0 && (
                  <div style={{marginBottom:16}}>
                    <button onClick={()=>toggleSeccion(p.id,'pendiente_revision')} style={{width:'100%',padding:'10px',background:'#fef3c7',border:'none',borderRadius:8,fontSize:12,fontWeight:600,color:'#b45309',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span>👁 Pendiente revisión ({stats.pendiente_revision})</span>
                      <span>{seccionesDesplegadas[`${p.id}-pendiente_revision`]?'▲':'▼'}</span>
                    </button>
                    {seccionesDesplegadas[`${p.id}-pendiente_revision`] && (
                      <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6}}>
                        {tpers.filter(t=>t.estado==='pendiente_revision').map(t=>{
                          const ultimo = ultimoAv(t.id)
                          return (
                            <div key={t.id} style={{padding:'10px',background:'#fffbeb',borderRadius:8,border:'1px solid #fcd34d'}}>
                              <div style={{fontSize:12,fontWeight:600}}>{t.titulo}</div>
                              {ultimo && <div style={{fontSize:10,color:'#b45309',marginTop:2}}>{ultimo.porcentaje}% · {formatSemanaLabel(ultimo.semana, ultimo.created_at)}</div>}
                              <button onClick={()=>{setMTarea(t);setMPct(ultimo?.porcentaje??0);setMSem('');setMEstado(t.estado);setMComentario('');setModalAv(true)}} 
                                style={{marginTop:6,padding:'4px 8px',background:'#fef3c7',color:'#b45309',border:'1px solid #fcd34d',borderRadius:6,fontSize:10,cursor:'pointer',fontWeight:600}}>
                                + Registrar avance / Revisar
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
                
                {/* SUBSANACIÓN */}
                {stats.subsanacion > 0 && (
                  <div style={{marginBottom:16}}>
                    <button onClick={()=>toggleSeccion(p.id,'subsanacion')} style={{width:'100%',padding:'10px',background:'#fce7f3',border:'none',borderRadius:8,fontSize:12,fontWeight:600,color:'#be185d',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span>🔧 En subsanación ({stats.subsanacion})</span>
                      <span>{seccionesDesplegadas[`${p.id}-subsanacion`]?'▲':'▼'}</span>
                    </button>
                    {seccionesDesplegadas[`${p.id}-subsanacion`] && (
                      <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6}}>
                        {tpers.filter(t=>t.estado==='subsanacion').map(t=>{
                          const ultimo = ultimoAv(t.id)
                          return (
                            <div key={t.id} style={{padding:'10px',background:'#fdf2f8',borderRadius:8,border:'1px solid #f9a8d4'}}>
                              <div style={{fontSize:12,fontWeight:600}}>{t.titulo}</div>
                              {t.comentario_subsanacion && <div style={{fontSize:10,color:'#be185d',marginTop:2,fontStyle:'italic'}}>"{t.comentario_subsanacion}"</div>}
                              {ultimo && <div style={{fontSize:10,color:'#be185d',marginTop:2}}>{ultimo.porcentaje}% · {formatSemanaLabel(ultimo.semana, ultimo.created_at)}</div>}
                              <button onClick={()=>{setMTarea(t);setMPct(ultimo?.porcentaje??0);setMSem('');setMEstado(t.estado);setMComentario(t.comentario_subsanacion||'');setModalAv(true)}} 
                                style={{marginTop:6,padding:'4px 8px',background:'#fce7f3',color:'#be185d',border:'1px solid #f9a8d4',borderRadius:6,fontSize:10,cursor:'pointer',fontWeight:600}}>
                                + Corregir y enviar
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
                
                {/* COMPLETADAS */}
                {stats.completadas > 0 && (
                  <div>
                    <button onClick={()=>toggleSeccion(p.id,'completada')} style={{width:'100%',padding:'10px',background:'#dcfce7',border:'none',borderRadius:8,fontSize:12,fontWeight:600,color:'#15803d',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span>✅ Completadas ({stats.completadas})</span>
                      <span>{seccionesDesplegadas[`${p.id}-completada`]?'▲':'▼'}</span>
                    </button>
                    {seccionesDesplegadas[`${p.id}-completada`] && (
                      <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6}}>
                        {tpers.filter(t=>t.estado==='completada').map(t=>{
                          const ua=ultimoAv(t.id)
                          return (
                            <div key={t.id} style={{padding:'10px',background:'#f0fdf4',borderRadius:8,border:'1px solid #86efac',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                              <span style={{fontSize:12,fontWeight:600,color:'#15803d'}}>{t.titulo}</span>
                              <span style={{fontSize:11,color:'#15803d',fontWeight:700}}>
                                100% · {ua?.semana ? formatSemanaLabel(ua.semana, ua.created_at) : '—'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
                
                {tpers.length===0 && (
                  <div style={{textAlign:'center',padding:32,color:'#94a3b8',fontSize:13}}>Sin tareas registradas</div>
                )}
              </div>
            </div>
          )
        })}
        
        {personasFiltro.filter(p=>tareasVistaPer.some(t=>t.persona_id===p.id)).length===0 && (
          <div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13}}>No hay personas o tareas para mostrar</div>
        )}
      </div>

      {/* Modal avance - ACTUALIZADO */}
      {modalAv&&mTarea&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={e=>{if(e.target===e.currentTarget)setModalAv(false)}}>
          <div style={{background:'white',borderRadius:18,padding:24,width:'100%',maxWidth:480,boxShadow:'0 24px 80px rgba(0,0,0,.25)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{fontSize:16,fontWeight:700,margin:0}}>Registrar avance</h3>
              <button onClick={()=>setModalAv(false)} style={{width:28,height:28,borderRadius:'50%',border:'none',background:'#f1f5f9',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            <div style={{marginBottom:14,padding:'10px 14px',background:'#eff6ff',borderRadius:9,fontSize:13,fontWeight:600,color:'#002F6C',border:'1px solid #bfdbfe'}}>{mTarea.titulo}</div>
            
            {/* Selector de semanas */}
            <div style={{marginBottom:12}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Semana *</label>
              <select 
                value={mSem} 
                onChange={e=>setMSem(e.target.value)}
                style={{width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,outline:'none'}}
              >
                <option value="">Seleccionar semana...</option>
                {generarSemanasDisponibles().map((sem:any)=>(
                  <option key={sem.key} value={sem.key}>
                    {sem.esAnterior ? '⬅️ ' : sem.esActual ? '📍 ' : ''}{sem.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Selector de estado */}
            <div style={{marginBottom:12}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Estado de la tarea</label>
              <select 
                value={mEstado} 
                onChange={e=>setMEstado(e.target.value)}
                style={{width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,outline:'none'}}
              >
                {Object.entries(ESTADO_CFG).map(([k,v])=>(
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            
            {/* Comentario para subsanación */}
            {mEstado === 'subsanacion' && (
              <div style={{marginBottom:12}}>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#be185d',marginBottom:5,textTransform:'uppercase'}}>Comentario de corrección</label>
                <textarea 
                  value={mComentario} 
                  onChange={e=>setMComentario(e.target.value)}
                  rows={2}
                  placeholder="Indica qué debe corregir el estudiante..."
                  style={{width:'100%',padding:'10px 12px',border:'1.5px solid #f9a8d4',borderRadius:9,fontFamily:'inherit',fontSize:13,resize:'vertical'}}
                />
              </div>
            )}
            
            {/* Porcentaje de avance */}
            <div style={{marginBottom:8}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Avance: {mPct}%</label>
              <input type="range" min={0} max={100} step={5} value={mPct} onChange={e=>setMPct(+e.target.value)} style={{width:'100%',accentColor:'#002F6C'}}/>
            </div>
            <div style={{height:8,background:'#e2e8f0',borderRadius:10,overflow:'hidden',marginBottom:14}}>
              <div style={{height:'100%',width:`${mPct}%`,background:mPct>=100?'#15803d':'#2563C8',borderRadius:10,transition:'width .3s'}}/>
            </div>
            {mPct>=100&&<p style={{fontSize:12,color:'#15803d',fontWeight:600,textAlign:'center',marginBottom:12}}>✓ Se marcará como completada</p>}
            
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setModalAv(false)} style={{padding:'8px 16px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'white',cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>Cancelar</button>
              <button onClick={guardar} disabled={saving||!mSem} style={{padding:'8px 18px',borderRadius:9,border:'none',background:'#002F6C',color:'white',cursor:(!mSem||saving)?'not-allowed':'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit',opacity:(!mSem||saving)?0.6:1}}>{saving?'Guardando...':'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}