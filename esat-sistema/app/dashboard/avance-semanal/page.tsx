'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Vista = 'persona' | 'semana'
const SEMANAS_RECIENTES = 4

export default function AvanceSemanalPage() {
  const supabase = createClient()
  const [personas, setPersonas] = useState<any[]>([])
  const [tareas, setTareas] = useState<any[]>([])
  const [avances, setAvances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<Vista>('persona')
  const [selPer, setSelPer] = useState('')
  const [selSem, setSelSem] = useState('')
  const [modalAv, setModalAv] = useState(false)
  const [mTarea, setMTarea] = useState<any>(null)
  const [mPct, setMPct] = useState(0)
  const [mSem, setMSem] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(()=>{load()},[])

  async function load(){
    const [p,t,a] = await Promise.all([
      supabase.from('personas').select('id,nombre,color,rol,subrol,area').eq('activo',true).order('nombre'),
      supabase.from('tareas').select('*,personas(nombre,color)').neq('estado','cancelada').order('created_at',{ascending:false}),
      supabase.from('avances_semanales').select('*').order('semana',{ascending:false}),
    ])
    setPersonas(p.data??[]); setTareas(t.data??[]); setAvances(a.data??[])
    setLoading(false)
  }

  async function guardar(){
    if(!mTarea || !mSem) return
    setSaving(true)
    await supabase.from('avances_semanales').upsert(
      {tarea_id:mTarea.id, semana:mSem, porcentaje:mPct},
      {onConflict:'tarea_id,semana'}
    )
    if(mPct >= 100) await supabase.from('tareas').update({estado:'completada'}).eq('id', mTarea.id)
    setModalAv(false); setSaving(false); load()
  }

  // Obtener semanas únicas y tomar las últimas 4
  const semanasExistentes = avances
  .map(a => a.semana)
  .filter((v, i, a) => a.indexOf(v) === i)
  .sort((a, b) => b.localeCompare(a))
  const ultimas4 = semanasExistentes.slice(0, SEMANAS_RECIENTES)

  function avTarea(tid:string, sem:string){ 
    return avances.find(a=>a.tarea_id===tid && a.semana===sem) 
  }
  function ultimoAv(tid:string){ 
    return avances.filter(a=>a.tarea_id===tid).sort((a:any,b:any)=>b.semana.localeCompare(a.semana))[0] 
  }

  const personasFiltro = selPer ? personas.filter(p=>p.id===selPer) : personas
  const tareasVistaPer = selPer ? tareas.filter(t=>t.persona_id===selPer) : tareas

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando avances...</div>

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,color:'#002F6C'}}>Avance Semanal</h1>
          <p style={{fontSize:12,color:'#94a3b8',marginTop:2}}>Progreso de tareas · últimas {SEMANAS_RECIENTES} semanas</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <select value={selPer} onChange={e=>setSelPer(e.target.value)} style={{padding:'8px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13,fontFamily:'inherit',maxWidth:200}}>
            <option value="">Todas las personas</option>
            {personas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <div style={{display:'flex',background:'white',border:'1px solid #e2e8f0',borderRadius:9,overflow:'hidden'}}>
            {(['persona','semana'] as Vista[]).map(v=>(
              <button key={v} onClick={()=>setVista(v)} style={{padding:'8px 16px',border:'none',fontSize:12,fontWeight:vista===v?600:400,cursor:'pointer',fontFamily:'inherit',background:vista===v?'#002F6C':'transparent',color:vista===v?'white':'#475569'}}>
                {v==='persona'?'👤 Por persona':'📅 Por semana'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {vista === 'persona' ? (
        /* VISTA POR PERSONA */
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {personasFiltro.filter(p=>tareasVistaPer.some(t=>t.persona_id===p.id)).map(p=>{
            const tpers = tareasVistaPer.filter(t=>t.persona_id===p.id)
            const activas = tpers.filter(t=>t.estado!=='completada')
            const comp = tpers.filter(t=>t.estado==='completada')
            return (
              <div key={p.id} style={{background:'white',borderRadius:14,border:'1.5px solid #e2e8f0',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
                <div style={{padding:'14px 20px',borderBottom:'1px solid #e2e8f0',background:'#f8fafc',display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:38,height:38,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'white'}}>{p.nombre.charAt(0)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600}}>{p.nombre}</div>
                    <div style={{fontSize:11,color:'#94a3b8'}}>{p.rol==='SENATI'?`SENATI · ${p.subrol}`:p.subrol??p.rol} · {p.area}</div>
                  </div>
                  <div style={{display:'flex',gap:16}}>
                    <div style={{textAlign:'center'}}><div style={{fontSize:20,fontWeight:700,color:'#1d4ed8'}}>{activas.length}</div><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>Activas</div></div>
                    <div style={{textAlign:'center'}}><div style={{fontSize:20,fontWeight:700,color:'#15803d'}}>{comp.length}</div><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>Completadas</div></div>
                  </div>
                </div>

                <div style={{padding:'14px 20px'}}>
                  {activas.length>0 && (
                    <>
                      <div style={{fontSize:11,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>En progreso / Pendientes</div>
                      {activas.map(t=>{
                        const ua = ultimoAv(t.id)
                        return (
                          <div key={t.id} style={{marginBottom:12,padding:'10px 14px',background:'#f8fafc',borderRadius:10,border:'1px solid #e2e8f0'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,justifyContent:'space-between',flexWrap:'wrap'}}>
                              <span style={{fontSize:13,fontWeight:600}}>{t.titulo}</span>
                              <button onClick={()=>{setMTarea(t);setMPct(ua?.porcentaje??0);setMSem('');setModalAv(true)}}
                                style={{background:'#dbeafe',color:'#1d4ed8',border:'1px solid #93c5fd',borderRadius:7,padding:'4px 10px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>
                                + Avance
                              </button>
                            </div>
                            {ultimas4.length>0 && (
                              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                                {ultimas4.map(sem=>{
                                  const av = avTarea(t.id, sem)
                                  return (
                                    <div key={sem} style={{flex:'1 1 100px',padding:'6px 10px',background:'white',borderRadius:8,border:'1px solid #e2e8f0',textAlign:'center'}}>
                                      <div style={{fontSize:9,color:'#94a3b8',marginBottom:3,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{sem}</div>
                                      {av ? (
                                        <>
                                          <div style={{fontSize:14,fontWeight:700,color:av.porcentaje>=100?'#15803d':'#002F6C'}}>{av.porcentaje}%</div>
                                          <div style={{height:3,background:'#e2e8f0',borderRadius:10,overflow:'hidden',marginTop:3}}>
                                            <div style={{height:'100%',width:`${av.porcentaje}%`,background:av.porcentaje>=100?'#15803d':'#2563C8',borderRadius:10}}/>
                                          </div>
                                        </>
                                      ) : <div style={{fontSize:12,color:'#cbd5e1'}}>—</div>}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </>
                  )}

                  {comp.length>0 && (
                    <details style={{marginTop:activas.length>0?8:0}}>
                      <summary style={{fontSize:12,fontWeight:600,color:'#15803d',cursor:'pointer',padding:'6px 0',userSelect:'none'}}>
                        ✅ {comp.length} tarea(s) completada(s) — ver
                      </summary>
                      <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:8}}>
                        {comp.map(t=>{
                          const ua = ultimoAv(t.id)
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
          {personasFiltro.filter(p=>tareasVistaPer.some(t=>t.persona_id===p.id)).length===0 && (
            <div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13}}>Sin tareas registradas</div>
          )}
        </div>
      ) : (
        /* VISTA POR SEMANA */
        <div>
          <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
            <button onClick={()=>setSelSem('')} style={{padding:'7px 14px',borderRadius:8,border:`1.5px solid ${selSem===''?'#002F6C':'#e2e8f0'}`,background:selSem===''?'#002F6C':'white',color:selSem===''?'white':'#475569',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
              Todas
            </button>
            {ultimas4.map(sem=>(
              <button key={sem} onClick={()=>setSelSem(sem)} style={{padding:'7px 14px',borderRadius:8,border:`1.5px solid ${selSem===sem?'#002F6C':'#e2e8f0'}`,background:selSem===sem?'#002F6C':'white',color:selSem===sem?'white':'#475569',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>
                {sem}
              </button>
            ))}
          </div>

          {(selSem ? [selSem] : ultimas4).map(sem=>{
            const avsem = avances.filter(a=>a.semana===sem)
            if(!avsem.length) return null
            return (
              <div key={sem} style={{background:'white',borderRadius:14,border:'1.5px solid #e2e8f0',marginBottom:14,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
                <div style={{padding:'12px 20px',borderBottom:'1px solid #e2e8f0',background:'#f8fafc',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:14,fontWeight:700,color:'#002F6C'}}>{sem}</span>
                  <span style={{fontSize:12,color:'#94a3b8'}}>{avsem.length} registros</span>
                </div>
                <div style={{padding:'12px 20px',display:'flex',flexDirection:'column',gap:6}}>
                  {avsem.map(av=>{
                    const t = tareas.find(x=>x.id===av.tarea_id)
                    const pers = t ? personas.find(p=>p.id===t.persona_id) : null
                    if(!t) return null
                    return (
                      <div key={av.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 12px',background:'#f8fafc',borderRadius:9}}>
                        {pers && <div style={{width:26,height:26,borderRadius:'50%',background:pers.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>{pers.nombre.charAt(0)}</div>}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{t.titulo}</div>
                          {pers && <div style={{fontSize:10,color:'#94a3b8'}}>{pers.nombre}</div>}
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                          <div style={{width:80,height:5,background:'#e2e8f0',borderRadius:10,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${av.porcentaje}%`,background:av.porcentaje>=100?'#15803d':'#2563C8',borderRadius:10}}/>
                          </div>
                          <span style={{fontSize:13,fontWeight:700,color:av.porcentaje>=100?'#15803d':'#002F6C',minWidth:36,textAlign:'right'}}>{av.porcentaje}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal para registrar avance */}
      {modalAv && mTarea && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
          onClick={e=>{if(e.target===e.currentTarget)setModalAv(false)}}>
          <div style={{background:'white',borderRadius:18,padding:24,width:'100%',maxWidth:420,boxShadow:'0 24px 80px rgba(0,0,0,.25)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{fontSize:16,fontWeight:700}}>Registrar avance</h3>
              <button onClick={()=>setModalAv(false)} style={{width:28,height:28,borderRadius:'50%',border:'none',background:'#f1f5f9',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            <div style={{marginBottom:14,padding:'10px 14px',background:'#eff6ff',borderRadius:9,fontSize:13,fontWeight:600,color:'#002F6C'}}>{mTarea.titulo}</div>
            <div style={{marginBottom:12}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase',letterSpacing:'.04em'}}>Semana</label>
              <input value={mSem} onChange={e=>setMSem(e.target.value)} placeholder="Ej: Sem 19 (5-9 may)"
                style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,outline:'none'}}/>
            </div>
            <div style={{marginBottom:8}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase',letterSpacing:'.04em'}}>Avance: {mPct}%</label>
              <input type="range" min={0} max={100} step={5} value={mPct} onChange={e=>setMPct(+e.target.value)} style={{width:'100%',accentColor:'#002F6C'}}/>
            </div>
            <div style={{height:8,background:'#e2e8f0',borderRadius:10,overflow:'hidden',marginBottom:16}}>
              <div style={{height:'100%',width:`${mPct}%`,background:mPct>=100?'#15803d':'#2563C8',borderRadius:10,transition:'width .3s'}}/>
            </div>
            {mPct>=100 && <p style={{fontSize:12,color:'#15803d',fontWeight:600,textAlign:'center',marginBottom:12}}>✓ Se marcará como completada</p>}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setModalAv(false)} style={{padding:'8px 16px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'white',cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>Cancelar</button>
              <button onClick={guardar} disabled={saving||!mSem}
                style={{padding:'8px 18px',borderRadius:9,border:'none',background:'#002F6C',color:'white',cursor:(!mSem||saving)?'not-allowed':'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit',opacity:(!mSem||saving)?.6:1}}>
                {saving?'Guardando...':'Guardar avance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}