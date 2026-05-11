'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'

const MESES = Array.from({ length: 12 }, (_, i) => ({
  valor: format(new Date(2026, i, 1), 'yyyy-MM'),
  label: format(new Date(2026, i, 1), 'MMMM yyyy', { locale: es }),
}))

const TIPOS = [
  { value:'asistencia', label:'Asistencia mensual' },
  { value:'horas',      label:'Horas acumuladas' },
  { value:'permisos',   label:'Permisos y faltas' },
  { value:'completo',   label:'Reporte completo' },
]

export default function AsistenciaPage() {
 const supabase = createClient()
  const [mes, setMes]       = useState(format(new Date(), 'yyyy-MM'))
  const [tipo, setTipo]     = useState('asistencia')
  const [fmt, setFmt]       = useState<'csv'|'excel'|'pdf'>('csv')
  const [personas, setPersonas] = useState<any[]>([])
  const [selPersonas, setSelPersonas] = useState<string[]>([])
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('personas').select('*').eq('activo', true).order('nombre')
      .then(({ data }) => setPersonas(data ?? []))
  }, [])

  useEffect(() => { generarPreview() }, [mes, tipo, selPersonas])

  async function generarPreview() {
    if (!mes) return
    const [year, month] = mes.split('-').map(Number)
    const inicio = format(startOfMonth(new Date(year, month-1)), 'yyyy-MM-dd')
    const fin    = format(endOfMonth(new Date(year, month-1)), 'yyyy-MM-dd')

    const personasFiltro = selPersonas.length > 0 ? selPersonas : personas.map(p => p.id)

    if (tipo === 'asistencia') {
      const { data } = await supabase.from('asistencias')
        .select('*, personas(nombre)')
        .gte('fecha', inicio).lte('fecha', fin)
        .in('persona_id', personasFiltro)
        .order('fecha')

      const lines = ['Nombre,Fecha,Entrada,Salida,Estado,Tardanza (min)']
      ;(data ?? []).forEach(a => {
        lines.push([
          a.personas?.nombre ?? '—',
          a.fecha,
          a.hora_entrada?.slice(0,5) ?? '—',
          a.hora_salida?.slice(0,5) ?? '—',
          a.estado,
          a.tardanza_min ?? 0,
        ].join(','))
      })
      setPreview(lines.join('\n'))
    } else if (tipo === 'permisos') {
      const { data } = await supabase.from('permisos')
        .select('*, personas(nombre)')
        .gte('fecha_inicio', inicio).lte('fecha_fin', fin)
        .order('fecha_inicio')

      const lines = ['Nombre,Tipo,Fecha Inicio,Fecha Fin,Motivo,Estado']
      ;(data ?? []).forEach(p => {
        lines.push([p.personas?.nombre ?? '—', p.tipo, p.fecha_inicio, p.fecha_fin, p.motivo ?? '', p.estado].join(','))
      })
      setPreview(lines.join('\n'))
    } else {
      setPreview(`Vista previa de tipo "${tipo}" — ${mes}`)
    }
  }

  async function exportar() {
    setLoading(true)
    await generarPreview()

    if (fmt === 'csv') {
      const blob = new Blob([preview], { type: 'text/csv;charset=utf-8;' })
      download(blob, `ESAT_${tipo}_${mes}.csv`)
    } else if (fmt === 'excel') {
      const { utils, writeFile } = await import('xlsx')
      const rows = preview.split('\n').map(r => r.split(','))
      const ws = utils.aoa_to_sheet(rows)
      const wb = utils.book_new()
      utils.book_append_sheet(wb, ws, tipo)
      writeFile(wb, `ESAT_${tipo}_${mes}.xlsx`)
    } else if (fmt === 'pdf') {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()
      doc.setFontSize(14)
      doc.text(`ESAT · CIAD — Reporte de ${tipo} · ${mes}`, 14, 18)
      const rows = preview.split('\n').map(r => r.split(','))
      const head = [rows[0]]
      const body = rows.slice(1)
      autoTable(doc, { head, body, startY: 26, styles: { fontSize: 8 } })
      doc.save(`ESAT_${tipo}_${mes}.pdf`)
    }

    setLoading(false)
  }

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  function togglePersona(id: string) {
    setSelPersonas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:20, fontWeight:700, color:'var(--azul)' }}>Exportar reportes</h1>
        <p style={{ fontSize:12, color:'var(--txt3)', marginTop:2 }}>Descarga datos en CSV, Excel o PDF</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Controles */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="card">
            <div className="card-body">
              <div className="card-title"><span className="dot" style={{ background:'var(--azul)' }}></span>1. Mes</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                {MESES.map(m => (
                  <button key={m.valor} onClick={() => setMes(m.valor)}
                    style={{ padding:'7px 4px', borderRadius:8, border:`1.5px solid ${mes===m.valor?'var(--azul)':'var(--borde2)'}`,
                      background: mes===m.valor ? 'var(--azul-lt2)' : 'white',
                      color: mes===m.valor ? 'var(--azul)' : 'var(--txt)',
                      fontSize:11, fontWeight: mes===m.valor ? 600 : 400, cursor:'pointer', fontFamily:'inherit',
                      textTransform:'capitalize' }}>
                    {m.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="card-title"><span className="dot" style={{ background:'var(--dorado2)' }}></span>2. Tipo</div>
              {TIPOS.map(t => (
                <label key={t.value} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, cursor:'pointer', fontSize:13 }}>
                  <input type="radio" name="tipo" value={t.value} checked={tipo===t.value}
                    onChange={() => setTipo(t.value)} style={{ accentColor:'var(--azul)' }} />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="card-title"><span className="dot" style={{ background:'var(--verde)' }}></span>3. Personas (todas por defecto)</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {personas.map(p => (
                  <button key={p.id} onClick={() => togglePersona(p.id)}
                    style={{ padding:'4px 10px', borderRadius:20, border:`1.5px solid ${selPersonas.includes(p.id)?'var(--azul)':'var(--borde2)'}`,
                      background: selPersonas.includes(p.id) ? 'var(--azul-lt2)' : 'white',
                      color: selPersonas.includes(p.id) ? 'var(--azul)' : 'var(--txt)',
                      fontSize:11, fontWeight: selPersonas.includes(p.id) ? 600 : 400, cursor:'pointer', fontFamily:'inherit' }}>
                    {p.nombre.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="card-title"><span className="dot" style={{ background:'var(--rojo2)' }}></span>4. Formato</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
                {([['csv','📄','CSV','Universal'],['excel','📊','Excel','.xlsx'],['pdf','📋','PDF','Imprimible']] as const).map(([f,ic,l,s]) => (
                  <label key={f} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, cursor:'pointer',
                    padding:'12px 8px', border:`2px solid ${fmt===f?'var(--azul)':'var(--borde2)'}`,
                    borderRadius:10, background: fmt===f ? 'var(--azul-lt2)' : 'white', transition:'all .2s' }}>
                    <input type="radio" name="fmt" value={f} checked={fmt===f} onChange={() => setFmt(f)} style={{ display:'none' }} />
                    <span style={{ fontSize:22 }}>{ic}</span>
                    <span style={{ fontSize:12, fontWeight:600 }}>{l}</span>
                    <span style={{ fontSize:10, color:'var(--txt3)' }}>{s}</span>
                  </label>
                ))}
              </div>
              <button className="btn btn-p" style={{ width:'100%', justifyContent:'center', padding:14 }}
                onClick={exportar} disabled={loading}>
                {loading ? '⏳ Generando...' : '📥 Generar y descargar'}
              </button>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="card" style={{ height:'fit-content' }}>
          <div className="card-body">
            <div className="card-title"><span className="dot" style={{ background:'var(--dorado2)' }}></span>Vista previa</div>
            <pre style={{ background:'var(--bg)', borderRadius:9, padding:14, fontSize:11,
              color:'var(--txt2)', whiteSpace:'pre-wrap', lineHeight:1.7,
              maxHeight:500, overflowY:'auto', fontFamily:'monospace' }}>
              {preview || 'Selecciona un mes y tipo para ver la vista previa...'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
