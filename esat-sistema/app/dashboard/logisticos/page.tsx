'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfWeek, addDays } from 'date-fns'
import { es } from 'date-fns/locale'

export default function DashboardLogisticoPage() {
  const supabase = createClient()
  // Usamos la fecha local del navegador para evitar errores de servidor
  const hoy = format(new Date(), 'yyyy-MM-dd')
  const lunes = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const viernes = format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 4), 'yyyy-MM-dd')

  const [coordinador, setCoordinador] = useState<any>(null)
  const [personas, setPersonas] = useState<any[]>([])
  const [asistHoy, setAsistHoy] = useState<any[]>([])
  const [permisos, setPermisos] = useState<any[]>([])
  const [tareas, setTareas] = useState<any[]>([])
  const [tiempoExtra, setTiempoExtra] = useState<any[]>([])
  const [flexibilidadHoy, setFlexibilidadHoy] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Estados para Flexibilidad Horaria
  const [modalFlex, setModalFlex] = useState(false)
  const [flexPersonas, setFlexPersonas] = useState<string[]>([])
  const [flexFecha, setFlexFecha] = useState(hoy)
  const [flexMinutos, setFlexMinutos] = useState('15')
  const [flexMotivo, setFlexMotivo] = useState('')

  // Estados para Tiempo Extra
  const [modalTiempoExtra, setModalTiempoExtra] = useState(false)
  const [tePersonas, setTePersonas] = useState<string[]>([])
  const [teFecha, setTeFecha] = useState(hoy)
  const [teHoraInicio, setTeHoraInicio] = useState('')
  const [teHoraFin, setTeHoraFin] = useState('')
  const [teMotivo, setTeMotivo] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: coordData } = await supabase
      .from('personas')
      .select('*')
      .eq('auth_id', user.id)
      .single()

    setCoordinador(coordData)

    const esFrancisco = coordData?.dni === '70189681'
    const grupoAsignado = esFrancisco ? 'EcoBIOTEM' : 'ESAT'
    const rolFiltro = esFrancisco ? 'EcoBIOTEM' : ['Practicante', 'SENATI', 'Voluntario', 'Asistente']

    const [p, ah, perm, tar, te, flex] = await Promise.all([
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
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('tareas')
        .select('*, personas(nombre,color)')
        .neq('estado', 'cancelada')
        .order('created_at', { ascending: false })
        .limit(10),
      // Tiempo extra - SOLO HOY
      supabase.from('horas_extras')
        .select('*, personas(nombre,color,rol)')
        .eq('fecha', hoy)
        .eq('aprobado', true)
        .order('created_at', { ascending: false }),
      // Flexibilidad horaria - SOLO HOY
      supabase.from('flexibilidad_horaria')
        .select('*, personas(nombre)')
        .eq('fecha', hoy)
        .order('created_at', { ascending: false }),
    ])

    const personasIds = p.data?.map(x => x.id) || []
    const asistFiltrada = ah.data?.filter(a => personasIds.includes(a.persona_id)) || []

    setPersonas(p.data ?? [])
    setAsistHoy(asistFiltrada)
    setPermisos(perm.data ?? [])
    setTareas(tar.data ?? [])
    setTiempoExtra(te.data ?? [])
    setFlexibilidadHoy(flex.data ?? [])
    setLoading(false)
  }

  async function registrarTiempoExtra() {
    if (tePersonas.length === 0 || !teFecha || !teHoraInicio || !teHoraFin) {
      alert('Selecciona al menos una persona, fecha y horas')
      return
    }

    // Calcular horas
    const inicio = new Date(`2000-01-01T${teHoraInicio}`)
    const fin = new Date(`2000-01-01T${teHoraFin}`)
    const horas = (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60)

    // Registrar para cada persona seleccionada
    for (const personaId of tePersonas) {
      await supabase.from('horas_extras').insert({
        persona_id: personaId,
        fecha: teFecha,
        hora_inicio: teHoraInicio + ':00',
        hora_fin: teHoraFin + ':00',
        horas_solicitadas: horas,
        motivo: teMotivo,
        aprobado: true,
        aprobado_por: coordinador?.id
      })
    }

    setModalTiempoExtra(false)
    setTePersonas([])
    setTeFecha(hoy)
    setTeHoraInicio('')
    setTeHoraFin('')
    setTeMotivo('')
    alert(`Tiempo extra registrado para ${tePersonas.length} persona(s)`)
    load()
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
    if (flexPersonas.length === 0 || !flexFecha || !flexMotivo) {
      alert('Selecciona al menos una persona y completa los campos')
      return
    }

    // Registrar para cada persona seleccionada
    for (const personaId of flexPersonas) {
      await supabase.from('flexibilidad_horaria').insert({
        persona_id: personaId,
        fecha: flexFecha,
        minutos_gracia: parseInt(flexMinutos),
        motivo: flexMotivo,
        autorizado_por: coordinador?.id
      })
    }

    setModalFlex(false)
    setFlexPersonas([])
    setFlexFecha(hoy)
    setFlexMinutos('15')
    setFlexMotivo('')
    alert(`Flexibilidad registrada para ${flexPersonas.length} persona(s)`)
    load()
  }

  const presentes = asistHoy.filter(a => ['presente', 'tarde'].includes(a.estado)).length
  const tardanzas = asistHoy.filter(a => a.estado === 'tarde').length
  const permisosPendientes = permisos.length
  const tareasActivas = tareas.filter(t => t.estado === 'en_progreso').length

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando dashboard logístico...</div>

  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif', background: '#f8fafc', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#002F6C' }}>
            Dashboard de Gestión del Equipo
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Control de asistencias, permisos y avances del equipo
          </p>
        </div>
        <button onClick={async () => {
          await supabase.auth.signOut()
          window.location.href = '/auth/login'
        }} style={{
          background: '#dc2626', color: 'white', padding: '8px 16px',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600
        }}>
          Cerrar Sesión
        </button>
      </div>

      {/* Banner informativo */}
      <div style={{
        background: coordinador?.dni === '70189681'
          ? 'linear-gradient(135deg,#166534,#15803d)'
          : 'linear-gradient(135deg,#002F6C,#1249A0)',
        borderRadius: 14,
        padding: '18px 24px',
        marginBottom: 20,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: 16
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, background: 'rgba(255,255,255,.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0
        }}>
          {coordinador?.dni === '70189681' ? '🌿' : '📦'}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {coordinador?.dni === '70189681' ? 'GI EcoBIOTEM' : 'ESAT-FCAM · CIAD-FCAM · UNASAM'}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', marginTop: 2 }}>
            {coordinador?.dni === '70189681'
              ? 'Grupo de Investigación en Biotecnología Ambiental'
              : 'Equipo Técnico y Administrativo - Huaraz, Áncash'}
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { l: 'Personal activo', v: personas.length, s: `${coordinador?.dni === '70189681' ? 'EcoBIOTEM' : 'ESAT'}`, i: '👥', c: '#002F6C' },
          { l: 'Presentes hoy', v: presentes, s: `de ${personas.length} esperados`, i: '✅', c: '#15803d' },
          { l: 'Tardanzas', v: tardanzas, s: 'registradas hoy', i: '⏰', c: '#d97706' },
          { l: 'Permisos pendientes', v: permisosPendientes, s: 'por aprobar', i: '', c: '#dc2626' },
        ].map(m => (
          <div key={m.l} style={{
            background: 'white', borderRadius: 12, padding: '16px 18px',
            border: `1.5px solid ${m.c}22`, boxShadow: '0 1px 3px rgba(0,0,0,.06)',
            position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>{m.l}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: m.c, lineHeight: 1 }}>{m.v}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{m.s}</div>
            <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 28, opacity: .15 }}>{m.i}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

       {/* Estado del equipo hoy - VERSIÓN MEJORADA */}
