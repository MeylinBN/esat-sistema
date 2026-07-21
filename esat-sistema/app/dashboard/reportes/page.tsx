'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Tooltip, Legend, Title,
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title)

export default function AsistenciaPage() {
  const supabase = createClient()
  const [personas, setPersonas]     = useState<any[]>([])
  const [asistencias, setAsistencias] = useState<any[]>([])
  const [tareas, setTareas]         = useState<any[]>([])
  const [loading, setLoading]       = useState(true)

  const mesActual = format(new Date(), 'yyyy-MM')
  const inicio    = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const fin       = format(endOfMonth(new Date()), 'yyyy-MM-dd')

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: a }, { data: t }] = await Promise.all([
        supabase.from('personas').select('*').eq('activo', true),
        supabase.from('asistencias').select('*, personas(nombre)').gte('fecha', inicio).lte('fecha', fin),
        supabase.from('tareas').select('*'),
      ])
      setPersonas(p ?? [])
      setAsistencias(a ?? [])
      setTareas(t ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'var(--txt3)' }}>Cargando...</div>

  // Asistencia por persona (por día, no por fila: una persona puede tener
  // hasta 2 registros el mismo día si trabaja mañana y tarde)
  const asistPorPersona = personas.filter(p => p.grupo === 'ESAT').map(p => {
    const registros = asistencias.filter(a => a.persona_id === p.id)
    const diasUnicos = Array.from(new Set(registros.map(a => a.fecha)))
    const diasPresentes = diasUnicos.filter(fecha =>
      registros.some(a => a.fecha === fecha && ['presente','tarde'].includes(a.estado))
    )
    return { nombre: p.nombre.split(' ')[0], presentes: diasPresentes.length, total: diasUnicos.length }
  })

  // Distribución de roles
  const rolCount: Record<string, number> = {}
  personas.forEach(p => { rolCount[p.rol] = (rolCount[p.rol] ?? 0) + 1 })

  // Tareas
  const tareasComp  = tareas.filter(t => t.estado === 'completada').length
  const tareasTotal = tareas.length
  const tareasProgreso = tareas.filter(t => t.estado === 'en_progreso').length

  // % asistencia general
  const totalRegistros = asistencias.length
  const totalPresentes = asistencias.filter(a => ['presente','tarde'].includes(a.estado)).length
  const pctAsist = totalRegistros > 0 ? Math.round(totalPresentes / totalRegistros * 100) : 0

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--azul)' }}>Reportes</h1>
          <p style={{ fontSize:12, color:'var(--txt3)', marginTop:2, textTransform:'capitalize' }}>
            {format(new Date(), "MMMM yyyy", { locale: es })}
          </p>
        </div>
        <a href="/dashboard/exportar" className="btn btn-s btn-sm">📤 Exportar</a>
      </div>

      {/* Metrics */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        <div className="metric m-azul">
          <div className="metric-lbl">Registros mes</div>
          <div className="metric-val">{totalRegistros}</div>
          <div className="metric-sub">Asistencias registradas</div>
          <div className="metric-icon">📅</div>
        </div>
        <div className="metric m-verde">
          <div className="metric-lbl">% Asistencia</div>
          <div className="metric-val">{pctAsist}%</div>
          <div className="metric-sub">Promedio general</div>
          <div className="metric-icon">📊</div>
        </div>
        <div className="metric m-rojo">
          <div className="metric-lbl">Tareas completadas</div>
          <div className="metric-val">{tareasComp}</div>
          <div className="metric-sub">De {tareasTotal} total</div>
          <div className="metric-icon">✅</div>
        </div>
        <div className="metric m-dorado">
          <div className="metric-lbl">En progreso</div>
          <div className="metric-val">{tareasProgreso}</div>
          <div className="metric-sub">Tareas activas</div>
          <div className="metric-icon">⚙</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
        {/* Asistencia por persona */}
        <div className="card">
          <div className="card-body">
            <div className="card-title">
              <span className="dot" style={{ background:'var(--azul)' }}></span>
              Asistencia por persona — mes actual
            </div>
            {asistPorPersona.some(p => p.total > 0) ? (
              <div style={{ height:280 }}>
                <Bar
                  data={{
                    labels: asistPorPersona.map(p => p.nombre),
                    datasets: [{
                      label: 'Días presentes',
                      data: asistPorPersona.map(p => p.presentes),
                      backgroundColor: '#1249A0cc',
                      borderColor: '#002F6C',
                      borderWidth: 1.5,
                      borderRadius: 6,
                    }],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                  }}
                />
              </div>
            ) : (
              <div style={{ height:280, display:'flex', alignItems:'center', justifyContent:'center',
                color:'var(--txt3)', fontSize:13 }}>
                Sin datos de asistencia este mes
              </div>
            )}
          </div>
        </div>

        {/* Distribución de roles */}
        <div className="card">
          <div className="card-body">
            <div className="card-title">
              <span className="dot" style={{ background:'var(--dorado2)' }}></span>
              Distribución de roles
            </div>
            <div style={{ height:200 }}>
              <Doughnut
                data={{
                  labels: Object.keys(rolCount),
                  datasets: [{
                    data: Object.values(rolCount),
                    backgroundColor: ['#1249A0','#7c3aed','#15803d','#d97706','#dc2626','#0369a1','#166534','#374151'],
                    borderWidth: 2,
                    borderColor: 'white',
                  }],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 8 } } },
                }}
              />
            </div>
            <div style={{ marginTop:12 }}>
              {Object.entries(rolCount).map(([rol, count]) => (
                <div key={rol} style={{ display:'flex', justifyContent:'space-between', fontSize:12,
                  padding:'4px 0', borderBottom:'1px solid var(--borde2)' }}>
                  <span>{rol}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
