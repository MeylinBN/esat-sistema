'use client' 
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Persona, Asistencia, getTurno } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const DIAS: Record<number, string> = { 1:'L', 2:'M', 3:'X', 4:'J', 5:'V', 6:'S', 0:'D' }
const ESTADO_LABEL: Record<string, string> = {
  presente:'Presente', tarde:'Tardanza', ausente:'Ausente',
  permiso:'Permiso', falta_justificada:'F. Justificada', falta_injustificada:'F. Injustificada',
}
const ESTADO_COLOR: Record<string, string> = {
  presente:'#15803d', tarde:'#d97706', ausente:'#dc2626',
  permiso:'#7c3aed', falta_justificada:'#0369a1', falta_injustificada:'#b91c1c',
}

export default function AsistenciaPage() {
  const supabase = createClient()
  const hoy = format(new Date(), 'yyyy-MM-dd')
  const diaKey = DIAS[new Date().getDay()]

  const [personas, setPersonas]     = useState<Persona[]>([])
  const [asistencias, setAsistencias] = useState<Asistencia[]>([])
  const [horarios, setHorarios]     = useState<any[]>([])
  const [loading, setLoading]       = useState(true)

  // Modal
  const [modal, setModal]           = useState(false)
  const [mPerId, setMPerId]         = useState('')
  const [mTipo, setMTipo]           = useState<'entrada'|'salida'>('entrada')
  const [mHora, setMHora]           = useState(format(new Date(), 'HH:mm'))
  const [mObs, setMObs]             = useState('')
  const [saving, setSaving]         = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: a }, { data: h }] = await Promise.all([
      supabase.from('personas').select('*').eq('activo', true).order('nombre'),
      supabase.from('asistencias').select('*').eq('fecha', hoy),
      supabase.from('horarios').select('*'),
    ])
    setPersonas(p ?? [])
    setAsistencias(a ?? [])
    setHorarios(h ?? [])
    setLoading(false)
  }

  function turnoHoy(personaId: string) {
    const franjas = horarios.filter(h => h.persona_id === personaId && h.dia === diaKey)
    return getTurno(franjas)
  }

  function getAsistencia(personaId: string) {
    return asistencias.find(a => a.persona_id === personaId)
  }

  async function guardar() {
    if (!mPerId) return
    setSaving(true)
    const asist = getAsistencia(mPerId)
    const hora  = mHora + ':00'

    if (!asist) {
      // Calcular tardanza
      const persona = personas.find(p => p.id === mPerId)
      let tard = 0
      if (persona?.hora_ingreso && mTipo === 'entrada') {
        const [hE, mE] = persona.hora_ingreso.split(':').map(Number)
        const [hR, mR] = mHora.split(':').map(Number)
        tard = Math.max(0, (hR*60+mR) - (hE*60+mE) - (persona.tolerancia ?? 10))
      }
      const estado = tard > 0 ? 'tarde' : 'presente'
      await supabase.from('asistencias').insert({
        persona_id: mPerId, fecha: hoy,
        hora_entrada: mTipo === 'entrada' ? hora : null,
        hora_salida:  mTipo === 'salida'  ? hora : null,
        estado, tardanza_min: tard, observacion: mObs || null,
      })
    } else {
      const updates: any = { observacion: mObs || asist.observacion }
      if (mTipo === 'entrada') updates.hora_entrada = hora
      else updates.hora_salida = hora
      await supabase.from('asistencias').update(updates).eq('id', asist.id)
    }

    setModal(false)
    setMObs('')
    setSaving(false)
    load()
  }

  const esat   = personas.filter(p => p.grupo === 'ESAT')
  const eco    = personas.filter(p => p.grupo === 'EcoBIOTEM')
  const presentes = asistencias.filter(a => ['presente','tarde'].includes(a.estado)).length

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'var(--txt3)' }}>Cargando...</div>

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--azul)' }}>Asistencia</h1>
          <p style={{ fontSize:12, color:'var(--txt3)', marginTop:2, textTransform:'capitalize' }}>
            {format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ padding:'8px 14px', background:'var(--verde-lt)', borderRadius:9,
            fontSize:12, fontWeight:600, color:'var(--verde)' }}>
            {presentes} / {esat.length} presentes
          </div>
          <button className="btn btn-p" onClick={() => { setModal(true); setMHora(format(new Date(),'HH:mm')) }}>
            + Registrar
          </button>
        </div>
      </div>

      {/* ESAT cards */}
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:13, fontWeight:600, color:'var(--txt2)', marginBottom:12, textTransform:'uppercase', letterSpacing:'.06em' }}>
          Equipo ESAT
        </h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
          {esat.map(p => {
            const a = getAsistencia(p.id)
            const turno = turnoHoy(p.id)
            const estado = a?.estado ?? (turno === '—' ? 'libre' : 'sin_registrar')
            const bgMap: Record<string,string> = {
              presente:'var(--verde-lt)', tarde:'var(--dorado-lt)', ausente:'var(--rojo-lt)',
              permiso:'#f3e8ff', libre:'var(--bg)', sin_registrar:'white',
            }
            return (
              <div key={p.id} style={{ background: bgMap[estado] ?? 'white',
                border:`1.5px solid ${estado==='presente'?'#86efac':estado==='tarde'?'#fde68a':estado==='ausente'?'#fca5a5':'var(--borde2)'}`,
                borderRadius:12, padding:14, cursor:'pointer', transition:'all .2s' }}
                onClick={() => { setMPerId(p.id); setModal(true); setMHora(format(new Date(),'HH:mm')) }}>
                <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:8 }}>
                  <div style={{ width:34, height:34, borderRadius:9, background:p.color+'25',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontWeight:700, fontSize:14, color:p.color }}>
                    {p.nombre.charAt(0)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.nombre}</div>
                    <div style={{ fontSize:9, color:'var(--txt3)' }}>
                      {p.rol === 'SENATI' ? `SENATI · ${p.subrol}` :
                       p.rol === 'Practicante' ? `UNASAM · ${p.subrol}` : p.rol}
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:10 }}>
                  <span style={{ color: ESTADO_COLOR[estado] ?? 'var(--txt3)', fontWeight:600 }}>
                    {estado === 'sin_registrar' ? '—' : ESTADO_LABEL[estado] ?? estado}
                  </span>
                  <span style={{ color:'var(--txt3)' }}>
                    {a?.hora_entrada ? a.hora_entrada.slice(0,5) : turno !== '—' ? turno : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* EcoBIOTEM */}
      {eco.length > 0 && (
        <div>
          <h2 style={{ fontSize:13, fontWeight:600, color:'var(--verde)', marginBottom:12,
            textTransform:'uppercase', letterSpacing:'.06em' }}>
            🌿 GI EcoBIOTEM
          </h2>
          <div style={{ background:'white', borderRadius:12, border:'2px solid #86efac', padding:16,
            fontSize:12, color:'var(--txt2)', lineHeight:1.7 }}>
            Horario flexible — registran horas desde su panel personal.
            <strong> {eco.length} miembros activos.</strong>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="mo" onClick={e => { if(e.target===e.currentTarget) setModal(false) }}>
          <div className="mo-box">
            <div className="mo-head">
              <h3>Registrar asistencia</h3>
              <button className="mo-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="ig" style={{ marginBottom:14 }}>
              <label>Persona</label>
              <select value={mPerId} onChange={e => setMPerId(e.target.value)}>
                <option value="">Seleccionar...</option>
                {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
              <div className="ig">
                <label>Tipo</label>
                <select value={mTipo} onChange={e => setMTipo(e.target.value as any)}>
                  <option value="entrada">Entrada</option>
                  <option value="salida">Salida</option>
                </select>
              </div>
              <div className="ig">
                <label>Hora</label>
                <input type="time" value={mHora} onChange={e => setMHora(e.target.value)} />
              </div>
            </div>
            <div className="ig" style={{ marginBottom:16 }}>
              <label>Observación (opcional)</label>
              <input type="text" value={mObs} onChange={e => setMObs(e.target.value)} placeholder="Ej: llegó por problemas de transporte" />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn btn-s" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={guardar} disabled={saving || !mPerId}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
