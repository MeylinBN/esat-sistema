'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { useLocationCheck } from '@/app/lib/useLocationCheck'

const DIAS: Record<number,string> = {1:'L',2:'M',3:'X',4:'J',5:'V',6:'S',0:'D'}
const DIAS_COMPLETOS: Record<number,string> = {
  1:'Lunes',2:'Martes',3:'Miércoles',4:'Jueves',5:'Viernes',6:'Sábado',0:'Domingo'
}

const GRUPOS = [
  {key:'Practicante', label:'🎓 Practicantes UNASAM', color:'#1e40af'},
  {key:'SENATI',      label:'🔧 Practicantes Externos (SENATI)', color:'#92400e'},
  {key:'Voluntario',  label:'🤝 Voluntarios ESAT', color:'#15803d'},
  {key:'Asistente',   label:'💼 Asistentes T. Completo', color:'#374151'},
]

function turnoLabel(franjas: any[]) {
  if (!franjas.length) return '—'
  const m = franjas.some(f=>parseInt(f.hora_entrada)<13)
  const t = franjas.some(f=>parseInt(f.hora_entrada)>=13)
  if (m&&t) return `M+T ${franjas.map(f=>f.hora_entrada.slice(0,5)+'–'+f.hora_salida.slice(0,5)).join(' ')}`
  if (m) return `Mañana ${franjas[0].hora_entrada.slice(0,5)}–${franjas[0].hora_salida.slice(0,5)}`
  if (t) return `Tarde ${franjas[0].hora_entrada.slice(0,5)}–${franjas[0].hora_salida.slice(0,5)}`
  return '—'
}

const ESTADO_CFG: Record<string,{bg:string,border:string,pill:string,ptxt:string,label:string}> = {
  presente:          {bg:'#f0fdf4',border:'#86efac',pill:'#dcfce7',ptxt:'#15803d',label:'PRESENTE'},
  tarde:             {bg:'#fff7ed',border:'#fed7aa',pill:'#ffedd5',ptxt:'#c2410c',label:'TARDANZA'},
  ausente:           {bg:'#fef2f2',border:'#fca5a5',pill:'#fee2e2',ptxt:'#b91c1c',label:'AUSENTE'},
  permiso:           {bg:'#fffbeb',border:'#fde68a',pill:'#fef3c7',ptxt:'#b45309',label:'PERMISO'},
  falta_justificada: {bg:'#eff6ff',border:'#93c5fd',pill:'#dbeafe',ptxt:'#1d4ed8',label:'F.JUSTIF.'},
  sin_registrar:     {bg:'white',  border:'#e2e8f0',pill:'#f1f5f9',ptxt:'#94a3b8',label:'—'},
}

