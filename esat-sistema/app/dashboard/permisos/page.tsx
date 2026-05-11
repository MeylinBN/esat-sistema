'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Persona, Permiso, TipoPermiso, EstadoPermiso } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const TIPO_LABEL: Record<TipoPermiso, string> = {
  permiso_medico:       '🏥 Médico',
  permiso_personal:     '👤 Personal',
  permiso_academico:    '🎓 Académico',
  falta_justificada:    '📋 F. Justificada',
  falta_injustificada:  '⚠ F. Injustificada',
  vacaciones:           '🏖 Vacaciones',
}
const ESTADO_STYLE: Record<EstadoPermiso, { bg:string; txt:string }> = {
  aprobado:  { bg:'var(--verde-lt)',   txt:'var(--verde)' },
  pendiente: { bg:'var(--dorado-lt)',  txt:'var(--dorado)' },
  rechazado: { bg:'var(--rojo-lt)',    txt:'var(--rojo2)' },
}

export default function AsistenciaPage() {
  const supabase =  createClient()
  const [personas, setPersonas] = useState<Persona[]>([])
  const [permisos, setPermisos] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [mPerId, setMPerId]     = useState('')
  const [mTipo, setMTipo]       = useState<TipoPermiso>('permiso_personal')
  const [mFI, setMFI]           = useState('')
  const [mFF, setMFF]           = useState('')
  const [mMotivo, setMMotivo]   = useState('')
  const [mEstado, setMEstado]   = useState<EstadoPermiso>('pendiente')
  const [mRecup, setMRecup]     = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: p }, { data: pe }] = await Promise.all([
      supabase.from('personas').select('*').eq('activo', true).order('nombre'),
      supabase.from('permisos').select('*, personas(nombre)').order('created_at', { ascending: false }),
    ])
    setPersonas(p ?? [])
    setPermisos(pe ?? [])
    setLoading(false)
  }

  async function guardar() {
    if (!mPerId || !mFI || !mFF) return
    setSaving(true)
    await supabase.from('permisos').insert({
      persona_id: mPerId, tipo: mTipo,
      fecha_inicio: mFI, fecha_fin: mFF,
      motivo: mMotivo, estado: mEstado,
      dias_recuperacion: mRecup || null,
    })
    setModal(false)
    setMPerId(''); setMFI(''); setMFF(''); setMMotivo(''); setMRecup('')
    setSaving(false)
    load()
  }

  async function cambiarEstado(id: string, estado: EstadoPermiso) {
    await supabase.from('permisos').update({ estado }).eq('id', id)
    load()
  }

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'var(--txt3)' }}>Cargando...</div>

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--azul)' }}>Permisos y Faltas</h1>
          <p style={{ fontSize:12, color:'var(--txt3)', marginTop:2 }}>Registro de ausencias justificadas</p>
        </div>
        <button className="btn btn-p" onClick={() => setModal(true)}>+ Registrar permiso</button>
      </div>

      {/* Pendientes banner */}
      {permisos.filter(p => p.estado === 'pendiente').length > 0 && (
        <div style={{ background:'var(--dorado-lt)', border:'1.5px solid #fde68a', borderRadius:10,
          padding:'12px 16px', marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
          <span>⏳</span>
          <span style={{ fontSize:13, color:'var(--dorado)', fontWeight:600 }}>
            {permisos.filter(p => p.estado === 'pendiente').length} permiso(s) pendiente(s) de aprobación
          </span>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {permisos.map(p => {
          const es_ = ESTADO_STYLE[p.estado as EstadoPermiso] ?? ESTADO_STYLE.pendiente
          return (
            <div key={p.id} style={{ background:'white', borderRadius:12,
              border:'1.5px solid var(--borde2)', padding:'14px 18px', boxShadow:'var(--shadow)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:13, fontWeight:700 }}>{p.personas?.nombre ?? '—'}</span>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'var(--azul-lt2)', color:'var(--azul2)' }}>
                      {TIPO_LABEL[p.tipo as TipoPermiso] ?? p.tipo}
                    </span>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20,
                      background:es_.bg, color:es_.txt, fontWeight:600 }}>
                      {p.estado}
                    </span>
                  </div>
                  <div style={{ fontSize:12, color:'var(--txt2)', marginBottom:4 }}>
                    📅 {format(new Date(p.fecha_inicio+'T12:00:00'), "d MMM yyyy", { locale: es })}
                    {p.fecha_fin !== p.fecha_inicio && ` → ${format(new Date(p.fecha_fin+'T12:00:00'), "d MMM yyyy", { locale: es })}`}
                  </div>
                  {p.motivo && <div style={{ fontSize:12, color:'var(--txt2)' }}>{p.motivo}</div>}
                  {p.dias_recuperacion && (
                    <div style={{ fontSize:11, color:'var(--txt3)', marginTop:4 }}>
                      🔁 Recuperación: {p.dias_recuperacion}
                    </div>
                  )}
                </div>
                {p.estado === 'pendiente' && (
                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    <button onClick={() => cambiarEstado(p.id, 'aprobado')}
                      className="btn btn-sm" style={{ background:'var(--verde-lt)', color:'var(--verde)', border:'1px solid #86efac' }}>
                      ✓ Aprobar
                    </button>
                    <button onClick={() => cambiarEstado(p.id, 'rechazado')}
                      className="btn btn-sm" style={{ background:'var(--rojo-lt)', color:'var(--rojo2)', border:'1px solid #fca5a5' }}>
                      ✗ Rechazar
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {!permisos.length && (
          <div style={{ textAlign:'center', padding:40, color:'var(--txt3)' }}>Sin permisos registrados</div>
        )}
      </div>

      {modal && (
        <div className="mo" onClick={e => { if(e.target===e.currentTarget) setModal(false) }}>
          <div className="mo-box">
            <div className="mo-head">
              <h3>Registrar permiso / falta</h3>
              <button className="mo-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div className="ig">
                <label>Persona</label>
                <select value={mPerId} onChange={e => setMPerId(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="ig">
                <label>Tipo</label>
                <select value={mTipo} onChange={e => setMTipo(e.target.value as TipoPermiso)}>
                  {Object.entries(TIPO_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div className="ig"><label>Fecha inicio</label><input type="date" value={mFI} onChange={e => setMFI(e.target.value)} /></div>
              <div className="ig"><label>Fecha fin</label><input type="date" value={mFF} onChange={e => setMFF(e.target.value)} /></div>
            </div>
            <div className="ig" style={{ marginBottom:12 }}>
              <label>Motivo</label>
              <textarea value={mMotivo} onChange={e => setMMotivo(e.target.value)} rows={2} placeholder="Explica el motivo..." />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
              <div className="ig">
                <label>Estado</label>
                <select value={mEstado} onChange={e => setMEstado(e.target.value as EstadoPermiso)}>
                  <option value="aprobado">Aprobado</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="rechazado">Rechazado</option>
                </select>
              </div>
              <div className="ig">
                <label>Días de recuperación</label>
                <input value={mRecup} onChange={e => setMRecup(e.target.value)} placeholder="Ej: martes 28/04" />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn btn-s" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={guardar} disabled={saving || !mPerId || !mFI}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
