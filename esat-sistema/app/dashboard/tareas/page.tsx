'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const PRIO_CFG: Record<string,{bg:string,txt:string,label:string}> = {
  alta: {bg:'#fee2e2',txt:'#b91c1c',label:'🔴 Alta'},
  media:{bg:'#fef3c7',txt:'#b45309',label:'🟡 Media'},
  baja: {bg:'#dcfce7',txt:'#15803d',label:'🟢 Baja'},
}
const ESTADO_CFG: Record<string,{bg:string,txt:string,label:string}> = {
  pendiente:   {bg:'#f1f5f9',txt:'#94a3b8',label:'Pendiente'},
  en_progreso: {bg:'#dbeafe',txt:'#1d4ed8',label:'En progreso'},
  completada:  {bg:'#dcfce7',txt:'#15803d',label:'✓ Completada'},
  cancelada:   {bg:'#fee2e2',txt:'#b91c1c',label:'Cancelada'},
}

export default function TareasPage() {
  const supabase = createClient()
  const [personas, setPersonas]   = useState<any[]>([])
  const [tareas,   setTareas]     = useState<any[]>([])
  const [avances,  setAvances]    = useState<any[]>([])
  const [loading,  setLoading]    = useState(true)
  const [vista,    setVista]      = useState<'lista'|'persona'>('lista')
  const [fPer,     setFPer]       = useState('')
  const [fEst,     setFEst]       = useState('')
  const [modal,    setModal]      = useState(false)
  const [editando, setEditando]   = useState<any>(null)
  const [mTitulo,  setMTitulo]    = useState('')
  const [mDesc,    setMDesc]      = useState('')
  const [mPerId,   setMPerId]     = useState('')
  const [mPrio,    setMPrio]      = useState('media')
  const [mFecha,   setMFecha]     = useState('')
  const [mHoras,   setMHoras]     = useState('')
  const [mSemana,  setMSemana]    = useState('')
  const [mAsig,    setMAsig]      = useState('')
  const [mComent,  setMComent]    = useState('')
  const [saving,   setSaving]     = useState(false)
  // Modal avance
  const [modalAv,  setModalAv]    = useState(false)
  const [mAvTarea, setMAvTarea]   = useState<any>(null)
  const [mAvPct,   setMAvPct]     = useState(0)
  const [mAvSem,   setMAvSem]     = useState('')

  useEffect(()=>{load()},[])

  async function load(){
    const [p,t,a] = await Promise.all([
      supabase.from('personas').select('id,nombre,color,rol,subrol').eq('activo',true).order('nombre'),
      supabase.from('tareas').select('*,personas(nombre,color)').order('created_at',{ascending:false}),
      supabase.from('avances_semanales').select('*').order('semana'),
    ])
    setPersonas(p.data??[])
    setTareas(t.data??[])
    setAvances(a.data??[])
    setLoading(false)
  }

  function avancesTarea(tid:string){return avances.filter(a=>a.tarea_id===tid).sort((a,b)=>b.semana.localeCompare(a.semana))}
  function ultimoAvance(tid:string){return avancesTarea(tid)[0]}

  async function cambiarEstado(id:string,estado:string){
    await supabase.from('tareas').update({estado}).eq('id',id);load()
  }

  async function eliminarTarea(id:string){
    if(!confirm('¿Eliminar esta tarea?')) return
    await supabase.from('tareas').delete().eq('id',id);load()
  }

  function abrirNuevo(){
    setEditando(null);setMTitulo('');setMDesc('');setMPerId('');setMPrio('media')
    setMFecha('');setMHoras('');setMSemana('');setMAsig('');setMComent('');setModal(true)
  }

  function abrirEditar(t:any){
    setEditando(t);setMTitulo(t.titulo);setMDesc(t.descripcion??'');setMPerId(t.persona_id);setMPrio(t.prioridad)
    setMFecha(t.fecha_limite??'');setMHoras(t.horas_estimadas?.toString()??'');setMSemana(t.semana??'')
    setMAsig(t.asignado_por??'');setMComent(t.comentario??'');setModal(true)
  }

  async function guardar(){
    if(!mTitulo||!mPerId) return
    setSaving(true)
    const data={titulo:mTitulo,descripcion:mDesc,persona_id:mPerId,prioridad:mPrio,
      estado:editando?.estado??'pendiente',fecha_limite:mFecha||null,
      horas_estimadas:mHoras?parseFloat(mHoras):null,semana:mSemana||null,
      asignado_por:mAsig||null,comentario:mComent||null}
    if(editando) await supabase.from('tareas').update(data).eq('id',editando.id)
    else await supabase.from('tareas').insert(data)
    setModal(false);setSaving(false);load()
  }

  async function guardarAvance(){
    if(!mAvTarea||!mAvSem) return
    setSaving(true)
    await supabase.from('avances_semanales').upsert({tarea_id:mAvTarea.id,semana:mAvSem,porcentaje:mAvPct},{onConflict:'tarea_id,semana'})
    if(mAvPct>=100) await supabase.from('tareas').update({estado:'completada'}).eq('id',mAvTarea.id)
    setModalAv(false);setSaving(false);load()
  }

  const filtradas=tareas.filter(t=>(!fPer||t.persona_id===fPer)&&(!fEst||t.estado===fEst))
  const porPersona = personas.map(p=>({...p,tareasP:tareas.filter(t=>t.persona_id===p.id)})).filter(p=>p.tareasP.length>0)

  const stats={total:tareas.length,pendientes:tareas.filter(t=>t.estado==='pendiente').length,
    progreso:tareas.filter(t=>t.estado==='en_progreso').length,completadas:tareas.filter(t=>t.estado==='completada').length}

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando tareas...</div>

  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Lora,serif',fontSize:24,color:'#002F6C',fontWeight:600}}>Tareas</h1>
          <p style={{fontSize:12,color:'#475569',marginTop:3}}>{stats.progreso} en progreso · {stats.pendientes} pendientes · {stats.completadas} completadas</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <div style={{display:'flex',background:'white',border:'1px solid #e2e8f0',borderRadius:9,overflow:'hidden'}}>
            {(['lista','persona'] as const).map(v=>(
              <button key={v} onClick={()=>setVista(v)} style={{padding:'7px 14px',border:'none',fontSize:12,fontWeight:vista===v?600:400,cursor:'pointer',fontFamily:'inherit',background:vista===v?'#002F6C':'transparent',color:vista===v?'white':'#475569'}}>
                {v==='lista'?'Lista':'Por persona'}
              </button>
            ))}
          </div>
          <button className="btn btn-p" onClick={abrirNuevo}>+ Asignar tarea</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
        {[{l:'Total',v:stats.total,c:'m-azul',i:'📌'},{l:'En progreso',v:stats.progreso,c:'m-verde',i:'⚙️'},{l:'Pendientes',v:stats.pendientes,c:'m-dorado',i:'⏳'},{l:'Completadas',v:stats.completadas,c:'m-rojo',i:'✅'}].map(m=>(
          <div key={m.l} className={`metric ${m.c}`}>
            <div className="metric-lbl">{m.l}</div>
            <div className="metric-val">{m.v}</div>
            <div className="metric-icon">{m.i}</div>
          </div>
        ))}
      </div>

      {vista==='lista' ? (
        <>
          <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
            <select value={fPer} onChange={e=>setFPer(e.target.value)} style={{padding:'7px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:12,fontFamily:'inherit'}}>
              <option value="">Todas las personas</option>
              {personas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <select value={fEst} onChange={e=>setFEst(e.target.value)} style={{padding:'7px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:12,fontFamily:'inherit'}}>
              <option value="">Todos los estados</option>
              {Object.entries(ESTADO_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {filtradas.map(t=>{
              const pc=PRIO_CFG[t.prioridad]??PRIO_CFG.media
              const ec=ESTADO_CFG[t.estado]??ESTADO_CFG.pendiente
              const ua=ultimoAvance(t.id)
              const persona=t.personas
              return (
                <div key={t.id} style={{background:'white',borderRadius:12,border:'1.5px solid #e2e8f0',padding:'14px 18px',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                        <span style={{fontSize:14,fontWeight:700}}>{t.titulo}</span>
                        <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:pc.bg,color:pc.txt}}>{pc.label}</span>
                      </div>
                      {t.descripcion&&<div style={{fontSize:12,color:'#475569',marginBottom:6,lineHeight:1.5}}>{t.descripcion}</div>}
                      <div style={{display:'flex',gap:14,fontSize:11,color:'#94a3b8',flexWrap:'wrap'}}>
                        {persona&&<span style={{color:persona.color,fontWeight:500}}>👤 {persona.nombre}</span>}
                        {t.fecha_limite&&<span>📅 {format(new Date(t.fecha_limite+'T12:00:00'),"d MMM yyyy",{locale:es})}</span>}
                        {t.horas_estimadas&&<span>⏱ {t.horas_estimadas}h est.</span>}
                        {t.asignado_por&&<span>👨‍💼 {t.asignado_por}</span>}
                        {t.semana&&<span>📆 {t.semana}</span>}
                      </div>
                      {ua&&(
                        <div style={{marginTop:8}}>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#94a3b8',marginBottom:3}}>
                            <span>Avance: {ua.porcentaje}%</span><span>{ua.semana}</span>
                          </div>
                          <div style={{height:5,background:'#e2e8f0',borderRadius:10,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${ua.porcentaje}%`,background:ua.porcentaje>=100?'#15803d':'#2563C8',borderRadius:10,transition:'width .4s'}}/>
                          </div>
                        </div>
                      )}
                      {t.comentario&&<div style={{fontSize:11,color:'#94a3b8',marginTop:6,fontStyle:'italic'}}>💬 {t.comentario}</div>}
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:6,alignItems:'flex-end',flexShrink:0}}>
                      <select value={t.estado} onChange={e=>cambiarEstado(t.id,e.target.value)}
                        style={{padding:'5px 8px',border:`1.5px solid ${ec.txt}`,borderRadius:8,fontSize:11,color:ec.txt,background:ec.bg,cursor:'pointer',fontFamily:'inherit'}}>
                        {Object.entries(ESTADO_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <div style={{display:'flex',gap:4}}>
                        <button onClick={()=>{setMAvTarea(t);setMAvPct(ultimoAvance(t.id)?.porcentaje??0);setMAvSem('');setModalAv(true)}} className="btn btn-g btn-xs">% Avance</button>
                        <button onClick={()=>abrirEditar(t)} className="btn btn-s btn-xs">✏</button>
                        <button onClick={()=>eliminarTarea(t.id)} className="btn btn-d btn-xs">🗑</button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {!filtradas.length&&<div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13}}>Sin tareas</div>}
          </div>
        </>
      ) : (
        /* Vista por persona */
        <div>
          {porPersona.map(p=>{
            const enProg=p.tareasP.filter((t:any)=>t.estado==='en_progreso').length
            const comp=p.tareasP.filter((t:any)=>t.estado==='completada').length
            return (
              <div key={p.id} style={{background:'white',borderRadius:12,border:'1px solid #e2e8f0',marginBottom:14,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
                <div style={{display:'flex',alignItems:'center',gap:12,padding:'16px 20px',borderBottom:'1px solid #e2e8f0',background:'#f8fafc'}}>
                  <div style={{width:40,height:40,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:15,color:'white'}}>{p.nombre.charAt(0)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600}}>{p.nombre}</div>
                    <div style={{fontSize:11,color:'#94a3b8'}}>{p.rol==='SENATI'?`SENATI · ${p.subrol}`:p.subrol??p.rol}</div>
                  </div>
                  <div style={{display:'flex',gap:12}}>
                    <div style={{textAlign:'center'}}><div style={{fontSize:18,fontWeight:700,color:'#002F6C'}}>{p.tareasP.length}</div><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>Total</div></div>
                    <div style={{textAlign:'center'}}><div style={{fontSize:18,fontWeight:700,color:'#1d4ed8'}}>{enProg}</div><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>Progreso</div></div>
                    <div style={{textAlign:'center'}}><div style={{fontSize:18,fontWeight:700,color:'#15803d'}}>{comp}</div><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>Listas</div></div>
                  </div>
                </div>
                <div style={{padding:'14px 20px',display:'flex',flexDirection:'column',gap:8}}>
                  {p.tareasP.map((t:any)=>{
                    const pc=PRIO_CFG[t.prioridad]??PRIO_CFG.media
                    const ec=ESTADO_CFG[t.estado]??ESTADO_CFG.pendiente
                    const ua=ultimoAvance(t.id)
                    return (
                      <div key={t.id} style={{padding:'10px 14px',background:'#f8fafc',borderRadius:9,border:'1px solid #e2e8f0'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'space-between',flexWrap:'wrap'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:12,fontWeight:600}}>{t.titulo}</span>
                            <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:pc.bg,color:pc.txt}}>{pc.label}</span>
                            <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:ec.bg,color:ec.txt,fontWeight:600}}>{ec.label}</span>
                          </div>
                          <div style={{display:'flex',gap:4}}>
                            <button onClick={()=>{setMAvTarea(t);setMAvPct(ua?.porcentaje??0);setMAvSem('');setModalAv(true)}} className="btn btn-g btn-xs">% Avance</button>
                            <button onClick={()=>cambiarEstado(t.id,t.estado==='completada'?'en_progreso':'completada')} className="btn btn-s btn-xs">{t.estado==='completada'?'Reabrir':'✓ Listo'}</button>
                          </div>
                        </div>
                        {ua&&(
                          <div style={{marginTop:6}}>
                            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#94a3b8',marginBottom:3}}><span>Avance: {ua.porcentaje}%</span><span>{ua.semana}</span></div>
                            <div style={{height:4,background:'#e2e8f0',borderRadius:10,overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${ua.porcentaje}%`,background:ua.porcentaje>=100?'#15803d':'#2563C8',borderRadius:10}}/>
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

      {/* Modal tarea */}
      {modal&&(
        <div className="mo" onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div className="mo-box" style={{maxWidth:520}}>
            <div className="mo-head"><h3>{editando?'Editar tarea':'Asignar tarea'}</h3><button className="mo-close" onClick={()=>setModal(false)}>×</button></div>
            <div className="ig" style={{marginBottom:12}}><label>Título</label><input value={mTitulo} onChange={e=>setMTitulo(e.target.value)} placeholder="Título de la tarea"/></div>
            <div className="ig" style={{marginBottom:12}}><label>Descripción</label><textarea value={mDesc} onChange={e=>setMDesc(e.target.value)} rows={2} placeholder="Detalla la tarea..."/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div className="ig"><label>Asignar a</label>
                <select value={mPerId} onChange={e=>setMPerId(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {personas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="ig"><label>Prioridad</label>
                <select value={mPrio} onChange={e=>setMPrio(e.target.value)}>
                  <option value="alta">🔴 Alta</option>
                  <option value="media">🟡 Media</option>
                  <option value="baja">🟢 Baja</option>
                </select>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div className="ig"><label>Fecha límite</label><input type="date" value={mFecha} onChange={e=>setMFecha(e.target.value)}/></div>
              <div className="ig"><label>Horas estimadas</label><input type="number" value={mHoras} onChange={e=>setMHoras(e.target.value)} placeholder="20" step="0.5"/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div className="ig"><label>Semana</label><input value={mSemana} onChange={e=>setMSemana(e.target.value)} placeholder="Sem 14 (31 mar-4 abr)"/></div>
              <div className="ig"><label>Asignado por</label><input value={mAsig} onChange={e=>setMAsig(e.target.value)} placeholder="Nombre del coordinador"/></div>
            </div>
            <div className="ig" style={{marginBottom:16}}><label>Comentario interno</label><input value={mComent} onChange={e=>setMComent(e.target.value)} placeholder="Nota adicional..."/></div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-s" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={guardar} disabled={saving||!mTitulo||!mPerId}>{saving?'Guardando...':editando?'Guardar cambios':'Asignar tarea'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal avance */}
      {modalAv&&mAvTarea&&(
        <div className="mo" onClick={e=>{if(e.target===e.currentTarget)setModalAv(false)}}>
          <div className="mo-box">
            <div className="mo-head"><h3>Registrar avance</h3><button className="mo-close" onClick={()=>setModalAv(false)}>×</button></div>
            <div style={{marginBottom:14,padding:'10px 14px',background:'#eff6ff',borderRadius:9,fontSize:13,fontWeight:600,color:'#002F6C'}}>{mAvTarea.titulo}</div>
            <div className="ig" style={{marginBottom:12}}><label>Semana</label><input value={mAvSem} onChange={e=>setMAvSem(e.target.value)} placeholder="Ej: Sem 19 (5-9 may)"/></div>
            <div className="ig" style={{marginBottom:8}}><label>Porcentaje de avance: {mAvPct}%</label>
              <input type="range" min={0} max={100} step={5} value={mAvPct} onChange={e=>setMAvPct(+e.target.value)} style={{width:'100%',accentColor:'#002F6C'}}/>
            </div>
            <div style={{height:8,background:'#e2e8f0',borderRadius:10,overflow:'hidden',marginBottom:16}}>
              <div style={{height:'100%',width:`${mAvPct}%`,background:mAvPct>=100?'#15803d':'#2563C8',borderRadius:10,transition:'width .3s'}}/>
            </div>
            {mAvPct>=100&&<p style={{fontSize:12,color:'#15803d',fontWeight:600,textAlign:'center',marginBottom:12}}>✓ Se marcará como completada automáticamente</p>}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-s" onClick={()=>setModalAv(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={guardarAvance} disabled={saving||!mAvSem}>{saving?'Guardando...':'Registrar avance'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
