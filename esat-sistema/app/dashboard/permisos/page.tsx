'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const TIPO_LABEL: Record<string,string> = {
  permiso_medico:'🏥 Médico', permiso_personal:'👤 Personal',
  permiso_academico:'🎓 Académico', falta_justificada:'📋 F. Justificada',
  falta_injustificada:'⚠️ F. Injustificada', vacaciones:'🏖 Vacaciones',
}
const ESTADO_CFG: Record<string,{bg:string,txt:string}> = {
  aprobado: {bg:'#dcfce7',txt:'#15803d'},
  pendiente:{bg:'#fef3c7',txt:'#b45309'},
  rechazado:{bg:'#fee2e2',txt:'#b91c1c'},
}

export default function PermisosPage() {
  const supabase = createClient()
  const [personas, setPersonas] = useState<any[]>([])
  const [permisos, setPermisos] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [mPerId,   setMPerId]   = useState('')
  const [mTipo,    setMTipo]    = useState('permiso_personal')
  const [mFI,      setMFI]      = useState('')
  const [mFF,      setMFF]      = useState('')
  const [mMotivo,  setMMotivo]  = useState('')
  const [mEstado,  setMEstado]  = useState('pendiente')
  const [mRecup,   setMRecup]   = useState('')
  const [saving,   setSaving]   = useState(false)
  const [filtro,   setFiltro]   = useState('todos')

  useEffect(()=>{load()},[])

  async function load(){
    const [p,pe] = await Promise.all([
      supabase.from('personas').select('id,nombre,color,rol').eq('activo',true).order('nombre'),
      supabase.from('permisos').select('*,personas(nombre,color)').order('created_at',{ascending:false}),
    ])
    setPersonas(p.data??[])
    setPermisos(pe.data??[])
    setLoading(false)
  }

  async function guardar(){
    if(!mPerId||!mFI||!mFF) return
    setSaving(true)
    const data={persona_id:mPerId,tipo:mTipo,fecha_inicio:mFI,fecha_fin:mFF,
      motivo:mMotivo||null,estado:mEstado,dias_recuperacion:mRecup||null}
    if(editando) await supabase.from('permisos').update(data).eq('id',editando.id)
    else await supabase.from('permisos').insert(data)
    setModal(false);setMPerId('');setMFI('');setMFF('');setMMotivo('');setMRecup('');
    setSaving(false);load()
  }

  async function cambiarEstado(id:string,estado:string){
    await supabase.from('permisos').update({estado}).eq('id',id);load()
  }

  async function eliminar(id:string){
    if(!confirm('¿Eliminar este permiso?')) return
    await supabase.from('permisos').delete().eq('id',id);load()
  }

  function abrirEditar(p:any){
    setEditando(p);setMPerId(p.persona_id);setMTipo(p.tipo);setMFI(p.fecha_inicio)
    setMFF(p.fecha_fin);setMMotivo(p.motivo??'');setMEstado(p.estado);setMRecup(p.dias_recuperacion??'')
    setModal(true)
  }

  const pendientes = permisos.filter(p=>p.estado==='pendiente').length
  const filtrados  = permisos.filter(p=>filtro==='todos'||p.estado===filtro)

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando permisos...</div>

  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Lora,serif',fontSize:24,color:'#002F6C',fontWeight:600}}>Permisos y Faltas</h1>
          <p style={{fontSize:12,color:'#475569',marginTop:3}}>Registro y aprobación de ausencias justificadas</p>
        </div>
        <button className="btn btn-p" onClick={()=>{setEditando(null);setMPerId('');setMFI('');setMFF('');setMMotivo('');setMEstado('pendiente');setMRecup('');setModal(true)}}>+ Registrar permiso</button>
      </div>

      {pendientes>0&&(
        <div style={{background:'#fef3c7',border:'1.5px solid #fde68a',borderRadius:10,padding:'12px 16px',marginBottom:20,display:'flex',alignItems:'center',gap:10}}>
          <span>⏳</span>
          <span style={{fontSize:13,color:'#b45309',fontWeight:600}}>{pendientes} permiso(s) pendiente(s) de aprobación</span>
        </div>
      )}

      {/* Métricas */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:20}}>
        {[
          {l:'Total registros',v:permisos.length,c:'m-azul',i:'📋'},
          {l:'Aprobados',v:permisos.filter(p=>p.estado==='aprobado').length,c:'m-verde',i:'✅'},
          {l:'Pendientes',v:pendientes,c:'m-dorado',i:'⏳'},
        ].map(m=>(
          <div key={m.l} className={`metric ${m.c}`}>
            <div className="metric-lbl">{m.l}</div>
            <div className="metric-val">{m.v}</div>
            <div className="metric-icon">{m.i}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{display:'flex',gap:4,marginBottom:16,background:'white',padding:4,borderRadius:10,border:'1px solid #e2e8f0',width:'fit-content'}}>
        {[['todos','Todos'],['pendiente','Pendientes'],['aprobado','Aprobados'],['rechazado','Rechazados']].map(([v,l])=>(
          <button key={v} onClick={()=>setFiltro(v)} style={{padding:'6px 14px',borderRadius:8,border:'none',fontSize:12,fontWeight:filtro===v?600:400,cursor:'pointer',fontFamily:'inherit',background:filtro===v?'#002F6C':'transparent',color:filtro===v?'white':'#475569',transition:'all .15s'}}>{l}</button>
        ))}
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {filtrados.map(p=>{
          const ec=ESTADO_CFG[p.estado]??ESTADO_CFG.pendiente
          const persona=p.personas
          return (
            <div key={p.id} style={{background:'white',borderRadius:12,border:'1.5px solid #e2e8f0',padding:'14px 18px',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                    {persona&&(
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <div style={{width:26,height:26,borderRadius:'50%',background:persona.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white'}}>{persona.nombre.charAt(0)}</div>
                        <span style={{fontSize:13,fontWeight:700}}>{persona.nombre}</span>
                      </div>
                    )}
                    <span style={{fontSize:11,padding:'2px 9px',borderRadius:20,background:'#dbeafe',color:'#1d4ed8'}}>{TIPO_LABEL[p.tipo]??p.tipo}</span>
                    <span style={{fontSize:11,padding:'2px 9px',borderRadius:20,fontWeight:600,background:ec.bg,color:ec.txt}}>{p.estado}</span>
                  </div>
                  <div style={{fontSize:12,color:'#475569',marginBottom:4}}>
                    📅 {format(new Date(p.fecha_inicio+'T12:00:00'),"d MMM yyyy",{locale:es})}
                    {p.fecha_fin!==p.fecha_inicio&&` → ${format(new Date(p.fecha_fin+'T12:00:00'),"d MMM yyyy",{locale:es})}`}
                  </div>
                  {p.motivo&&<div style={{fontSize:12,color:'#475569',marginBottom:4}}>{p.motivo}</div>}
                  {p.dias_recuperacion&&(
                    <div style={{fontSize:11,color:'#15803d',fontWeight:500}}>🔁 Recuperación: {p.dias_recuperacion}</div>
                  )}
                </div>
                <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0,flexWrap:'wrap'}}>
                  {p.estado==='pendiente'&&(
                    <>
                      <button onClick={()=>cambiarEstado(p.id,'aprobado')} className="btn btn-sm" style={{background:'#dcfce7',color:'#15803d',border:'1px solid #86efac',borderRadius:7,padding:'5px 10px',fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>✓ Aprobar</button>
                      <button onClick={()=>cambiarEstado(p.id,'rechazado')} className="btn btn-sm" style={{background:'#fee2e2',color:'#b91c1c',border:'1px solid #fca5a5',borderRadius:7,padding:'5px 10px',fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>✗ Rechazar</button>
                    </>
                  )}
                  <button onClick={()=>abrirEditar(p)} className="btn btn-s btn-xs">✏ Editar</button>
                  <button onClick={()=>eliminar(p.id)} className="btn btn-d btn-xs">🗑</button>
                </div>
              </div>
            </div>
          )
        })}
        {!filtrados.length&&<div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13}}>Sin permisos registrados</div>}
      </div>

      {modal&&(
        <div className="mo" onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div className="mo-box">
            <div className="mo-head"><h3>{editando?'Editar permiso':'Registrar permiso / falta'}</h3><button className="mo-close" onClick={()=>setModal(false)}>×</button></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div className="ig"><label>Persona</label>
                <select value={mPerId} onChange={e=>setMPerId(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {personas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="ig"><label>Tipo</label>
                <select value={mTipo} onChange={e=>setMTipo(e.target.value)}>
                  {Object.entries(TIPO_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div className="ig"><label>Fecha inicio</label><input type="date" value={mFI} onChange={e=>setMFI(e.target.value)}/></div>
              <div className="ig"><label>Fecha fin</label><input type="date" value={mFF} onChange={e=>setMFF(e.target.value)}/></div>
            </div>
            <div className="ig" style={{marginBottom:12}}><label>Motivo</label><textarea value={mMotivo} onChange={e=>setMMotivo(e.target.value)} rows={2} placeholder="Explica el motivo..."/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
              <div className="ig"><label>Estado</label>
                <select value={mEstado} onChange={e=>setMEstado(e.target.value)}>
                  <option value="pendiente">Pendiente</option>
                  <option value="aprobado">Aprobado</option>
                  <option value="rechazado">Rechazado</option>
                </select>
              </div>
              <div className="ig"><label>Días de recuperación</label><input value={mRecup} onChange={e=>setMRecup(e.target.value)} placeholder="Ej: martes 28/04"/></div>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-s" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={guardar} disabled={saving||!mPerId||!mFI}>{saving?'Guardando...':editando?'Guardar cambios':'Registrar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