export default function AsistenciaPage() {
  const supabase = createClient()
  const hoy = format(new Date(),'yyyy-MM-dd')
  const diaSemana = getDay(new Date())
  const diaKey = DIAS[diaSemana]
  const esFinDeSemana = diaSemana === 0 || diaSemana === 6
  const location = useLocationCheck()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [personas, setPersonas]       = useState<any[]>([])
  const [asistencias, setAsistencias] = useState<any[]>([])
  const [horarios, setHorarios]       = useState<any[]>([])
  const [tareas, setTareas]           = useState<any[]>([])
  const [flexibilidadHoy, setFlexibilidadHoy] = useState<any[]>([])
  const [tiempoExtraHoy, setTiempoExtraHoy] = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [modal, setModal]             = useState(false)
  const [mPerId, setMPerId]           = useState('')
  const [mTurno, setMTurno]           = useState<'manana'|'tarde'|'unico'>('unico')
  const [mTipo, setMTipo]             = useState<'entrada'|'salida'>('entrada')
  const [mHora, setMHora]             = useState(format(new Date(),'HH:mm'))
  const [mUsarHoraActual, setMUsarHoraActual] = useState(true)
  const [mEstado, setMEstado]         = useState('presente')
  const [mObs, setMObs]               = useState('')
  const [saving, setSaving]           = useState(false)
  const [verLista, setVerLista]       = useState(false)
  const [mostrarAlertaFinSemana, setMostrarAlertaFinSemana] = useState(false)
  
  const [esRecuperacion, setEsRecuperacion] = useState(false)
  const [motivoRecuperacion, setMotivoRecuperacion] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    // Obtener grupo del usuario actual
    let grupoDelUsuario = 'ESAT' // default
    if (user) {
      const { data: userData } = await supabase
        .from('personas')
        .select('grupo')
        .eq('auth_id', user.id)
        .single()
      if (userData?.grupo) {
        grupoDelUsuario = userData.grupo
        setCurrentUser(userData)
      }
    }
    
    const [p,a,h,t,flex,te] = await Promise.all([
      supabase.from('personas').select('*').eq('activo',true).eq('grupo', grupoDelUsuario).neq('rol','Coordinador').order('nombre'),
      supabase.from('asistencias').select('*').eq('fecha',hoy),
      supabase.from('horarios').select('*'),
      supabase.from('tareas').select('persona_id,estado'),
      supabase.from('flexibilidad_horaria').select('*').eq('fecha',hoy),
      supabase.from('horas_extras').select('*').eq('fecha',hoy).eq('aprobado',true),
    ])
    setPersonas(p.data??[])
    setAsistencias(a.data??[])
    setHorarios(h.data??[])
    setTareas(t.data??[])
    setFlexibilidadHoy(flex.data??[])
    setTiempoExtraHoy(te.data??[])
    setLoading(false)
  },[hoy])

  useEffect(()=>{load()},[load])

  function getAsistenciasPersona(pid:string){ return asistencias.filter(a=>a.persona_id===pid) }
  function getA(pid:string, turno?: 'manana'|'tarde'|'unico'){
    const lista = getAsistenciasPersona(pid)
    if(turno) return lista.find(a=>a.turno===turno)
    return lista[0]
  }
  function getHoy(pid:string){return horarios.filter(h=>h.persona_id===pid&&h.dia===diaKey)}
  function turnoDeFranja(franja:any): 'manana'|'tarde'{
    return parseInt(franja.hora_entrada) < 13 ? 'manana' : 'tarde'
  }
  // Turnos disponibles hoy para una persona (para saber si hace falta
  // pedirle al coordinador que elija mañana/tarde al registrar)
  function turnosHoy(pid:string): Array<'manana'|'tarde'>{
    const franjas = getHoy(pid)
    const turnos = Array.from(new Set(franjas.map(turnoDeFranja)))
    return turnos as Array<'manana'|'tarde'>
  }
  function tareasActivas(pid:string){return tareas.filter(t=>t.persona_id===pid&&t.estado==='en_progreso').length}
  
  function getFlexibilidad(pid:string){
    return flexibilidadHoy.find(f => f.persona_id === pid)
  }
  
  function tieneTiempoExtra(pid:string){
    return tiempoExtraHoy.some(te => te.persona_id === pid)
  }

  function seleccionarPersona(pid:string){
    setMPerId(pid)
    const turnos = pid ? turnosHoy(pid) : []
    setMTurno(turnos.length===1 ? turnos[0] : turnos.length===2 ? turnos[0] : 'unico')
  }

  async function guardar(){
    if(!mPerId){return}
    
    if(esFinDeSemana && !mObs.toLowerCase().includes('fin de semana') && !esRecuperacion) {
      if(!confirm(`⚠️ Hoy es ${DIAS_COMPLETOS[diaSemana]}. ¿Estás seguro de registrar asistencia en fin de semana?`)) {
        return
      }
    }
    
    setSaving(true)
    
    const horaRegistro = mUsarHoraActual ? format(new Date(),'HH:mm') : mHora
    const horaCompleta = horaRegistro+':00'
    const asist = getA(mPerId, mTurno)
    const persona = personas.find(p=>p.id===mPerId)
    
    const flex = getFlexibilidad(mPerId)
    const minutosGracia = flex?.minutos_gracia || 0
    
    let tard=0
    if(persona?.hora_ingreso&&mTipo==='entrada' && !esRecuperacion){
      const [hE,mE]=persona.hora_ingreso.split(':').map(Number)
      const [hR,mR]=horaRegistro.split(':').map(Number)
      const toleranciaTotal = (persona.tolerancia??10) + minutosGracia
      tard=Math.max(0,(hR*60+mR)-(hE*60+mE)-toleranciaTotal)
    }
    
    let opError = null
    if(!asist){
      const estado = mEstado!=='presente' ? mEstado : (esRecuperacion ? 'presente' : tard>0?'tarde':'presente')
      const { error } = await supabase.from('asistencias').insert({
        persona_id:mPerId,fecha:hoy,turno:mTurno,
        hora_entrada:mTipo==='entrada'?horaCompleta:null,
        hora_salida:mTipo==='salida'?horaCompleta:null,
        hora_recuperacion: esRecuperacion ? horaCompleta : null,
        recuperacion_motivo: esRecuperacion ? motivoRecuperacion : null,
        recuperacion_aprobada: esRecuperacion ? false : null,
        estado,tardanza_min:tard,observacion:mObs||null
      })
      opError = error
    } else {
      const upd:any={observacion:mObs||asist.observacion}
      if(mTipo==='entrada'){
        upd.hora_entrada=horaCompleta
        if(esRecuperacion){
          upd.hora_recuperacion = horaCompleta
          upd.recuperacion_motivo = motivoRecuperacion
          upd.recuperacion_aprobada = false
        }
        if(tard>0)upd.estado='tarde'
      } else {
        upd.hora_salida=horaCompleta
        if(esRecuperacion){
          upd.hora_recuperacion = horaCompleta
          upd.recuperacion_motivo = motivoRecuperacion
        }
      }
      const { error } = await supabase.from('asistencias').update(upd).eq('id',asist.id)
      opError = error
    }
    setSaving(false)
    if(opError){
      alert('Error al registrar asistencia: ' + opError.message)
      return
    }
    setModal(false);setMObs('');setEsRecuperacion(false);setMotivoRecuperacion('');load()
  }

  // ✅ CORRECCIÓN: Filtrar por grupo del usuario logueado
  const grupoDelUsuario = currentUser?.grupo || 'ESAT'
  const personasDelGrupo = personas.filter(p => p.grupo === grupoDelUsuario && p.activo === true)
  const total = personasDelGrupo.length
  // Dedupe por persona: con 2 turnos al día una persona puede tener 2 filas
  const personasPresentes = new Set(asistencias.filter(a=>['presente','tarde'].includes(a.estado)).map(a=>a.persona_id))
  const personasTarde = new Set(asistencias.filter(a=>a.estado==='tarde').map(a=>a.persona_id))
  const presentes = personasPresentes.size
  const tardanzas = personasTarde.size
  const conFlexibilidad = flexibilidadHoy.length
  const conTiempoExtra = tiempoExtraHoy.length

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando asistencia...</div>

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Lora,serif',fontSize:24,color:'#002F6C',fontWeight:600}}>Control de asistencia</h1>
          <p style={{fontSize:12,color:'#475569',marginTop:3,textTransform:'capitalize'}}>
            {format(new Date(),"EEEE d 'de' MMMM 'del' yyyy",{locale:es})}
            {esFinDeSemana && <span style={{marginLeft:8,color:'#dc2626',fontWeight:600}}>⚠️ Fin de semana</span>}
          </p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <button onClick={()=>setVerLista(!verLista)} style={{padding:'8px 16px',background:'white',border:'1.5px solid #e2e8f0',borderRadius:8,cursor:'pointer',fontWeight:600}}>{verLista?'Ver tarjetas':'Ver lista completa'}</button>
          <button
            onClick={() => {
              if (!location.ipOk && !location.gpsOk) {
                alert(location.mensaje)
                return
              }
              if (esFinDeSemana) {
                if (confirm('⚠️ Hoy es fin de semana. ¿Deseas registrar asistencia de todas formas?')) {
                  setMPerId(''); setModal(true)
                }
              } else {
                setMPerId(''); setModal(true)
              }
            }}
            disabled={location.checking}
            style={{
              padding: '8px 16px',
              background: location.checking
                ? '#94a3b8'
                : location.status === 'authorized'
                  ? '#002F6C'
                  : '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: location.checking ? 'wait' : 'pointer',
              fontWeight: 600,
              opacity: location.checking ? 0.7 : 1,
              transition: 'background .3s',
            }}
          >
            {location.checking
              ? '⏳ Verificando...'
              : location.status === 'authorized'
                ? '+ Registrar'
                : '🚫 Sin acceso'}
          </button>
        </div>
      </div>

 {/* Banner de verificación de ubicación */}
 {!location.checking && (
        <div style={{
          background: location.status === 'authorized' ? '#f0fdf4' : '#fef2f2',
          border: `1.5px solid ${location.status === 'authorized' ? '#86efac' : '#fca5a5'}`,
          borderRadius: 10,
          padding: '10px 16px',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>
              {location.status === 'authorized' ? '🛰️' : '📡'}
            </span>
            <div>
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                color: location.status === 'authorized' ? '#15803d' : '#b91c1c',
              }}>
                {location.mensaje}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                {location.ipOk && '✓ Red ESAT '}
                {location.gpsOk && `✓ GPS (${location.distanciaMetros}m)`}
                {!location.ipOk && !location.gpsOk && 'Red y GPS fuera del campus'}
              </div>
            </div>
          </div>
          <button
            onClick={location.recheck}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              background: 'white',
              cursor: 'pointer',
              fontWeight: 600,
              color: '#475569',
              whiteSpace: 'nowrap',
            }}
          >
            🔄 Reverificar
          </button>
        </div>
      )}


      {/* Alerta fin de semana */}
      {esFinDeSemana && (
        <div style={{background:'#fef3c7',border:'2px solid #f59e0b',borderRadius:12,padding:'16px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:12}}>
          <div style={{fontSize:24}}>⚠️</div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:'#92400e',marginBottom:4}}>
              Hoy es {DIAS_COMPLETOS[diaSemana]} - Día no laborable
            </div>
            <div style={{fontSize:12,color:'#b45309'}}>
              Solo registra asistencia si es trabajo extraordinario o recuperación de horas. Se requiere justificación.
            </div>
          </div>
        </div>
      )}

      {/* Métricas */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
        {[
          {l:'Total equipo',v:total,s:`${grupoDelUsuario} activos`,c:'#002F6C',i:'👥'},
          {l:'Presentes hoy',v:presentes,s:`${total>0?Math.round(presentes/total*100):0}% asistencia`,c:'#15803d',i:'✅'},
          {l:'Tardanzas',v:tardanzas,s:'llegaron tarde',c:'#d97706',i:'⏰'},
          {l:'Flexibilidad/TE',v:conFlexibilidad+conTiempoExtra,s:`${conFlexibilidad} flex · ${conTiempoExtra} TE`,c:'#7c3aed',i:'🕐'},
        ].map(m=>(
          <div key={m.l} style={{background:'white',borderRadius:12,padding:'16px 18px',border:`1.5px solid ${m.c}22`,boxShadow:'0 1px 3px rgba(0,0,0,.06)',position:'relative',overflow:'hidden'}}>
            <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',marginBottom:6}}>{m.l}</div>
            <div style={{fontSize:30,fontWeight:700,color:m.c,lineHeight:1}}>{m.v}</div>
            <div style={{fontSize:11,color:'#94a3b8',marginTop:4}}>{m.s}</div>
            <div style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',fontSize:28,opacity:.15}}>{m.i}</div>
          </div>
        ))}
      </div>

      {!verLista ? (
        <>
          {GRUPOS.map(grupo=>{
            // ✅ CORRECCIÓN: Filtrar por grupo del usuario
            const gpersonas = personasDelGrupo.filter(p=>p.rol===grupo.key)
            if(!gpersonas.length) return null
            const gpresentes = gpersonas.filter(p=>getAsistenciasPersona(p.id).some(a=>['presente','tarde'].includes(a.estado))).length
            return (
              <div key={grupo.key} style={{marginBottom:24}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <h2 style={{fontSize:13,fontWeight:600,color:grupo.color,textTransform:'uppercase',letterSpacing:'.06em'}}>{grupo.label}</h2>
                  <span style={{fontSize:11,color:'#94a3b8'}}>{gpresentes}/{gpersonas.length} presentes</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:12}}>
                  {gpersonas.map(p=>{
                    const asistPersona = asistencias.filter(a => a.persona_id === p.id)
                    const asist1 = asistPersona[0]
                    const asist2 = asistPersona[1]
                    
                    const estado = asistPersona.length > 0 
                      ? (asistPersona.some(a => a.estado === 'tarde') ? 'tarde' : asistPersona[0].estado)
                      : 'sin_registrar'

                    const cfg = ESTADO_CFG[estado] ?? ESTADO_CFG.sin_registrar
                    const franjas = getHoy(p.id)
                    const turno = turnoLabel(franjas)
                    const tAct = tareasActivas(p.id)
                    const tieneFlex = getFlexibilidad(p.id)
                    const tieneTE = tieneTiempoExtra(p.id)

                    return (
                      <div key={p.id}onClick={() => {
              if (!location.ipOk && !location.gpsOk) {
                alert(location.mensaje)
                return
              }
              seleccionarPersona(p.id)
              setModal(true)
            }}
                        style={{background:cfg.bg,border:`1.5px solid ${cfg.border}`,borderRadius:12,padding:14,cursor:'pointer',transition:'all .2s',position:'relative'}}
                        onMouseEnter={e=>(e.currentTarget as any).style.boxShadow='0 4px 16px rgba(0,0,0,.1)'}
                        onMouseLeave={e=>(e.currentTarget as any).style.boxShadow=''}>
                        
                        <span style={{position:'absolute',top:10,right:10,padding:'2px 8px',borderRadius:20,fontSize:9,fontWeight:700,background:cfg.pill,color:cfg.ptxt}}>
                          {cfg.label}
                        </span>

                        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:8, paddingRight: '65px'}}> 
                          <div style={{width:38,height:38,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,color:'white',flexShrink:0,position:'relative'}}>
                            {p.nombre.charAt(0)}
                            <div style={{position:'absolute',inset:-2,borderRadius:'50%',border:`2px solid ${cfg.border}`}}/>
                            {(tieneFlex || tieneTE) && (
                              <div style={{position:'absolute',top:-2,right:-2,width:12,height:12,borderRadius:'50%',background:'#7c3aed',border:'2px solid white',display:'flex',alignItems:'center',justifyContent:'center'}}>
                                <span style={{fontSize:8,color:'white'}}>🕐</span>
                              </div>
                            )}
                          </div>
                          
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.nombre}</div>
                            <div style={{fontSize:9,color:'#94a3b8',marginTop:1}}>
                              {p.rol==='SENATI'?`Prac. SENATI · ${p.subrol}`:p.rol==='Practicante'?`Prac. UNASAM · ${p.subrol}`:p.rol}
                            </div>
                            {(tieneFlex || tieneTE) && (
                              <div style={{fontSize:9,color:'#7c3aed',marginTop:2,fontWeight:600}}>
                                {tieneFlex && `🕐 +${tieneFlex.minutos_gracia}min`}
                                {tieneTE && ' ⏱ TE'}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{borderTop:'1px solid rgba(0,0,0,.06)',paddingTop:8,display:'flex',justifyContent:'space-between'}}>
                          <div style={{textAlign:'center', flex: 1}}>
                            <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.04em'}}>ENTRADA</div>
                            <div style={{fontSize:11,fontWeight:700,color:'#0f172a'}}>{asist1?.hora_entrada?.slice(0,5) ?? '—'}</div>
                            {asist2 && <div style={{fontSize:9, color:'#64748b',marginTop:2}}>{asist2.hora_entrada?.slice(0,5)}</div>}
                          </div>
                          <div style={{textAlign:'center', flex: 1}}>
                            <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.04em'}}>SALIDA</div>
                            <div style={{fontSize:11,fontWeight:700,color:'#0f172a'}}>{asist1?.hora_salida?.slice(0,5) ?? '—'}</div>
                            {asist2 && <div style={{fontSize:9, color:'#64748b',marginTop:2}}>{asist2.hora_salida?.slice(0,5)}</div>}
                          </div>
                          <div style={{textAlign:'center', flex: 1}}>
                            <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.04em'}}>TAREAS</div>
                            <div style={{fontSize:12,fontWeight:600,color:'#002F6C'}}>{tAct}</div>
                          </div>
                        </div>

                        {asist1?.tardanza_min>0 && <div style={{fontSize:10,color:'#ea580c',fontWeight:600,textAlign:'center',marginTop:4}}>+{asist1.tardanza_min} min tardanza</div>}
                        
                        <div style={{fontSize:10,color:'#94a3b8',textAlign:'center',marginTop:4, borderTop:'1px dashed #e2e8f0', paddingTop:4}}>
                          {turno!=='—' ? turno : (p.hora_ingreso ? `Esp: ${p.hora_ingreso.slice(0,5)}` : 'Sin horario hoy')}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Mostrar EcoBIOTEM solo si el usuario es de EcoBIOTEM */}
          {grupoDelUsuario === 'EcoBIOTEM' && personasDelGrupo.length>0 && (
            <div style={{background:'white',borderRadius:14,border:'2px solid #86efac',marginBottom:24,padding:20}}>
              <div style={{fontSize:14,fontWeight:600,color:'#0f172a',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:'#15803d'}}/>🌿 GI EcoBIOTEM — Horario flexible
              </div>
              <p style={{fontSize:13,color:'#475569',lineHeight:1.7,margin:0}}>
                Los miembros del GI EcoBIOTEM <strong>no tienen horario fijo</strong>. Registran horas desde su panel personal. <strong>{personasDelGrupo.length} miembros activos.</strong>
              </p>
            </div>
          )}
        </>
      ) : (
        <div style={{background:'white',borderRadius:14,border:'1.5px solid #e2e8f0',overflow:'hidden'}}>
          <div style={{padding:20,borderBottom:'1px solid #e2e8f0',display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#002F6C'}}/>
            <span style={{fontSize:14,fontWeight:600,color:'#0f172a'}}>Registro completo del día</span>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'#f8fafc'}}>
                  {['Nombre','Horario hoy','Entrada','Salida','Estado','Tardanza','Flex/TE','Obs.'].map(h=>(
                    <th key={h} style={{padding:'12px',textAlign:'left',fontSize:11,fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* ✅ CORRECCIÓN: Mapear personasDelGrupo en lugar de esat */}
                {personasDelGrupo.map((p,i)=>{
                  const asistPersona = getAsistenciasPersona(p.id)
                  const asist1 = asistPersona[0]
                  const asist2 = asistPersona[1]
                  const estado = asistPersona.length > 0
                    ? (asistPersona.some(a=>a.estado==='tarde') ? 'tarde' : asistPersona[0].estado)
                    : 'sin_registrar'
                  const cfg=ESTADO_CFG[estado]??ESTADO_CFG.sin_registrar
                  const franjas=getHoy(p.id)
                  const flex = getFlexibilidad(p.id)
                  const te = tieneTiempoExtra(p.id)
                  return (
                    <tr key={p.id} style={{background:i%2===0?'white':'#f8fafc',borderBottom:'1px solid #f1f5f9'}}>
                      <td style={{padding:'10px 12px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:28,height:28,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white'}}>{p.nombre.charAt(0)}</div>
                          <div>
                            <div style={{fontSize:12,fontWeight:600}}>{p.nombre}</div>
                            <div style={{fontSize:10,color:'#94a3b8'}}>{p.rol==='SENATI'?'SENATI':p.rol==='Practicante'?`UNASAM · ${p.subrol}`:p.rol}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{padding:'10px 12px',fontSize:11,color:'#475569'}}>{turnoLabel(franjas)}</td>
                      <td style={{padding:'10px 12px',fontSize:12,fontWeight:600}}>
                        {asist1?.hora_entrada?.slice(0,5)??'—'}
                        {asist2 && <div style={{fontSize:10,color:'#64748b',fontWeight:400}}>{asist2.hora_entrada?.slice(0,5)}</div>}
                      </td>
                      <td style={{padding:'10px 12px',fontSize:12}}>
                        {asist1?.hora_salida?.slice(0,5)??'—'}
                        {asist2 && <div style={{fontSize:10,color:'#64748b'}}>{asist2.hora_salida?.slice(0,5)}</div>}
                      </td>
                      <td style={{padding:'10px 12px'}}>
                        <span style={{padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:700,background:cfg.pill,color:cfg.ptxt}}>{cfg.label}</span>
                      </td>
                      <td style={{padding:'10px 12px',fontSize:11,color:'#ea580c',fontWeight:600}}>
                        {asist1?.tardanza_min>0?`+${asist1.tardanza_min} min`:'—'}
                      </td>
                      <td style={{padding:'10px 12px',fontSize:11}}>
                        {flex && <span style={{color:'#7c3aed',fontWeight:600}}>{flex.minutos_gracia}min</span>}
                        {te && <span style={{color:'#7c3aed',fontWeight:600,marginLeft:4}}>TE</span>}
                        {!flex && !te && '—'}
                      </td>
                      <td style={{padding:'10px 12px',fontSize:11,color:'#94a3b8'}}>{asist1?.observacion??'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div style={{background:'white',borderRadius:18,padding:24,width:'100%',maxWidth:480,boxShadow:'0 24px 80px rgba(0,0,0,.25)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{fontSize:16,fontWeight:700,margin:0}}>Registrar asistencia</h3>
              <button onClick={()=>setModal(false)} style={{width:28,height:28,borderRadius:'50%',border:'none',background:'#f1f5f9',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            
            {esFinDeSemana && (
              <div style={{background:'#fef3c7',border:'1.5px solid #f59e0b',borderRadius:9,padding:'12px',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:18}}>⚠️</span>
                <span style={{fontSize:12,color:'#92400e',fontWeight:600}}>
                  Registrando en fin de semana - Requiere justificación
                </span>
              </div>
            )}
            
            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Persona</label>
              <select value={mPerId} onChange={e=>seleccionarPersona(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}>
                <option value="">Seleccionar...</option>
                {/* ✅ CORRECCIÓN: Mapear personasDelGrupo */}
                {personasDelGrupo.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>

            {mPerId && turnosHoy(mPerId).length===2 && (
              <div style={{marginBottom:16}}>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Turno</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {(['manana','tarde'] as const).map(t=>(
                    <button key={t} onClick={()=>setMTurno(t)} type="button"
                      style={{padding:'10px',background:mTurno===t?'#002F6C':'white',color:mTurno===t?'white':'#475569',border:`2px solid ${mTurno===t?'#002F6C':'#e2e8f0'}`,borderRadius:9,cursor:'pointer',fontWeight:600,fontSize:13}}>
                      {t==='manana'?'🌅 Mañana':'🌆 Tarde'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Tipo de registro</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <button 
                  onClick={()=>setMTipo('entrada')}
                  style={{
                    padding:'12px',
                    background:mTipo==='entrada'?'#15803d':'white',
                    color:mTipo==='entrada'?'white':'#475569',
                    border:`2px solid ${mTipo==='entrada'?'#15803d':'#e2e8f0'}`,
                    borderRadius:10,
                    cursor:'pointer',
                    fontWeight:600,
                    fontSize:13,
                    transition:'all .2s'
                  }}>
                  ✅ Marcar Entrada
                </button>
                <button 
                  onClick={()=>setMTipo('salida')}
                  style={{
                    padding:'12px',
                    background:mTipo==='salida'?'#dc2626':'white',
                    color:mTipo==='salida'?'white':'#475569',
                    border:`2px solid ${mTipo==='salida'?'#dc2626':'#e2e8f0'}`,
                    borderRadius:10,
                    cursor:'pointer',
                    fontWeight:600,
                    fontSize:13,
                    transition:'all .2s'
                  }}>
                  🚪 Marcar Salida
                </button>
              </div>
            </div>

            <div style={{marginBottom:12}}>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',marginBottom:10}}>
                <input 
                  type="checkbox" 
                  checked={mUsarHoraActual}
                  onChange={e=>setMUsarHoraActual(e.target.checked)}
                  style={{width:16,height:16,accentColor:'#002F6C'}}
                />
                <span style={{fontSize:12,fontWeight:600,color:'#475569'}}>
                  ⏰ Usar hora actual ({format(new Date(),'HH:mm:ss')})
                </span>
              </label>
              
              {!mUsarHoraActual && (
                <div style={{marginTop:10}}>
                  <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>
                    Hora de registro:
                  </label>
                  <input 
                    type="time" 
                    value={mHora}
                    onChange={e=>setMHora(e.target.value)}
                    style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}
                  />
                </div>
              )}
            </div>

            <div style={{marginBottom:12}}>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                <input 
                  type="checkbox" 
                  checked={esRecuperacion}
                  onChange={e=>setEsRecuperacion(e.target.checked)}
                  style={{width:16,height:16,accentColor:'#002F6C'}}
                />
                <span style={{fontSize:12,fontWeight:600,color:'#475569'}}>
                  🕐 Hora de recuperación (fuera de horario)
                </span>
              </label>
            </div>

            {esRecuperacion && (
              <div style={{marginBottom:12,padding:'10px 12px',background:'#eff6ff',borderRadius:9,border:'1px solid #bfdbfe'}}>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#1e40af',marginBottom:6}}>
                  Motivo de recuperación:
                </label>
                <textarea 
                  value={motivoRecuperacion}
                  onChange={e=>setMotivoRecuperacion(e.target.value)}
                  placeholder="Ej: Recuperación de hora del martes 20/05"
                  rows={2}
                  style={{width:'100%',padding:'8px',border:'1px solid #bfdbfe',borderRadius:6,fontSize:12,fontFamily:'inherit'}}
                />
              </div>
            )}
            
            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>
                Observación {esFinDeSemana && <span style={{color:'#dc2626'}}>*</span>}
              </label>
              <textarea 
                value={mObs} 
                onChange={e=>setMObs(e.target.value)} 
                placeholder={esFinDeSemana ? "Obligatorio: Justificar trabajo en fin de semana" : "Ej: llegó tarde por transporte"} 
                rows={esFinDeSemana ? 3 : 2}
                style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${esFinDeSemana ? '#fca5a5' : '#e2e8f0'}`,borderRadius:9,fontFamily:'inherit',fontSize:13}}
              />
              {esFinDeSemana && (
                <p style={{fontSize:10,color:'#dc2626',marginTop:4}}>
                  ⚠️ Campo obligatorio para registro en fin de semana
                </p>
              )}
            </div>
            
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setModal(false)} style={{padding:'8px 16px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'white',cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>Cancelar</button>
              <button onClick={guardar} disabled={saving||!mPerId||(esFinDeSemana&&!mObs.trim())} style={{padding:'8px 18px',borderRadius:9,border:'none',background:'#002F6C',color:'white',cursor:(!mPerId||saving||(esFinDeSemana&&!mObs.trim()))?'not-allowed':'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit',opacity:(!mPerId||saving||(esFinDeSemana&&!mObs.trim()))?0.6:1}}>
                {saving?'Guardando...':'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}