'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const DIAS = ['L','M','X','J','V'] as const
const DIAS_NM: Record<string,string> = {L:'Lunes',M:'Martes',X:'Miércoles',J:'Jueves',V:'Viernes'}
const GRUPOS_HS = [
  {rol:'Practicante',label:'🎓 Practicantes UNASAM',color:'#1e40af'},
  {rol:'SENATI',     label:'🔧 Practicantes Externos (SENATI)',color:'#92400e'},
  {rol:'Voluntario', label:'🤝 Voluntarios ESAT',color:'#15803d'},
  {rol:'Asistente',  label:'💼 Asistentes T. Completo',color:'#374151'},
]

function turnoCell(franjas:any[]){
  if(!franjas.length) return {bg:'#f8fafc',border:'#e2e8f0',txt:'—',detail:''}
  const m=franjas.some(f=>parseInt(f.hora_entrada)<13)
  const t=franjas.some(f=>parseInt(f.hora_entrada)>=13)
  const detail=franjas.map(f=>f.hora_entrada.slice(0,5)+'–'+f.hora_salida.slice(0,5)).join('\n')
  if(m&&t) return {bg:'#fef9c3',border:'#fde047',txt:'M+T',detail}
  if(m)    return {bg:'#dbeafe',border:'#93c5fd',txt:'M',detail}
  if(t)    return {bg:'#dcfce7',border:'#86efac',txt:'T',detail}
  return {bg:'#f8fafc',border:'#e2e8f0',txt:'—',detail:''}
}

