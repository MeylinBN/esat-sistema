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
  pendiente:   {bg:'#f1f5f9',txt:'#64748b',label:'Pendiente'},
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
  const [usuarioActual, setUsuarioActual] = useState<any>(null)
  
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
  
  const [modalAv,  setModalAv]    = useState(false)
  const [mAvTarea, setMAvTarea]   = useState<any>(null)
  const [mAvPct,   setMAvPct]     = useState(0)
  const [mAvSem,   setMAvSem]     = useState('')

  useEffect(()=>{
    load()
  },[])

  useEffect(() => {
    async function cargarUsuario() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) return
        
        const { data: userData, error: dataError } = await supabase
          .from('personas')
          .select('nombre')
          .eq('auth_id', user.id)
          .single()
          
        if (dataError) return
        
        setUsuarioActual(userData)
        if (userData) setMAsig(userData.nombre)
      } catch (err) {
        console.error('Error cargando usuario:', err)
      }
    }
    cargarUsuario()
  }, [])

  async function load(){
    try {
      const [p,t,a] = await Promise.all([
        supabase.from('personas').select('id,nombre,color,rol,subrol').eq('activo',true).order('nombre'),
        supabase.from('tareas').select('*,personas(id,nombre,color)').order('created_at',{ascending:false}),
        supabase.from('avances_semanales').select('*').order('semana'),
      ])
      
      if (p.error) throw p.error
      if (t.error) throw t.error
      if (a.error) throw a.error
      
      setPersonas(p.data??[])
      setTareas(t.data??[])
      setAvances(a.data??[])
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  function avancesTarea(tid:string){return avances.filter(a=>a.tarea_id===tid).sort((a,b)=>b.semana.localeCompare(a.semana))}
  function ultimoAvance(tid:string){return avancesTarea(tid)[0]}

  async function cambiarEstado(id:string,estado:string){
    await supabase.from('tareas').update({estado}).eq('id',id)
    load()
  }

  async function eliminarTarea(id:string){
    if(!confirm('¿Eliminar esta tarea?')) return
    await supabase.from('tareas').delete().eq('id',id)
    load()
  }

  function abrirNuevo(){
    setEditando(null);setMTitulo('');setMDesc('');setMPerId('');setMPrio('media')
    setMFecha('');setMHoras('');setMSemana('');setMAsig(usuarioActual?.nombre||'');setMComent('');setModal(true)
  }

  function abrirEditar(t:any){
    setEditando(t);setMTitulo(t.titulo);setMDesc(t.descripcion??'');setMPerId(t.persona_id);setMPrio(t.prioridad)
    setMFecha(t.fecha_limite??'');setMHoras(t.horas_estimadas?.toString()??'');setMSemana(t.semana??'')
    setMAsig(t.asignado_por??usuarioActual?.nombre||'');setMComent(t.comentario??'');setModal(true)
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
          <button onClick={abrirNuevo} style={{padding:'7px 14px',background:'#002F6C',color:'white',border:'none',borderRadius:9,cursor:'pointer',fontSize:12,fontWeight:600}}>+ Asignar tarea</button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
        {[
          {l:'Total',v:stats.total,c:'#002F6C',i:'📌'},
          {l:'En progreso',v:stats.progreso,c:'#1d4ed8',i:'⚙️'},
          {l:'Pendientes',v:stats.pendientes,c:'#b45309',i:'⏳'},
          {l:'Completadas',v:stats.completadas,c:'#15803d',i:'✅'}
        ].map(m=>(
          <div key={m.l} style={{background:'white',borderRadius:12,padding:'16px',border:`1.5px solid ${m.c}22`,boxShadow:'0 1px 3px rgba(0,0,0,.06)',position:'relative'}}>
            <div style={{fontSize:11,fontWeight:600,color:'#94a3b8',textTransform:'uppercase'}}>{m.l}</div>
            <div style={{fontSize:28,fontWeight:700,color:m.c,lineHeight:1,marginTop:4}}>{m.v}</div>
            <div style={{position:'absolute',right:16,top:16,fontSize:20,opacity:0.2}}>{m.i}</div>
          </div>
        ))}
      </div>

      {vista==='lista' ? (
        <>
          <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
            <select value={fPer} onChange={e=>setFPer(e.target.value)} style={{padding:'7px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:12,fontFamily:'inherit',outline:'none'}}>
              <option value="">Todas las personas</option>
              {personas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <select value={fEst} onChange={e=>setFEst(e.target.value)} style={{padding:'7px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:12,fontFamily:'inherit',outline:'none'}}>
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
                <div key={t.id} style={{background:'white',borderRadius:12,border:`1.5px solid ${ec.bg}`,padding:'14px 18px',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                        <span style={{fontSize:14,fontWeight:700,color:'#0f172a'}}>{t.titulo}</span>
                        <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:pc.bg,color:pc.txt,fontWeight:500}}>{pc.label}</span>
                      </div>
                      {t.descripcion&&<div style={{fontSize:12,color:'#475569',marginBottom:6,lineHeight:1.5}}>{t.descripcion}</div>}
                      <div style={{display:'flex',gap:14,fontSize:11,color:'#64748b',flexWrap:'wrap',alignItems:'center'}}>
                        {persona&&<span style={{display:'flex',alignItems:'center',gap:4,color:persona.color,fontWeight:600}}><span style={{width:6,height:6,borderRadius:'50%',background:persona.color,display:'inline-block'}}/>{persona.nombre}</span>}
                        {t.fecha_limite&&<span>📅 {format(new Date(t.fecha_limite+'T12:00:00'),"d MMM",{locale:es})}</span>}
                        {t.horas_estimadas&&<span>⏱ {t.horas_estimadas}h</span>}
                        {t.asignado_por&&<span>👨‍ {t.asignado_por}</span>}
                      </div>
                      
                      {ua && (
                        <div style={{marginTop:10,background:'#f8fafc',borderRadius:8,padding:'8px 10px',border:'1px solid #e2e8f0'}}>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#475569',marginBottom:4,fontWeight:600}}>
                            <span>Progreso</span>
                            <span style={{color:ua.porcentaje>=100?'#15803d':'#2563C8'}}>{ua.porcentaje}% · {ua.semana}</span>
                          </div>
                          <div style={{height:6,background:'#e2e8f0',borderRadius:10,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${ua.porcentaje}%`,background:ua.porcentaje>=100?'#15803d':'#2563C8',borderRadius:10,transition:'width .4s ease'}}/>
                          </div>
                        </div>
                      )}
                      {t.comentario&&<div style={{fontSize:11,color:'#64748b',marginTop:6,fontStyle:'italic',borderLeft:'2px solid #e2e8f0',paddingLeft:8}}>💬 {t.comentario}</div>}
                    </div>
                    
                    <div style={{display:'flex',flexDirection:'column',gap:6,alignItems:'flex-end',flexShrink:0}}>
                      <select value={t.estado} onChange={e=>cambiarEstado(t.id,e.target.value)}
                        style={{padding:'5px 8px',border:`1.5px solid ${ec.bg}`,borderRadius:8,fontSize:11,color:ec.txt,background:ec.bg,cursor:'pointer',fontFamily:'inherit',outline:'none',textAlign:'center'}}>
                        {Object.entries(ESTADO_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <div style={{display:'flex',gap:4}}>
                        <button onClick={()=>{setMAvTarea(t);setMAvPct(ultimoAvance(t.id)?.porcentaje??0);setMAvSem('');setModalAv(true)}} 
                          style={{padding:'4px 8px',background:'#eff6ff',color:'#1d4ed8',border:'1px solid #bfdbfe',borderRadius:6,fontSize:10,cursor:'pointer',fontWeight:600}}>
                          📊 Avance
                        </button>
                        <button onClick={()=>abrirEditar(t)} 
                          style={{padding:'4px 8px',background:'#f8fafc',color:'#475569',border:'1px solid #e2e8f0',borderRadius:6,fontSize:10,cursor:'pointer'}}>
                          ✏️
                        </button>
                        <button onClick={()=>eliminarTarea(t.id)} 
                          style={{padding:'4px 8px',background:'#fee2e2',color:'#b91c1c',border:'1px solid #fecaca',borderRadius:6,fontSize:10,cursor:'pointer'}}>
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {!filtradas.length&&<div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13,background:'white',borderRadius:12}}>No hay tareas que coincidan con los filtros</div>}
          </div>
        </>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {porPersona.map(p=>{
            const enProg=p.tareasP.filter((t:any)=>t.estado==='en_progreso').length
            const comp=p.tareasP.filter((t:any)=>t.estado==='completada').length
            return (
              <div key={p.id} style={{background:'white',borderRadius:12,border:'1px solid #e2e8f0',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
                <div style={{display:'flex',alignItems:'center',gap:12,padding:'16px 20px',borderBottom:'1px solid #e2e8f0',background:'#f8fafc'}}>
                  <div style={{width:40,height:40,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:15,color:'white'}}>{p.nombre.charAt(0)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:'#0f172a'}}>{p.nombre}</div>
                    <div style={{fontSize:11,color:'#64748b'}}>{p.rol==='SENATI'?`SENATI · ${p.subrol}`:p.subrol??p.rol}</div>
                  </div>
                  <div style={{display:'flex',gap:16}}>
                    <div style={{textAlign:'center'}}><div style={{fontSize:18,fontWeight:700,color:'#002F6C'}}>{p.tareasP.length}</div><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>Total</div></div>
                    <div style={{textAlign:'center'}}><div style={{fontSize:18,fontWeight:700,color:'#1d4ed8'}}>{enProg}</div><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>Progreso</div></div>
                    <div style={{textAlign:'center'}}><div style={{fontSize:18,fontWeight:700,color:'#15803d'}}>{comp}</div><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>Listas</div></div>
                  </div>
                </div>
                <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:10}}>
                  {p.tareasP.map((t:any)=>{
                    const pc=PRIO_CFG[t.prioridad]??PRIO_CFG.media
                    const ec=ESTADO_CFG[t.estado]??ESTADO_CFG.pendiente
                    const ua=ultimoAvance(t.id)
                    return (
                      <div key={t.id} style={{padding:'12px',background:'#f8fafc',borderRadius:10,border:'1px solid #e2e8f0'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'space-between',flexWrap:'wrap',marginBottom:ua?8:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:12,fontWeight:600,color:'#0f172a'}}>{t.titulo}</span>
                            <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:pc.bg,color:pc.txt,fontWeight:500}}>{pc.label}</span>
                            <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:ec.bg,color:ec.txt,fontWeight:600}}>{ec.label}</span>
                          </div>
                          <div style={{display:'flex',gap:4}}>
                            <button onClick={()=>{setMAvTarea(t);setMAvPct(ua?.porcentaje??0);setMAvSem('');setModalAv(true)}} 
                              style={{padding:'4px 8px',background:'#eff6ff',color:'#1d4ed8',border:'1px solid #bfdbfe',borderRadius:6,fontSize:10,cursor:'pointer',fontWeight:600}}>
                              📊 Avance
                            </button>
                            <button onClick={()=>cambiarEstado(t.id,t.estado==='completada'?'en_progreso':'completada')} 
                              style={{padding:'4px 8px',background:t.estado==='completada'?'#fee2e2':'#dcfce7',color:t.estado==='completada'?'#b91c1c':'#15803d',border:'none',borderRadius:6,fontSize:10,cursor:'pointer',fontWeight:600}}>
                              {t.estado==='completada'?'🔄 Reabrir':'✓ Listo'}
                            </button>
                          </div>
                        </div>
                        {ua&&(
                          <div style={{background:'white',borderRadius:6,padding:'6px 8px',border:'1px solid #e2e8f0'}}>
                            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#64748b',marginBottom:3}}>
                              <span>Avance semanal</span>
                              <span style={{color:ua.porcentaje>=100?'#15803d':'#2563C8',fontWeight:600}}>{ua.porcentaje}% · {ua.semana}</span>
                            </div>
                            <div style={{height:4,background:'#e2e8f0',borderRadius:10,overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${ua.porcentaje}%`,background:ua.porcentaje>=100?'#15803d':'#2563C8',borderRadius:10,transition:'width .3s'}}/>
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
          {porPersona.length===0 && <div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13,background:'white',borderRadius:12}}>Sin tareas asignadas</div>}
        </div>
      )}

      {/* Modal tarea */}
      {modal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div style={{background:'white',borderRadius:18,padding:24,width:'100%',maxWidth:520,boxShadow:'0 24px 80px rgba(0,0,0,.25)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{fontSize:18,fontWeight:700,margin:0}}>{editando?'Editar tarea':'Asignar tarea'}</h3>
              <button onClick={()=>setModal(false)} style={{width:32,height:32,borderRadius:'50%',border:'none',background:'#f1f5f9',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Título *</label>
              <input value={mTitulo} onChange={e=>setMTitulo(e.target.value)} placeholder="Ej: Actualizar base de datos" style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,boxSizing:'border-box'}}/>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Descripción</label>
              <textarea value={mDesc} onChange={e=>setMDesc(e.target.value)} rows={2} placeholder="Detalla la tarea..." style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,resize:'vertical',boxSizing:'border-box'}}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Asignar a *</label>
                <select value={mPerId} onChange={e=>setMPerId(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}>
                  <option value="">Seleccionar...</option>
                  {personas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Prioridad</label>
                <select value={mPrio} onChange={e=>setMPrio(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}>
                  <option value="alta">🔴 Alta</option>
                  <option value="media">🟡 Media</option>
                  <option value="baja">🟢 Baja</option>
                </select>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Fecha límite</label>
                <input type="date" value={mFecha} onChange={e=>setMFecha(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,boxSizing:'border-box'}}/>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Horas estimadas</label>
                <input type="number" value={mHoras} onChange={e=>setMHoras(e.target.value)} placeholder="20" step="0.5" style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,boxSizing:'border-box'}}/>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Semana</label>
                <input value={mSemana} onChange={e=>setMSemana(e.target.value)} placeholder="Sem 14 (31 mar-4 abr)" style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,boxSizing:'border-box'}}/>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Asignado por</label>
                <input value={mAsig} onChange={e=>setMAsig(e.target.value)} placeholder="Nombre coordinador" style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,boxSizing:'border-box'}}/>
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Comentario interno</label>
              <input value={mComent} onChange={e=>setMComent(e.target.value)} placeholder="Nota adicional..." style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,boxSizing:'border-box'}}/>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingTop:16,borderTop:'1px solid #e2e8f0'}}>
              <button onClick={()=>setModal(false)} style={{padding:'8px 16px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'white',cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>Cancelar</button>
              <button onClick={guardar} disabled={saving||!mTitulo||!mPerId} style={{padding:'8px 18px',borderRadius:9,border:'none',background:'#002F6C',color:'white',cursor:(!mTitulo||!mPerId||saving)?'not-allowed':'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit',opacity:(!mTitulo||!mPerId||saving)?.6:1}}>{saving?'Guardando...':editando?'Guardar cambios':'Asignar tarea'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal avance */}
      {modalAv&&mAvTarea&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={e=>{if(e.target===e.currentTarget)setModalAv(false)}}>
          <div style={{background:'white',borderRadius:18,padding:24,width:'100%',maxWidth:420,boxShadow:'0 24px 80px rgba(0,0,0,.25)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{fontSize:18,fontWeight:700,margin:0}}>Registrar avance</h3>
              <button onClick={()=>setModalAv(false)} style={{width:32,height:32,borderRadius:'50%',border:'none',background:'#f1f5f9',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            <div style={{marginBottom:16,padding:'12px 14px',background:'#eff6ff',borderRadius:9,fontSize:13,fontWeight:600,color:'#002F6C',border:'1px solid #bfdbfe'}}>{mAvTarea.titulo}</div>
            <div style={{marginBottom:12}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Semana *</label>
              <input value={mAvSem} onChange={e=>setMAvSem(e.target.value)} placeholder="Ej: Sem 19 (5-9 may)" style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,boxSizing:'border-box'}}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:8,textTransform:'uppercase'}}>Avance: {mAvPct}%</label>
              <input type="range" min={0} max={100} step={5} value={mAvPct} onChange={e=>setMAvPct(+e.target.value)} style={{width:'100%',accentColor:'#002F6C',cursor:'pointer'}}/>
            </div>
            <div style={{height:10,background:'#e2e8f0',borderRadius:10,overflow:'hidden',marginBottom:16,boxShadow:'inset 0 1px 3px rgba(0,0,0,.1)'}}>
              <div style={{height:'100%',width:`${mAvPct}%`,background:mAvPct>=100?'#15803d':'#2563C8',borderRadius:10,transition:'width .3s ease'}}/>
            </div>
            {mAvPct>=100&&<p style={{fontSize:12,color:'#15803d',fontWeight:600,textAlign:'center',marginBottom:16,background:'#dcfce7',padding:'8px',borderRadius:8}}>✓ Se marcará como completada automáticamente</p>}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setModalAv(false)} style={{padding:'8px 16px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'white',cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>Cancelar</button>
              <button onClick={guardarAvance} disabled={saving||!mAvSem} style={{padding:'8px 18px',borderRadius:9,border:'none',background:'#002F6C',color:'white',cursor:(!mAvSem||saving)?'not-allowed':'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit',opacity:(!mAvSem||saving)?.6:1}}>{saving?'Guardando...':'Registrar avance'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}