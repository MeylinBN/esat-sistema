'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const ROLES = ['Practicante','Tesista','Voluntario','Investigador','Asistente','SENATI','EcoBIOTEM','Coordinador']
const DIAS = ['L','M','X','J','V']
const DIAS_LABEL: Record<string,string> = {L:'Lun',M:'Mar',X:'Mié',J:'Jue',V:'Vie'}
const GRUPOS_CONFIG = [
  {rol:'Coordinador', label:'⭐ Coordinadores',      color:'#c9a227'},
  {rol:'Practicante', label:'🎓 Practicantes UNASAM', color:'#1e40af'},
  {rol:'SENATI',      label:'🔧 Practicantes SENATI', color:'#92400e'},
  {rol:'Voluntario',  label:'🤝 Voluntarios',         color:'#15803d'},
  {rol:'Asistente',   label:'💼 Asistentes',          color:'#374151'},
  {rol:'EcoBIOTEM',   label:'🌿 GI EcoBIOTEM',        color:'#166534'},
]

export default function PersonasPage() {
  const supabase = createClient()
  const [personas,  setPersonas]  = useState<any[]>([])
  const [horarios,  setHorarios]  = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [buscar,    setBuscar]    = useState('')
  const [modal,     setModal]     = useState(false)
  const [editando,  setEditando]  = useState<any>(null)
  const [mNombre,   setMNombre]   = useState('')
  const [mDni,      setMDni]      = useState('')
  const [mRol,      setMRol]      = useState('Practicante')
  const [mSubrol,   setMSubrol]   = useState('')
  const [mGrupo,    setMGrupo]    = useState('ESAT')
  const [mHora,     setMHora]     = useState('08:30')
  const [mTol,      setMTol]      = useState(10)
  const [mArea,     setMArea]     = useState('')
  const [mColor,    setMColor]    = useState('#1e40af')
  const [mHsSem,    setMHsSem]    = useState('')
  const [saving,    setSaving]    = useState(false)

  useEffect(()=>{load()},[])

  async function load(){
    const [p,h]=await Promise.all([
      supabase.from('personas').select('*').order('nombre'),
      supabase.from('horarios').select('*'),
    ])
    setPersonas(p.data??[])
    setHorarios(h.data??[])
    setLoading(false)
  }

  function horarioResumen(pid:string){
    return DIAS.map(d=>{
      const ff=horarios.filter(h=>h.persona_id===pid&&h.dia===d)
      if(!ff.length) return null
      return `${DIAS_LABEL[d]}: ${ff.map(f=>f.hora_entrada.slice(0,5)+'–'+f.hora_salida.slice(0,5)).join(', ')}`
    }).filter(Boolean).join(' | ')
  }

  function abrirNuevo(){
    setEditando(null);setMNombre('');setMDni('');setMRol('Practicante');setMSubrol('');setMGrupo('ESAT')
    setMHora('08:30');setMTol(10);setMArea('');setMColor('#1e40af');setMHsSem('');setModal(true)
  }

  function abrirEditar(p:any){
    setEditando(p);setMNombre(p.nombre);setMDni(p.dni);setMRol(p.rol);setMSubrol(p.subrol??'')
    setMGrupo(p.grupo);setMHora(p.hora_ingreso?.slice(0,5)??'08:30');setMTol(p.tolerancia??10)
    setMArea(p.area??'');setMColor(p.color??'#1e40af');setMHsSem(p.hs_semanales?.toString()??'');setModal(true)
  }

  async function toggleActivo(id:string,activo:boolean){
    await supabase.from('personas').update({activo:!activo}).eq('id',id);load()
  }

  async function eliminar(id:string,nombre:string){
    if(!confirm(`¿Eliminar a ${nombre}? Esta acción no se puede deshacer.`)) return
    await supabase.from('personas').delete().eq('id',id);load()
  }

  async function guardar(){
    if(!mNombre||!mDni) return
    setSaving(true)
    const esEco=mRol==='EcoBIOTEM'
    const data={nombre:mNombre,dni:mDni,rol:mRol,subrol:mSubrol||null,grupo:mGrupo,
      hora_ingreso:esEco?null:(mHora+':00'),tolerancia:mTol,color:mColor,area:mArea||null,
      hs_semanales:mHsSem?parseFloat(mHsSem):null,sin_horario:esEco}
    if(editando){
      await supabase.from('personas').update(data).eq('id',editando.id)
    } else {
      await supabase.from('personas').insert({...data,activo:true})
    }
    setModal(false);setSaving(false);load()
  }

  const filtradas = personas.filter(p=>
    p.nombre.toLowerCase().includes(buscar.toLowerCase())||
    (p.dni??'').includes(buscar)||(p.rol??'').toLowerCase().includes(buscar.toLowerCase())
  )

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando personas...</div>

  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Lora,serif',fontSize:24,color:'#002F6C',fontWeight:600}}>Personas</h1>
          <p style={{fontSize:12,color:'#475569',marginTop:3}}>{personas.filter(p=>p.activo).length} activas · {personas.length} total</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar nombre, DNI, rol..." style={{padding:'8px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13,fontFamily:'inherit',outline:'none',width:220}}/>
          <button className="btn btn-p" onClick={abrirNuevo}>+ Agregar</button>
        </div>
      </div>

      {GRUPOS_CONFIG.map(grupo=>{
        const gp=filtradas.filter(p=>p.rol===grupo.rol)
        if(!gp.length) return null
        return (
          <div key={grupo.rol} style={{marginBottom:28}}>
            <h2 style={{fontSize:13,fontWeight:600,color:grupo.color,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:12}}>{grupo.label} <span style={{fontSize:11,fontWeight:400,color:'#94a3b8'}}>({gp.length})</span></h2>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:12}}>
              {gp.map(p=>{
                const res=horarioResumen(p.id)
                return (
                  <div key={p.id} style={{background:'white',borderRadius:12,border:`1.5px solid ${p.activo?'#e2e8f0':'#fca5a5'}`,padding:16,boxShadow:'0 1px 3px rgba(0,0,0,.06)',opacity:p.activo?1:.7}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                      <div style={{width:42,height:42,borderRadius:10,background:p.color+'25',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:17,color:p.color,flexShrink:0}}>{p.nombre.charAt(0)}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600}}>{p.nombre}</div>
                        <div style={{fontSize:11,color:'#94a3b8'}}>
                          {p.rol==='SENATI'?`Practicante SENATI · ${p.subrol}`:p.rol==='Practicante'?`Practicante UNASAM · ${p.subrol}`:p.rol}{p.subrol&&p.rol!=='Practicante'&&p.rol!=='SENATI'?` · ${p.subrol}`:''}
                        </div>
                      </div>
                      <span style={{fontSize:10,fontWeight:600,padding:'3px 8px',borderRadius:20,background:p.activo?'#dcfce7':'#fee2e2',color:p.activo?'#15803d':'#b91c1c'}}>{p.activo?'Activo':'Inactivo'}</span>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,fontSize:11,color:'#94a3b8',marginBottom:10}}>
                      <span>📋 DNI: <strong style={{color:'#475569'}}>{p.dni}</strong></span>
                      {p.hora_ingreso&&<span>🕐 Ingreso: <strong style={{color:'#475569'}}>{p.hora_ingreso.slice(0,5)}</strong></span>}
                      {p.area&&<span>📍 {p.area}</span>}
                      {p.hs_semanales&&<span>⏱ {p.hs_semanales}h/sem</span>}
                      {p.tolerancia>0&&<span>⏳ Tol: {p.tolerancia}min</span>}
                    </div>
                    {res&&(
                      <div style={{fontSize:10,color:'#475569',background:'#f8fafc',borderRadius:7,padding:'6px 8px',marginBottom:10,lineHeight:1.7}}>{res}</div>
                    )}
                    <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                      <button onClick={()=>abrirEditar(p)} className="btn btn-s btn-xs">✏ Editar</button>
                      <button onClick={()=>toggleActivo(p.id,p.activo)} className="btn btn-xs" style={{background:p.activo?'#fef3c7':'#dcfce7',color:p.activo?'#b45309':'#15803d',border:'none',borderRadius:6,padding:'4px 9px',fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>{p.activo?'Desactivar':'Activar'}</button>
                      <button onClick={()=>eliminar(p.id,p.nombre)} className="btn btn-d btn-xs">🗑</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {modal&&(
        <div className="mo" onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div className="mo-box" style={{maxWidth:540}}>
            <div className="mo-head"><h3>{editando?'Editar persona':'Agregar persona'}</h3><button className="mo-close" onClick={()=>setModal(false)}>×</button></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div className="ig"><label>Nombre completo</label><input value={mNombre} onChange={e=>setMNombre(e.target.value)} placeholder="Nombres y apellidos"/></div>
              <div className="ig"><label>DNI</label><input value={mDni} onChange={e=>setMDni(e.target.value)} placeholder="Nro. de documento"/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div className="ig"><label>Rol</label>
                <select value={mRol} onChange={e=>setMRol(e.target.value)}>
                  {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="ig"><label>Subrol / Especialidad</label><input value={mSubrol} onChange={e=>setMSubrol(e.target.value)} placeholder="Ej: Ing. Ambiental"/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
              <div className="ig"><label>Grupo</label>
                <select value={mGrupo} onChange={e=>setMGrupo(e.target.value)}>
                  <option value="ESAT">ESAT</option>
                  <option value="EcoBIOTEM">EcoBIOTEM</option>
                </select>
              </div>
              <div className="ig"><label>Hora ingreso</label><input type="time" value={mHora} onChange={e=>setMHora(e.target.value)}/></div>
              <div className="ig"><label>Tolerancia (min)</label><input type="number" value={mTol} onChange={e=>setMTol(+e.target.value)} min={0} max={30}/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:12,marginBottom:16}}>
              <div className="ig"><label>Área</label><input value={mArea} onChange={e=>setMArea(e.target.value)} placeholder="Ambiental, Sistemas..."/></div>
              <div className="ig"><label>Hs/semana</label><input type="number" value={mHsSem} onChange={e=>setMHsSem(e.target.value)} placeholder="20" step="0.5"/></div>
              <div className="ig"><label>Color</label><input type="color" value={mColor} onChange={e=>setMColor(e.target.value)} style={{height:38,padding:'2px 4px',width:52}}/></div>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-s" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={guardar} disabled={saving||!mNombre||!mDni}>{saving?'Guardando...':editando?'Guardar cambios':'Agregar persona'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
