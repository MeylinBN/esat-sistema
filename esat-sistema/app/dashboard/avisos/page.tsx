'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Aviso, TipoAviso, TIPO_AVISO_LABEL } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const TIPO_COLORS: Record<TipoAviso, { bg: string; border: string; txt: string }> = {
  permiso:      { bg:'#f3e8ff', border:'#a855f7', txt:'#7c3aed' },
  anuncio:      { bg:'var(--verde-lt)', border:'#86efac', txt:'var(--verde)' },
  urgente:      { bg:'var(--rojo-lt)', border:'#fca5a5', txt:'var(--rojo2)' },
  horario:      { bg:'var(--azul-lt2)', border:'#93c5fd', txt:'var(--azul2)' },
  recordatorio: { bg:'var(--dorado-lt)', border:'#fde68a', txt:'var(--dorado)' },
}

export default function AsistenciaPage() {
  const supabase =  createClient()
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState(false)
  const [mTipo, setMTipo]   = useState<TipoAviso>('anuncio')
  const [mTitulo, setMTitulo] = useState('')
  const [mDesc, setMDesc]   = useState('')
  const [mDest, setMDest]   = useState('todos')
  const [mFecha, setMFecha] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('avisos').select('*').order('created_at', { ascending: false })
    setAvisos(data ?? [])
    setLoading(false)
  }

  async function guardar() {
    if (!mTitulo) return
    setSaving(true)
    await supabase.from('avisos').insert({
      tipo: mTipo, titulo: mTitulo, descripcion: mDesc,
      destinatario: mDest, fecha_evento: mFecha || null,
      urgente: mTipo === 'urgente',
    })
    setModal(false)
    setMTitulo(''); setMDesc(''); setMFecha('')
    setSaving(false)
    load()
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este aviso?')) return
    await supabase.from('avisos').delete().eq('id', id)
    load()
  }

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'var(--txt3)' }}>Cargando...</div>

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--azul)' }}>Avisos</h1>
          <p style={{ fontSize:12, color:'var(--txt3)', marginTop:2 }}>Comunicados del equipo</p>
        </div>
        <button className="btn btn-p" onClick={() => setModal(true)}>+ Nuevo aviso</button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {avisos.map(a => {
          const c = TIPO_COLORS[a.tipo as TipoAviso] ?? TIPO_COLORS.anuncio
          return (
            <div key={a.id} style={{ background:'white', border:`1.5px solid ${c.border}`,
              borderLeft:`4px solid ${c.txt}`, borderRadius:12, padding:'14px 18px',
              boxShadow:'var(--shadow)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20,
                      background:c.bg, color:c.txt }}>
                      {TIPO_AVISO_LABEL[a.tipo as TipoAviso]}
                    </span>
                    {a.urgente && <span style={{ fontSize:10, fontWeight:700, color:'var(--rojo2)' }}>🔴 URGENTE</span>}
                  </div>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>{a.titulo}</div>
                  {a.descripcion && (
                    <div style={{ fontSize:12, color:'var(--txt2)', lineHeight:1.6 }}>{a.descripcion}</div>
                  )}
                  <div style={{ display:'flex', gap:16, marginTop:8, fontSize:10, color:'var(--txt3)' }}>
                    {a.fecha_evento && (
                      <span>📅 {format(new Date(a.fecha_evento+'T12:00:00'), "d 'de' MMM yyyy", { locale: es })}</span>
                    )}
                    <span>🕐 {format(new Date(a.created_at!), "d MMM · HH:mm", { locale: es })}</span>
                    <span>👥 {a.destinatario === 'todos' ? 'Todo el equipo' : a.destinatario}</span>
                  </div>
                </div>
                <button onClick={() => eliminar(a.id)} style={{ background:'var(--rojo-lt)', border:'none',
                  color:'var(--rojo2)', borderRadius:7, padding:'4px 8px', cursor:'pointer', fontSize:11,
                  fontWeight:600, flexShrink:0 }}>
                  Eliminar
                </button>
              </div>
            </div>
          )
        })}
        {!avisos.length && (
          <div style={{ textAlign:'center', padding:40, color:'var(--txt3)' }}>
            Sin avisos registrados
          </div>
        )}
      </div>

      {modal && (
        <div className="mo" onClick={e => { if(e.target===e.currentTarget) setModal(false) }}>
          <div className="mo-box">
            <div className="mo-head">
              <h3>Nuevo aviso</h3>
              <button className="mo-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="ig" style={{ marginBottom:12 }}>
              <label>Tipo</label>
              <select value={mTipo} onChange={e => setMTipo(e.target.value as TipoAviso)}>
                {Object.entries(TIPO_AVISO_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="ig" style={{ marginBottom:12 }}>
              <label>Título</label>
              <input value={mTitulo} onChange={e => setMTitulo(e.target.value)} placeholder="Título del aviso" />
            </div>
            <div className="ig" style={{ marginBottom:12 }}>
              <label>Descripción</label>
              <textarea value={mDesc} onChange={e => setMDesc(e.target.value)} rows={3} placeholder="Detalla el aviso..." />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
              <div className="ig">
                <label>Destinatario</label>
                <select value={mDest} onChange={e => setMDest(e.target.value)}>
                  <option value="todos">Todo el equipo</option>
                  <option value="Practicante">Practicantes</option>
                  <option value="SENATI">SENATI</option>
                  <option value="Voluntario">Voluntarios</option>
                  <option value="Asistente">Asistentes</option>
                  <option value="EcoBIOTEM">EcoBIOTEM</option>
                </select>
              </div>
              <div className="ig">
                <label>Fecha del evento</label>
                <input type="date" value={mFecha} onChange={e => setMFecha(e.target.value)} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn btn-s" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={guardar} disabled={saving || !mTitulo}>
                {saving ? 'Guardando...' : 'Publicar aviso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
