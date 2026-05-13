'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const ROLES = ['Practicante','Tesista','Voluntario','Investigador','Asistente','SENATI','EcoBIOTEM','Coordinador']
const DIAS = ['L','M','X','J','V']
const DIAS_LABEL: Record<string,string> = {L:'Lunes',M:'Martes',X:'Miércoles',J:'Jueves',V:'Viernes'}

const AREAS = [
  'Ing. Sistemas',
  'Ing. Ambiental',
  'Comunicaciones',
  'Derecho',
  'Administración',
  'Recursos Humanos',
  'General'
]

const ORIGENES = [
  'UNASAM',
  'SENATI',
  'UCV',
  'EXTERNO'
]

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
  const [vistaInactivos, setVistaInactivos] = useState(false)

  // Estados del formulario
  const [mNombre,   setMNombre]   = useState('')
  const [mDni,      setMDni]      = useState('')
  const [mRol,      setMRol]      = useState('Practicante')
  const [mSubrol,   setMSubrol]   = useState('')
  const [mOrigen,   setMOrigen]   = useState('UNASAM')
  const [mGrupo,    setMGrupo]    = useState('ESAT')
  const [mArea,     setMArea]     = useState('Ing. Sistemas')
  const [mColor,    setMColor]    = useState('#1e40af')
  const [mHsSem,    setMHsSem]    = useState('')
  
  // Horarios por día (estructura: {L: [{entrada, salida}], M: [...], ...})
  const [mHorariosDia, setMHorariosDia] = useState<Record<string, Array<{entrada:string, salida:string}>>>({
    L: [], M: [], X: [], J: [], V: []
  })

  const [saving,    setSaving]    = useState(false)

  useEffect(()=>{load()},[])

  async function load(){
    const [p,h] = await Promise.all([
      supabase.from('personas').select('*').order('nombre'),
      supabase.from('horarios').select('*'),
    ])
    setPersonas(p.data??[])
    setHorarios(h.data??[])
    setLoading(false)
  }

  function horarioResumen(pid:string){
    return DIAS.map(d=>{
      const ff = horarios.filter(h=>h.persona_id===pid && h.dia===d)
      if(!ff.length) return null
      return `${DIAS_LABEL[d]}: ${ff.map(f=>f.hora_entrada.slice(0,5)+'–'+f.hora_salida.slice(0,5)).join(', ')}`
    }).filter(Boolean).join(' | ')
  }

  function abrirNuevo(){
    setEditando(null)
    setMNombre('')
    setMDni('')
    setMRol('Practicante')
    setMSubrol('')
    setMOrigen('UNASAM')
    setMGrupo('ESAT')
    setMArea('Ing. Sistemas')
    setMColor('#1e40af')
    setMHsSem('')
    setMHorariosDia({L: [], M: [], X: [], J: [], V: []})
    setModal(true)
  }

  async function abrirEditar(p:any){
    setEditando(p)
    setMNombre(p.nombre)
    setMDni(p.dni)
    setMRol(p.rol)
    setMSubrol(p.subrol??'')
    setMOrigen(p.origen??'UNASAM')
    setMGrupo(p.grupo)
    setMArea(p.area??'Ing. Sistemas')
    setMColor(p.color??'#1e40af')
    setMHsSem(p.hs_semanales?.toString()??'')
    
    // Cargar horarios por día desde la BD
    const hPersona = horarios.filter(h=>h.persona_id===p.id)
    const horariosPorDia: Record<string, Array<{entrada:string, salida:string}>> = {
      L: [], M: [], X: [], J: [], V: []
    }
    hPersona.forEach(h=>{
      if(horariosPorDia[h.dia]) {
        horariosPorDia[h.dia].push({entrada: h.hora_entrada, salida: h.hora_salida})
      }
    })
    setMHorariosDia(horariosPorDia)
    setModal(true)
  }

  async function toggleActivo(id:string, activo:boolean){
    await supabase.from('personas').update({activo:!activo}).eq('id',id)
    load()
  }

  // Función para "eliminar" (en realidad es desactivar)
  async function desactivarPersona(id:string, nombre:string){
    if(!confirm(`¿Desactivar a ${nombre}?\n\nEl usuario pasará a la lista de "Personal Inactivo" y podrá ser reactivado en el futuro.`)) return
    await supabase.from('personas').update({activo:false}).eq('id',id)
    load()
  }

  // Agregar franja horaria a un día
  function agregarFranja(dia:string){
    const nuevas = {...mHorariosDia}
    nuevas[dia] = [...(nuevas[dia]||[]), {entrada:'08:00', salida:'13:00'}]
    setMHorariosDia(nuevas)
  }

  // Actualizar franja horaria
  function actualizarFranja(dia:string, index:number, campo:'entrada'|'salida', valor:string){
    const nuevas = {...mHorariosDia}
    if(nuevas[dia][index]) {
      nuevas[dia][index][campo] = valor
      setMHorariosDia(nuevas)
    }
  }

  // Eliminar franja horaria
  function eliminarFranja(dia:string, index:number){
    const nuevas = {...mHorariosDia}
    nuevas[dia] = nuevas[dia].filter((_,i)=>i!==index)
    setMHorariosDia(nuevas)
  }

  async function guardar(){
    if(!mNombre||!mDni) return
    setSaving(true)
    
    const esEco = mRol==='EcoBIOTEM'
    const data = {
      nombre: mNombre,
      dni: mDni,
      rol: mRol,
      subrol: mSubrol||null,
      origen: mOrigen,
      grupo: mGrupo,
      hora_ingreso: esEco?null:(mHorariosDia.L?.[0]?.entrada ?? '08:00:00'),
      tolerancia: 10,
      color: mColor,
      area: mArea||null,
      hs_semanales: mHsSem?parseFloat(mHsSem):null,
      sin_horario: esEco
    }

    try {
      let personaId = editando?.id
      
      if(editando){
        await supabase.from('personas').update(data).eq('id', editando.id)
      } else {
        const {data: nuevo} = await supabase.from('personas').insert({...data, activo:true}).select().single()
        personaId = nuevo.id
      }

      // Guardar horarios por día
      if(personaId && !esEco){
        // Primero eliminar horarios antiguos si es edición
        if(editando){
          await supabase.from('horarios').delete().eq('persona_id', personaId)
        }
        
        // Insertar nuevos horarios
        const horariosAInsertar: any[] = []
        DIAS.forEach(dia=>{
          (mHorariosDia[dia]||[]).forEach(franja=>{
            horariosAInsertar.push({
              persona_id: personaId,
              dia: dia,
              hora_entrada: franja.entrada + ':00',
              hora_salida: franja.salida + ':00'
            })
          })
        })
        
        if(horariosAInsertar.length > 0){
          await supabase.from('horarios').insert(horariosAInsertar)
        }
      }

      setModal(false)
      setSaving(false)
      load()
    } catch(err){
      console.error('Error:', err)
      alert('Error al guardar')
      setSaving(false)
    }
  }

  const personasActivas = personas.filter(p=>p.activo!==false)
  const personasInactivas = personas.filter(p=>p.activo===false)
  
  const filtradas = (vistaInactivos ? personasInactivas : personasActivas).filter(p=>
    p.nombre.toLowerCase().includes(buscar.toLowerCase())||
    (p.dni??'').includes(buscar)||(p.rol??'').toLowerCase().includes(buscar.toLowerCase())
  )

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando personas...</div>

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Lora,serif',fontSize:24,color:'#002F6C',fontWeight:600}}>
            {vistaInactivos ? 'Personal Inactivo' : 'Personal Activo'}
          </h1>
          <p style={{fontSize:12,color:'#475569',marginTop:3}}>
            {personasActivas.length} activos · {personasInactivas.length} inactivos · {personas.length} total
          </p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <input 
            value={buscar} 
            onChange={e=>setBuscar(e.target.value)} 
            placeholder="Buscar nombre, DNI, rol..." 
            style={{padding:'8px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13,fontFamily:'inherit',outline:'none',width:220}}
          />
          <button 
            onClick={()=>setVistaInactivos(!vistaInactivos)} 
            style={{padding:'8px 16px',borderRadius:9,border:'1.5px solid #e2e8f0',background:vistaInactivos?'#fef3c7':'white',color:vistaInactivos?'#b45309':'#475569',cursor:'pointer',fontWeight:600,fontSize:13}}>
            {vistaInactivos ? '👤 Ver Activos' : '📁 Ver Inactivos'}
          </button>
          {!vistaInactivos && (
            <button onClick={abrirNuevo} style={{padding:'8px 16px',background:'#002F6C',color:'white',border:'none',borderRadius:9,cursor:'pointer',fontWeight:600,fontSize:13}}>
              + Agregar
            </button>
          )}
        </div>
      </div>

      {/* Alerta si hay inactivos */}
      {vistaInactivos && personasInactivas.length > 0 && (
        <div style={{background:'#fef3c7',border:'1.5px solid #fde68a',borderRadius:10,padding:'12px 16px',marginBottom:20}}>
          <span style={{fontSize:13,color:'#b45309',fontWeight:600}}>
            ℹ️ Mostrando {personasInactivas.length} persona(s) inactiva(s) - Pueden ser reactivadas en cualquier momento
          </span>
        </div>
      )}

      {/* Lista de personas agrupadas */}
      {GRUPOS_CONFIG.map(grupo=>{
        const gp = filtradas.filter(p=>p.rol===grupo.rol)
        if(!gp.length) return null
        return (
          <div key={grupo.rol} style={{marginBottom:28}}>
            <h2 style={{fontSize:13,fontWeight:600,color:grupo.color,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:12}}>
              {grupo.label} <span style={{fontSize:11,fontWeight:400,color:'#94a3b8'}}>({gp.length})</span>
            </h2>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:12}}>
              {gp.map(p=>{
                const res = horarioResumen(p.id)
                return (
                  <div key={p.id} style={{background:'white',borderRadius:12,border:`1.5px solid ${p.activo!==false?'#e2e8f0':'#fca5a5'}`,padding:16,boxShadow:'0 1px 3px rgba(0,0,0,.06)',opacity:p.activo!==false?1:.7}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                      <div style={{width:42,height:42,borderRadius:10,background:p.color+'25',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:17,color:p.color,flexShrink:0}}>
                        {p.nombre.charAt(0)}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600}}>{p.nombre}</div>
                        <div style={{fontSize:11,color:'#94a3b8'}}>
                          {p.rol==='SENATI'?`Practicante SENATI · ${p.subrol}`:p.rol==='Practicante'?`Practicante UNASAM · ${p.subrol}`:p.rol}
                        </div>
                      </div>
                      <span style={{fontSize:10,fontWeight:600,padding:'3px 8px',borderRadius:20,background:p.activo!==false?'#dcfce7':'#fee2e2',color:p.activo!==false?'#15803d':'#b91c1c'}}>
                        {p.activo!==false?'Activo':'Inactivo'}
                      </span>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,fontSize:11,color:'#94a3b8',marginBottom:10}}>
                      <span>📋 DNI: <strong style={{color:'#475569'}}>{p.dni}</strong></span>
                      <span>🏢 {p.origen||'UNASAM'}</span>
                      {p.area && <span>📍 {p.area}</span>}
                      {p.hs_semanales && <span>⏱ {p.hs_semanales}h/sem</span>}
                    </div>
                    {res && (
                      <div style={{fontSize:10,color:'#475569',background:'#f8fafc',borderRadius:7,padding:'6px 8px',marginBottom:10,lineHeight:1.7}}>
                        {res}
                      </div>
                    )}
                    <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                      <button onClick={()=>abrirEditar(p)} style={{padding:'5px 10px',background:'#dbeafe',color:'#1d4ed8',border:'1px solid #93c5fd',borderRadius:7,fontSize:11,cursor:'pointer',fontWeight:600}}>
                        ✏ Editar
                      </button>
                      <button 
                        onClick={()=>toggleActivo(p.id, p.activo)} 
                        style={{padding:'5px 10px',background:p.activo!==false?'#fef3c7':'#dcfce7',color:p.activo!==false?'#b45309':'#15803d',border:'none',borderRadius:7,fontSize:11,cursor:'pointer',fontWeight:600}}>
                        {p.activo!==false?'Desactivar':'Activar'}
                      </button>
                      {p.activo!==false && (
                        <button onClick={()=>desactivarPersona(p.id,p.nombre)} style={{padding:'5px 10px',background:'#fee2e2',color:'#b91c1c',border:'1px solid #fca5a5',borderRadius:7,fontSize:11,cursor:'pointer',fontWeight:600}}>
                          🗑 Desactivar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {!filtradas.length && (
        <div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>
          No se encontraron personas {vistaInactivos?'inactivas':''} {buscar?`con "${buscar}"`:''}
        </div>
      )}

      {/* Modal Agregar/Editar */}
      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20,overflowY:'auto'}}
          onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div style={{background:'white',borderRadius:18,padding:24,width:'100%',maxWidth:700,boxShadow:'0 24px 80px rgba(0,0,0,.25)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{fontSize:18,fontWeight:700,margin:0}}>{editando?'Editar persona':'Agregar persona'}</h3>
              <button onClick={()=>setModal(false)} style={{width:32,height:32,borderRadius:'50%',border:'none',background:'#f1f5f9',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            
            {/* Datos básicos */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Nombre completo *</label>
                <input value={mNombre} onChange={e=>setMNombre(e.target.value)} placeholder="Nombres y apellidos"
                  style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}/>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>DNI *</label>
                <input value={mDni} onChange={e=>setMDni(e.target.value)} placeholder="Nro. de documento"
                  style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}/>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Rol</label>
                <select value={mRol} onChange={e=>setMRol(e.target.value)}
                  style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}>
                  {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Origen</label>
                <select value={mOrigen} onChange={e=>setMOrigen(e.target.value)}
                  style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}>
                  {ORIGENES.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Área</label>
                <select value={mArea} onChange={e=>setMArea(e.target.value)}
                  style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}>
                  {AREAS.map(a=><option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Subrol / Especialidad</label>
                <input value={mSubrol} onChange={e=>setMSubrol(e.target.value)} placeholder="Ej: Ing. Ambiental"
                  style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}/>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Grupo</label>
                <select value={mGrupo} onChange={e=>setMGrupo(e.target.value)}
                  style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}>
                  <option value="ESAT">ESAT</option>
                  <option value="EcoBIOTEM">EcoBIOTEM</option>
                </select>
              </div>
            </div>

            {/* Horarios por día */}
            {mRol !== 'EcoBIOTEM' && (
              <div style={{marginBottom:16,padding:'16px',background:'#f8fafc',borderRadius:12,border:'1.5px solid #e2e8f0'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <h4 style={{fontSize:13,fontWeight:600,color:'#0f172a',margin:0}}>📅 Horarios por día</h4>
                  <span style={{fontSize:11,color:'#64748b'}}>Agrega turnos (mañana/tarde)</span>
                </div>
                
                {DIAS.map(dia=>(
                  <div key={dia} style={{marginBottom:12,padding:'10px',background:'white',borderRadius:8,border:'1px solid #e2e8f0'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                      <span style={{fontSize:12,fontWeight:600,color:'#475569'}}>{DIAS_LABEL[dia]}</span>
                      <button onClick={()=>agregarFranja(dia)} 
                        style={{padding:'3px 8px',background:'#10b981',color:'white',border:'none',borderRadius:5,fontSize:10,cursor:'pointer',fontWeight:600}}>
                        + Agregar turno
                      </button>
                    </div>
                    {(mHorariosDia[dia]||[]).map((franja,idx)=>(
                      <div key={idx} style={{display:'flex',gap:8,alignItems:'center',marginBottom:6}}>
                        <input type="time" value={franja.entrada} onChange={e=>actualizarFranja(dia,idx,'entrada',e.target.value)}
                          style={{flex:1,padding:'6px 8px',border:'1px solid #d1d5db',borderRadius:6,fontSize:12}}/>
                        <span style={{color:'#94a3b8'}}>a</span>
                        <input type="time" value={franja.salida} onChange={e=>actualizarFranja(dia,idx,'salida',e.target.value)}
                          style={{flex:1,padding:'6px 8px',border:'1px solid #d1d5db',borderRadius:6,fontSize:12}}/>
                        <button onClick={()=>eliminarFranja(dia,idx)} 
                          style={{width:24,height:24,border:'none',background:'#fee2e2',color:'#b91c1c',borderRadius:5,cursor:'pointer',fontSize:12}}>×</button>
                      </div>
                    ))}
                    {(mHorariosDia[dia]||[]).length===0 && (
                      <div style={{fontSize:11,color:'#94a3b8',padding:'4px 0'}}>Sin horario registrado</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:12,marginBottom:16}}>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Horas/semana</label>
                <input type="number" value={mHsSem} onChange={e=>setMHsSem(e.target.value)} placeholder="20" step="0.5"
                  style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}/>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Color</label>
                <input type="color" value={mColor} onChange={e=>setMColor(e.target.value)} 
                  style={{height:38,padding:'2px 4px',width:60,border:'1.5px solid #e2e8f0',borderRadius:9,cursor:'pointer'}}/>
              </div>
            </div>

            <div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingTop:16,borderTop:'1px solid #e2e8f0'}}>
              <button onClick={()=>setModal(false)} 
                style={{padding:'10px 20px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'white',cursor:'pointer',fontSize:13,fontFamily:'inherit',fontWeight:600}}>
                Cancelar
              </button>
              <button onClick={guardar} disabled={saving||!mNombre||!mDni}
                style={{padding:'10px 24px',borderRadius:9,border:'none',background:'#002F6C',color:'white',cursor:(!mNombre||!mDni||saving)?'not-allowed':'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit',opacity:(!mNombre||!mDni||saving)?.6:1}}>
                {saving?'Guardando...':editando?'Guardar cambios':'Agregar persona'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}