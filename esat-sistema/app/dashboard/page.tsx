import { createClient } from '@/lib/supabase/server'
import { getRolLabel } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  const hoy = format(new Date(), 'yyyy-MM-dd')
  const diaSemana = format(new Date(), 'EEEE', { locale: es })

  const [{ data: personas }, { data: asistenciasHoy }, { data: avisos }] = await Promise.all([
    supabase.from('personas').select('*').eq('activo', true).order('nombre'),
    supabase.from('asistencias').select('*').eq('fecha', hoy),
    supabase.from('avisos').select('*').order('created_at', { ascending: false }).limit(5),
  ])

  const total     = personas?.length ?? 0
  const presentes = asistenciasHoy?.filter(a => ['presente','tarde'].includes(a.estado)).length ?? 0
  const ausentes  = total - presentes

  return (
    <div>
      {/* Page header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--azul)' }}>Dashboard</h1>
          <p style={{ fontSize:12, color:'var(--txt3)', marginTop:2, textTransform:'capitalize' }}>
            {format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <Link href="/dashboard/asistencia" className="btn btn-p" style={{ fontSize:12 }}>
          ✅ Registrar asistencia
        </Link>
      </div>

      {/* Metrics */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        <div className="metric m-azul">
          <div className="metric-lbl">Total equipo</div>
          <div className="metric-val">{total}</div>
          <div className="metric-sub">Personas activas</div>
          <div className="metric-icon">👥</div>
        </div>
        <div className="metric m-verde">
          <div className="metric-lbl">Presentes hoy</div>
          <div className="metric-val">{presentes}</div>
          <div className="metric-sub">{total > 0 ? Math.round(presentes/total*100) : 0}% asistencia</div>
          <div className="metric-icon">✅</div>
        </div>
        <div className="metric m-rojo">
          <div className="metric-lbl">Ausentes hoy</div>
          <div className="metric-val">{ausentes}</div>
          <div className="metric-sub">Sin registrar o ausentes</div>
          <div className="metric-icon">⚠</div>
        </div>
        <div className="metric m-dorado">
          <div className="metric-lbl">Avisos activos</div>
          <div className="metric-val">{avisos?.length ?? 0}</div>
          <div className="metric-sub">Últimos registros</div>
          <div className="metric-icon">🔔</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Estado del equipo hoy */}
        <div className="card">
          <div className="card-body">
            <div className="card-title">
              <span className="dot" style={{ background:'var(--azul)' }}></span>
              Estado del equipo hoy
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:360, overflowY:'auto' }}>
              {(personas ?? []).filter(p => p.grupo === 'ESAT').map(p => {
                const asist = asistenciasHoy?.find(a => a.persona_id === p.id)
                const estado = asist?.estado ?? 'sin_registrar'
                const colors: Record<string, string> = {
                  presente: 'var(--verde)', tarde: 'var(--dorado2)', ausente: 'var(--rojo2)',
                  permiso: '#7c3aed', sin_registrar: 'var(--txt3)',
                }
                const labels: Record<string, string> = {
                  presente: 'Presente', tarde: 'Tardanza', ausente: 'Ausente',
                  permiso: 'Permiso', sin_registrar: 'Sin registrar',
                }
                return (
                  <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
                    borderRadius:9, background:'var(--bg)', border:'1px solid var(--borde2)' }}>
                    <div style={{ width:32, height:32, borderRadius:8, background: p.color+'20',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
                      fontWeight:700, color: p.color, flexShrink:0 }}>
                      {p.nombre.charAt(0)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {p.nombre}
                      </div>
                      <div style={{ fontSize:10, color:'var(--txt3)' }}>{getRolLabel(p as any)}</div>
                    </div>
                    <span style={{ fontSize:10, fontWeight:600, color: colors[estado],
                      background: colors[estado]+'18', padding:'3px 8px', borderRadius:20, whiteSpace:'nowrap' }}>
                      {asist?.hora_entrada ? asist.hora_entrada.slice(0,5) + ' · ' : ''}{labels[estado]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Avisos recientes */}
        <div className="card">
          <div className="card-body">
            <div className="card-title" style={{ justifyContent:'space-between' }}>
              <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span className="dot" style={{ background:'var(--dorado2)' }}></span>
                Avisos recientes
              </span>
              <Link href="/dashboard/avisos" style={{ fontSize:11, color:'var(--azul3)', textDecoration:'none' }}>Ver todos →</Link>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {(avisos ?? []).map(a => {
                const typeColors: Record<string, string> = {
                  permiso:'#7c3aed', anuncio:'var(--verde)', urgente:'var(--rojo2)',
                  horario:'var(--azul)', recordatorio:'var(--dorado2)',
                }
                return (
                  <div key={a.id} style={{ padding:'10px 12px', borderRadius:9,
                    background:'var(--bg)', borderLeft:`3px solid ${typeColors[a.tipo] ?? 'var(--borde)'}` }}>
                    <div style={{ fontSize:12, fontWeight:600, marginBottom:3 }}>{a.titulo}</div>
                    <div style={{ fontSize:11, color:'var(--txt2)', lineHeight:1.5 }}>{a.descripcion}</div>
                    {a.fecha_evento && (
                      <div style={{ fontSize:10, color:'var(--txt3)', marginTop:4 }}>
                        📅 {format(new Date(a.fecha_evento + 'T12:00:00'), 'd MMM yyyy', { locale: es })}
                      </div>
                    )}
                  </div>
                )
              })}
              {!avisos?.length && (
                <p style={{ fontSize:13, color:'var(--txt3)', textAlign:'center', padding:'20px 0' }}>
                  Sin avisos recientes
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
