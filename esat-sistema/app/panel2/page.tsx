'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export default function MiPanelPage() {
  const supabase = createClient()
  const hoy = format(new Date(),'yyyy-MM-dd')
  const [tiempo, setTiempo] = useState(format(new Date(),'HH:mm'))

  const [persona, setPersona] = useState<any>(null)
  const [horarios, setHorarios] = useState<any[]>([])
  const [asistHoy, setAsistHoy] = useState<any>(null)
  const [tareas, setTareas] = useState<any[]>([])
  const [avances, setAvances] = useState<any[]>([])
  const [asistMes, setAsistMes] = useState<any[]>([])
  const [flexibilidadHoy, setFlexibilidadHoy] = useState<any>(null)
  const [tiempoExtraHoy, setTiempoExtraHoy] = useState<any>(null)
  const [recuperacionHoy, setRecuperacionHoy] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [registrando, setRegistrando] = useState(false)
  const [modalAv, setModalAv] = useState(false)
  const [mTarea, setMTarea] = useState<any>(null)
  const [mPct, setMPct] = useState(0)
  const [mSem, setMSem] = useState('')
  const [saving, setSaving] = useState(false)
  
  const [motivoPermiso, setMotivoPermiso] = useState('')
  const [tipoPermiso, setTipoPermiso] = useState('permiso_personal')
  const [fechaPermiso, setFechaPermiso] = useState(hoy)
  const [enviandoPermiso, setEnviandoPermiso] = useState(false)
  const [permisoOk, setPermisoOk] = useState(false)
  
  const [necesitaRecuperar, setNecesitaRecuperar] = useState(false)
  const [diaRecuperacion, setDiaRecuperacion] = useState('')
  const [horaRecuperacionInicio, setHoraRecuperacionInicio] = useState('')
  const [horaRecuperacionFin, setHoraRecuperacionFin] = useState('')

  const [alertaEntrada, setAlertaEntrada] = useState('')

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

    const [h,a,t,av,am,flex,te,perm] = await Promise.all([
      supabase.from('horarios').select('*').eq('persona_id',p.id),
      supabase.from('asistencias').select('*').eq('persona_id',p.id).eq('fecha',hoy).maybeSingle(),
      supabase.from('tareas').select('*').eq('persona_id',p.id).in('estado', ['asignado', 'en_progreso', 'pendiente_revision', 'subsanacion']).order('created_at',{ascending:false}),
      supabase.from('avances_semanales').select('*').order('semana',{ascending:false}),
      supabase.from('asistencias').select('*').eq('persona_id',p.id).gte('fecha',mesIni).lte('fecha',mesFin),
      supabase.from('flexibilidad_horaria').select(`*, coordinador:personas!flexibilidad_horaria_autorizado_por_fkey(nombre)`).eq('persona_id',p.id).eq('fecha',hoy).maybeSingle(),
      supabase.from('horas_extras').select('*').eq('persona_id',p.id).eq('fecha',hoy).eq('aprobado',true).maybeSingle(),
      supabase.from('permisos').select('*').eq('persona_id',p.id).eq('dia_recuperacion',hoy).eq('recuperacion_aprobada',true).maybeSingle(),
    ])
    setHorarios(h.data??[])
    setAsistHoy(a.data??null)
    setTareas(t.data??[])
    setAvances(av.data??[])
    setAsistMes(am.data??[])
    setFlexibilidadHoy(flex.data??null)
    setTiempoExtraHoy(te.data??null)
    setRecuperacionHoy(perm.data??null)
    setLoading(false)
  }

  function getHorarioHoy(){
    const diaSemana = new Date().getDay()
    const mapeoDias: Record<number,string> = {0:'D', 1:'L', 2:'M', 3:'X', 4:'J', 5:'V', 6:'S'}
    const diaKey = mapeoDias[diaSemana]
    const franjas = horarios.filter(h => h.dia === diaKey && h.persona_id === persona?.id)
    if(franjas.length === 0) return null
    return franjas
  }

  function getTurnoActivo(){
    const franjas = getHorarioHoy()
    if(!franjas) return null
    
    const [hActual] = tiempo.split(':').map(Number)
    
    // Buscar turno activo (hora actual está dentro del turno o hasta 1 hora después)
    const turnoActivo = franjas.find(franja => {
      const [hEntrada] = franja.hora_entrada.split(':').map(Number)
      const [hSalida] = franja.hora_salida.split(':').map(Number)
      return hActual >= hEntrada && hActual <= hSalida + 1
    })
    
    // Si no hay turno activo, retornar el primero
    return turnoActivo || franjas[0]
  }

  async function marcarEntrada(){
    if(!persona||registrando) return
    setRegistrando(true)
    
    const horaActual = tiempo
    const [hActual, mActual] = horaActual.split(':').map(Number)
    const minutosActuales = hActual * 60 + mActual
    
    const turnoActivo = getTurnoActivo()
    if(!turnoActivo) {
      setAlertaEntrada('⚠️ No tienes horario registrado para hoy')
      setTimeout(()=>setAlertaEntrada(''), 5000)
      setRegistrando(false)
      return
    }
    
    const horaEsperada = turnoActivo.hora_entrada.slice(0,5)
    const [hEsp, mEsp] = horaEsperada.split(':').map(Number)
    const minutosEsperados = hEsp * 60 + mEsp
    
    const minutosGracia = flexibilidadHoy?.minutos_gracia || 0
    const tolerancia = persona.tolerancia || 10
    const margenTotal = minutosGracia + tolerancia
    
    if(minutosActuales < minutosEsperados) {
      const minutosAntes = minutosEsperados - minutosActuales
      setAlertaEntrada(`⚠️ No puedes registrar entrada ${minutosAntes} minutos antes de tu horario (${horaEsperada}).`)
      setTimeout(()=>setAlertaEntrada(''), 5000)
      setRegistrando(false)
      return
    }
    
    const tardanzaMinutos = Math.max(0, minutosActuales - minutosEsperados - margenTotal)
    const estado = tardanzaMinutos > 0 ? 'tarde' : 'presente'
    const horaCompleta = horaActual+':00'
    
    await supabase.from('asistencias').upsert(
      {persona_id:persona.id,fecha:hoy,hora_entrada:horaCompleta,estado,tardanza_min:tardanzaMinutos},
      {onConflict:'persona_id,fecha'}
    )
    
    setAlertaEntrada('')
    setRegistrando(false)
    load()
  }

  async function marcarSalida(){
    if(!persona||!asistHoy||registrando) return
    setRegistrando(true)
    
    const horaActual = tiempo
    const horaCompleta = horaActual+':00'
    
    await supabase.from('asistencias').update({hora_salida:horaCompleta}).eq('id',asistHoy.id)
    
    setRegistrando(false)
    load()
  }

  async function enviarPermiso(){
    if(!persona||!motivoPermiso) { alert('Escribe el motivo'); return }
    setEnviandoPermiso(true)
    const permisoData: any = {
      persona_id: persona.id, tipo: tipoPermiso, fecha_inicio: fechaPermiso, fecha_fin: fechaPermiso,
      motivo: motivoPermiso, sustento_texto: motivoPermiso, estado: 'pendiente',
      dia_recuperacion: necesitaRecuperar ? diaRecuperacion : null,
      hora_recuperacion_inicio: necesitaRecuperar ? horaRecuperacionInicio : null,
      hora_recuperacion_fin: necesitaRecuperar ? horaRecuperacionFin : null,
      recuperacion_aprobada: false
    }
    await supabase.from('permisos').insert(permisoData)
    setMotivoPermiso('');setNecesitaRecuperar(false);setDiaRecuperacion('');setHoraRecuperacionInicio('');setHoraRecuperacionFin('');setPermisoOk(true);setEnviandoPermiso(false)
    setTimeout(()=>setPermisoOk(false),3000)
  }

  async function guardarAvance(){
    if(!mTarea||!mSem) return
    setSaving(true)
    await supabase.from('avances_semanales').upsert({tarea_id:mTarea.id,semana:mSem,porcentaje:mPct},{onConflict:'tarea_id,semana'})
    if(mPct>=100) await supabase.from('tareas').update({estado:'completada'}).eq('id',mTarea.id)
    setModalAv(false);setSaving(false);load()
  }

  const horasMes = asistMes.filter(a=>a.hora_entrada&&a.hora_salida).reduce((acc,a)=>{
    const [he,me]=a.hora_entrada.split(':').map(Number);const [hs,ms]=a.hora_salida.split(':').map(Number)
    return acc+Math.max(0,((hs*60+ms)-(he*60+me))/60)
  },0)
  
  const tareasActivas = tareas.filter(t => t.estado !== 'completada')
  const TIPO_PERMISO: Record<string,string> = {permiso_medico:'🏥 Médico',permiso_personal:'👤 Personal',permiso_academico:'🎓 Académico',falta_justificada:'📋 Falta justificada'}

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'80vh',flexDirection:'column',gap:14}}><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style><div style={{width:40,height:40,border:'3px solid #002F6C',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite'}}/><p style={{color:'#94a3b8',fontSize:13}}>Cargando...</p></div>
  if(!persona) return <div style={{padding:40,textAlign:'center',maxWidth:480,margin:'60px auto'}}><div style={{fontSize:48,marginBottom:16}}>⚠️</div><h2 style={{color:'#002F6C',marginBottom:8,fontSize:18}}>Usuario no vinculado</h2><p style={{color:'#94a3b8',fontSize:13}}>Pide al coordinador que ejecute el SQL de vinculación.</p></div>

  const franjasHoy = getHorarioHoy()
  const turnoActivo = getTurnoActivo()
  const horaReferencia = turnoActivo?.hora_entrada?.slice(0,5) || '—'

  return (
    <div style={{maxWidth:680,margin:'0 auto'}}>
      {/* Header */}
      <div style={{background:'#002F6C',borderRadius:14,padding:'14px 22px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between',color:'white'}}>
        <div><div style={{fontFamily:'Lora,serif',fontSize:16,fontWeight:600}}>ESAT · CIAD — Mi Panel</div><div style={{fontSize:11,color:'rgba(255,255,255,.55)',marginTop:2}}>UNASAM · Huaraz</div></div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:9,background:'rgba(255,255,255,.12)',borderRadius:10,padding:'8px 14px'}}>
            <div style={{width:30,height:30,borderRadius:'50%',background:persona.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'white'}}>{persona.nombre.charAt(0)}</div>
            <div><div style={{fontSize:12,fontWeight:600}}>{persona.nombre}</div><div style={{fontSize:10,color:'rgba(255,255,255,.6)'}}>{persona.rol}</div></div>
          </div>
          <button onClick={async()=>{await supabase.auth.signOut();window.location.href='/auth/login'}} style={{background:'rgba(255,255,255,.1)',color:'white',border:'1px solid rgba(255,255,255,.2)',borderRadius:8,padding:'7px 14px',fontSize:12,fontWeight:600,cursor:'pointer'}}>← Salir</button>
        </div>
      </div>

      {/* Métricas */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:20}}>
        <div style={{background:'white',borderRadius:12,padding:'16px 18px',textAlign:'center',border:'1.5px solid #e2e8f0'}}><div style={{fontSize:28,fontWeight:700,color:'#002F6C'}}>{tareasActivas.length}</div><div style={{fontSize:11,color:'#94a3b8',textTransform:'uppercase'}}>Tareas activas</div></div>
        <div style={{background:'white',borderRadius:12,padding:'16px 18px',textAlign:'center',border:'1.5px solid #e2e8f0'}}><div style={{fontSize:28,fontWeight:700,color:'#002F6C'}}>{tareas.filter(t=>t.estado==='completada').length}</div><div style={{fontSize:11,color:'#94a3b8',textTransform:'uppercase'}}>Completadas</div></div>
        <div style={{background:'#002F6C',borderRadius:12,padding:'16px 18px',textAlign:'center'}}><div style={{fontSize:28,fontWeight:700,color:'white'}}>{horasMes.toFixed(0)}h</div><div style={{fontSize:11,color:'rgba(255,255,255,.6)',textTransform:'uppercase'}}>Horas acum.</div></div>
      </div>

      {/* Alertas */}
      {recuperacionHoy && (
        <div style={{background:'#fef3c7',border:'2px solid #f59e0b',borderRadius:14,padding:'20px',marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}><div style={{fontSize:32}}>🔄</div><div><div style={{fontSize:16,fontWeight:700,color:'#92400e'}}>¡Hoy recuperas horas!</div><div style={{fontSize:13,color:'#b45309'}}>Tienes una recuperación aprobada</div></div></div>
          <div style={{background:'white',borderRadius:10,padding:'14px',border:'1px solid #fcd34d'}}><div style={{fontSize:13,color:'#78350f',marginBottom:8}}><strong>Horario:</strong></div><div style={{fontSize:14,color:'#92400e',fontWeight:600}}>🕐 {recuperacionHoy.hora_recuperacion_inicio?.slice(0,5)} - {recuperacionHoy.hora_recuperacion_fin?.slice(0,5)}</div>{recuperacionHoy.motivo && <div style={{fontSize:12,color:'#78350f',marginTop:8,fontStyle:'italic'}}>"{recuperacionHoy.motivo}"</div>}</div>
        </div>
      )}
      {flexibilidadHoy && (
        <div style={{background:'#eff6ff',border:'2px solid #3b82f6',borderRadius:14,padding:'16px',marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}><span style={{fontSize:24}}>🕐</span><div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:'#1e40af'}}>Flexibilidad Aprobada</div><div style={{fontSize:12,color:'#1e40af',fontWeight:600}}>+{flexibilidadHoy.minutos_gracia} minutos de gracia</div></div></div>
          <div style={{fontSize:12,color:'#1e3a8a',background:'white',padding:'10px',borderRadius:8}}><strong>Motivo:</strong> {flexibilidadHoy.motivo}<br/><strong>Autorizado por:</strong> {flexibilidadHoy.coordinador?.nombre || 'Coordinador'}</div>
        </div>
      )}

      {/* Card Asistencia */}
      <div style={{background:'white',borderRadius:16,border:'1.5px solid #e2e8f0',padding:'24px',marginBottom:16,boxShadow:'0 1px 3px rgba(0,0,0,.06)',textAlign:'center'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:4}}><div style={{width:8,height:8,borderRadius:'50%',background:'#ef4444',animation:'pulse 2s infinite'}}/><style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style><span style={{fontSize:12,fontWeight:600,color:'#475569',textTransform:'uppercase'}}>HOY · {format(new Date(),"EEEE d 'de' MMMM",{locale:es})}</span></div>
        <div style={{fontSize:52,fontWeight:700,color:'#002F6C',marginBottom:4}}>{tiempo}</div>
        <div style={{fontSize:13,color:'#94a3b8',marginBottom:18}}>Marca tu asistencia</div>
        
        {/* Horarios del día */}
        {franjasHoy && franjasHoy.length > 0 ? (
          <div style={{marginBottom:16,display:'flex',flexDirection:'column',gap:10}}>
            {franjasHoy.map((franja, idx) => {
              const esManana = parseInt(franja.hora_entrada) < 12
              return (
                <div key={idx} style={{padding:'10px 14px',background:'#f0f9ff',borderRadius:9,border:'1px solid #bae6fd',fontSize:12,color:'#0369a1'}}>
                  <div style={{marginBottom:4,fontWeight:600,textTransform:'uppercase',fontSize:10}}>
                    {esManana ? '🌅 Turno Mañana' : '🌆 Turno Tarde'}
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',gap:16}}>
                    <div><span style={{color:'#64748b'}}>Entrada:</span> <strong>{franja.hora_entrada.slice(0,5)}</strong></div>
                    <div><span style={{color:'#64748b'}}>Salida:</span> <strong>{franja.hora_salida.slice(0,5)}</strong></div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{padding:'10px 14px',background:'#fef3c7',borderRadius:9,border:'1px solid #fcd34d',fontSize:12,color:'#92400e',marginBottom:16}}>
            ⚠️ No tienes horario registrado para hoy
          </div>
        )}

        {alertaEntrada && <div style={{padding:'12px',background:'#fee2e2',border:'2px solid #ef4444',borderRadius:9,fontSize:13,color:'#b91c1c',marginBottom:16,fontWeight:600}}>{alertaEntrada}</div>}
        
        {/* Botones - CORREGIDOS */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
          <button onClick={marcarEntrada} disabled={registrando||!!asistHoy?.hora_entrada} 
            style={{padding:'16px',borderRadius:12,border:'none',cursor:asistHoy?.hora_entrada?'not-allowed':'pointer',
              background:asistHoy?.hora_entrada?'#dcfce7':'#16a34a',color:asistHoy?.hora_entrada?'#15803d':'white',
              fontFamily:'inherit',fontWeight:700,fontSize:14,opacity:registrando?0.7:1,transition:'all .2s'}}>
            <div style={{fontSize:22,marginBottom:4}}>{asistHoy?.hora_entrada?'✅':'☑️'}</div>
            <div>Marcar Entrada</div>
            <div style={{fontSize:11,fontWeight:400,opacity:.8,marginTop:2}}>
              {asistHoy?.hora_entrada ? `Registrada: ${asistHoy.hora_entrada.slice(0,5)}` : 
               horaReferencia ? `Desde ${horaReferencia}` : 'Sin horario'}
            </div>
          </button>
          
          <button onClick={marcarSalida} disabled={registrando||!asistHoy?.hora_entrada||!!asistHoy?.hora_salida}
            style={{padding:'16px',borderRadius:12,border:'none',
              cursor:(!asistHoy?.hora_entrada||asistHoy?.hora_salida)?'not-allowed':'pointer',
              background:asistHoy?.hora_salida?'#fee2e2':!asistHoy?.hora_entrada?'#f1f5f9':'#dc2626',
              color:asistHoy?.hora_salida?'#b91c1c':!asistHoy?.hora_entrada?'#94a3b8':'white',
              fontFamily:'inherit',fontWeight:700,fontSize:14,opacity:registrando?0.7:1,transition:'all .2s'}}>
            <div style={{fontSize:22,marginBottom:4}}>{asistHoy?.hora_salida?'🚪':''}</div>
            <div>Marcar Salida</div>
            <div style={{fontSize:11,opacity:.8,marginTop:2}}>
              {asistHoy?.hora_salida ? `Registrada: ${asistHoy.hora_salida.slice(0,5)}` : 'Registrar salida'}
            </div>
          </button>
        </div>
        
        {asistHoy && <div style={{padding:'10px 16px',background:'#f0fdf4',borderRadius:9,border:'1px solid #86efac',fontSize:13,color:'#15803d',fontWeight:500}}>✅ Registrada — Entrada: {asistHoy.hora_entrada?.slice(0,5)}{asistHoy.tardanza_min>0&&<span style={{color:'#d97706',marginLeft:8}}>· +{asistHoy.tardanza_min}min</span>}{asistHoy.hora_salida&&<span style={{marginLeft:8}}>· Salida: {asistHoy.hora_salida.slice(0,5)}</span>}</div>}
      </div>

      {/* Permiso */}
      <div style={{background:'white',borderRadius:16,border:'1.5px solid #e2e8f0',padding:'20px 24px',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}><span style={{fontSize:22}}>📋</span><div><div style={{fontSize:15,fontWeight:600,color:'#002F6C'}}>Solicitar permiso</div><div style={{fontSize:12,color:'#94a3b8'}}>Tu coordinador aprobará la solicitud</div></div></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}><div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5}}>Tipo</label><select value={tipoPermiso} onChange={e=>setTipoPermiso(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9}}>{Object.entries(TIPO_PERMISO).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div><div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5}}>Fecha</label><input type="date" value={fechaPermiso} onChange={e=>setFechaPermiso(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9}}/></div></div>
        <div style={{marginBottom:12,padding:10,background:'#f8fafc',borderRadius:8}}><label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}><input type="checkbox" checked={necesitaRecuperar} onChange={e=>setNecesitaRecuperar(e.target.checked)} style={{width:16,height:16,accentColor:'#002F6C'}}/><span style={{fontSize:12,fontWeight:600}}>Voy a recuperar horas el día:</span></label>{necesitaRecuperar && <div style={{marginTop:8,display:'flex',gap:8}}><input type="date" value={diaRecuperacion} onChange={e=>setDiaRecuperacion(e.target.value)} style={{flex:1,padding:6,borderRadius:4,border:'1px solid #e2e8f0'}}/><input type="time" value={horaRecuperacionInicio} onChange={e=>setHoraRecuperacionInicio(e.target.value)} style={{padding:6,borderRadius:4,border:'1px solid #e2e8f0'}}/><span>-</span><input type="time" value={horaRecuperacionFin} onChange={e=>setHoraRecuperacionFin(e.target.value)} style={{padding:6,borderRadius:4,border:'1px solid #e2e8f0'}}/></div>}</div>
        <div style={{marginBottom:12}}><label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5}}>Motivo (Obligatorio)</label><textarea value={motivoPermiso} onChange={e=>setMotivoPermiso(e.target.value)} rows={3} placeholder="Ej: Cita médica" style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9}}/></div>
        {permisoOk&&<div style={{padding:'8px 14px',background:'#dcfce7',borderRadius:8,fontSize:12,color:'#15803d',fontWeight:600,marginBottom:10}}>✅ Solicitud enviada</div>}
        <button onClick={enviarPermiso} disabled={enviandoPermiso||!motivoPermiso} style={{width:'100%',padding:'13px',background:'#c9a227',color:'white',border:'none',borderRadius:10,fontFamily:'inherit',fontSize:14,fontWeight:700,cursor:motivoPermiso?'pointer':'not-allowed'}}>{enviandoPermiso?'Enviando...':'Enviar solicitud'}</button>
      </div>

      {/* Tareas */}
      {tareas.length>0 && (
        <div style={{background:'white',borderRadius:16,border:'1.5px solid #e2e8f0',padding:'20px 24px',marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:600,color:'#002F6C',marginBottom:14}}>📌 Mis tareas <span style={{fontSize:11,fontWeight:400,color:'#94a3b8'}}>({tareasActivas.length} activas)</span></div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {tareas.filter(t => t.estado !== 'completada').map(t => {
              const ua=avances.find(a=>a.tarea_id===t.id)
              const PC: Record<string,string>={alta:'#fee2e2',media:'#fef3c7',baja:'#dcfce7'}
              const PT: Record<string,string>={alta:'#b91c1c',media:'#b45309',baja:'#15803d'}
              const EC: Record<string,string>={asignado:'#e0f2fe',en_progreso:'#dbeafe',pendiente_revision:'#fef3c7',subsanacion:'#fce7f3',completada:'#dcfce7'}
              const ET: Record<string,string>={asignado:'#0369a1',en_progreso:'#1d4ed8',pendiente_revision:'#b45309',subsanacion:'#be185d',completada:'#15803d'}
              const EL: Record<string,string>={asignado:'📋 Asignado',en_progreso:'⚙️ En progreso',pendiente_revision:'👁 En revisión',subsanacion:'🔧 Subsanación',completada:'✅ Completada'}
              return (
                <div key={t.id} style={{padding:'12px 16px',background:'#f8fafc',borderRadius:10,border:'1px solid #e2e8f0'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:5,flexWrap:'wrap'}}><span style={{fontSize:13,fontWeight:600}}>{t.titulo}</span><span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:PC[t.prioridad],color:PT[t.prioridad]}}>{t.prioridad}</span><span style={{fontSize:10,padding:'2px 7px',borderRadius:20,fontWeight:600,background:EC[t.estado],color:ET[t.estado]}}>{EL[t.estado]}</span></div>
                      {t.descripcion&&<div style={{fontSize:12,color:'#475569',marginBottom:5}}>{t.descripcion}</div>}
                      <div style={{display:'flex',gap:12,fontSize:11,color:'#94a3b8'}}>{t.fecha_limite&&<span>📅 {t.fecha_limite}</span>}{t.horas_estimadas&&<span>⏱ {t.horas_estimadas}h</span>}</div>
                      {ua&&<div style={{marginTop:7}}><div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#94a3b8',marginBottom:3}}><span>Avance: {ua.porcentaje}%</span></div><div style={{height:5,background:'#e2e8f0',borderRadius:10,overflow:'hidden'}}><div style={{height:'100%',width:`${ua.porcentaje}%`,background:ua.porcentaje>=100?'#16a34a':'#2563C8',borderRadius:10}}/></div></div>}
                    </div>
                    {t.estado!=='completada' && <button onClick={()=>{setMTarea(t);setMPct(ua?.porcentaje??0);setMSem('');setModalAv(true)}} style={{background:'#dbeafe',color:'#1d4ed8',border:'1px solid #93c5fd',borderRadius:8,padding:'6px 11px',fontSize:11,fontWeight:600,cursor:'pointer'}}>📊 Avance</button>}
                  </div>
                </div>
              )
            })}
          </div>
          {tareas.filter(t => t.estado !== 'completada').length===0 && <div style={{textAlign:'center',padding:20,color:'#94a3b8',fontSize:13}}>🎉 ¡Todas completadas!</div>}
        </div>
      )}

      {/* Modal Avance */}
      {modalAv&&mTarea&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={e=>{if(e.target===e.currentTarget)setModalAv(false)}}>
          <div style={{background:'white',borderRadius:18,padding:24,width:'100%',maxWidth:420}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}><h3 style={{fontSize:16,fontWeight:700}}>Reportar avance</h3><button onClick={()=>setModalAv(false)} style={{width:28,height:28,borderRadius:'50%',border:'none',background:'#f1f5f9',cursor:'pointer'}}>×</button></div>
            <div style={{marginBottom:14,padding:'10px 14px',background:'#eff6ff',borderRadius:9,fontSize:13,fontWeight:600,color:'#002F6C'}}>{mTarea.titulo}</div>
            <div style={{marginBottom:12}}><label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5}}>Semana</label><input value={mSem} onChange={e=>setMSem(e.target.value)} placeholder="Ej: Sem 19" style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9}}/></div>
            <div style={{marginBottom:8}}><label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5}}>Avance: {mPct}%</label><input type="range" min={0} max={100} step={5} value={mPct} onChange={e=>setMPct(+e.target.value)} style={{width:'100%',accentColor:'#002F6C'}}/></div>
            <div style={{height:8,background:'#e2e8f0',borderRadius:10,overflow:'hidden',marginBottom:16}}><div style={{height:'100%',width:`${mPct}%`,background:mPct>=100?'#16a34a':'#2563C8',borderRadius:10}}/></div>
            {mPct>=100&&<p style={{fontSize:12,color:'#16a34a',fontWeight:600,textAlign:'center',marginBottom:12}}>✓ Se marcará como completada</p>}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}><button onClick={()=>setModalAv(false)} style={{padding:'8px 16px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'white',cursor:'pointer'}}>Cancelar</button><button onClick={guardarAvance} disabled={saving||!mSem} style={{padding:'8px 18px',borderRadius:9,border:'none',background:'#002F6C',color:'white',cursor:(!mSem||saving)?'not-allowed':'pointer'}}>{saving?'Guardando...':'Guardar'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}