export default function HorariosPage(){
  const supabase = createClient()
  const [personas,   setPersonas]   = useState<any[]>([])
  const [horarios,   setHorarios]   = useState<any[]>([])
  const [permisos,   setPermisos]   = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [modalEdit,  setModalEdit]  = useState(false)
  const [editPerId,  setEditPerId]  = useState('')
  const [editFranjas,setEditFranjas]= useState<Record<string,{id?:string,e:string,s:string}[]>>({L:[],M:[],X:[],J:[],V:[]})
  const [saving,     setSaving]     = useState(false)
  const [modalPerm,  setModalPerm]  = useState(false)
  const [mpPerId,    setMpPerId]    = useState('')
  const [mpTipo,     setMpTipo]     = useState('permiso_personal')
  const [mpFecha,    setMpFecha]    = useState(format(new Date(),'yyyy-MM-dd'))
  const [mpMotivo,   setMpMotivo]   = useState('')
  const [mpDia,      setMpDia]      = useState('L')
  const [mpEntrada,  setMpEntrada]  = useState('08:30')
  const [mpSalida,   setMpSalida]   = useState('13:00')

  useEffect(()=>{load()},[])

  async function load(){
    const [p,h,pe]=await Promise.all([
      supabase.from('personas').select('*').eq('activo',true).order('nombre'),
      supabase.from('horarios').select('*'),
      supabase.from('permisos').select('*, personas(nombre,color,rol)').order('created_at',{ascending:false}).limit(20),
    ])
    setPersonas(p.data??[]);setHorarios(h.data??[]);setPermisos(pe.data??[])
    setLoading(false)
  }

  function franjas(pid:string,dia:string){
    return horarios.filter(h=>h.persona_id===pid&&h.dia===dia)
  }

  function totalHs(pid:string){
    return horarios.filter(h=>h.persona_id===pid).reduce((acc,h)=>{
      const [he,me]=h.hora_entrada.split(':').map(Number)
      const [hs,ms]=h.hora_salida.split(':').map(Number)
      return acc+((hs*60+ms)-(he*60+me))/60
    },0)
  }

  function resumenHorario(pid:string){
    return DIAS.map(d=>{
      const ff=franjas(pid,d)
      if(!ff.length) return null
      return `${DIAS_NM[d].slice(0,3)}: ${ff.map(f=>f.hora_entrada.slice(0,5)+'–'+f.hora_salida.slice(0,5)).join(', ')}`
    }).filter(Boolean).join(' | ')
  }

  function abrirEdicion(persona:any){
    const fr: Record<string,{id?:string,e:string,s:string}[]>={L:[],M:[],X:[],J:[],V:[]}
    horarios.filter(h=>h.persona_id===persona.id).forEach(h=>{
      if(fr[h.dia]) fr[h.dia].push({id:h.id,e:h.hora_entrada.slice(0,5),s:h.hora_salida.slice(0,5)})
    })
    setEditFranjas(fr);setEditPerId(persona.id);setModalEdit(true)
  }

  function addFranja(dia:string){setEditFranjas(p=>({...p,[dia]:[...p[dia],{e:'08:30',s:'13:00'}]}))}
  function delFranja(dia:string,i:number){setEditFranjas(p=>({...p,[dia]:p[dia].filter((_:any,j:number)=>j!==i)}))}
  function updFranja(dia:string,i:number,f:'e'|'s',v:string){
    setEditFranjas(p=>{const n={...p};n[dia]=n[dia].map((x:any,j:number)=>j===i?{...x,[f]:v}:x);return n})
  }

  async function guardarHorario(){
    setSaving(true)
    await supabase.from('horarios').delete().eq('persona_id',editPerId)
    const rows:any[]=[]
    DIAS.forEach(d=>{editFranjas[d].forEach(f=>{if(f.e&&f.s)rows.push({persona_id:editPerId,dia:d,hora_entrada:f.e+':00',hora_salida:f.s+':00'})})})
    if(rows.length) await supabase.from('horarios').insert(rows)
    setSaving(false);setModalEdit(false);load()
  }

  async function guardarPermiso(){
    if(!mpPerId) return
    setSaving(true)
    // Usamos la tabla permisos para todo (más simple y compatible)
    await supabase.from('permisos').insert({
      persona_id:mpPerId,
      tipo: mpTipo==='cambio_horario' ? 'permiso_personal' : mpTipo,
      fecha_inicio:mpFecha,
      fecha_fin:mpFecha,
      motivo: mpMotivo || (mpTipo==='cambio_horario' ? `Cambio horario ${mpDia}: ${mpEntrada}-${mpSalida}` : ''),
      estado:'pendiente',
      dias_recuperacion: mpTipo==='cambio_horario' ? `${mpDia} ${mpEntrada}-${mpSalida}` : null
    })
    setSaving(false);setModalPerm(false);setMpMotivo('');load()
  }

  const esat=personas.filter(p=>p.grupo==='ESAT')
  const eco =personas.filter(p=>p.grupo==='EcoBIOTEM')

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando horarios...</div>

  return (
    <div style={{padding:'24px',fontFamily:'sans-serif',background:'#f8fafc',minHeight:'100vh'}}>
      
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:18,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,color:'#002F6C',margin:0}}>Gestión de horarios</h1>
          <p style={{fontSize:12,color:'#94a3b8',marginTop:2}}>Horarios actualizados · Semana regular del equipo ESAT</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setModalPerm(true)} style={{padding:'8px 16px',background:'white',border:'1.5px solid #e2e8f0',borderRadius:9,cursor:'pointer',fontWeight:600,fontSize:13}}>
            📋 Ver permisos
          </button>
          <button onClick={()=>setModalPerm(true)} style={{padding:'8px 16px',background:'#002F6C',color:'white',border:'none',borderRadius:9,cursor:'pointer',fontWeight:600,fontSize:13}}>
            + Registrar cambio
          </button>
        </div>
      </div>

      {/* Leyenda */}
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:18,flexWrap:'wrap'}}>
        <span style={{fontSize:11,fontWeight:600,color:'#475569'}}>LEYENDA:</span>
        {[['#dbeafe','Mañana'],['#dcfce7','Tarde'],['#fef9c3','Ambos'],['#f8fafc','Libre']].map(([bg,l])=>(
          <div key={l} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#475569'}}>
            <div style={{width:14,height:14,borderRadius:3,background:bg as string,border:'1px solid #e2e8f0'}}/>
            {l}
          </div>
        ))}
      </div>

      {/* EcoBIOTEM */}
      <div style={{background:'white',borderRadius:12,border:'2px solid #86efac',padding:'16px 20px',marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <span style={{width:10,height:10,borderRadius:'50%',background:'#15803d',display:'inline-block'}}/>
          <span style={{fontSize:13,fontWeight:600,color:'#15803d'}}>🌿 GI EcoBIOTEM — Horario flexible</span>
        </div>
        <p style={{fontSize:13,color:'#475569',lineHeight:1.7,margin:0}}>
          Los miembros del GI EcoBIOTEM <strong>no tienen horario fijo</strong>. Registran horas desde su panel personal. <strong>{eco.length} miembros activos.</strong>
        </p>
      </div>

      {/* Tabla de horarios por grupo */}
      {GRUPOS_HS.map(g=>{
        const gp=esat.filter(p=>p.rol===g.rol)
        if(!gp.length) return null
        return (
          <div key={g.rol} style={{marginBottom:28}}>
            <h2 style={{fontSize:13,fontWeight:600,color:g.color,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:12}}>{g.label}</h2>
            <div style={{background:'white',borderRadius:12,border:'1.5px solid #e2e8f0',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{background:'#f8fafc'}}>
                      <th style={{padding:'10px 16px',textAlign:'left',fontWeight:600,color:'#64748b',borderBottom:'1.5px solid #e2e8f0'}}>Persona</th>
                      {DIAS.map(d=><th key={d} style={{padding:'10px 12px',textAlign:'center',fontWeight:600,color:'#64748b',borderBottom:'1.5px solid #e2e8f0'}}>{DIAS_NM[d].slice(0,3)}</th>)}
                      <th style={{padding:'10px 12px',textAlign:'center',fontWeight:600,color:'#64748b',borderBottom:'1.5px solid #e2e8f0'}}>Hs/sem</th>
                      <th style={{padding:'10px 12px',textAlign:'center',fontWeight:600,color:'#64748b',borderBottom:'1.5px solid #e2e8f0'}}>Editar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gp.map((p,i)=>(
                      <tr key={p.id} style={{background:i%2===0?'white':'#fafafa'}}>
                        <td style={{padding:'12px 16px',borderBottom:'1px solid #f1f5f9'}}>
                          <div style={{display:'flex',alignItems:'center',gap:9}}>
                            <div style={{width:32,height:32,borderRadius:8,background:p.color+'25',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,color:p.color}}>{p.nombre.charAt(0)}</div>
                            <div>
                              <div style={{fontSize:12,fontWeight:600}}>{p.nombre}</div>
                              <div style={{fontSize:10,color:'#94a3b8'}}>{p.subrol??p.rol}</div>
                            </div>
                          </div>
                        </td>
                        {DIAS.map(d=>{
                          const ff=franjas(p.id,d)
                          const tc=turnoCell(ff)
                          return (
                            <td key={d} style={{padding:'8px',textAlign:'center',borderBottom:'1px solid #f1f5f9'}}>
                              {ff.length>0?(
                                <div title={tc.detail} style={{display:'inline-flex',flexDirection:'column',alignItems:'center',background:tc.bg,border:`1.5px solid ${tc.border}`,borderRadius:8,padding:'5px 10px',cursor:'help',minWidth:60}}>
                                  <span style={{fontSize:11,fontWeight:700}}>{tc.txt}</span>
                                  <span style={{fontSize:8,color:'#64748b',marginTop:1,whiteSpace:'pre',textAlign:'center',lineHeight:1.4}}>{tc.detail}</span>
                                </div>
                              ):(
                                <span style={{fontSize:12,color:'#cbd5e1'}}>—</span>
                              )}
                            </td>
                          )
                        })}
                        <td style={{padding:'8px',textAlign:'center',borderBottom:'1px solid #f1f5f9',fontSize:12,fontWeight:700,color:'#002F6C'}}>{totalHs(p.id).toFixed(1)}h</td>
                        <td style={{padding:'8px',textAlign:'center',borderBottom:'1px solid #f1f5f9'}}>
                          <button onClick={()=>abrirEdicion(p)} style={{background:'#dbeafe',color:'#1d4ed8',border:'1px solid #93c5fd',borderRadius:7,padding:'4px 10px',fontSize:11,cursor:'pointer',fontWeight:600}}>✏ Editar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })}

      {/* Permisos registrados */}
      <div style={{background:'white',borderRadius:12,border:'1.5px solid #e2e8f0',marginBottom:24,boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid #e2e8f0',display:'flex',alignItems:'center',gap:8}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:'#d97706',display:'inline-block'}}/>
          <span style={{fontSize:13,fontWeight:600}}>📋 Permisos y cambios registrados</span>
        </div>
        <div style={{padding:'14px 20px',display:'flex',flexDirection:'column',gap:7,maxHeight:320,overflowY:'auto'}}>
          {permisos.length===0&&<p style={{fontSize:13,color:'#94a3b8',textAlign:'center',padding:'16px 0'}}>Sin registros recientes</p>}
          {permisos.map(p=>{
            const EC: Record<string,string>={aprobado:'#dcfce7',pendiente:'#fef3c7',rechazado:'#fee2e2'}
            const ET: Record<string,string>={aprobado:'#15803d',pendiente:'#b45309',rechazado:'#b91c1c'}
            return (
              <div key={p.id} style={{padding:'9px 14px',background:'#fffbeb',borderRadius:9,borderLeft:'3px solid #fde68a',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                <div style={{flex:1}}>
                  <strong style={{fontSize:12}}>{p.personas?.nombre}</strong>
                  <span style={{fontSize:11,color:'#94a3b8',marginLeft:8}}>{p.tipo?.replace('_',' ')} · {p.fecha_inicio}</span>
                  {p.motivo&&<span style={{fontSize:11,color:'#475569',marginLeft:8}}>"{p.motivo}"</span>}
                  {p.dias_recuperacion&&<span style={{fontSize:11,color:'#15803d',marginLeft:8}}>🔁 {p.dias_recuperacion}</span>}
                </div>
                <span style={{fontSize:10,fontWeight:600,padding:'2px 9px',borderRadius:20,background:EC[p.estado]??'#f1f5f9',color:ET[p.estado]??'#94a3b8'}}>{p.estado}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal edición horario */}
      {modalEdit && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={e=>{if(e.target===e.currentTarget)setModalEdit(false)}}>
          <div style={{background:'white',borderRadius:18,padding:24,width:'100%',maxWidth:520,boxShadow:'0 24px 80px rgba(0,0,0,.25)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{fontSize:16,fontWeight:700,margin:0}}>Editar horario — {personas.find(p=>p.id===editPerId)?.nombre}</h3>
              <button onClick={()=>setModalEdit(false)} style={{width:28,height:28,borderRadius:'50%',border:'none',background:'#f1f5f9',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            <p style={{fontSize:12,color:'#94a3b8',marginBottom:14}}>Agrega o elimina franjas por día.</p>
            {DIAS.map(d=>(
              <div key={d} style={{marginBottom:10,padding:'10px 14px',background:'#f8fafc',borderRadius:10,border:'1px solid #e2e8f0'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:7}}>
                  <span style={{fontSize:12,fontWeight:700,color:'#002F6C'}}>{DIAS_NM[d]}</span>
                  <button onClick={()=>addFranja(d)} style={{fontSize:11,padding:'3px 9px',borderRadius:7,border:'1px solid #93c5fd',background:'#eff6ff',color:'#1d4ed8',cursor:'pointer',fontWeight:600}}>+ Franja</button>
                </div>
                {editFranjas[d].length===0&&<span style={{fontSize:11,color:'#cbd5e1'}}>Libre — sin franja</span>}
                {editFranjas[d].map((f:any,i:number)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                    <input type="time" value={f.e} onChange={e=>updFranja(d,i,'e',e.target.value)} style={{padding:'5px 8px',border:'1.5px solid #e2e8f0',borderRadius:7,fontFamily:'inherit',fontSize:12,width:100}}/>
                    <span style={{fontSize:11,color:'#94a3b8'}}>–</span>
                    <input type="time" value={f.s} onChange={e=>updFranja(d,i,'s',e.target.value)} style={{padding:'5px 8px',border:'1.5px solid #e2e8f0',borderRadius:7,fontFamily:'inherit',fontSize:12,width:100}}/>
                    <button onClick={()=>delFranja(d,i)} style={{background:'#fee2e2',border:'none',color:'#b91c1c',borderRadius:6,padding:'3px 7px',cursor:'pointer',fontSize:13}}>×</button>
                  </div>
                ))}
              </div>
            ))}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
              <button onClick={()=>setModalEdit(false)} style={{padding:'8px 16px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'white',cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>Cancelar</button>
              <button onClick={guardarHorario} disabled={saving} style={{padding:'8px 18px',borderRadius:9,border:'none',background:'#002F6C',color:'white',cursor:saving?'not-allowed':'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit',opacity:saving?.6:1}}>{saving?'Guardando...':'Guardar horario'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal permiso/cambio */}
      {modalPerm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={e=>{if(e.target===e.currentTarget)setModalPerm(false)}}>
          <div style={{background:'white',borderRadius:18,padding:24,width:'100%',maxWidth:450,boxShadow:'0 24px 80px rgba(0,0,0,.25)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{fontSize:16,fontWeight:700,margin:0}}>Registrar cambio / permiso</h3>
              <button onClick={()=>setModalPerm(false)} style={{width:28,height:28,borderRadius:'50%',border:'none',background:'#f1f5f9',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Persona</label>
                <select value={mpPerId} onChange={e=>setMpPerId(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}>
                  <option value="">Seleccionar...</option>
                  {personas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Tipo</label>
                <select value={mpTipo} onChange={e=>setMpTipo(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}>
                  <option value="permiso_personal">Permiso personal</option>
                  <option value="permiso_medico">Permiso médico</option>
                  <option value="permiso_academico">Permiso académico</option>
                  <option value="falta_justificada">Falta justificada</option>
                  <option value="cambio_horario">Cambio de horario</option>
                </select>
              </div>
            </div>
            {mpTipo==='cambio_horario' && (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
                <div>
                  <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Día</label>
                  <select value={mpDia} onChange={e=>setMpDia(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}>
                    {DIAS.map(d=><option key={d} value={d}>{DIAS_NM[d]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Entrada</label>
                  <input type="time" value={mpEntrada} onChange={e=>setMpEntrada(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Salida</label>
                  <input type="time" value={mpSalida} onChange={e=>setMpSalida(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}/>
                </div>
              </div>
            )}
            <div style={{marginBottom:12}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Fecha</label>
              <input type="date" value={mpFecha} onChange={e=>setMpFecha(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Motivo</label>
              <textarea value={mpMotivo} onChange={e=>setMpMotivo(e.target.value)} rows={2} placeholder="Detalla el cambio o permiso..." style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,resize:'vertical'}}/>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setModalPerm(false)} style={{padding:'8px 16px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'white',cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>Cancelar</button>
              <button onClick={guardarPermiso} disabled={saving||!mpPerId} style={{padding:'8px 18px',borderRadius:9,border:'none',background:'#002F6C',color:'white',cursor:(!mpPerId||saving)?'not-allowed':'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit',opacity:(!mpPerId||saving)?.6:1}}>{saving?'Guardando...':'Registrar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}