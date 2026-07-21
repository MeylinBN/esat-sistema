'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, addDays, addMonths, subMonths, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'

function primerDiaMes(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function ultimoDiaMes(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }

// Semanas (lunes a viernes) que tocan el mes de referencia, con fechas reales.
function getSemanasDeMes(mesRef: Date) {
  const inicioMes = primerDiaMes(mesRef)
  const finMes = ultimoDiaMes(mesRef)
  const semanas: { numero: number; inicio: Date; fin: Date }[] = []
  let cursor = startOfWeek(inicioMes, { weekStartsOn: 1 })
  let n = 1
  while (cursor <= finMes) {
    semanas.push({ numero: n, inicio: cursor, fin: addDays(cursor, 4) })
    cursor = addDays(cursor, 7)
    n++
  }
  return semanas
}

export default function AvancesPage() {
  const supabase = createClient()
  const [personas, setPersonas] = useState<any[]>([])
  const [tareas, setTareas] = useState<any[]>([])
  const [avances, setAvances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selPer, setSelPer] = useState('')

  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})
  const [mesVer, setMesVer] = useState(() => primerDiaMes(new Date()))
  const [seccionesDesplegadas, setSeccionesDesplegadas] = useState<Record<string, boolean>>({})

  const [modalAv, setModalAv] = useState(false)
  const [mTarea, setMTarea] = useState<any>(null)
  const [mPct, setMPct] = useState(0)
  const [mFecha, setMFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [mComentario, setMComentario] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [p, t, a] = await Promise.all([
        supabase.from('personas').select('id,nombre,color,rol,subrol').eq('activo', true).order('nombre'),
        supabase.from('tareas').select('*,personas(nombre,color)').neq('estado', 'cancelada').order('created_at', { ascending: false }),
        supabase.from('avances_semanales').select('*').order('fecha', { ascending: false }),
      ])
      setPersonas(p.data ?? []); setTareas(t.data ?? []); setAvances(a.data ?? [])
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  async function guardar() {
    if (!mTarea || !mFecha) { alert('Selecciona un día'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('avances_semanales').upsert(
        { tarea_id: mTarea.id, fecha: mFecha, porcentaje: mPct, comentario: mComentario || null },
        { onConflict: 'tarea_id,fecha' }
      )
      if (error) throw error
      if (mPct >= 100) {
        const { error: e2 } = await supabase.from('tareas').update({ estado: 'completada' }).eq('id', mTarea.id)
        if (e2) throw e2
      }
    } catch (error: any) {
      console.error('Error guardando:', error)
      alert('❌ Error al guardar: ' + (error?.message ?? error))
    } finally {
      setModalAv(false); setSaving(false); load()
    }
  }

  function abrirModalAvance(t: any) {
    const ultimo = avances.filter(a => a.tarea_id === t.id).sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
    setMTarea(t)
    setMPct(ultimo?.porcentaje ?? 0)
    setMFecha(format(new Date(), 'yyyy-MM-dd'))
    setMComentario('')
    setModalAv(true)
  }

  function toggleExpandido(personaId: string) {
    setExpandidos(prev => ({ ...prev, [personaId]: !prev[personaId] }))
  }

  function toggleSeccion(personaId: string, estado: string) {
    setSeccionesDesplegadas(prev => ({ ...prev, [`${personaId}-${estado}`]: !prev[`${personaId}-${estado}`] }))
  }

  const personasFiltro = selPer ? personas.filter(p => p.id === selPer) : personas
  const tareasVistaPer = selPer ? tareas.filter(t => t.persona_id === selPer) : tareas

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando avances...</div>

  const semanasDelMes = getSemanasDeMes(mesVer)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#002F6C' }}>Avances</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Registro diario de progreso por alumno</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={selPer} onChange={e => setSelPer(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13, fontFamily: 'inherit', maxWidth: 200 }}>
            <option value="">Todas las personas</option>
            {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {personasFiltro.filter(p => tareasVistaPer.some(t => t.persona_id === p.id)).map(p => {
          const tpers = tareasVistaPer.filter(t => t.persona_id === p.id)
          const stats = {
            asignadas: tpers.filter(t => t.estado === 'asignado').length,
            en_progreso: tpers.filter(t => t.estado === 'en_progreso').length,
            subsanacion: tpers.filter(t => t.estado === 'subsanacion').length,
            completadas: tpers.filter(t => t.estado === 'completada').length,
          }
          const abierto = !!expandidos[p.id]

          return (
            <div key={p.id} style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <button onClick={() => toggleExpandido(p.id)} style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', padding: '14px 20px', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0 }}>{p.nombre.charAt(0)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.nombre}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.rol === 'SENATI' ? `SENATI · ${p.subrol}` : p.subrol ?? p.rol}</div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 700, color: '#0369a1' }}>{stats.asignadas}</div><div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>Asignadas</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 700, color: '#1d4ed8' }}>{stats.en_progreso}</div><div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>Progreso</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 700, color: '#be185d' }}>{stats.subsanacion}</div><div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>Subsanación</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 700, color: '#15803d' }}>{stats.completadas}</div><div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>Completadas</div></div>
                </div>
                <span style={{ fontSize: 14, color: '#94a3b8', marginLeft: 4 }}>{abierto ? '▲' : '▼'}</span>
              </button>

              {abierto && (
                <div style={{ padding: '16px 20px' }}>
                  {/* Tareas activas: acceso rápido a "Registrar avance" */}
                  {tpers.filter(t => !['completada'].includes(t.estado)).length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Tareas activas</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {tpers.filter(t => !['completada'].includes(t.estado)).map(t => (
                          <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{t.titulo}</span>
                            <button onClick={() => abrirModalAvance(t)} style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd', borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                              📊 Registrar avance
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Subsanación (con el comentario del coordinador) */}
                  {stats.subsanacion > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <button onClick={() => toggleSeccion(p.id, 'subsanacion')} style={{ width: '100%', padding: '10px', background: '#fce7f3', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#be185d', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>🔧 En subsanación ({stats.subsanacion})</span>
                        <span>{seccionesDesplegadas[`${p.id}-subsanacion`] ? '▲' : '▼'}</span>
                      </button>
                      {seccionesDesplegadas[`${p.id}-subsanacion`] && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {tpers.filter(t => t.estado === 'subsanacion').map(t => {
                            const ultimo = avances.filter(a => a.tarea_id === t.id).sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
                            return (
                              <div key={t.id} style={{ padding: '10px', background: '#fdf2f8', borderRadius: 8, border: '1px solid #f9a8d4' }}>
                                <div style={{ fontSize: 12, fontWeight: 600 }}>{t.titulo}</div>
                                {ultimo?.comentario && <div style={{ fontSize: 10, color: '#be185d', marginTop: 2, fontStyle: 'italic' }}>"{ultimo.comentario}"</div>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Completadas */}
                  {stats.completadas > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <button onClick={() => toggleSeccion(p.id, 'completada')} style={{ width: '100%', padding: '10px', background: '#dcfce7', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#15803d', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>✅ Completadas ({stats.completadas})</span>
                        <span>{seccionesDesplegadas[`${p.id}-completada`] ? '▲' : '▼'}</span>
                      </button>
                      {seccionesDesplegadas[`${p.id}-completada`] && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {tpers.filter(t => t.estado === 'completada').map(t => (
                            <div key={t.id} style={{ padding: '10px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>{t.titulo}</span>
                              <span style={{ fontSize: 11, color: '#15803d', fontWeight: 700 }}>100%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Avance diario por mes */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>📅 Avance diario</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => setMesVer(m => subMonths(m, 1))} style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 12 }}>◀</button>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', textTransform: 'capitalize', minWidth: 110, textAlign: 'center' }}>{format(mesVer, 'MMMM yyyy', { locale: es })}</span>
                        <button onClick={() => setMesVer(m => addMonths(m, 1))} style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 12 }}>▶</button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {semanasDelMes.map(sem => {
                        const ini = format(sem.inicio, 'yyyy-MM-dd')
                        const fin = format(sem.fin, 'yyyy-MM-dd')
                        const idsTarea = new Set(tpers.map(t => t.id))
                        const avancesSemana = avances
                          .filter(a => idsTarea.has(a.tarea_id) && a.fecha >= ini && a.fecha <= fin)
                          .sort((a, b) => a.fecha.localeCompare(b.fecha))

                        return (
                          <div key={sem.numero} style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#002F6C', marginBottom: 8 }}>
                              Semana {sem.numero} ({format(sem.inicio, 'dd/MM')} - {format(sem.fin, 'dd/MM')})
                            </div>
                            {avancesSemana.length === 0 ? (
                              <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Sin avances registrados esta semana</div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {avancesSemana.map(av => {
                                  const tarea = tpers.find(t => t.id === av.tarea_id)
                                  return (
                                    <div key={av.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'white', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                      <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', minWidth: 66, textTransform: 'capitalize' }}>{format(new Date(av.fecha + 'T12:00:00'), 'EEE dd/MM', { locale: es })}</div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tarea?.titulo ?? '—'}</div>
                                        {av.comentario && <div style={{ fontSize: 10, color: '#7c3aed', fontStyle: 'italic', marginTop: 1 }}>💬 {av.comentario}</div>}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 70, height: 6, background: '#e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                                          <div style={{ height: '100%', width: `${av.porcentaje}%`, background: av.porcentaje >= 100 ? '#15803d' : '#2563C8', borderRadius: 10 }} />
                                        </div>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: av.porcentaje >= 100 ? '#15803d' : '#002F6C', minWidth: 32, textAlign: 'right' }}>{av.porcentaje}%</span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {tpers.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 13 }}>Sin tareas registradas</div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {personasFiltro.filter(p => tareasVistaPer.some(t => t.persona_id === p.id)).length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>No hay personas o tareas para mostrar</div>
        )}
      </div>

      {/* Modal registrar avance */}
      {modalAv && mTarea && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => { if (e.target === e.currentTarget) setModalAv(false) }}>
          <div style={{ background: 'white', borderRadius: 18, padding: 24, width: '100%', maxWidth: 450, boxShadow: '0 24px 80px rgba(0,0,0,.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Registrar avance</h3>
              <button onClick={() => setModalAv(false)} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#f1f5f9', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ marginBottom: 14, padding: '10px 14px', background: '#eff6ff', borderRadius: 9, fontSize: 13, fontWeight: 600, color: '#002F6C', border: '1px solid #bfdbfe' }}>{mTarea.titulo}</div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 5, textTransform: 'uppercase' }}>Día *</label>
              <input type="date" value={mFecha} max={format(new Date(), 'yyyy-MM-dd')} onChange={e => setMFecha(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontFamily: 'inherit', fontSize: 13 }} />
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 5, textTransform: 'uppercase' }}>Avance: {mPct}%</label>
              <input type="range" min={0} max={100} step={5} value={mPct} onChange={e => setMPct(+e.target.value)} style={{ width: '100%', accentColor: '#002F6C' }} />
            </div>
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ height: '100%', width: `${mPct}%`, background: mPct >= 100 ? '#15803d' : '#2563C8', borderRadius: 10, transition: 'width .3s' }} />
            </div>
            {mPct >= 100 && <p style={{ fontSize: 12, color: '#15803d', fontWeight: 600, textAlign: 'center', marginBottom: 12 }}>✓ Se marcará como completada</p>}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 5, textTransform: 'uppercase' }}>Comentario (opcional)</label>
              <textarea value={mComentario} onChange={e => setMComentario(e.target.value)} rows={2} placeholder="Duda, nota o comentario para el alumno/coordinador..." style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontFamily: 'inherit', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalAv(false)} style={{ padding: '8px 16px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={guardar} disabled={saving || !mFecha} style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: '#002F6C', color: 'white', cursor: (!mFecha || saving) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', opacity: (!mFecha || saving) ? 0.6 : 1 }}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
