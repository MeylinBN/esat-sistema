'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const DIAS: Record<number,string> = {1:'L',2:'M',3:'X',4:'J',5:'V',6:'S',0:'D'}

export default function MiPanelPage() {
  const supabase = createClient()
  const hoy = format(new Date(),'yyyy-MM-dd')
  const diaKey = DIAS[new Date().getDay()]
  const [tiempo, setTiempo] = useState(format(new Date(),'HH:mm'))
  const [necesitaRecuperar, setNecesitaRecuperar] = useState(false)
const [diaRecuperacion, setDiaRecuperacion] = useState('')
const [horaRecuperacionInicio, setHoraRecuperacionInicio] = useState('')
const [horaRecuperacionFin, setHoraRecuperacionFin] = useState('')

  const [persona,    setPersona]    = useState<any>(null)
  const [horarios,   setHorarios]   = useState<any[]>([])
  const [asistHoy,   setAsistHoy]   = useState<any>(null)
  const [tareas,     setTareas]     = useState<any[]>([])
  const [avances,    setAvances]    = useState<any[]>([])
  const [asistMes,   setAsistMes]   = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [registrando,setRegistrando]= useState(false)
  const [modalAv,    setModalAv]    = useState(false)
  const [mTarea,     setMTarea]     = useState<any>(null)
  const [mPct,       setMPct]       = useState(0)
  const [mSem,       setMSem]       = useState('')
  const [saving,     setSaving]     = useState(false)
  const [motivoPermiso, setMotivoPermiso] = useState('')
  const [tipoPermiso,   setTipoPermiso]   = useState('permiso_medico')
  const [fechaPermiso,  setFechaPermiso]  = useState(hoy)
  const [enviandoPermiso, setEnviandoPermiso] = useState(false)
  const [permisoOk, setPermisoOk]   = useState(false)

  // Reloj en tiempo real
  useEffect(()=>{
    const t = setInterval(()=>setTiempo(format(new Date(),'HH:mm')),1000)
    return ()=>clearInterval(t)
  },[])

  useEffect(()=>{load()},[])

  async function load(){
    setLoading(true)
    const {data:{user}} = await supabase.auth.getUser()
    if(!user){setLoading(false);return}

    const {data:p} = await supabase.from('personas')
      .select('*').eq('auth_id',user.id).single()
    if(!p){setLoading(false);return}
    setPersona(p)

    const mesIni = hoy.slice(0,7)+'-01'
    const mesFin = new Date(new Date().getFullYear(),new Date().getMonth()+1,0).toISOString().slice(0,10)

    const [h,a,t,av,am] = await Promise.all([
      supabase.from('horarios').select('*').eq('persona_id',p.id),
      supabase.from('asistencias').select('*').eq('persona_id',p.id).eq('fecha',hoy).maybeSingle(),
      supabase.from('tareas').select('*').eq('persona_id',p.id).neq('estado','cancelada').order('created_at',{ascending:false}),
      supabase.from('avances_semanales').select('*').order('semana',{ascending:false}),
      supabase.from('asistencias').select('*').eq('persona_id',p.id).gte('fecha',mesIni).lte('fecha',mesFin),
    ])
    setHorarios(h.data??[])
    setAsistHoy(a.data??null)
    setTareas(t.data??[])
    setAvances(av.data??[])
    setAsistMes(am.data??[])
    setLoading(false)
  }

  async function marcarEntrada(){
    if(!persona||registrando) return
    setRegistrando(true)
    
    // ✅ HORA AUTOMÁTICA DEL SISTEMA
    const hora = format(new Date(),'HH:mm:ss')
    
    const [he,me]=(persona.hora_ingreso?.slice(0,5)??'08:30').split(':').map(Number)
    const [hr,mr]=tiempo.split(':').map(Number)
    const tard=Math.max(0,(hr*60+mr)-(he*60+me)-(persona.tolerancia??10))
    
    await supabase.from('asistencias').upsert(
      {persona_id:persona.id,fecha:hoy,hora_entrada:hora,estado:tard>0?'tarde':'presente',tardanza_min:tard},
      {onConflict:'persona_id,fecha'}
    )
    setRegistrando(false);load()
  }

  async function marcarSalida(){
    if(!persona||!asistHoy||registrando) return
    setRegistrando(true)
    
    // ✅ HORA AUTOMÁTICA DEL SISTEMA
    const hora = format(new Date(),'HH:mm:ss')
    
    await supabase.from('asistencias').update({hora_salida:hora}).eq('id',asistHoy.id)
    setRegistrando(false);load()
  }

  async function enviarPermiso(){
    if(!persona||!motivoPermiso) return
    setEnviandoPermiso(true)
    await supabase.from('permisos').insert({
  persona_id: persona.id,
  tipo: tipoPermiso,
  fecha_inicio: fechaPermiso,
  fecha_fin: fechaPermiso,
  motivo: motivoPermiso,
  sustento_texto: motivoPermiso,  // Agregamos el sustento como texto
  dia_recuperacion: necesitaRecuperar ? diaRecuperacion : null,
  hora_recuperacion_inicio: necesitaRecuperar ? horaRecuperacionInicio : null,
  hora_recuperacion_fin: necesitaRecuperar ? horaRecuperacionFin : null,
  estado: 'pendiente'
})
    setMotivoPermiso('');setPermisoOk(true);setEnviandoPermiso(false)
    setTimeout(()=>setPermisoOk(false),3000)
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

  function franjas(dia:string){return horarios.filter(h=>h.dia===dia)}
  function ultimoAvance(tid:string){return avances.filter(a=>a.tarea_id===tid).sort((a,b)=>b.semana.localeCompare(a.semana))[0]}

  const franjasHoy = franjas(diaKey)
  const horarioHoyStr = franjasHoy.length>0
    ? franjasHoy.map(f=>f.hora_entrada.slice(0,5)+'–'+f.hora_salida.slice(0,5)).join(' | ')
    : 'Sin horario hoy'

  const horasMes = asistMes.filter(a=>a.hora_entrada&&a.hora_salida).reduce((acc,a)=>{
    const [he,me]=a.hora_entrada.split(':').map(Number)
    const [hs,ms]=a.hora_salida.split(':').map(Number)
    return acc+Math.max(0,((hs*60+ms)-(he*60+me))/60)
  },0)
  const tareasActivas = tareas.filter(t=>t.estado==='en_progreso'||t.estado==='pendiente')
  const tareasComp    = tareas.filter(t=>t.estado==='completada')

  const TIPO_PERMISO: Record<string,string> = {
    permiso_medico:'🏥 Médico', permiso_personal:'👤 Personal',
    permiso_academico:'🎓 Académico', falta_justificada:'📋 Falta justificada',
  }

{/* Formulario de Permiso */}
<div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, marginBottom: 16 }}>
  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>📋 Solicitar Permiso o Recuperación</h3>
  
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Tipo de Permiso</label>
      <select value={tipoPermiso} onChange={e => setTipoPermiso(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
        <option value="permiso_medico">Médico</option>
        <option value="permiso_personal">Personal</option>
        <option value="falta_justificada">Falta Justificada</option>
      </select>
    </div>
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Fecha del Evento</label>
      <input type="date" value={fechaPermiso} onChange={e => setFechaPermiso(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }} />
    </div>
  </div>

  {/* CHECKBOX PARA RECUPERAR */}
  <div style={{ marginBottom: 12, padding: 10, background: '#f8fafc', borderRadius: 8 }}>
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <input type="checkbox" checked={necesitaRecuperar} onChange={e => setNecesitaRecuperar(e.target.checked)} />
      <span style={{ fontSize: 12, fontWeight: 600 }}>Voy a recuperar las horas el día:</span>
    </label>
    {necesitaRecuperar && (
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <input type="date" value={diaRecuperacion} onChange={e => setDiaRecuperacion(e.target.value)} style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid #e2e8f0' }} />
        <input type="time" value={horaRecuperacionInicio} onChange={e => setHoraRecuperacionInicio(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #e2e8f0' }} />
        <span style={{ alignSelf: 'center' }}>-</span>
        <input type="time" value={horaRecuperacionFin} onChange={e => setHoraRecuperacionFin(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #e2e8f0' }} />
      </div>
    )}
  </div>

  {/* SUSTENTO (TEXTO) */}
  <div style={{ marginBottom: 12 }}>
    <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Sustento / Motivo (Obligatorio)</label>
    <textarea 
      value={motivoPermiso} 
      onChange={e => setMotivoPermiso(e.target.value)} 
      rows={3} 
      placeholder="Ej: Tengo cita con el dentista a las 10am. Recuperaré el viernes por la tarde."
      style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }} 
    />
  </div>

  <button onClick={enviarPermiso} style={{ width: '100%', padding: 10, background: '#c9a227', color: 'white', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer' }}>
    Enviar Solicitud al Coordinador
  </button>
</div>
  


  if(loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'80vh',flexDirection:'column',gap:14}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:40,height:40,border:'3px solid #002F6C',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
      <p style={{color:'#94a3b8',fontSize:13}}>Cargando tu panel...</p>
    </div>
  )

  if(!persona) return (
    <div style={{padding:40,textAlign:'center',maxWidth:480,margin:'60px auto'}}>
      <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
      <h2 style={{color:'#002F6C',marginBottom:8,fontSize:18}}>Tu usuario no está vinculado</h2>
      <p style={{color:'#94a3b8',fontSize:13,lineHeight:1.7}}>
        Tu cuenta existe pero no está conectada con tu perfil en la base de datos.<br/>
        Pide al coordinador que ejecute el SQL de vinculación.
      </p>
    </div>
  )

  return (
    <div style={{maxWidth:680,margin:'0 auto'}}>
      {/* Header barra superior */}
      <div style={{background:'#002F6C',borderRadius:14,padding:'14px 22px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between',color:'white'}}>
        <div>
          <div style={{fontFamily:'Lora,serif',fontSize:16,fontWeight:600}}>ESAT · CIAD — Mi Panel</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,.55)',marginTop:2}}>Instituto de ESAT · FCAM · UNASAM · Huaraz</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:9,background:'rgba(255,255,255,.12)',borderRadius:10,padding:'8px 14px'}}>
            <div style={{width:30,height:30,borderRadius:'50%',background:persona.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'white'}}>{persona.nombre.charAt(0)}</div>
            <div>
              <div style={{fontSize:12,fontWeight:600}}>{persona.nombre}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,.6)'}}>{persona.rol==='Practicante'?`Practicante · Ing. ${persona.subrol??''}`:persona.rol==='SENATI'?`Practicante SENATI · ${persona.subrol??''}`:persona.rol} · ESAT</div>
            </div>
          </div>
          <button onClick={async()=>{await supabase.auth.signOut();window.location.href='/auth/login'}}
            style={{background:'rgba(255,255,255,.1)',color:'white',border:'1px solid rgba(255,255,255,.2)',borderRadius:8,padding:'7px 14px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            ← Salir
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:20}}>
        <div style={{background:'white',borderRadius:12,padding:'16px 18px',textAlign:'center',border:'1.5px solid #e2e8f0',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
          <div style={{fontSize:28,fontWeight:700,color:'#002F6C'}}>{tareasActivas.length}</div>
          <div style={{fontSize:11,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.06em',marginTop:2}}>Tareas activas</div>
        </div>
        <div style={{background:'white',borderRadius:12,padding:'16px 18px',textAlign:'center',border:'1.5px solid #e2e8f0',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
          <div style={{fontSize:28,fontWeight:700,color:'#002F6C'}}>{tareasComp.length}</div>
          <div style={{fontSize:11,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.06em',marginTop:2}}>Completadas</div>
        </div>
        <div style={{background:'#002F6C',borderRadius:12,padding:'16px 18px',textAlign:'center',boxShadow:'0 4px 12px rgba(0,47,108,.3)'}}>
          <div style={{fontSize:28,fontWeight:700,color:'white'}}>{horasMes.toFixed(0)}h</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,.6)',textTransform:'uppercase',letterSpacing:'.06em',marginTop:2}}>Horas acum.</div>
        </div>
      </div>

      {/* Card de asistencia */}
      <div style={{background:'white',borderRadius:16,border:'1.5px solid #e2e8f0',padding:'24px',marginBottom:16,boxShadow:'0 1px 3px rgba(0,0,0,.06)',textAlign:'center'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:4}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:'#ef4444',animation:'pulse 2s infinite'}}/>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <span style={{fontSize:12,fontWeight:600,color:'#475569',textTransform:'uppercase',letterSpacing:'.08em'}}>HOY · {format(new Date(),"EEEE d 'de' MMMM",{locale:es})}</span>
        </div>
        <div style={{fontSize:52,fontWeight:700,color:'#002F6C',letterSpacing:'-1px',marginBottom:4,fontVariantNumeric:'tabular-nums'}}>{tiempo}</div>
        <div style={{fontSize:13,color:'#94a3b8',marginBottom:18}}>Marca tu asistencia del día de hoy</div>

        {/* Botones - SIN INPUT DE HORA */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
          <button onClick={marcarEntrada} disabled={registrando||!!asistHoy?.hora_entrada}
            style={{padding:'16px',borderRadius:12,border:'none',cursor:asistHoy?.hora_entrada?'not-allowed':'pointer',
              background:asistHoy?.hora_entrada?'#dcfce7':'#16a34a',color:asistHoy?.hora_entrada?'#15803d':'white',
              fontFamily:'inherit',fontWeight:700,fontSize:14,opacity:registrando?.7:1,transition:'all .2s'}}>
            <div style={{fontSize:22,marginBottom:4}}>{asistHoy?.hora_entrada?'✅':'☑️'}</div>
            <div>Marcar Entrada</div>
            <div style={{fontSize:11,fontWeight:400,opacity:.8,marginTop:2}}>{asistHoy?.hora_entrada?`Registrada: ${asistHoy.hora_entrada.slice(0,5)}`:'Registrar llegada'}</div>
          </button>
          <button onClick={marcarSalida} disabled={registrando||!asistHoy?.hora_entrada||!!asistHoy?.hora_salida}
            style={{padding:'16px',borderRadius:12,border:'none',
              cursor:(!asistHoy?.hora_entrada||asistHoy?.hora_salida)?'not-allowed':'pointer',
              background:asistHoy?.hora_salida?'#fee2e2':!asistHoy?.hora_entrada?'#f1f5f9':'#dc2626',
              color:asistHoy?.hora_salida?'#b91c1c':!asistHoy?.hora_entrada?'#94a3b8':'white',
              fontFamily:'inherit',fontWeight:700,fontSize:14,opacity:registrando?.7:1,transition:'all .2s'}}>
            <div style={{fontSize:22,marginBottom:4}}>{asistHoy?.hora_salida?'🚪':'🚪'}</div>
            <div>Marcar Salida</div>
            <div style={{fontSize:11,fontWeight:400,opacity:.8,marginTop:2}}>{asistHoy?.hora_salida?`Registrada: ${asistHoy.hora_salida.slice(0,5)}`:'Registrar partida'}</div>
          </button>
        </div>

        {/* Estado */}
        {asistHoy&&(
          <div style={{padding:'10px 16px',background:'#f0fdf4',borderRadius:9,border:'1px solid #86efac',fontSize:13,color:'#15803d',fontWeight:500,marginBottom:10}}>
            ✅ Asistencia registrada — Entrada: {asistHoy.hora_entrada?.slice(0,5)}
            {asistHoy.tardanza_min>0&&<span style={{color:'#d97706',marginLeft:8}}>· +{asistHoy.tardanza_min}min tardanza</span>}
            {asistHoy.hora_salida&&<span style={{marginLeft:8}}>· Salida: {asistHoy.hora_salida.slice(0,5)}</span>}
          </div>
        )}

        {franjasHoy.length>0&&(
          <div style={{padding:'8px 14px',background:'#eff6ff',borderRadius:9,border:'1px solid #93c5fd',fontSize:12,color:'#1d4ed8'}}>
            🗓 Tu horario hoy: {horarioHoyStr}
          </div>
        )}
      </div>

      {/* Solicitar permiso */}
      <div style={{background:'white',borderRadius:16,border:'1.5px solid #e2e8f0',padding:'20px 24px',marginBottom:16,boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
          <span style={{fontSize:22}}>📋</span>
          <div>
            <div style={{fontSize:15,fontWeight:600,color:'#002F6C'}}>Solicitar permiso o reportar falta</div>
            <div style={{fontSize:12,color:'#94a3b8'}}>Tu coordinador recibirá la solicitud para aprobarla</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
          <div>
            <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase',letterSpacing:'.04em'}}>Tipo</label>
            <select value={tipoPermiso} onChange={e=>setTipoPermiso(e.target.value)}
              style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,outline:'none'}}>
              {Object.entries(TIPO_PERMISO).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase',letterSpacing:'.04em'}}>Fecha</label>
            <input type="date" value={fechaPermiso} onChange={e=>setFechaPermiso(e.target.value)}
              style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,outline:'none'}}/>
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase',letterSpacing:'.04em'}}>Motivo y recuperación (si aplica)</label>
          <textarea value={motivoPermiso} onChange={e=>setMotivoPermiso(e.target.value)} rows={3}
            placeholder="Ej: Tengo cita médica de 9am a 11am. Recuperaré el viernes de 4pm a 6pm."
            style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,outline:'none',resize:'vertical'}}/>
        </div>
        {permisoOk&&<div style={{padding:'8px 14px',background:'#dcfce7',borderRadius:8,fontSize:12,color:'#15803d',fontWeight:600,marginBottom:10}}>✅ Solicitud enviada al coordinador</div>}
        <button onClick={enviarPermiso} disabled={enviandoPermiso||!motivoPermiso}
          style={{width:'100%',padding:'13px',background:'#c9a227',color:'white',border:'none',borderRadius:10,fontFamily:'inherit',fontSize:14,fontWeight:700,cursor:motivoPermiso?'pointer':'not-allowed',opacity:(!motivoPermiso||enviandoPermiso)?.6:1}}>
          📨 {enviandoPermiso?'Enviando...':'Enviar solicitud al coordinador'}
        </button>
      </div>

      {/* Mis tareas */}
      {tareas.length>0&&(
        <div style={{background:'white',borderRadius:16,border:'1.5px solid #e2e8f0',padding:'20px 24px',marginBottom:16,boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
          <div style={{fontSize:15,fontWeight:600,color:'#002F6C',marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
            📌 Mis tareas asignadas
            <span style={{fontSize:11,fontWeight:400,color:'#94a3b8'}}>({tareasActivas.length} activas)</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {tareas.map(t=>{
              const ua=ultimoAvance(t.id)
              const PC: Record<string,string>={alta:'#fee2e2',media:'#fef3c7',baja:'#dcfce7'}
              const PT: Record<string,string>={alta:'#b91c1c',media:'#b45309',baja:'#15803d'}
              const EC: Record<string,string>={pendiente:'#f1f5f9',en_progreso:'#dbeafe',completada:'#dcfce7'}
              const ET: Record<string,string>={pendiente:'#94a3b8',en_progreso:'#1d4ed8',completada:'#15803d'}
              const EL: Record<string,string>={pendiente:'Pendiente',en_progreso:'En progreso',completada:'✓ Lista'}
              return (
                <div key={t.id} style={{padding:'12px 16px',background:'#f8fafc',borderRadius:10,border:'1px solid #e2e8f0'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:5,flexWrap:'wrap'}}>
                        <span style={{fontSize:13,fontWeight:600}}>{t.titulo}</span>
                        <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:PC[t.prioridad],color:PT[t.prioridad]}}>{t.prioridad==='alta'?'🔴':t.prioridad==='media'?'🟡':'🟢'} {t.prioridad}</span>
                        <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,fontWeight:600,background:EC[t.estado],color:ET[t.estado]}}>{EL[t.estado]}</span>
                      </div>
                      {t.descripcion&&<div style={{fontSize:12,color:'#475569',marginBottom:5,lineHeight:1.5}}>{t.descripcion}</div>}
                      <div style={{display:'flex',gap:12,fontSize:11,color:'#94a3b8',flexWrap:'wrap'}}>
                        {t.fecha_limite&&<span>📅 {t.fecha_limite}</span>}
                        {t.horas_estimadas&&<span>⏱ {t.horas_estimadas}h</span>}
                        {t.asignado_por&&<span>👨‍💼 {t.asignado_por}</span>}
                        {t.semana&&<span>📆 {t.semana}</span>}
                      </div>
                      {ua&&(
                        <div style={{marginTop:7}}>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#94a3b8',marginBottom:3}}><span>Avance: {ua.porcentaje}%</span><span>{ua.semana}</span></div>
                          <div style={{height:5,background:'#e2e8f0',borderRadius:10,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${ua.porcentaje}%`,background:ua.porcentaje>=100?'#16a34a':'#2563C8',borderRadius:10}}/>
                          </div>
                        </div>
                      )}
                    </div>
                    {t.estado!=='completada'&&(
                      <button onClick={()=>{setMTarea(t);setMPct(ua?.porcentaje??0);setMSem('');setModalAv(true)}}
                        style={{background:'#dbeafe',color:'#1d4ed8',border:'1px solid #93c5fd',borderRadius:8,padding:'6px 11px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',flexShrink:0,whiteSpace:'nowrap'}}>
                        📊 Avance
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal avance */}
      {modalAv&&mTarea&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20,backdropFilter:'blur(2px)'}}
          onClick={e=>{if(e.target===e.currentTarget)setModalAv(false)}}>
          <div style={{background:'white',borderRadius:18,padding:24,width:'100%',maxWidth:420,boxShadow:'0 24px 80px rgba(0,0,0,.25)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{fontSize:16,fontWeight:700}}>Reportar avance semanal</h3>
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
              <div style={{height:'100%',width:`${mPct}%`,background:mPct>=100?'#16a34a':'#2563C8',borderRadius:10,transition:'width .3s'}}/>
            </div>
            {mPct>=100&&<p style={{fontSize:12,color:'#16a34a',fontWeight:600,textAlign:'center',marginBottom:12}}>✓ Se marcará como completada</p>}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setModalAv(false)} style={{padding:'8px 16px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'white',cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>Cancelar</button>
              <button onClick={guardarAvance} disabled={saving||!mSem}
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