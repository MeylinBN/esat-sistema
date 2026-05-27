'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfWeek, addDays } from 'date-fns'
import { es } from 'date-fns/locale'

export default function DashboardLogisticoPage() {
  const supabase = createClient()
  const hoy = format(new Date(),'yyyy-MM-dd')
  const lunes = format(startOfWeek(new Date(),{weekStartsOn:1}),'yyyy-MM-dd')
  const viernes = format(addDays(startOfWeek(new Date(),{weekStartsOn:1}),4),'yyyy-MM-dd')

  const [coordinador, setCoordinador] = useState<any>(null)
  const [personas, setPersonas] = useState<any[]>([])
  const [asistHoy, setAsistHoy] = useState<any[]>([])
  const [permisos, setPermisos] = useState<any[]>([])
  const [tareas, setTareas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Estados para Flexibilidad Horaria
  const [modalFlex, setModalFlex] = useState(false)
  const [flexPersona, setFlexPersona] = useState('')
  const [flexFecha, setFlexFecha] = useState('')
  const [flexMinutos, setFlexMinutos] = useState('15')
  const [flexMotivo, setFlexMotivo] = useState('')

  useEffect(()=>{load()},[])

  async function load(){
    const { data: { user } } = await supabase.auth.getUser()
    if(!user) return

    const { data: coordData } = await supabase
      .from('personas')
      .select('*')
      .eq('auth_id', user.id)
      .single()
    
    setCoordinador(coordData)

    const esFrancisco = coordData?.dni === '70189681'
    const grupoAsignado = esFrancisco ? 'EcoBIOTEM' : 'ESAT'
    const rolFiltro = esFrancisco ? 'EcoBIOTEM' : ['Practicante','SENATI','Voluntario','Asistente']

    const [p, ah, perm, tar] = await Promise.all([
      supabase.from('personas')
        .select('*')
        .eq('activo', true)
        .in('rol', Array.isArray(rolFiltro) ? rolFiltro : [rolFiltro])
        .eq('grupo', grupoAsignado)
        .order('nombre'),
      supabase.from('asistencias')
        .select('*')
        .eq('fecha', hoy),
      supabase.from('permisos')
        .select('*, personas(nombre,color,rol)')
        .eq('estado', 'pendiente')
        .order('created_at', {ascending:false})
        .limit(5),
      supabase.from('tareas')
        .select('*, personas(nombre,color)')
        .neq('estado', 'cancelada')
        .order('created_at', {ascending:false})
        .limit(10),
    ])

    const personasIds = p.data?.map(x=>x.id) || []
    const asistFiltrada = ah.data?.filter(a=>personasIds.includes(a.persona_id)) || []

    setPersonas(p.data ?? [])
    setAsistHoy(asistFiltrada)
    setPermisos(perm.data ?? [])
    setTareas(tar.data ?? [])
    setLoading(false)
  }

  async function aprobarPermiso(id: string, estado: string) {
    await supabase.from('permisos').update({
      estado: estado,
      recuperacion_aprobada: estado === 'aprobado',
      revisado_por: coordinador?.id
    }).eq('id', id)
    load()
  }

  async function guardarFlexibilidad() {
    if(!flexPersona || !flexFecha || !flexMotivo) {
      alert('Completa todos los campos')
      return
    }
    
    await supabase.from('flexibilidad_horaria').insert({
      persona_id: flexPersona,
      fecha: flexFecha,
      minutos_gracia: parseInt(flexMinutos),
      motivo: flexMotivo,
      autorizado_por: coordinador?.id
    })
    
    setModalFlex(false)
    setFlexPersona('')
    setFlexFecha('')
    setFlexMinutos('15')
    setFlexMotivo('')
    alert('Flexibilidad registrada correctamente')
  }

  const presentes = asistHoy.filter(a=>['presente','tarde'].includes(a.estado)).length
  const tardanzas = asistHoy.filter(a=>a.estado==='tarde').length
  const permisosPendientes = permisos.length
  const tareasActivas = tareas.filter(t=>t.estado==='en_progreso').length

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando dashboard logístico...</div>

  return (
    <div style={{padding:'24px',fontFamily:'sans-serif',background:'#f8fafc',minHeight:'100vh'}}>
      
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#002F6C' }}>
            Dashboard de Gestión del Equipo
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Control de asistencias, permisos y avances del equipo
          </p>
        </div>
        <button onClick={async ()=>{
          await supabase.auth.signOut()
          window.location.href='/auth/login'
        }} style={{
          background:'#dc2626',color:'white',padding:'8px 16px',
          border:'none',borderRadius:8,cursor:'pointer',fontWeight:600
        }}>
          Cerrar Sesión
        </button>
      </div>

      {/* Banner informativo */}
      <div style={{
        background: coordinador?.dni==='70189681' 
          ? 'linear-gradient(135deg,#166534,#15803d)' 
          : 'linear-gradient(135deg,#002F6C,#1249A0)',
        borderRadius:14,
        padding:'18px 24px',
        marginBottom:20,
        color:'white',
        display:'flex',
        alignItems:'center',
        gap:16
      }}>
        <div style={{
          width:44,height:44,borderRadius:10,background:'rgba(255,255,255,.15)',
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0
        }}>
          {coordinador?.dni==='70189681' ? '🌿' : '📦'}
        </div>
        <div>
          <div style={{fontSize:16,fontWeight:700}}>
            {coordinador?.dni==='70189681' ? 'GI EcoBIOTEM' : 'ESAT-FCAM · CIAD-FCAM · UNASAM'}
          </div>
          <div style={{fontSize:12,color:'rgba(255,255,255,.7)',marginTop:2}}>
            {coordinador?.dni==='70189681' 
              ? 'Grupo de Investigación en Biotecnología Ambiental' 
              : 'Equipo Técnico y Administrativo - Huaraz, Áncash'}
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
        {[
          {l:'Personal activo',v:personas.length,s:`${coordinador?.dni==='70189681'?'EcoBIOTEM':'ESAT'}`,i:'👥',c:'#002F6C'},
          {l:'Presentes hoy',v:presentes,s:`de ${personas.length} esperados`,i:'✅',c:'#15803d'},
          {l:'Tardanzas',v:tardanzas,s:'registradas hoy',i:'⏰',c:'#d97706'},
          {l:'Permisos pendientes',v:permisosPendientes,s:'por aprobar',i:'📋',c:'#dc2626'},
        ].map(m=>(
          <div key={m.l} style={{
            background:'white',borderRadius:12,padding:'16px 18px',
            border:`1.5px solid ${m.c}22`,boxShadow:'0 1px 3px rgba(0,0,0,.06)',
            position:'relative',overflow:'hidden'
          }}>
            <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',marginBottom:6}}>{m.l}</div>
            <div style={{fontSize:28,fontWeight:700,color:m.c,lineHeight:1}}>{m.v}</div>
            <div style={{fontSize:11,color:'#94a3b8',marginTop:4}}>{m.s}</div>
            <div style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',fontSize:28,opacity:.15}}>{m.i}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        
        {/* Estado del equipo hoy */}
        <div style={{background:'white',borderRadius:14,border:'1.5px solid #e2e8f0',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
          <div style={{fontSize:14,fontWeight:600,color:'#0f172a',marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#15803d'}}/>
            Estado del equipo hoy
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:380,overflowY:'auto'}}>
            {personas.map(p=>{
              const a = asistHoy.find(x=>x.persona_id===p.id)
              const estado = a?.estado ?? 'sin_registrar'
              const COLOR: Record<string,string> = {
                presente:'#15803d',tarde:'#d97706',ausente:'#dc2626',
                permiso:'#7c3aed',sin_registrar:'#94a3b8'
              }
              return (
                <div key={p.id} style={{
                  display:'flex',alignItems:'center',gap:10,
                  padding:'8px 10px',borderRadius:9,background:'#f8fafc',
                  border:'1px solid #e2e8f0'
                }}>
                  <div style={{
                    width:32,height:32,borderRadius:'50%',background:p.color,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:11,fontWeight:700,color:'white',flexShrink:0
                  }}>
                    {p.nombre.charAt(0)}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {p.nombre}
                    </div>
                    <div style={{fontSize:10,color:'#94a3b8'}}>
                      {p.rol} · {p.area||p.subrol||'-'}
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:COLOR[estado]}}/>
                    <span style={{fontSize:11,color:COLOR[estado],fontWeight:500}}>
                      {a?.hora_entrada?.slice(0,5) ?? '—'}
                    </span>
                  </div>
                </div>
              )
            })}
            {!personas.length && (
              <div style={{textAlign:'center',padding:20,color:'#94a3b8',fontSize:13}}>
                No hay personal asignado
              </div>
            )}
          </div>
        </div>

        {/* Permisos pendientes */}
        <div style={{background:'white',borderRadius:14,border:'1.5px solid #e2e8f0',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
          <div style={{fontSize:14,fontWeight:600,color:'#0f172a',marginBottom:14,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:'#dc2626'}}/>
              Permisos pendientes
            </span>
            <a href="/dashboard/permisos" style={{fontSize:11,color:'#002F6C',textDecoration:'none',fontWeight:500}}>
              Ver todos →
            </a>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {permisos.map(perm=>(
              <div key={perm.id} style={{
                padding:'10px 14px',background:'#fffbeb',
                borderRadius:9,border:'1px solid #fde68a'
              }}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                  <div style={{
                    width:26,height:26,borderRadius:'50%',
                    background:perm.personas?.color||'#94a3b8',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:10,fontWeight:700,color:'white'
                  }}>
                    {perm.personas?.nombre?.charAt(0)}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:600}}>{perm.personas?.nombre}</div>
                    <div style={{fontSize:10,color:'#94a3b8'}}>{perm.personas?.rol}</div>
                  </div>
                </div>
                <div style={{fontSize:11,color:'#475569',marginBottom:4}}>
                  📅 {perm.fecha_inicio} · {perm.tipo}
                </div>
                {perm.sustento_texto && (
                  <div style={{fontSize:11,color:'#64748b',fontStyle:'italic',marginBottom:4}}>
                    "{perm.sustento_texto}"
                  </div>
                )}
                {perm.dia_recuperacion && (
                  <div style={{fontSize:10,color:'#1e40af',background:'#eff6ff',padding:'4px 8px',borderRadius:4,display:'inline-block',marginBottom:6}}>
                    🔄 Recuperación: {format(new Date(perm.dia_recuperacion), 'dd/MM')} de {perm.hora_recuperacion_inicio?.slice(0,5)} a {perm.hora_recuperacion_fin?.slice(0,5)}
                  </div>
                )}
                <div style={{display:'flex',gap:6,marginTop:8}}>
                  <button onClick={()=>aprobarPermiso(perm.id,'aprobado')} style={{
                    padding:'4px 10px',background:'#dcfce7',color:'#15803d',
                    border:'1px solid #86efac',borderRadius:6,fontSize:10,
                    cursor:'pointer',fontWeight:600
                  }}>
                    ✓ Aprobar
                  </button>
                  <button onClick={()=>aprobarPermiso(perm.id,'rechazado')} style={{
                    padding:'4px 10px',background:'#fee2e2',color:'#b91c1c',
                    border:'1px solid #fca5a5',borderRadius:6,fontSize:10,
                    cursor:'pointer',fontWeight:600
                  }}>
                    ✗ Rechazar
                  </button>
                </div>
              </div>
            ))}
            {!permisos.length && (
              <div style={{textAlign:'center',padding:20,color:'#94a3b8',fontSize:13}}>
                ✅ No hay permisos pendientes
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Flexibilidad Horaria - NUEVA SECCIÓN */}
      <div style={{background:'white',borderRadius:14,border:'1.5px solid #e2e8f0',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,.06)', marginBottom: 16}}>
        <div style={{fontSize:14,fontWeight:600,color:'#0f172a',marginBottom:14,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#8b5cf6'}}/>
            ⏰ Flexibilidad Horaria
          </span>
          <button onClick={() => setModalFlex(true)} style={{fontSize:11,color:'#002F6C',background:'none',border:'none',cursor:'pointer',fontWeight:500}}>
            + Registrar flexibilidad
          </button>
        </div>
        <p style={{fontSize:12,color:'#64748b',marginBottom:12}}>
          Permite que personas específicas lleguen tarde un día sin que se marque como tardanza.
        </p>
      </div>

      {/* Tareas activas */}
      <div style={{background:'white',borderRadius:14,border:'1.5px solid #e2e8f0',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
        <div style={{fontSize:14,fontWeight:600,color:'#0f172a',marginBottom:14,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#d97706'}}/>
            Tareas activas ({tareasActivas})
          </span>
          <a href="/dashboard/tareas" style={{fontSize:11,color:'#002F6C',textDecoration:'none',fontWeight:500}}>
            Ver todas →
          </a>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:10}}>
          {tareas.slice(0,6).map(t=>(
            <div key={t.id} style={{
              padding:'12px',background:'#f8fafc',borderRadius:9,
              border:'1px solid #e2e8f0'
            }}>
              <div style={{fontSize:12,fontWeight:600,color:'#0f172a',marginBottom:4}}>
                {t.titulo}
              </div>
              <div style={{fontSize:10,color:'#64748b',marginBottom:6}}>
                👤 {t.personas?.nombre} · 📅 {t.fecha_limite}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{
                  fontSize:9,padding:'2px 6px',borderRadius:12,
                  background:t.estado==='en_progreso'?'#dbeafe':'#dcfce7',
                  color:t.estado==='en_progreso'?'#1d4ed8':'#15803d',
                  fontWeight:600,textTransform:'uppercase'
                }}>
                  {t.estado==='en_progreso'?'En progreso':'Completada'}
                </span>
                {t.prioridad && (
                  <span style={{
                    fontSize:9,padding:'2px 6px',borderRadius:12,
                    background:t.prioridad==='alta'?'#fee2e2':'#fef3c7',
                    color:t.prioridad==='alta'?'#b91c1c':'#b45309',
                    fontWeight:600
                  }}>
                    {t.prioridad}
                  </span>
                )}
              </div>
            </div>
          ))}
          {!tareas.length && (
            <div style={{textAlign:'center',padding:20,color:'#94a3b8',fontSize:13}}>
              No hay tareas registradas
            </div>
          )}
        </div>
      </div>

      {/* Modal Flexibilidad Horaria */}
      {modalFlex && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={()=>setModalFlex(false)}>
          <div style={{background:'white',padding:24,borderRadius:12,width:400,maxWidth:'90%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{marginBottom:16,fontSize:16,fontWeight:600}}>Registrar Flexibilidad Horaria</h3>
            
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:600,color:'#475569',display:'block',marginBottom:4}}>Persona</label>
              <select value={flexPersona} onChange={e=>setFlexPersona(e.target.value)} style={{width:'100%',padding:8,border:'1px solid #e2e8f0',borderRadius:6}}>
                <option value="">Seleccionar...</option>
                {personas.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:600,color:'#475569',display:'block',marginBottom:4}}>Fecha</label>
              <input type="date" value={flexFecha} onChange={e=>setFlexFecha(e.target.value)} style={{width:'100%',padding:8,border:'1px solid #e2e8f0',borderRadius:6}} />
            </div>
            
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:600,color:'#475569',display:'block',marginBottom:4}}>Minutos de Gracia</label>
              <input type="number" value={flexMinutos} onChange={e=>setFlexMinutos(e.target.value)} placeholder="15" style={{width:'100%',padding:8,border:'1px solid #e2e8f0',borderRadius:6}} />
            </div>
            
            <div style={{marginBottom:16}}>
              <label style={{fontSize:11,fontWeight:600,color:'#475569',display:'block',marginBottom:4}}>Motivo</label>
              <textarea value={flexMotivo} onChange={e=>setFlexMotivo(e.target.value)} rows={3} placeholder="Ej: Reunión general de ESAT" style={{width:'100%',padding:8,border:'1px solid #e2e8f0',borderRadius:6}} />
            </div>
            
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setModalFlex(false)} style={{padding:'8px 16px',borderRadius:6,border:'1px solid #e2e8f0',background:'white',cursor:'pointer'}}>Cancelar</button>
              <button onClick={guardarFlexibilidad} style={{padding:'8px 16px',borderRadius:6,border:'none',background:'#002F6C',color:'white',cursor:'pointer'}}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}