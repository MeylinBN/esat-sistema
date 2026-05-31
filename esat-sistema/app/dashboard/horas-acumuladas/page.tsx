'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export default function HorasAcumuladasPage() {
  const supabase = createClient()
  const [personas, setPersonas] = useState<any[]>([])
  const [asistencias, setAsistencias] = useState<any[]>([])
  const [horarios, setHorarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroGrupo, setFiltroGrupo] = useState<'todos'|'ESAT'|'EcoBIOTEM'>('todos')
  const [personaSel, setPersonaSel] = useState<string>('')
  const [mesSel, setMesSel] = useState(format(new Date(), 'yyyy-MM'))
  const [gruposConfig, setGruposConfig] = useState<string[]>([])

 useEffect(() => {
  load()
  loadGrupos()
}, [])

async function loadGrupos(){
  const {data} = await supabase.from('config_grupos').select('nombre').order('orden', {ascending:true})
  console.log('👥 Grupos cargados:', data)
  setGruposConfig(data?.map(g=>g.nombre) || [])
}

  async function load() {
    try {
      const [p, a, h] = await Promise.all([
        supabase.from('personas').select('id,nombre,color,rol,grupo,subrol').eq('activo', true).order('nombre'),
        supabase.from('asistencias').select('*').order('fecha', { ascending: false }),
        supabase.from('horarios').select('*'),
      ])
      
      if (p.error) throw p.error
      if (a.error) throw a.error
      if (h.error) throw h.error
      
      setPersonas(p.data ?? [])
      setAsistencias(a.data ?? [])
      setHorarios(h.data ?? [])
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  function calcularHorasDia(entrada1: string, salida1: string, entrada2?: string, salida2?: string): number {
    let totalHoras = 0
    
    // Primer turno
    if (entrada1 && salida1) {
      const [hE1, mE1] = entrada1.split(':').map(Number)
      const [hS1, mS1] = salida1.split(':').map(Number)
      const minutos1 = (hS1 * 60 + mS1) - (hE1 * 60 + mE1)
      if (minutos1 > 0) totalHoras += minutos1 / 60
    }
    
    // Segundo turno (si existe)
    if (entrada2 && salida2) {
      const [hE2, mE2] = entrada2.split(':').map(Number)
      const [hS2, mS2] = salida2.split(':').map(Number)
      const minutos2 = (hS2 * 60 + mS2) - (hE2 * 60 + mE2)
      if (minutos2 > 0) totalHoras += minutos2 / 60
    }
    
    return totalHoras
  }

  function formatoHoras(horas: number): string {
    const h = Math.floor(horas)
    const m = Math.round((horas - h) * 60)
    return `${h}h ${m}min`
  }

  // Filtrar personas por grupo seleccionado
  const personasFiltradas = personas.filter(p => {
    if (filtroGrupo === 'todos') return true
    return p.grupo === filtroGrupo
  })

  // Obtener asistencias del mes seleccionado
  const [year, month] = mesSel.split('-').map(Number)
  const asistenciasMes = asistencias.filter(a => {
    const fecha = parseISO(a.fecha)
    return fecha.getFullYear() === year && fecha.getMonth() + 1 === month &&
           (personaSel ? a.persona_id === personaSel : true)
  })

  // Agrupar por persona
  const porPersona: Record<string, any[]> = {}
  asistenciasMes.forEach(a => {
    if (!porPersona[a.persona_id]) porPersona[a.persona_id] = []
    porPersona[a.persona_id].push(a)
  })

  // Calcular totales DINÁMICOS según el filtro
const stats = {
    totalPersonas: Object.keys(porPersona).length,
    totalHoras: Object.values(porPersona).flat().reduce((acc: number, a: any) => 
      acc + calcularHorasDia(
        a.hora_entrada?.slice(0,5), 
        a.hora_salida?.slice(0,5),
        a.hora_entrada_2?.slice(0,5),  // ✅ Segundo turno
        a.hora_salida_2?.slice(0,5)     // ✅ Segundo turno
      ), 0
    ),
    porGrupo: gruposConfig.reduce((acc, grupo) => {
      acc[grupo] = personas.filter(p => p.grupo === grupo && porPersona[p.id]).length
      return acc
    }, {} as Record<string, number>)
  }

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Cargando horas acumuladas...</div>

  return (
    <div style={{ padding:24, fontFamily:'sans-serif', background:'#f8fafc', minHeight:'100vh' }}>
      
      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'#002F6C', margin:0 }}>Horas Acumuladas</h1>
        <p style={{ fontSize:13, color:'#64748b', marginTop:4 }}>Seguimiento de horas trabajadas por integrante</p>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
     <select value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value as any)}
  style={{ padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:13, fontFamily:'inherit' }}>
  <option value="todos">Todos los grupos</option>
  {gruposConfig.map(g => (
    <option key={g} value={g}>{g}</option>
  ))}