<div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#15803d' }} />
    Estado del equipo hoy
  </div>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflowY: 'auto' }}>
    {personas.map(p => {
      const a = asistHoy.find(x => x.persona_id === p.id)
      const tieneFlexibilidad = flexibilidadHoy.find(f => f.persona_id === p.id)
      
      // Calcular hora esperada de entrada
      const horaIngreso = p.hora_ingreso || '08:30'
      const [hEsp, mEsp] = horaIngreso.split(':').map(Number)
      const minutosEsperados = hEsp * 60 + mEsp
      
      // Calcular minutos de gracia si tiene flexibilidad
      const minutosGracia = tieneFlexibilidad?.minutos_gracia || 0
      const tolerancia = p.tolerancia || 10
      const margenTotal = minutosGracia + tolerancia
      
      // Hora actual
      const ahora = new Date()
      const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes()
      
      // Determinar estado visual
      let estadoVisual = 'sin_registrar'
      let colorHora = '#94a3b8'
      let textoEstado = '—'
      
      if (a?.hora_entrada) {
        // Ya registró entrada
        const [hEnt, mEnt] = a.hora_entrada.split(':').map(Number)
        const minutosEntrada = hEnt * 60 + mEnt
        const tardanza = minutosEntrada - minutosEsperados - margenTotal
        
        if (tardanza > 0) {
          colorHora = '#d97706' // Naranja - Tarde
          textoEstado = `${a.hora_entrada.slice(0,5)} (+${Math.floor(tardanza)}min)`
        } else {
          colorHora = '#15803d' // Verde - Puntual
          textoEstado = a.hora_entrada.slice(0,5)
        }
      } else {
        // Aún no registra entrada
        const minutosTarde = minutosActuales - minutosEsperados - margenTotal
        
        if (minutosTarde > 15) {
          // Ya pasó más de 15 minutos de su hora → ROJO (Ausente)
          colorHora = '#dc2626'
          textoEstado = 'AUSENTE'
        } else if (minutosTarde > 0) {
          // Ya pasó su hora pero menos de 15 min → NARANJA (Esperando)
          colorHora = '#d97706'
          textoEstado = `${minutosTarde}min tarde`
        } else {
          // Aún es temprano → GRIS
          colorHora = '#94a3b8'
          textoEstado = '—'
        }
      }
      
      return (
        <div key={p.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 10,
          background: colorHora === '#dc2626' ? '#fef2f2' : 
                     colorHora === '#d97706' ? '#fff7ed' : 
                     colorHora === '#15803d' ? '#f0fdf4' : '#f8fafc',
          border: `1.5px solid ${colorHora}40`
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: p.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0,
            border: `2px solid ${colorHora}`,
            boxShadow: colorHora !== '#94a3b8' ? `0 0 0 3px ${colorHora}20` : 'none'
          }}>
            {p.nombre.charAt(0)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {p.nombre}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>
              {p.rol} · {p.area || p.subrol || '-'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colorHora }}>
              {textoEstado}
            </div>
            {tieneFlexibilidad && (
              <div style={{ fontSize: 9, color: '#7c3aed', fontWeight: 600 }}>
                +{tieneFlexibilidad.minutos_gracia}min gracia
              </div>
            )}
          </div>
        </div>
      )
    })}
    {!personas.length && (
      <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 }}>
        No hay personal asignado
      </div>
    )}
  </div>
