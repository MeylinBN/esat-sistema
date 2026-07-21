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
  const [asistHoyList, setAsistHoyList] = useState<any[]>([])
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
      supabase.from('asistencias').select('*').eq('persona_id',p.id).eq('fecha',hoy),
      supabase.from('tareas').select('*').eq('persona_id',p.id).in('estado', ['asignado', 'en_progreso', 'pendiente_revision', 'subsanacion']).order('created_at',{ascending:false}),
      supabase.from('avances_semanales').select('*').order('semana',{ascending:false}),
      supabase.from('asistencias').select('*').eq('persona_id',p.id).gte('fecha',mesIni).lte('fecha',mesFin),
      supabase.from('flexibilidad_horaria').select(`*, coordinador:personas!flexibilidad_horaria_autorizado_por_fkey(nombre)`).eq('persona_id',p.id).eq('fecha',hoy).maybeSingle(),
      supabase.from('horas_extras').select('*').eq('persona_id',p.id).eq('fecha',hoy).eq('aprobado',true).maybeSingle(),
      supabase.from('permisos').select('*').eq('persona_id',p.id).eq('dia_recuperacion',hoy).eq('recuperacion_aprobada',true).maybeSingle(),
    ])
    setHorarios(h.data??[])
    setAsistHoyList(a.data??[])
    setTareas(t.data??[])
    setAvances(av.data??[])
    setAsistMes(am.data??[])
    setFlexibilidadHoy(flex.data??null)
    setTiempoExtraHoy(te.data??null)
    setRecuperacionHoy(perm.data??null)
    setLoading(false)
  }

  const diaSemana = new Date().getDay() // 0=Domingo ... 6=Sábado
  const esFinDeSemana = diaSemana === 0 || diaSemana === 6

  function getFranjasHoy(){
    const mapeoDias: Record<number,string> = {0:'D', 1:'L', 2:'M', 3:'X', 4:'J', 5:'V', 6:'S'}
    const diaKey = mapeoDias[diaSemana]
    const franjas = horarios.filter(h => h.dia === diaKey && h.persona_id === persona?.id)
    if(franjas.length === 0) return null
    return franjas
  }

  function turnoDeFranja(franja:any): 'manana'|'tarde'{
    return parseInt(franja.hora_entrada) < 13 ? 'manana' : 'tarde'
  }

  function getAsistDeTurno(turno:string){
    return asistHoyList.find(a => a.turno === turno)
  }

  // Evalúa el estado de una franja de hoy: si ya se puede marcar entrada,
  // si es muy temprano, si el turno ya cerró, o si ya está registrada.
  function evaluarFranja(franja:any){
    const turno = turnoDeFranja(franja)
    const asist = getAsistDeTurno(turno)
    const label = turno === 'manana' ? 'Mañana' : 'Tarde'

    const [hActual, mActual] = tiempo.split(':').map(Number)
    const minutosActuales = hActual*60 + mActual

    const [hEnt, mEnt] = franja.hora_entrada.split(':').map(Number)
    const minutosEntrada = hEnt*60 + mEnt
    const [hSal, mSal] = franja.hora_salida.split(':').map(Number)
    const minutosSalida = hSal*60 + mSal

    const minutosGracia = flexibilidadHoy?.minutos_gracia || 0
    const tolerancia = (persona?.tolerancia ?? 10) + minutosGracia

    let puedeMarcarEntrada = false
    let motivoBloqueo = ''
    if(!asist?.hora_entrada){
      if(minutosActuales < minutosEntrada){
        motivoBloqueo = `Aún no puedes marcar — tu turno ${label.toLowerCase()} empieza a las ${franja.hora_entrada.slice(0,5)}.`
      } else if(minutosActuales > minutosSalida){
        motivoBloqueo = `Fuera de horario — tu turno ${label.toLowerCase()} (${franja.hora_entrada.slice(0,5)}-${franja.hora_salida.slice(0,5)}) ya terminó. Si no pudiste marcar, solicita un permiso.`
      } else {
        puedeMarcarEntrada = true
      }
    }

    const tardanzaProyectada = Math.max(0, minutosActuales - minutosEntrada - tolerancia)

    return { turno, label, asist, franja, puedeMarcarEntrada, motivoBloqueo, minutosEntrada, tolerancia, tardanzaProyectada }
  }

  async function marcarEntrada(franja:any){
    if(!persona||registrando) return
    const ev = evaluarFranja(franja)
    if(!ev.puedeMarcarEntrada){
      setAlertaEntrada('⚠️ ' + ev.motivoBloqueo)
      setTimeout(()=>setAlertaEntrada(''), 6000)
      return
    }
    setRegistrando(true)

    const horaActual = tiempo
    const horaCompleta = horaActual+':00'
    const estado = ev.tardanzaProyectada > 0 ? 'tarde' : 'presente'

    const { error } = await supabase.from('asistencias').upsert(
      {persona_id:persona.id,fecha:hoy,turno:ev.turno,hora_entrada:horaCompleta,estado,tardanza_min:ev.tardanzaProyectada},
      {onConflict:'persona_id,fecha,turno'}
    )

    setRegistrando(false)
    if(error){
      setAlertaEntrada('⚠️ Error al registrar entrada: ' + error.message)
      setTimeout(()=>setAlertaEntrada(''), 6000)
      return
    }
    setAlertaEntrada('')
    load()
  }

  async function marcarSalida(asist:any){
    if(!persona||!asist||registrando) return
    setRegistrando(true)

    const horaActual = tiempo
    const horaCompleta = horaActual+':00'

    const { error } = await supabase.from('asistencias').update({hora_salida:horaCompleta}).eq('id',asist.id)

    setRegistrando(false)
    if(error){ alert('Error al registrar salida: ' + error.message); return }
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
    const { error } = await supabase.from('permisos').insert(permisoData)
    setEnviandoPermiso(false)
    if(error){ alert('Error al enviar solicitud: ' + error.message); return }
    setMotivoPermiso('');setNecesitaRecuperar(false);setDiaRecuperacion('');setHoraRecuperacionInicio('');setHoraRecuperacionFin('');setPermisoOk(true)
    setTimeout(()=>setPermisoOk(false),3000)
  }

  async function guardarAvance(){
    if(!mTarea||!mSem) return
    setSaving(true)
    const { error } = await supabase.from('avances_semanales').upsert({tarea_id:mTarea.id,semana:mSem,porcentaje:mPct},{onConflict:'tarea_id,semana'})
    if(error){ setSaving(false); alert('Error al guardar avance: ' + error.message); return }
    if(mPct>=100){
      const { error: estError } = await supabase.from('tareas').update({estado:'completada'}).eq('id',mTarea.id)
      if(estError){ setSaving(false); alert('Error al completar tarea: ' + estError.message); return }
    }
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

  const franjasHoy = getFranjasHoy()

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
        
        {esFinDeSemana && (!franjasHoy || franjasHoy.length===0) ? (
          <div style={{padding:'10px 14px',background:'#f1f5f9',borderRadius:9,border:'1px solid #cbd5e1',fontSize:12,color:'#475569',marginBottom:16}}>
            📅 Hoy es {diaSemana===0?'domingo':'sábado'} — no tienes turno asignado.
          </div>
        ) : !franjasHoy || franjasHoy.length===0 ? (
          <div style={{padding:'10px 14px',background:'#fef3c7',borderRadius:9,border:'1px solid #fcd34d',fontSize:12,color:'#92400e',marginBottom:16}}>
            ⚠️ No tienes horario registrado para hoy
          </div>
        ) : (
          <div style={{marginBottom:16,display:'flex',flexDirection:'column',gap:12}}>
            {franjasHoy.map((franja, idx) => {
              const ev = evaluarFranja(franja)
              const asist = ev.asist
              return (
                <div key={idx} style={{padding:'14px',background:'#f8fafc',borderRadius:12,border:'1px solid #e2e8f0'}}>
                  <div style={{marginBottom:8,fontWeight:700,textTransform:'uppercase',fontSize:11,color:'#475569'}}>
                    {ev.turno==='manana' ? '🌅 Turno Mañana' : '🌆 Turno Tarde'} · {franja.hora_entrada.slice(0,5)}-{franja.hora_salida.slice(0,5)}
                  </div>

                  {!ev.puedeMarcarEntrada && !asist?.hora_entrada && (
                    <div style={{padding:'8px 12px',background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,fontSize:11,color:'#b91c1c',marginBottom:10}}>
                      {ev.motivoBloqueo}
                    </div>
                  )}

                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <button onClick={()=>marcarEntrada(franja)} disabled={registrando||!!asist?.hora_entrada||!ev.puedeMarcarEntrada}
                      style={{padding:'14px',borderRadius:10,border:'none',
                        cursor:(asist?.hora_entrada||!ev.puedeMarcarEntrada)?'not-allowed':'pointer',
                        background:asist?.hora_entrada?'#dcfce7':ev.puedeMarcarEntrada?'#16a34a':'#e2e8f0',
                        color:asist?.hora_entrada?'#15803d':ev.puedeMarcarEntrada?'white':'#94a3b8',
                        fontFamily:'inherit',fontWeight:700,fontSize:13,opacity:registrando?0.7:1,transition:'all .2s'}}>
                      <div style={{fontSize:18,marginBottom:2}}>{asist?.hora_entrada?'✅':'☑️'}</div>
                      <div>Marcar Entrada</div>
                      <div style={{fontSize:10,fontWeight:400,opacity:.8,marginTop:2}}>
                        {asist?.hora_entrada
                          ? `Registrada: ${asist.hora_entrada.slice(0,5)}`
                          : ev.puedeMarcarEntrada ? `Desde ${franja.hora_entrada.slice(0,5)}` : 'No disponible'}
                      </div>
                    </button>

                    <button onClick={()=>marcarSalida(asist)} disabled={registrando||!asist?.hora_entrada||!!asist?.hora_salida}
                      style={{padding:'14px',borderRadius:10,border:'none',
                        cursor:(!asist?.hora_entrada||asist?.hora_salida)?'not-allowed':'pointer',
                        background:asist?.hora_salida?'#fee2e2':!asist?.hora_entrada?'#f1f5f9':'#dc2626',
                        color:asist?.hora_salida?'#b91c1c':!asist?.hora_entrada?'#94a3b8':'white',
                        fontFamily:'inherit',fontWeight:700,fontSize:13,opacity:registrando?0.7:1,transition:'all .2s'}}>
                      <div style={{fontSize:18,marginBottom:2}}>{asist?.hora_salida?'🚪':''}</div>
                      <div>Marcar Salida</div>
                      <div style={{fontSize:10,opacity:.8,marginTop:2}}>
                        {asist?.hora_salida ? `Registrada: ${asist.hora_salida.slice(0,5)}` : 'Registrar salida'}
                      </div>
                    </button>
                  </div>

                  {asist && <div style={{marginTop:8,padding:'8px 12px',background:'#f0fdf4',borderRadius:8,border:'1px solid #86efac',fontSize:11,color:'#15803d',fontWeight:500}}>
                    ✅ Entrada: {asist.hora_entrada?.slice(0,5)}
                    {asist.tardanza_min>0 && <span style={{color:'#d97706',marginLeft:8}}>· +{asist.tardanza_min}min tarde</span>}
                    {asist.hora_salida && <span style={{marginLeft:8}}>· Salida: {asist.hora_salida.slice(0,5)}</span>}
                  </div>}
                </div>
              )
            })}
          </div>
        )}

        {alertaEntrada && <div style={{padding:'12px',background:'#fee2e2',border:'2px solid #ef4444',borderRadius:9,fontSize:13,color:'#b91c1c',marginBottom:16,fontWeight:600}}>{alertaEntrada}</div>}
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