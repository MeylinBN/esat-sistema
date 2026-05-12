'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AvanceSemanalPage() {
  const supabase = createClient()
  const [personas, setPersonas] = useState<any[]>([])
  const [tareas,   setTareas]   = useState<any[]>([])
  const [avances,  setAvances]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [fPer,     setFPer]     = useState('')
  const [modalAv,  setModalAv]  = useState(false)
  const [mTarea,   setMTarea]   = useState<any>(null)
  const [mPct,     setMPct]     = useState(0)
  const [mSem,     setMSem]     = useState('')
  const [saving,   setSaving]   = useState(false)

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

  async function guardarAvance(){
    if(!mTarea||!mSem) return
    setSaving(true)
    await supabase.from('avances_semanales').upsert(
      {tarea_id:mTarea.id,semana:mSem,porcentaje:mPct},
      {onConflict:'tarea_id,semana'}
    )
    if(mPct>=100) await supabase.from('tareas').update({estado:'completada'}).eq('id',mTarea.id)
    setModalAv(false);setSaving(false);load()
  }

  const semanas = Array.from(new Set(avances.map(a => a.semana)))
  .sort((a, b) => b.localeCompare(a))
  .slice(0, 8);
  const tareasFiltr=tareas.filter(t=>!fPer||t.persona_id===fPer)

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando avances...</div>

  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Lora,serif',fontSize:24,color:'#002F6C',fontWeight:600}}>Avance Semanal</h1>
          <p style={{fontSize:12,color:'#475569',marginTop:3}}>Progreso de tareas por semana</p>
        </div>
        <select value={fPer} onChange={e=>setFPer(e.target.value)} style={{padding:'8px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13,fontFamily:'inherit'}}>
          <option value="">Todas las personas</option>
          {personas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      {/* Resumen semanal */}
      {semanas.length>0&&(
        <div className="card" style={{marginBottom:20}}>
          <div className="card-body">
            <div className="card-title"><span className="dot" style={{background:'#002F6C'}}/>Semanas recientes</div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:'#f8fafc'}}>
                    <th style={{padding:'8px 12px',textAlign:'left',fontSize:11,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Tarea / Persona</th>
                    {semanas.map(s=><th key={s} style={{padding:'8px 12px',textAlign:'center',fontSize:10,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0',whiteSpace:'nowrap'}}>{s}</th>)}
                    <th style={{padding:'8px 12px',textAlign:'center',fontSize:11,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {tareasFiltr.filter(t=>avances.some(a=>a.tarea_id===t.id)).map((t,i)=>(
                    <tr key={t.id} style={{background:i%2===0?'white':'#f8fafc'}}>
                      <td style={{padding:'10px 12px',borderBottom:'1px solid #e2e8f0'}}>
                        <div style={{fontSize:12,fontWeight:600}}>{t.titulo}</div>
                        {t.personas&&<div style={{fontSize:10,color:t.personas.color,fontWeight:500}}>👤 {t.personas.nombre}</div>}
                      </td>
                      {semanas.map(s=>{
                        const av=avances.find(a=>a.tarea_id===t.id&&a.semana===s)
                        return (
                          <td key={s} style={{padding:'8px 12px',borderBottom:'1px solid #e2e8f0',textAlign:'center'}}>
                            {av?(
                              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                                <span style={{fontSize:12,fontWeight:700,color:av.porcentaje>=100?'#15803d':'#002F6C'}}>{av.porcentaje}%</span>
                                <div style={{width:50,height:4,background:'#e2e8f0',borderRadius:10,overflow:'hidden'}}>
                                  <div style={{height:'100%',width:`${av.porcentaje}%`,background:av.porcentaje>=100?'#15803d':'#2563C8',borderRadius:10}}/>
                                </div>
                              </div>
                            ):<span style={{color:'#cbd5e1',fontSize:11}}>—</span>}
                          </td>
                        )
                      })}
                      <td style={{padding:'8px 12px',borderBottom:'1px solid #e2e8f0',textAlign:'center'}}>
                        <button onClick={()=>{setMTarea(t);setMPct(avances.find(a=>a.tarea_id===t.id)?.porcentaje??0);setMSem('');setModalAv(true)}} className="btn btn-g btn-xs">+ Avance</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Todas las tareas activas */}
      <div className="card">
        <div className="card-body">
          <div className="card-title"><span className="dot" style={{background:'#d97706'}}/>Tareas activas — registrar avance</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {tareasFiltr.filter(t=>t.estado!=='completada'&&t.estado!=='cancelada').map(t=>{
              const ultimoAv=avances.filter(a=>a.tarea_id===t.id).sort((a,b)=>b.semana.localeCompare(a.semana))[0]
              return (
                <div key={t.id} style={{padding:'12px 16px',background:'#f8fafc',borderRadius:10,border:'1px solid #e2e8f0',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:600,marginBottom:3}}>{t.titulo}</div>
                    {t.personas&&<div style={{fontSize:11,color:t.personas.color,fontWeight:500}}>👤 {t.personas.nombre}</div>}
                    {ultimoAv&&(
                      <div style={{marginTop:6}}>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#94a3b8',marginBottom:2}}><span>Último: {ultimoAv.porcentaje}%</span><span>{ultimoAv.semana}</span></div>
                        <div style={{height:5,background:'#e2e8f0',borderRadius:10,overflow:'hidden',width:200}}>
                          <div style={{height:'100%',width:`${ultimoAv.porcentaje}%`,background:'#2563C8',borderRadius:10}}/>
                        </div>
                      </div>
                    )}
                  </div>
                  <button onClick={()=>{setMTarea(t);setMPct(ultimoAv?.porcentaje??0);setMSem('');setModalAv(true)}} className="btn btn-p btn-sm">+ Registrar avance</button>
                </div>
              )
            })}
            {!tareasFiltr.filter(t=>t.estado!=='completada'&&t.estado!=='cancelada').length&&(
              <p style={{textAlign:'center',color:'#94a3b8',padding:'20px 0',fontSize:13}}>Sin tareas activas</p>
            )}
          </div>
        </div>
      </div>

      {modalAv&&mTarea&&(
        <div className="mo" onClick={e=>{if(e.target===e.currentTarget)setModalAv(false)}}>
          <div className="mo-box">
            <div className="mo-head"><h3>Registrar avance semanal</h3><button className="mo-close" onClick={()=>setModalAv(false)}>×</button></div>
            <div style={{marginBottom:14,padding:'10px 14px',background:'#eff6ff',borderRadius:9,fontSize:13,fontWeight:600,color:'#002F6C'}}>{mTarea.titulo}</div>
            <div className="ig" style={{marginBottom:12}}><label>Semana</label><input value={mSem} onChange={e=>setMSem(e.target.value)} placeholder="Ej: Sem 19 (5-9 may)"/></div>
            <div className="ig" style={{marginBottom:8}}><label>Avance: {mPct}%</label>
              <input type="range" min={0} max={100} step={5} value={mPct} onChange={e=>setMPct(+e.target.value)} style={{width:'100%',accentColor:'#002F6C'}}/>
            </div>
            <div style={{height:8,background:'#e2e8f0',borderRadius:10,overflow:'hidden',marginBottom:16}}>
              <div style={{height:'100%',width:`${mPct}%`,background:mPct>=100?'#15803d':'#2563C8',borderRadius:10,transition:'width .3s'}}/>
            </div>
            {mPct>=100&&<p style={{fontSize:12,color:'#15803d',fontWeight:600,textAlign:'center',marginBottom:12}}>✓ Se marcará como completada</p>}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-s" onClick={()=>setModalAv(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={guardarAvance} disabled={saving||!mSem}>{saving?'Guardando...':'Guardar avance'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
