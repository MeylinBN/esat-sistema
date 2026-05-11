'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Persona, Tarea, Prioridad, EstadoTarea } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const PRIO_STYLE: Record<Prioridad, { bg:string; txt:string; label:string }> = {
  alta:  { bg:'var(--rojo-lt)',   txt:'var(--rojo2)',  label:'🔴 Alta'  },
  media: { bg:'var(--dorado-lt)', txt:'var(--dorado)', label:'🟡 Media' },
  baja:  { bg:'var(--verde-lt)',  txt:'var(--verde)',  label:'🟢 Baja'  },
}
const ESTADO_STYLE: Record<EstadoTarea, { bg:string; txt:string; label:string }> = {
  pendiente:   { bg:'var(--bg)',       txt:'var(--txt3)',   label:'Pendiente'    },
  en_progreso: { bg:'var(--azul-lt2)', txt:'var(--azul2)',  label:'En progreso'  },
  completada:  { bg:'var(--verde-lt)', txt:'var(--verde)',  label:'✓ Completada' },
  cancelada:   { bg:'var(--rojo-lt)',  txt:'var(--rojo2)',  label:'Cancelada'    },
}

export default function AsistenciaPage() {
  const supabase = createClient()
  const [personas, setPersonas] = useState<Persona[]>([])
  const [tareas, setTareas]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtroPersona, setFiltroPersona] = useState('')
  const [filtroEstado,  setFiltroEstado]  = useState('')
  const [modal, setModal]       = useState(false)
  const [mTitulo, setMTitulo]   = useState('')
  const [mDesc, setMDesc]       = useState('')
  const [mPerId, setMPerId]     = useState('')
  const [mPrio, setMPrio]       = useState<Prioridad>('media')
  const [mFecha, setMFecha]     = useState('')
  const [mHoras, setMHoras]     = useState('')
  const [mSemana, setMSemana]   = useState('')
  const [mAsignador, setMAsignador] = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from('personas').select('*').eq('activo', true).order('nombre'),
      supabase.from('tareas').select('*, personas(nombre, color), avances_semanales(*)').order('created_at', { ascending: false }),
    ])
    setPersonas(p ?? [])
    setTareas(t ?? [])
    setLoading(false)
  }

  async function cambiarEstado(id: string, estado: EstadoTarea) {
    await supabase.from('tareas').update({ estado }).eq('id', id)
    load()
  }

  async function guardar() {
    if (!mTitulo || !mPerId) return
    setSaving(true)
    await supabase.from('tareas').insert({
      titulo: mTitulo, descripcion: mDesc, persona_id: mPerId,
      prioridad: mPrio, estado: 'pendiente',
      fecha_limite: mFecha || null, horas_estimadas: mHoras ? +mHoras : null,
      semana: mSemana || null, asignado_por: mAsignador || null,
    })
    setModal(false)
    setMTitulo(''); setMDesc(''); setMFecha(''); setMHoras(''); setMSemana(''); setMAsignador('')
    setSaving(false)
    load()
  }

  const filtradas = tareas.filter(t =>
    (!filtroPersona || t.persona_id === filtroPersona) &&
    (!filtroEstado  || t.estado === filtroEstado)
  )

  const contadores = {
    pendiente: tareas.filter(t=>t.estado==='pendiente').length,
    en_progreso: tareas.filter(t=>t.estado==='en_progreso').length,
    completada: tareas.filter(t=>t.estado==='completada').length,
  }

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'var(--txt3)' }}>Cargando...</div>

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--azul)' }}>Tareas</h1>
          <p style={{ fontSize:12, color:'var(--txt3)', marginTop:2 }}>
            {contadores.en_progreso} en progreso · {contadores.pendiente} pendientes · {contadores.completada} completadas
          </p>
        </div>
        <button className="btn btn-p" onClick={() => setModal(true)}>+ Asignar tarea</button>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:20 }}>
        <select value={filtroPersona} onChange={e=>setFiltroPersona(e.target.value)}
          style={{ padding:'7px 12px', border:'1.5px solid var(--borde2)', borderRadius:9, fontSize:12, fontFamily:'inherit' }}>
          <option value="">Todas las personas</option>
          {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)}
          style={{ padding:'7px 12px', border:'1.5px solid var(--borde2)', borderRadius:9, fontSize:12, fontFamily:'inherit' }}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_STYLE).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {filtradas.map(t => {
          const ps  = PRIO_STYLE[t.prioridad as Prioridad] ?? PRIO_STYLE.media
          const es_ = ESTADO_STYLE[t.estado as EstadoTarea] ?? ESTADO_STYLE.pendiente
          const persona = t.personas
          const ultimoAvance = t.avances_semanales?.sort((a:any,b:any) => b.semana.localeCompare(a.semana))[0]
          return (
            <div key={t.id} style={{ background:'white', borderRadius:12,
              border:'1.5px solid var(--borde2)', padding:'14px 18px', boxShadow:'var(--shadow)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                    <span style={{ fontSize:13, fontWeight:700 }}>{t.titulo}</span>
                    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:ps.bg, color:ps.txt }}>{ps.label}</span>
                    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:es_.bg, color:es_.txt, fontWeight:600 }}>{es_.label}</span>
                  </div>
                  {t.descripcion && <div style={{ fontSize:12, color:'var(--txt2)', marginBottom:6, lineHeight:1.5 }}>{t.descripcion}</div>}
                  <div style={{ display:'flex', gap:14, fontSize:11, color:'var(--txt3)', flexWrap:'wrap' }}>
                    {persona && <span style={{ color: persona.color, fontWeight:500 }}>👤 {persona.nombre}</span>}
                    {t.fecha_limite && <span>📅 {format(new Date(t.fecha_limite+'T12:00:00'), "d MMM yyyy", { locale: es })}</span>}
                    {t.horas_estimadas && <span>⏱ {t.horas_estimadas}h</span>}
                    {t.asignado_por && <span>👨‍💼 {t.asignado_por}</span>}
                    {t.semana && <span>📆 {t.semana}</span>}
                  </div>
                  {ultimoAvance && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--txt3)', marginBottom:3 }}>
                        <span>Avance: {ultimoAvance.porcentaje}%</span>
                        <span>{ultimoAvance.semana}</span>
                      </div>
                      <div style={{ height:5, background:'var(--borde2)', borderRadius:10, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${ultimoAvance.porcentaje}%`,
                          background: ultimoAvance.porcentaje===100 ? 'var(--verde)' : 'var(--azul3)', borderRadius:10, transition:'width .4s' }} />
                      </div>
                    </div>
                  )}
                  {t.comentario && <div style={{ fontSize:11, color:'var(--txt3)', marginTop:6, fontStyle:'italic' }}>💬 {t.comentario}</div>}
                </div>
                <select value={t.estado} onChange={e=>cambiarEstado(t.id, e.target.value as EstadoTarea)}
                  style={{ padding:'5px 8px', border:`1.5px solid ${es_.txt}`, borderRadius:8, fontSize:11,
                    color:es_.txt, background:es_.bg, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
                  {Object.entries(ESTADO_STYLE).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
          )
        })}
        {!filtradas.length && (
          <div style={{ textAlign:'center', padding:40, color:'var(--txt3)' }}>Sin tareas</div>
        )}
      </div>

      {modal && (
        <div className="mo" onClick={e => { if(e.target===e.currentTarget) setModal(false) }}>
          <div className="mo-box">
            <div className="mo-head">
              <h3>Asignar tarea</h3>
              <button className="mo-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="ig" style={{ marginBottom:12 }}>
              <label>Título</label>
              <input value={mTitulo} onChange={e=>setMTitulo(e.target.value)} placeholder="Título de la tarea" />
            </div>
            <div className="ig" style={{ marginBottom:12 }}>
              <label>Descripción</label>
              <textarea value={mDesc} onChange={e=>setMDesc(e.target.value)} rows={2} placeholder="Detalle la tarea..." />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div className="ig">
                <label>Asignar a</label>
                <select value={mPerId} onChange={e=>setMPerId(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {personas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="ig">
                <label>Prioridad</label>
                <select value={mPrio} onChange={e=>setMPrio(e.target.value as Prioridad)}>
                  <option value="alta">🔴 Alta</option>
                  <option value="media">🟡 Media</option>
                  <option value="baja">🟢 Baja</option>
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div className="ig"><label>Fecha límite</label><input type="date" value={mFecha} onChange={e=>setMFecha(e.target.value)} /></div>
              <div className="ig"><label>Horas estimadas</label><input type="number" value={mHoras} onChange={e=>setMHoras(e.target.value)} placeholder="20" min={1} /></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
              <div className="ig"><label>Semana</label><input value={mSemana} onChange={e=>setMSemana(e.target.value)} placeholder="Sem 14 (31 mar-4 abr)" /></div>
              <div className="ig"><label>Asignado por</label><input value={mAsignador} onChange={e=>setMAsignador(e.target.value)} placeholder="Nombre del asignador" /></div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn btn-s" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={guardar} disabled={saving || !mTitulo || !mPerId}>
                {saving ? 'Guardando...' : 'Asignar tarea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
