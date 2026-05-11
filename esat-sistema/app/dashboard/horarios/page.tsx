'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Persona, Horario, getTurno, DIAS_LABEL } from '@/types'

const DIAS = ['L','M','X','J','V'] as const
type Dia = typeof DIAS[number]

function turnoColor(franjas: Horario[]) {
  if (!franjas.length) return { bg:'#f1f5f9', border:'#cbd5e1', txt:'—' }
  // Turno determinado por hora de ENTRADA (no de salida)
  // M+T solo cuando hay 2 franjas separadas (sale a almorzar y vuelve)
  const tieneManana = franjas.some(f => parseInt(f.hora_entrada.split(':')[0]) < 13)
  const tieneTarde  = franjas.some(f => parseInt(f.hora_entrada.split(':')[0]) >= 13)
  if (tieneManana && tieneTarde) return { bg:'#fef9c3', border:'#fde047', txt:'M+T' }
  if (tieneManana) return { bg:'#dbeafe', border:'#93c5fd', txt:'M' }
  if (tieneTarde)  return { bg:'#dcfce7', border:'#86efac', txt:'T' }
  return { bg:'#f1f5f9', border:'#cbd5e1', txt:'—' }
}

export default function AsistenciaPage() {
  const supabase =  createClient()
  const [personas, setPersonas] = useState<Persona[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: p }, { data: h }] = await Promise.all([
      supabase.from('personas').select('*').eq('activo', true).order('nombre'),
      supabase.from('horarios').select('*'),
    ])
    setPersonas(p ?? [])
    setHorarios(h ?? [])
    setLoading(false)
  }

  function franjasPersonaDia(personaId: string, dia: string) {
    return horarios.filter(h => h.persona_id === personaId && h.dia === dia)
  }

  function totalHoras(personaId: string) {
    const franjas = horarios.filter(h => h.persona_id === personaId)
    return franjas.reduce((acc, h) => {
      const [he, me] = h.hora_entrada.split(':').map(Number)
      const [hs, ms] = h.hora_salida.split(':').map(Number)
      return acc + ((hs*60+ms) - (he*60+me)) / 60
    }, 0)
  }

  const esat = personas.filter(p => p.grupo === 'ESAT')
  const eco  = personas.filter(p => p.grupo === 'EcoBIOTEM')

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'var(--txt3)' }}>Cargando...</div>

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:20, fontWeight:700, color:'var(--azul)' }}>Horarios</h1>
        <p style={{ fontSize:12, color:'var(--txt3)', marginTop:2 }}>
          Horario semanal del equipo · M = Mañana · T = Tarde · M+T = Doble turno
        </p>
      </div>

      {/* Leyenda */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        {[['M','Mañana (entra antes 1pm)','#dbeafe','#93c5fd'],
          ['T','Tarde (entra 1pm o más tarde)','#dcfce7','#86efac'],
          ['M+T','Doble turno (sale a almorzar y vuelve)','#fef9c3','#fde047']].map(([k,l,bg,b])=>(
          <div key={k} style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 12px',
            background: bg as string, border:`1.5px solid ${b}`, borderRadius:8, fontSize:11 }}>
            <strong>{k}</strong> — {l}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ overflowX:'auto', marginBottom:24 }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'var(--bg)' }}>
              <th style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600,
                color:'var(--txt2)', textTransform:'uppercase', letterSpacing:'.06em', borderBottom:'2px solid var(--borde2)' }}>
                Persona
              </th>
              {DIAS.map(d => (
                <th key={d} style={{ padding:'10px 14px', textAlign:'center', fontSize:11, fontWeight:600,
                  color:'var(--txt2)', textTransform:'uppercase', letterSpacing:'.06em', borderBottom:'2px solid var(--borde2)' }}>
                  {DIAS_LABEL[d]}
                </th>
              ))}
              <th style={{ padding:'10px 14px', textAlign:'center', fontSize:11, fontWeight:600,
                color:'var(--txt2)', borderBottom:'2px solid var(--borde2)' }}>
                Hrs/sem
              </th>
            </tr>
          </thead>
          <tbody>
            {esat.map((p, i) => (
              <tr key={p.id} style={{ background: i%2===0 ? 'white' : 'var(--bg)' }}>
                <td style={{ padding:'10px 14px', borderBottom:'1px solid var(--borde2)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:28, height:28, borderRadius:7, background:p.color+'25',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontWeight:700, fontSize:12, color:p.color, flexShrink:0 }}>
                      {p.nombre.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600 }}>{p.nombre}</div>
                      <div style={{ fontSize:9, color:'var(--txt3)' }}>
                        {p.rol === 'SENATI' ? `SENATI · ${p.subrol}` :
                         p.rol === 'Practicante' ? `UNASAM · ${p.subrol}` : p.rol}
                      </div>
                    </div>
                  </div>
                </td>
                {DIAS.map(d => {
                  const franjas = franjasPersonaDia(p.id, d)
                  const tc = turnoColor(franjas)
                  return (
                    <td key={d} style={{ padding:'8px', textAlign:'center', borderBottom:'1px solid var(--borde2)' }}>
                      {franjas.length > 0 ? (
                        <div title={franjas.map(f => f.hora_entrada.slice(0,5)+'-'+f.hora_salida.slice(0,5)).join(', ')}
                          style={{ display:'inline-flex', flexDirection:'column', alignItems:'center',
                            background:tc.bg, border:`1.5px solid ${tc.border}`,
                            borderRadius:7, padding:'4px 10px', cursor:'help', minWidth:50 }}>
                          <span style={{ fontSize:11, fontWeight:700 }}>{tc.txt}</span>
                          <span style={{ fontSize:9, color:'var(--txt3)', marginTop:1 }}>
                            {franjas[0].hora_entrada.slice(0,5)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize:11, color:'var(--txt3)' }}>—</span>
                      )}
                    </td>
                  )
                })}
                <td style={{ padding:'10px 14px', textAlign:'center', borderBottom:'1px solid var(--borde2)',
                  fontSize:12, fontWeight:600, color:'var(--azul)' }}>
                  {totalHoras(p.id).toFixed(1)}h
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* EcoBIOTEM */}
      <div className="card" style={{ border:'2px solid #86efac' }}>
        <div className="card-body">
          <div className="card-title">
            <span className="dot" style={{ background:'#15803d' }}></span>
            🌿 GI EcoBIOTEM — Horario flexible
          </div>
          <p style={{ fontSize:13, color:'var(--txt2)', lineHeight:1.7 }}>
            Los miembros del GI EcoBIOTEM <strong>no tienen horario fijo de entrada ni salida</strong>.
            Lo que importa son las <strong>horas acumuladas y el avance en sus proyectos</strong>.
            Registran su tiempo usando el temporizador de sesión en su panel personal.
            Total de miembros activos: <strong>{eco.length}</strong>
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:8, marginTop:14 }}>
            {eco.map(p => (
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px',
                background:'var(--verde-lt)', borderRadius:9, border:'1px solid #86efac' }}>
                <div style={{ width:26, height:26, borderRadius:7, background:p.color+'30',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontWeight:700, color:p.color }}>
                  {p.nombre.charAt(0)}
                </div>
                <div style={{ fontSize:11, fontWeight:500, color:'var(--txt)' }}>{p.nombre}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
