'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachWeekOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'

type Vista = 'semana' | 'mes'

export default function AvanceSemanalPage() {
  const supabase = createClient()
  const [personas, setPersonas] = useState<any[]>([])
  const [tareas, setTareas] = useState<any[]>([])
  const [avances, setAvances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<Vista>('semana')
  const [selPer, setSelPer] = useState('')
  const [selSem, setSelSem] = useState('')
  const [selMes, setSelMes] = useState(format(new Date(), 'yyyy-MM'))
  const [modalAv, setModalAv] = useState(false)
  const [mTarea, setMTarea] = useState<any>(null)
  const [mPct, setMPct] = useState(0)
  const [mSem, setMSem] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(()=>{load()},[])

  async function load(){
    const [p,t,a]=await Promise.all([
      supabase.from('personas').select('id,nombre,color,rol,subrol').eq('activo',true).order('nombre'),
      supabase.from('tareas').select('*,personas(nombre,color)').neq('estado','cancelada').order('created_at',{ascending:false}),
      supabase.from('avances_semanales').select('*').order('semana',{ascending:false}),
    ])
    setPersonas(p.data??[]);setTareas(t.data??[]);setAvances(a.data??[])
    setLoading(false)
  }

  async function guardar(){
    if(!mTarea||!mSem) return
    setSaving(true)
    await supabase.from('avances_semanales').upsert(
      {tarea_id:mTarea.id,semana:mSem,porcentaje:mPct},
      {onConflict:'tarea_id,semana'}
    )
    if(mPct>=100) await supabase.from('tareas').update({estado:'completada'}).eq('id',mTarea.id)
    setModalAv(false);setSaving(false);load()
  }

  // Generar semanas del mes seleccionado
  const generarSemanasDelMes = () => {
    const [year, month] = selMes.split('-').map(Number)
    const inicio = startOfMonth(new Date(year, month - 1))
    const fin = endOfMonth(new Date(year, month - 1))
    
    const semanas = eachWeekOfInterval({ start: inicio, end: fin }, { locale: es })
    
    return semanas.map(semana => {
      const inicioSem = startOfWeek(semana, { locale: es })
      const finSem = endOfWeek(semana, { locale: es })
      const numSem = format(semana, 'w')
      const label = `Semana ${numSem} (${format(inicioSem, 'dd/MM')} - ${format(finSem, 'dd/MM')})`
      const key = format(semana, 'yyyy-w')
      
      return { key, label, inicio: inicioSem, fin: finSem, numSem }
    })
  }

  function avTarea(tid:string, sem:string){ 
    return avances.find(a=>a.tarea_id===tid && a.semana===sem) 
  }
  
  function ultimoAv(tid:string){ 
    return avances.filter(a=>a.tarea_id===tid).sort((a,b)=>b.semana.localeCompare(a.semana))[0] 
  }

  // Obtener todos los avances de una tarea ordenados por fecha
  function historialAvances(tid:string) {
    return avances
      .filter(a => a.tarea_id === tid)
      .sort((a, b) => a.semana.localeCompare(b.semana))
  }

  const personasFiltro = selPer ? personas.filter(p=>p.id===selPer) : personas
  const tareasVistaPer = selPer ? tareas.filter(t=>t.persona_id===selPer) : tareas
  const semanasDelMes = generarSemanasDelMes()

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando avances...</div>

  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,color:'#002F6C'}}>Avance Semanal</h1>
          <p style={{fontSize:12,color:'#94a3b8',marginTop:2}}>Progreso de tareas · Visualización por semana o mes</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {/* Selector de mes */}
          <select 
            value={selMes} 
            onChange={e=>setSelMes(e.target.value)} 
            style={{padding:'8px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13,fontFamily:'inherit'}}
          >
            {Array.from({ length: 12 }, (_, i) => {
              const val = format(new Date(2026, i, 1), 'yyyy-MM')
              const label = format(new Date(2026, i, 1), 'MMMM yyyy', { locale: es })
              return <option key={val} value={val}>{label}</option>
            })}
          </select>
          
          {/* Selector persona */}
          <select value={selPer} onChange={e=>setSelPer(e.target.value)} style={{padding:'8px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13,fontFamily:'inherit',maxWidth:200}}>
            <option value="">Todas las personas</option>
            {personas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          
          {/* Tabs vista */}
          <div style={{display:'flex',background:'white',border:'1px solid #e2e8f0',borderRadius:9,overflow:'hidden'}}>
            {(['semana','mes'] as Vista[]).map(v=>(
              <button key={v} onClick={()=>setVista(v)} style={{padding:'8px 16px',border:'none',fontSize:12,fontWeight:vista===v?600:400,cursor:'pointer',fontFamily:'inherit',background:vista===v?'#002F6C':'transparent',color:vista===v?'white':'#475569'}}>
                {v==='semana'?'📅 Por Semana':'📆 Por Mes'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {vista==='semana' ? (
        /* VISTA POR SEMANA */
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {personasFiltro.filter(p=>tareasVistaPer.some(t=>t.persona_id===p.id)).map(p=>{
            const tpers=tareasVistaPer.filter(t=>t.persona_id===p.id)
            const activas=tpers.filter(t=>t.estado!=='completada')
            const comp=tpers.filter(t=>t.estado==='completada')
            return (
              <div key={p.id} style={{background:'white',borderRadius:14,border:'1.5px solid #e2e8f0',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
                <div style={{padding:'14px 20px',borderBottom:'1px solid #e2e8f0',background:'#f8fafc',display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:38,height:38,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'white'}}>{p.nombre.charAt(0)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600}}>{p.nombre}</div>
                    <div style={{fontSize:11,color:'#94a3b8'}}>{p.rol==='SENATI'?`SENATI · ${p.subrol}`:p.subrol??p.rol}</div>
                  </div>
                  <div style={{display:'flex',gap:16}}>
                    <div style={{textAlign:'center'}}><div style={{fontSize:20,fontWeight:700,color:'#1d4ed8'}}>{activas.length}</div><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>Activas</div></div>
                    <div style={{textAlign:'center'}}><div style={{fontSize:20,fontWeight:700,color:'#15803d'}}>{comp.length}</div><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>Completadas</div></div>
                  </div>
                </div>

                {/* Tareas activas con semanas del mes seleccionado */}
                <div style={{padding:'14px 20px'}}>
                  {activas.length>0&&(
                    <>
                      <div style={{fontSize:11,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>En progreso / Pendientes</div>
                      {activas.map(t=>{
                        const ua=ultimoAv(t.id)
                        const historial = historialAvances(t.id)
                        return (
                          <div key={t.id} style={{marginBottom:12,padding:'10px 14px',background:'#f8fafc',borderRadius:10,border:'1px solid #e2e8f0'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,justifyContent:'space-between',flexWrap:'wrap'}}>
                              <span style={{fontSize:13,fontWeight:600}}>{t.titulo}</span>
                              <button onClick={()=>{setMTarea(t);setMPct(ua?.porcentaje??0);setMSem('');setModalAv(true)}}
                                style={{background:'#dbeafe',color:'#1d4ed8',border:'1px solid #93c5fd',borderRadius:7,padding:'4px 10px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>
                                + Avance
                              </button>
                            </div>
                            
                            {/* Historial de avances (últimos 4 registros) */}
                            {historial.length > 0 && (
                              <div style={{marginBottom:8,padding:'8px 10px',background:'white',borderRadius:8,border:'1px solid #e2e8f0'}}>
                                <div style={{fontSize:10,fontWeight:600,color:'#475569',marginBottom:6,textTransform:'uppercase'}}>📊 Historial de Avances</div>
                                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                                  {historial.slice(-4).map((av,idx)=>(
                                    <div key={idx} style={{flex:'1 1 80px',padding:'6px 8px',background:'#f8fafc',borderRadius:6,border:'1px solid #e2e8f0',textAlign:'center'}}>
                                      <div style={{fontSize:9,color:'#94a3b8',marginBottom:2}}>{av.semana}</div>
                                      <div style={{fontSize:12,fontWeight:700,color:av.porcentaje>=100?'#15803d':'#002F6C'}}>{av.porcentaje}%</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Semanas del mes actual */}
                            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                              {semanasDelMes.map(sem=>{
                                const av=avTarea(t.id,sem.key)
                                return (
                                  <div key={sem.key} style={{flex:'1 1 100px',padding:'6px 10px',background:'white',borderRadius:8,border:'1px solid #e2e8f0',textAlign:'center'}}>
                                    <div style={{fontSize:9,color:'#94a3b8',marginBottom:3,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{sem.label.split(' (')[0]}</div>
                                    {av?(
                                      <>
                                        <div style={{fontSize:14,fontWeight:700,color:av.porcentaje>=100?'#15803d':'#002F6C'}}>{av.porcentaje}%</div>
                                        <div style={{height:3,background:'#e2e8f0',borderRadius:10,overflow:'hidden',marginTop:3}}>
                                          <div style={{height:'100%',width:`${av.porcentaje}%`,background:av.porcentaje>=100?'#15803d':'#2563C8',borderRadius:10}}/>
                                        </div>
                                      </>
                                    ):<div style={{fontSize:12,color:'#cbd5e1'}}>—</div>}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}

                  {comp.length>0&&(
                    <details style={{marginTop:activas.length>0?8:0}}>
                      <summary style={{fontSize:12,fontWeight:600,color:'#15803d',cursor:'pointer',padding:'6px 0',userSelect:'none'}}>
                        ✅ {comp.length} tarea(s) completada(s) — ver
                      </summary>
                      <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:8}}>
                        {comp.map(t=>{
                          const ua=ultimoAv(t.id)
                          return (
                            <div key={t.id} style={{padding:'8px 12px',background:'#f0fdf4',borderRadius:9,border:'1px solid #86efac',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                              <span style={{fontSize:12,fontWeight:500,color:'#15803d'}}>{t.titulo}</span>
                              <span style={{fontSize:11,color:'#15803d',fontWeight:600}}>100% · {ua?.semana??'—'}</span>
                            </div>
                          )
                        })}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            )
          })}
          {personasFiltro.filter(p=>tareasVistaPer.some(t=>t.persona_id===p.id)).length===0&&(
            <div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13}}>Sin tareas registradas</div>
          )}
        </div>

      ) : (
        /* VISTA POR MES */
        <div>
          <div style={{background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:12,padding:'14px 18px',marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:600,color:'#1e40af',marginBottom:4}}>
              📆 {format(new Date(selMes + '-01'), 'MMMM yyyy', { locale: es }).toUpperCase()}
            </div>
            <div style={{fontSize:11,color:'#475569'}}>
              {semanasDelMes.length} semanas · {semanasDelMes[0]?.label.split(' (')[1]?.replace(')','')} - {semanasDelMes[semanasDelMes.length-1]?.label.split(' (')[1]?.replace(')','')}
            </div>
          </div>

          {personasFiltro.filter(p=>tareasVistaPer.some(t=>t.persona_id===p.id)).map(p=>{
            const tpers=tareasVistaPer.filter(t=>t.persona_id===p.id)
            return (
              <div key={p.id} style={{background:'white',borderRadius:14,border:'1.5px solid #e2e8f0',marginBottom:16,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
                <div style={{padding:'14px 20px',borderBottom:'1.5px solid #e2e8f0',background:'#f8fafc',display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:40,height:40,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700,color:'white'}}>{p.nombre.charAt(0)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15,fontWeight:600,color:'#0f172a'}}>{p.nombre}</div>
                    <div style={{fontSize:11,color:'#64748b'}}>{p.rol} {p.subrol && `· ${p.subrol}`}</div>
                  </div>
                </div>
                
                <div style={{padding:'16px 20px'}}>
                  {tpers.filter(t=>t.estado!=='completada').map(t=>{
                    const historial = historialAvances(t.id)
                    const ultimo = historial[historial.length-1]
                    
                    return (
                      <div key={t.id} style={{marginBottom:16,padding:'12px 14px',background:'#f8fafc',borderRadius:10,border:'1px solid #e2e8f0'}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:13,fontWeight:700,color:'#0f172a'}}>{t.titulo}</span>
                            <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:'#dbeafe',color:'#1d4ed8',fontWeight:600}}>
                              {t.estado==='en_progreso'?'⚙️ En progreso':'⏳ Pendiente'}
                            </span>
                          </div>
                          {ultimo && (
                            <span style={{fontSize:12,fontWeight:700,color:ultimo.porcentaje>=100?'#15803d':'#002F6C'}}>
                              Último: {ultimo.porcentaje}%
                            </span>
                          )}
                        </div>
                        
                        {/* Timeline de avances del mes */}
                        {historial.length > 0 && (
                          <div style={{marginTop:8}}>
                            <div style={{fontSize:10,fontWeight:600,color:'#64748b',marginBottom:6,textTransform:'uppercase'}}>
                              Progreso durante {format(new Date(selMes + '-01'), 'MMMM', { locale: es })}
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:4}}>
                              {historial.map((av,idx)=>(
                                <div key={idx} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                                  <div style={{width:'100%',height:6,background:'#e2e8f0',borderRadius:10,overflow:'hidden'}}>
                                    <div style={{height:'100%',width:`${av.porcentaje}%`,background:av.porcentaje>=100?'#15803d':'#2563C8',borderRadius:10}}/>
                                  </div>
                                  <span style={{fontSize:9,color:'#94a3b8'}}>{av.porcentaje}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal avance */}
      {modalAv&&mTarea&&(
        <div className="mo" onClick={e=>{if(e.target===e.currentTarget)setModalAv(false)}}>
          <div className="mo-box">
            <div className="mo-head"><h3>Registrar avance</h3><button className="mo-close" onClick={()=>setModalAv(false)}>×</button></div>
            <div style={{marginBottom:14,padding:'10px 14px',background:'#eff6ff',borderRadius:9,fontSize:13,fontWeight:600,color:'#002F6C'}}>{mTarea.titulo}</div>
            <div className="ig" style={{marginBottom:12}}><label>Semana</label><input value={mSem} onChange={e=>setMSem(e.target.value)} placeholder="Ej: Semana 26 (25/05 - 29/05)"/></div>
            <div className="ig" style={{marginBottom:8}}><label>Avance: {mPct}%</label><input type="range" min={0} max={100} step={5} value={mPct} onChange={e=>setMPct(+e.target.value)} style={{width:'100%',accentColor:'#002F6C'}}/></div>
            <div style={{height:8,background:'#e2e8f0',borderRadius:10,overflow:'hidden',marginBottom:14}}>
              <div style={{height:'100%',width:`${mPct}%`,background:mPct>=100?'#15803d':'#2563C8',borderRadius:10,transition:'width .3s'}}/>
            </div>
            {mPct>=100&&<p style={{fontSize:12,color:'#15803d',fontWeight:600,textAlign:'center',marginBottom:12}}>✓ Se marcará como completada</p>}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-s" onClick={()=>setModalAv(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={guardar} disabled={saving||!mSem}>{saving?'Guardando...':'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}