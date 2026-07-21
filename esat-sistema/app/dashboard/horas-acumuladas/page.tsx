'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO, addDays, addMonths, subMonths, startOfWeek } from 'date-fns'
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

export default function HorasAcumuladasPage() {
  const supabase = createClient()
  const [personas, setPersonas] = useState<any[]>([])
  const [asistencias, setAsistencias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroGrupo, setFiltroGrupo] = useState<string>('todos')
  const [personaSel, setPersonaSel] = useState<string>('')
  const [gruposConfig, setGruposConfig] = useState<string[]>([])
  const [mesVer, setMesVer] = useState(() => primerDiaMes(new Date()))
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})

  useEffect(() => {
    load()
    loadGrupos()
  }, [])

  async function loadGrupos() {
    const { data } = await supabase.from('config_grupos').select('nombre').order('orden', { ascending: true })
    setGruposConfig(data?.map(g => g.nombre) || [])
  }

  async function load() {
    try {
      const [p, a] = await Promise.all([
        supabase.from('personas').select('id,nombre,color,rol,grupo,subrol').eq('activo', true).order('nombre'),
        supabase.from('asistencias').select('*').order('fecha', { ascending: false }),
      ])
      if (p.error) throw p.error
      if (a.error) throw a.error
      setPersonas(p.data ?? [])
      setAsistencias(a.data ?? [])
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  // Horas de UN registro de asistencia (1 fila = 1 turno, gracias al campo "turno")
  function calcularHorasDia(entrada?: string, salida?: string): number {
    if (!entrada || !salida) return 0
    const [hE, mE] = entrada.split(':').map(Number)
    const [hS, mS] = salida.split(':').map(Number)
    const minutos = (hS * 60 + mS) - (hE * 60 + mE)
    return minutos > 0 ? minutos / 60 : 0
  }

  function horasDeFila(a: any): number {
    return calcularHorasDia(a.hora_entrada?.slice(0, 5), a.hora_salida?.slice(0, 5))
  }

  function formatoHoras(horas: number): string {
    const h = Math.floor(horas)
    const m = Math.round((horas - h) * 60)
    return `${h}h ${m}min`
  }

  function toggleExpandido(personaId: string) {
    setExpandidos(prev => ({ ...prev, [personaId]: !prev[personaId] }))
  }

  const personasFiltradas = personas.filter(p => {
    if (filtroGrupo !== 'todos' && p.grupo !== filtroGrupo) return false
    if (personaSel && p.id !== personaSel) return false
    return true
  })

  const inicioMes = format(primerDiaMes(mesVer), 'yyyy-MM-dd')
  const finMes = format(ultimoDiaMes(mesVer), 'yyyy-MM-dd')
  const semanasDelMes = getSemanasDeMes(mesVer)

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando horas acumuladas...</div>

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#002F6C', margin: 0 }}>Horas Acumuladas</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Seguimiento de horas trabajadas por integrante, por semana</p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)}
          style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13, fontFamily: 'inherit' }}>
          <option value="todos">Todos los grupos</option>
          {gruposConfig.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        <select value={personaSel} onChange={e => setPersonaSel(e.target.value)}
          style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13, fontFamily: 'inherit' }}>
          <option value="">Todas las personas</option>
          {personas.filter(p => filtroGrupo === 'todos' || p.grupo === filtroGrupo).map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <button onClick={() => setMesVer(m => subMonths(m, 1))} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 12 }}>◀</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', textTransform: 'capitalize', minWidth: 120, textAlign: 'center' }}>{format(mesVer, 'MMMM yyyy', { locale: es })}</span>
          <button onClick={() => setMesVer(m => addMonths(m, 1))} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 12 }}>▶</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: '16px', border: '1.5px solid #e2e8f0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Personas activas</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#002F6C' }}>{personasFiltradas.length}</div>
        </div>
      </div>

      {/* Lista de personas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {personasFiltradas.map(p => {
          const asistenciasMes = asistencias.filter(a => a.persona_id === p.id && a.fecha >= inicioMes && a.fecha <= finMes)
          const totalHorasPersona = asistenciasMes.reduce((acc, a) => acc + horasDeFila(a), 0)
          const abierto = !!expandidos[p.id]

          return (
            <div key={p.id} style={{ background: 'white', borderRadius: 14, border: `1.5px solid ${p.grupo === 'EcoBIOTEM' ? '#86efac' : '#e2e8f0'}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <button onClick={() => toggleExpandido(p.id)} style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', padding: '14px 20px', background: p.grupo === 'EcoBIOTEM' ? '#f0fdf4' : '#f8fafc', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: 'white', flexShrink: 0 }}>
                  {p.nombre.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.nombre}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.rol} {p.subrol ? `· ${p.subrol}` : ''} · {p.grupo}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: p.grupo === 'EcoBIOTEM' ? '#166534' : '#002F6C' }}>{formatoHoras(totalHorasPersona)}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>Total del mes</div>
                </div>
                <span style={{ fontSize: 14, color: '#94a3b8', marginLeft: 4 }}>{abierto ? '▲' : '▼'}</span>
              </button>

              {abierto && (
                <div style={{ padding: '12px 20px 16px' }}>
                  {semanasDelMes.map(sem => {
                    const ini = format(sem.inicio, 'yyyy-MM-dd')
                    const fin = format(sem.fin, 'yyyy-MM-dd')
                    const filasSemana = asistenciasMes.filter(a => a.fecha >= ini && a.fecha <= fin)
                    const totalSemana = filasSemana.reduce((acc, a) => acc + horasDeFila(a), 0)

                    const porFecha: Record<string, any[]> = {}
                    filasSemana.forEach(a => { if (!porFecha[a.fecha]) porFecha[a.fecha] = []; porFecha[a.fecha].push(a) })
                    const diasOrdenados = Object.entries(porFecha).sort((a, b) => a[0].localeCompare(b[0]))

                    return (
                      <div key={sem.numero} style={{ marginTop: 12, padding: '12px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#002F6C' }}>
                            Semana {sem.numero} ({format(sem.inicio, 'dd/MM')} - {format(sem.fin, 'dd/MM')})
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: totalSemana > 0 ? '#15803d' : '#94a3b8' }}>
                            Total semana: {formatoHoras(totalSemana)}
                          </span>
                        </div>

                        {diasOrdenados.length === 0 ? (
                          <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Sin asistencia registrada esta semana</div>
                        ) : (
                          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '6px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 10, textTransform: 'uppercase' }}>Fecha</th>
                                <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: '#475569', fontSize: 10, textTransform: 'uppercase' }}>Mañana</th>
                                <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: '#475569', fontSize: 10, textTransform: 'uppercase' }}>Tarde</th>
                                <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: '#475569', fontSize: 10, textTransform: 'uppercase' }}>Total día</th>
                                <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: '#475569', fontSize: 10, textTransform: 'uppercase' }}>Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {diasOrdenados.map(([fecha, filas]) => {
                                const rowManana = filas.find(f => f.turno === 'manana') ?? filas.find(f => f.turno === 'unico')
                                const rowTarde = filas.find(f => f.turno === 'tarde')
                                const horasM = horasDeFila(rowManana ?? {})
                                const horasT = horasDeFila(rowTarde ?? {})
                                const estadoDia = filas.some(f => f.estado === 'tarde') ? 'tarde' : filas[0].estado
                                return (
                                  <tr key={fecha} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '6px', color: '#0f172a' }}>{format(parseISO(fecha), 'EEE d MMM', { locale: es })}</td>
                                    <td style={{ padding: '6px', textAlign: 'center' }}>
                                      {rowManana?.hora_entrada && rowManana?.hora_salida ? (
                                        <div style={{ fontSize: 11 }}>
                                          <div style={{ color: '#475569' }}>{rowManana.hora_entrada.slice(0, 5)}-{rowManana.hora_salida.slice(0, 5)}</div>
                                          <div style={{ color: '#002F6C', fontWeight: 600 }}>{formatoHoras(horasM)}</div>
                                        </div>
                                      ) : <span style={{ color: '#94a3b8' }}>—</span>}
                                    </td>
                                    <td style={{ padding: '6px', textAlign: 'center' }}>
                                      {rowTarde?.hora_entrada && rowTarde?.hora_salida ? (
                                        <div style={{ fontSize: 11 }}>
                                          <div style={{ color: '#475569' }}>{rowTarde.hora_entrada.slice(0, 5)}-{rowTarde.hora_salida.slice(0, 5)}</div>
                                          <div style={{ color: '#002F6C', fontWeight: 600 }}>{formatoHoras(horasT)}</div>
                                        </div>
                                      ) : <span style={{ color: '#94a3b8' }}>—</span>}
                                    </td>
                                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700, color: '#002F6C' }}>{(horasM + horasT) > 0 ? formatoHoras(horasM + horasT) : '—'}</td>
                                    <td style={{ padding: '6px', textAlign: 'center' }}>
                                      <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: estadoDia === 'tarde' ? '#fef3c7' : '#dcfce7', color: estadoDia === 'tarde' ? '#b45309' : '#15803d' }}>{estadoDia}</span>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {personasFiltradas.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>No hay personas para mostrar</div>
        )}
      </div>
    </div>
  )
}