</select>

        <select value={mesSel} onChange={e => setMesSel(e.target.value)}
          style={{ padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:13, fontFamily:'inherit' }}>
          {Array.from({ length: 12 }, (_, i) => {
            const val = format(new Date(2026, i, 1), 'yyyy-MM')
            const label = format(new Date(2026, i, 1), 'MMMM yyyy', { locale: es })
            return <option key={val} value={val}>{label}</option>
          })}
        </select>

        <select value={personaSel} onChange={e => setPersonaSel(e.target.value)}
          style={{ padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:13, fontFamily:'inherit' }}>
          <option value="">Todas las personas</option>
          {personasFiltradas.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </div>

      {/* Stats dinámicos */}
{/* Stats */}
{/* Stats */}
<div style={{ 
  display:'grid', 
  gridTemplateColumns: filtroGrupo === 'todos' ? 'repeat(auto-fit, minmax(200px, 1fr))' : 'repeat(2,1fr)', 
  gap:14, 
  marginBottom:20 
}}>
  <div style={{ background:'white', borderRadius:12, padding:'16px', border:'1.5px solid #e2e8f0' }}>
    <div style={{ fontSize:11, fontWeight:600, color:'#94a3b8', textTransform:'uppercase' }}>Personas activas</div>
    <div style={{ fontSize:28, fontWeight:700, color:'#002F6C' }}>{stats.totalPersonas}</div>
  </div>
  <div style={{ background:'white', borderRadius:12, padding:'16px', border:'1.5px solid #e2e8f0' }}>
    <div style={{ fontSize:11, fontWeight:600, color:'#94a3b8', textTransform:'uppercase' }}>Total horas mes</div>
    <div style={{ fontSize:28, fontWeight:700, color:'#15803d' }}>{formatoHoras(stats.totalHoras)}</div>
  </div>
  
  {/* Si es "todos los grupos", mostrar TODAS las tarjetas de grupos */}
  {filtroGrupo === 'todos' && Object.entries(stats.porGrupo).map(([grupo, count]) => {
    if (count === 0) return null
    return (
      <div key={grupo} style={{ background:'white', borderRadius:12, padding:'16px', border:'1.5px solid #1e40af' }}>
        <div style={{ fontSize:11, fontWeight:600, color:'#94a3b8', textTransform:'uppercase' }}>{grupo}</div>
        <div style={{ fontSize:28, fontWeight:700, color:'#1e40af' }}>{count} miembros</div>
      </div>
    )
  })}
  
  {/* Si NO es "todos", mostrar solo el grupo seleccionado */}
  {filtroGrupo !== 'todos' && (
    <div style={{ background:'white', borderRadius:12, padding:'16px', border:'1.5px solid #1e40af' }}>
      <div style={{ fontSize:11, fontWeight:600, color:'#94a3b8', textTransform:'uppercase' }}>{filtroGrupo}</div>
      <div style={{ fontSize:28, fontWeight:700, color:'#1e40af' }}>{stats.porGrupo[filtroGrupo] || 0} miembros</div>
    </div>
  )}
</div>

      {/* Lista de personas con horas */}
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {personasFiltradas
          .filter(p => porPersona[p.id])
          .map(p => {
            const asistenciasPersona = porPersona[p.id] || []
            const totalHorasPersona = asistenciasPersona.reduce((acc: number, a: any) => 
              acc + calcularHorasDia(
                a.hora_entrada?.slice(0,5), 
                a.hora_salida?.slice(0,5),
                a.hora_entrada_2?.slice(0,5),
                a.hora_salida_2?.slice(0,5)
              ), 0
            )

            return (
              <div key={p.id} style={{ 
                background:'white', borderRadius:12, border:`2px solid ${p.grupo==='EcoBIOTEM'?'#166534':'#e2e8f0'}`, 
                overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)' 
              }}>
                {/* Header persona - SE MANTIENE IGUAL */}
                <div style={{ 
                  padding:'14px 20px', background: p.grupo==='EcoBIOTEM' ? '#f0fdf4' : '#f8fafc',
                  borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', gap:12 
                }}>
                  <div style={{ 
                    width:40, height:40, borderRadius:'50%', background:p.color,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontWeight:700, fontSize:15, color:'white' 
                  }}>
                    {p.nombre.charAt(0)}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600 }}>{p.nombre}</div>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>
                      {p.rol} {p.subrol ? `· ${p.subrol}` : ''} · {p.grupo}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:24, fontWeight:700, color: p.grupo==='EcoBIOTEM' ? '#166534' : '#002F6C' }}>
                      {formatoHoras(totalHorasPersona)}
                    </div>
                    <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase' }}>Total mes</div>
                  </div>
                </div>

                {/* Tabla de días - ACTUALIZADA PARA DOBLE TURNO */}
                <div style={{ padding:'12px 20px' }}>
                  <table style={{ width:'100%', fontSize:12 }}>
                    <thead>
                      <tr style={{ borderBottom:'1.5px solid #e2e8f0' }}>
                        <th style={{ padding:'8px', textAlign:'left', fontWeight:600, color:'#475569' }}>Fecha</th>
                        <th style={{ padding:'8px', textAlign:'center', fontWeight:600, color:'#475569' }}>Turno Mañana</th>
                        <th style={{ padding:'8px', textAlign:'center', fontWeight:600, color:'#475569' }}>Turno Tarde</th>
                        <th style={{ padding:'8px', textAlign:'center', fontWeight:600, color:'#475569' }}>Total Horas</th>
                        <th style={{ padding:'8px', textAlign:'center', fontWeight:600, color:'#475569' }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asistenciasPersona
                        .sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                        .map((a, i) => {
                          const horasTurno1 = calcularHorasDia(a.hora_entrada?.slice(0,5), a.hora_salida?.slice(0,5))
                          const horasTurno2 = calcularHorasDia(a.hora_entrada_2?.slice(0,5), a.hora_salida_2?.slice(0,5))
                          const horasTotales = horasTurno1 + horasTurno2
                          
                          return (
                            <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                              <td style={{ padding:'8px', color:'#0f172a' }}>
                                {format(parseISO(a.fecha), 'EEE d MMM', { locale: es })}
                              </td>
                              <td style={{ padding:'8px', textAlign:'center' }}>
                                {a.hora_entrada && a.hora_salida ? (
                                  <div style={{ fontSize:11 }}>
                                    <div style={{ color:'#475569' }}>{a.hora_entrada.slice(0,5)} - {a.hora_salida.slice(0,5)}</div>
                                    <div style={{ color:'#002F6C', fontWeight:600 }}>{formatoHoras(horasTurno1)}</div>
                                  </div>
                                ) : (
                                  <span style={{ color:'#94a3b8' }}>—</span>
                                )}
                              </td>
                              <td style={{ padding:'8px', textAlign:'center' }}>
                                {a.hora_entrada_2 && a.hora_salida_2 ? (
                                  <div style={{ fontSize:11 }}>
                                    <div style={{ color:'#475569' }}>{a.hora_entrada_2.slice(0,5)} - {a.hora_salida_2.slice(0,5)}</div>
                                    <div style={{ color:'#002F6C', fontWeight:600 }}>{formatoHoras(horasTurno2)}</div>
                                  </div>
                                ) : (
                                  <span style={{ color:'#94a3b8' }}>—</span>
                                )}
                              </td>
                              <td style={{ padding:'8px', textAlign:'center', fontWeight:700, color:'#002F6C' }}>
                                {horasTotales > 0 ? formatoHoras(horasTotales) : '—'}
                              </td>
                              <td style={{ padding:'8px', textAlign:'center' }}>
                                <span style={{ 
                                  padding:'3px 8px', borderRadius:12, fontSize:10, fontWeight:600,
                                  background: a.estado==='tarde' ? '#fef3c7' : '#dcfce7',
                                  color: a.estado==='tarde' ? '#b45309' : '#15803d'
                                }}>
                                  {a.estado}
                                </span>
                              </td>
                            </tr>
                          )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
        })}

        {Object.keys(porPersona).length === 0 && (
          <div style={{ textAlign:'center', padding:40, color:'#94a3b8', fontSize:13 }}>
            No hay asistencias registradas en {format(new Date(year, month-1), 'MMMM yyyy', { locale: es })}
          </div>
        )}
      </div>
    </div>
  )
}