</div>

        {/* Permisos pendientes */}
        <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
              Permisos pendientes
            </span>
            <a href="/dashboard/permisos" style={{ fontSize: 11, color: '#002F6C', textDecoration: 'none', fontWeight: 500 }}>
              Ver todos →
            </a>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {permisos.map(perm => (
              <div key={perm.id} style={{
                padding: '10px 14px', background: '#fffbeb',
                borderRadius: 9, border: '1px solid #fde68a'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: perm.personas?.color || '#94a3b8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: 'white'
                  }}>
                    {perm.personas?.nombre?.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{perm.personas?.nombre}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{perm.personas?.rol}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>
                  📅 {perm.fecha_inicio} · {perm.tipo}
                </div>
                {perm.sustento_texto && (
                  <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', marginBottom: 4 }}>
                    "{perm.sustento_texto}"
                  </div>
                )}
                {perm.dia_recuperacion && (
                  <div style={{ fontSize: 10, color: '#1e40af', background: '#eff6ff', padding: '4px 8px', borderRadius: 4, display: 'inline-block', marginBottom: 6 }}>
                    🔄 Recuperación: {format(new Date(perm.dia_recuperacion), 'dd/MM')} de {perm.hora_recuperacion_inicio?.slice(0, 5)} a {perm.hora_recuperacion_fin?.slice(0, 5)}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button onClick={() => aprobarPermiso(perm.id, 'aprobado')} style={{
                    padding: '4px 10px', background: '#dcfce7', color: '#15803d',
                    border: '1px solid #86efac', borderRadius: 6, fontSize: 10,
                    cursor: 'pointer', fontWeight: 600
                  }}>
                    ✓ Aprobar
                  </button>
                  <button onClick={() => aprobarPermiso(perm.id, 'rechazado')} style={{
                    padding: '4px 10px', background: '#fee2e2', color: '#b91c1c',
                    border: '1px solid #fca5a5', borderRadius: 6, fontSize: 10,
                    cursor: 'pointer', fontWeight: 600
                  }}>
                    ✗ Rechazar
                  </button>
                </div>
              </div>
            ))}
            {!permisos.length && (
              <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 }}>
                ✅ No hay permisos pendientes
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tiempo Extra - SOLO HOY */}
      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed' }} />
            ⏱ Tiempo Extra - Hoy
          </span>
          <button onClick={() => setModalTiempoExtra(true)} style={{ fontSize: 11, color: '#002F6C', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
            + Registrar tiempo extra
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
          Registra cuando una persona trabaje más allá de su horario normal hoy.
        </p>

        {tiempoExtra.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tiempoExtra.map(te => (
              <div key={te.id} style={{
                padding: '10px 14px', background: '#f5f3ff',
                borderRadius: 9, border: '1px solid #ddd6fe'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: te.personas?.color || '#94a3b8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: 'white'
                  }}>
                    {te.personas?.nombre?.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{te.personas?.nombre}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{te.personas?.rol}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>
                  🕐 {te.hora_inicio?.slice(0, 5)} - {te.hora_fin?.slice(0, 5)} ({te.horas_solicitadas?.toFixed(1)}h)
                </div>
                {te.motivo && (
                  <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                    "{te.motivo}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {tiempoExtra.length === 0 && (
          <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8', fontSize: 13 }}>
            No hay tiempo extra registrado para hoy
          </div>
        )}
      </div>

      {/* Modal Registrar Tiempo Extra - CON TAGS (CORREGIDO) */}
      {modalTiempoExtra && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setModalTiempoExtra(false)}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, width: 500, maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Registrar Tiempo Extra</h3>

            {/* Personas - Sistema de Tags */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                Personas ({tePersonas.length} seleccionada{tePersonas.length !== 1 ? 's' : ''})
              </label>

              {/* Tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, minHeight: 40, padding: 10, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 8 }}>
                {tePersonas.map(id => {
                  const p = personas.find(x => x.id === id)
                  if (!p) return null
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#7c3aed', color: 'white', borderRadius: 6, fontSize: 12, fontWeight: 500, boxShadow: '0 1px 3px rgba(124,58,237,0.3)' }}>
                      <span>{p.nombre}</span>
                      <button onClick={() => setTePersonas(tePersonas.filter(x => x !== id))} style={{ background: 'rgba(255,255,255,0.3)', border: 'none', cursor: 'pointer', color: 'white', fontSize: 14, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', padding: 0 }}>×</button>
                    </div>
                  )
                })}
                {tePersonas.length === 0 && <span style={{ color: '#94a3b8', fontSize: 12 }}>Selecciona personas...</span>}
              </div>

              {/* Dropdown */}
              <select
                value=""
                onChange={e => { if (e.target.value) setTePersonas([...tePersonas, e.target.value]) }}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 12 }}
              >
                <option value="">+ Agregar persona...</option>
                {personas.filter(p => !tePersonas.includes(p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} · {p.rol}</option>
                ))}
              </select>
            </div>

            {/* CORRECCIÓN: Campos de Tiempo Extra (Sin Minutos de Gracia) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Fecha</label>
                <input type="date" value={teFecha} onChange={e => setTeFecha(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Hora Inicio</label>
                <input type="time" value={teHoraInicio} onChange={e => setTeHoraInicio(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6 }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Hora Fin</label>
                <input type="time" value={teHoraFin} onChange={e => setTeHoraFin(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6 }} />
              </div>
              {/* Este espacio queda vacío o para otro campo si se requiere, pero ya no hay minutos de gracia */}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Motivo</label>
              <textarea value={teMotivo} onChange={e => setTeMotivo(e.target.value)} rows={3} placeholder="Ej: Entrega de proyecto urgente" style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6 }} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalTiempoExtra(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button onClick={registrarTiempoExtra} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Registrar para {tePersonas.length} persona{tePersonas.length !== 1 ? 's' : ''}</button>
            </div>
          </div>
        </div>
      )}

      {/* Flexibilidad Horaria - SOLO HOY */}
      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }} />
             Flexibilidad Horaria - Hoy
          </span>
          <button onClick={() => setModalFlex(true)} style={{ fontSize: 11, color: '#002F6C', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
            + Registrar flexibilidad
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
          Permite que personas específicas lleguen tarde hoy sin que se marque como tardanza.
        </p>
        {flexibilidadHoy.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {flexibilidadHoy.map(f => (
              <div key={f.id} style={{
                padding: '10px 14px', background: '#f0f9ff',
                borderRadius: 8, border: '1.5px solid #bae6fd',
                fontSize: 12, color: '#0369a1'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#3b82f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: 'white'
                  }}>
                    {f.personas?.nombre?.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{f.personas?.nombre}</div>
                    <div style={{ fontSize: 10, color: '#0369a1', fontStyle: 'italic' }}>{f.motivo}</div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#0284c7', background: '#e0f2fe', padding: '4px 8px', borderRadius: 6 }}>
                    {f.minutos_gracia} min
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {flexibilidadHoy.length === 0 && (
          <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8', fontSize: 13 }}>
            No hay flexibilidad registrada para hoy
          </div>
        )}
      </div>

      {/* Modal Flexibilidad Horaria - CON TAGS */}
      {modalFlex && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setModalFlex(false)}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, width: 500, maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Registrar Flexibilidad Horaria</h3>

            {/* Personas - Sistema de Tags */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                Personas ({flexPersonas.length} seleccionada{flexPersonas.length !== 1 ? 's' : ''})
              </label>

              {/* Tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, minHeight: 40, padding: 10, background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 8 }}>
                {flexPersonas.map(id => {
                  const p = personas.find(x => x.id === id)
                  if (!p) return null
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#3b82f6', color: 'white', borderRadius: 6, fontSize: 12, fontWeight: 500, boxShadow: '0 1px 3px rgba(59,130,246,0.3)' }}>
                      <span>{p.nombre}</span>
                      <button onClick={() => setFlexPersonas(flexPersonas.filter(x => x !== id))} style={{ background: 'rgba(255,255,255,0.3)', border: 'none', cursor: 'pointer', color: 'white', fontSize: 14, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', padding: 0 }}>×</button>
                    </div>
                  )
                })}
                {flexPersonas.length === 0 && <span style={{ color: '#94a3b8', fontSize: 12 }}>Selecciona personas...</span>}
              </div>

              {/* Dropdown */}
              <select
                value=""
                onChange={e => { if (e.target.value) setFlexPersonas([...flexPersonas, e.target.value]) }}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 12 }}
              >
                <option value="">+ Agregar persona...</option>
                {personas.filter(p => !flexPersonas.includes(p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} · {p.rol}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Fecha</label>
                <input type="date" value={flexFecha} onChange={e => setFlexFecha(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Minutos de Gracia</label>
                <input type="number" value={flexMinutos} onChange={e => setFlexMinutos(e.target.value)} placeholder="15" style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6 }} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Motivo</label>
              <textarea value={flexMotivo} onChange={e => setFlexMotivo(e.target.value)} rows={3} placeholder="Ej: Reunión general de ESAT" style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6 }} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalFlex(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button onClick={guardarFlexibilidad} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Registrar para {flexPersonas.length} persona{flexPersonas.length !== 1 ? 's' : ''}</button>
            </div>
          </div>
        </div>
      )}

      {/* Tareas activas */}
      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706' }} />
            Tareas activas ({tareasActivas})
          </span>
          <a href="/dashboard/tareas" style={{ fontSize: 11, color: '#002F6C', textDecoration: 'none', fontWeight: 500 }}>
            Ver todas →
          </a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 10 }}>
          {tareas.slice(0, 6).map(t => (
            <div key={t.id} style={{
              padding: '12px', background: '#f8fafc', borderRadius: 9,
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
                {t.titulo}
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>
                👤 {t.personas?.nombre} · 📅 {t.fecha_limite}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 9, padding: '2px 6px', borderRadius: 12,
                  background: t.estado === 'en_progreso' ? '#dbeafe' : '#dcfce7',
                  color: t.estado === 'en_progreso' ? '#1d4ed8' : '#15803d',
                  fontWeight: 600, textTransform: 'uppercase'
                }}>
                  {t.estado === 'en_progreso' ? 'En progreso' : 'Completada'}
                </span>
                {t.prioridad && (
                  <span style={{
                    fontSize: 9, padding: '2px 6px', borderRadius: 12,
                    background: t.prioridad === 'alta' ? '#fee2e2' : '#fef3c7',
                    color: t.prioridad === 'alta' ? '#b91c1c' : '#b45309',
                    fontWeight: 600
                  }}>
                    {t.prioridad}
                  </span>
                )}
              </div>
            </div>
          ))}
          {!tareas.length && (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 }}>
              No hay tareas registradas
            </div>
          )}
        </div>
      </div>
    </div>
  )
}