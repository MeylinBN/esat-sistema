'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth, parse } from 'date-fns'
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

function escapeCSV(val: any) {
  const str = String(val ?? '')
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

// Calcular horas entre dos tiempos (HH:MM)
function calcularHoras(entrada: string, salida: string): number {
  if (!entrada || !salida) return 0
  const [hE, mE] = entrada.split(':').map(Number)
  const [hS, mS] = salida.split(':').map(Number)
  const minutos = (hS * 60 + mS) - (hE * 60 + mE)
  return minutos > 0 ? minutos / 60 : 0
}

// Formatear minutos a "X Hr Y Min"
function formatoHoras(minutos: number): string {
  const hrs = Math.floor(minutos / 60)
  const mins = Math.round(minutos % 60)
  if (hrs > 0 && mins > 0) return `${hrs} Hr ${mins} Min`
  if (hrs > 0) return `${hrs} Hr`
  return `${mins} Min`
}

export default function ExportarPage() {
  const supabase = createClient()
  const [meses, setMeses] = useState<string[]>([format(new Date(), 'yyyy-MM')])
  const [tipo, setTipo] = useState('asistencia')
  const [fmt, setFmt] = useState<'csv'|'excel'|'pdf'>('csv')
  const [personas, setPersonas] = useState<any[]>([])
  const [selPersonas, setSelPersonas] = useState<string[]>([])
  const [dataPreview, setDataPreview] = useState<{headers:string[], rows:string[][]}>({headers:[], rows:[]})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)

  useEffect(() => {
    supabase.from('personas').select('id,nombre,dni,rol,area').eq('activo', true).order('nombre')
      .then(({ data }) => setPersonas(data ?? []))
  }, [])

  useEffect(() => { 
    if (meses.length > 0) generarPreview() 
  }, [meses, tipo, selPersonas])

  async function generarPreview() {
    if (meses.length === 0) return
    setLoading(true)
    setError(null)
    
    // Obtener rangos de fechas para todos los meses seleccionados
    const rangos = meses.map(mes => {
      const [year, month] = mes.split('-').map(Number)
      return {
        inicio: format(startOfMonth(new Date(year, month-1)), 'yyyy-MM-dd'),
        fin: format(endOfMonth(new Date(year, month-1)), 'yyyy-MM-dd')
      }
    })

    const idsFiltro = selPersonas.length > 0 ? selPersonas : personas.map(p => p.id)

    let headers: string[] = []
    let rows: string[][] = []

    try {
      if (tipo === 'asistencia') {
        headers = ['Fecha', 'Entrada', 'Salida', 'Horas Trabajadas', 'Estado', 'Tardanza']
        
        // Consultar asistencias para todos los meses
        let todasAsistencias: any[] = []
        for (const rango of rangos) {
          const { data, error } = await supabase
            .from('asistencias')
            .select('*')
            .gte('fecha', rango.inicio)
            .lte('fecha', rango.fin)
            .in('persona_id', idsFiltro)
            .order('persona_id')
            .order('fecha')
          
          if (error) console.error('Error:', error)
          else todasAsistencias = [...todasAsistencias, ...(data ?? [])]
        }

        console.log('✅ Total asistencias:', todasAsistencias.length)
        
        // Agrupar por persona
        const porPersona: Record<string, any[]> = {}
        todasAsistencias.forEach(a => {
          if (!porPersona[a.persona_id]) porPersona[a.persona_id] = []
          porPersona[a.persona_id].push(a)
        })
        
        // Generar filas agrupadas
        let totalGeneralHoras = 0
        let totalGeneralTardanza = 0
        
        Object.entries(porPersona).forEach(([pid, asistencias]) => {
          const p = personas.find(x => x.id === pid)
          if (!p) return
          
          // Encabezado de persona (fila especial)
          rows.push([` ${p.nombre}`, `DNI: ${p.dni}`, `${p.rol}`, '', '', ''])
          
          let totalHorasPersona = 0
          let totalTardanzaPersona = 0
          
          // Datos de asistencia
          asistencias.forEach(a => {
            const horasTrabajadas = calcularHoras(
              a.hora_entrada?.slice(0,5) ?? '',
              a.hora_salida?.slice(0,5) ?? ''
            )
            totalHorasPersona += horasTrabajadas
            totalTardanzaPersona += (a.tardanza_min ?? 0)
            
            rows.push([
              a.fecha,
              a.hora_entrada?.slice(0,5) ?? '—',
              a.hora_salida?.slice(0,5) ?? '—',
              horasTrabajadas > 0 ? formatoHoras(horasTrabajadas * 60) : '—',
              a.estado,
              a.tardanza_min > 0 ? formatoHoras(a.tardanza_min) : '0'
            ])
          })
          
          // Fila de totales por persona
          totalGeneralHoras += totalHorasPersona
          totalGeneralTardanza += totalTardanzaPersona
          rows.push([
            `📊 Total ${p.nombre.split(' ')[0]}`,
            '',
            '',
            formatoHoras(totalHorasPersona * 60),
            '',
            formatoHoras(totalTardanzaPersona)
          ])
          rows.push([]) // Separador
        })
        
        // Total general
        if (Object.keys(porPersona).length > 1) {
          rows.push([`📈 TOTAL GENERAL`, '', '', formatoHoras(totalGeneralHoras * 60), '', formatoHoras(totalGeneralTardanza)])
        }
        
      } else if (tipo === 'permisos') {
        headers = ['Tipo', 'Fecha Inicio', 'Fecha Fin', 'Motivo', 'Estado']
        let todosPermisos: any[] = []
        for (const rango of rangos) {
          const { data } = await supabase.from('permisos').select('*')
            .gte('fecha_inicio', rango.inicio).lte('fecha_fin', rango.fin)
            .order('persona_id').order('fecha_inicio')
          todosPermisos = [...todosPermisos, ...(data ?? [])]
        }
        
        const porPersona: Record<string, any[]> = {}
        todosPermisos.forEach(p => {
          if (!porPersona[p.persona_id]) porPersona[p.persona_id] = []
          porPersona[p.persona_id].push(p)
        })
        
        Object.entries(porPersona).forEach(([pid, permisos]) => {
          const persona = personas.find(x => x.id === pid)
          if (!persona) return
          rows.push([`📋 ${persona.nombre}`, `DNI: ${persona.dni}`, `${persona.rol}`, '', '', ''])
          permisos.forEach(perm => {
            rows.push([perm.tipo?.replace('_', ' '), perm.fecha_inicio, perm.fecha_fin, perm.motivo ?? '—', perm.estado])
          })
          rows.push([])
        })
      } else if (tipo === 'horas') {
        headers = ['Nombre', 'DNI', 'Rol', 'Horas/Sem', 'Área']
        personas.filter(p => idsFiltro.includes(p.id)).forEach(p => {
          rows.push([p.nombre, p.dni, p.rol, p.hs_semanales ?? '0', p.area ?? '—'])
        })
      } else {
        headers = ['Nombre', 'DNI', 'Rol', 'Área', 'Asistencias', 'Permisos']
        let todasAsis: any[] = []
        let todosPerm: any[] = []
        for (const rango of rangos) {
          const { data: asis } = await supabase.from('asistencias').select('persona_id').gte('fecha', rango.inicio).lte('fecha', rango.fin).in('persona_id', idsFiltro)
          const { data: perm } = await supabase.from('permisos').select('persona_id').gte('fecha_inicio', rango.inicio).lte('fecha_fin', rango.fin).in('persona_id', idsFiltro)
          todasAsis = [...todasAsis, ...(asis ?? [])]
          todosPerm = [...todosPerm, ...(perm ?? [])]
        }
        const conteoAsis: Record<string, number> = {}; todasAsis.forEach(a => conteoAsis[a.persona_id] = (conteoAsis[a.persona_id]||0)+1)
        const conteoPerm: Record<string, number> = {}; todosPerm.forEach(p => conteoPerm[p.persona_id] = (conteoPerm[p.persona_id]||0)+1)
        personas.filter(p => idsFiltro.includes(p.id)).forEach(p => {
          rows.push([p.nombre, p.dni, p.rol, p.area ?? '—', conteoAsis[p.id]??0, conteoPerm[p.id]??0])
        })
      }
      
      console.log('📊 Filas generadas:', rows.length)
      setDataPreview({ headers, rows })
    } catch(err) {
      console.error('❌ Error:', err)
      setError('Error al cargar datos')
      setDataPreview({ headers: ['Error'], rows: [['No se pudieron cargar los datos']] })
    } finally {
      setLoading(false)
    }
  }

  async function exportar() {
    if (dataPreview.rows.length === 0) {
      alert('No hay datos para exportar')
      return
    }
    
    setLoading(true)
    try {
      const mesesTexto = meses.length === 1 ? meses[0] : `${meses.length} meses`
      const csvLines = [
        `REPORTE DE ${tipo.toUpperCase()} · ${mesesTexto}`,
        `Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
        '',
        dataPreview.headers.join(','),
        ...dataPreview.rows.map(r => r.map(escapeCSV).join(','))
      ]
      const csvContent = csvLines.join('\n')
      
      if (fmt === 'csv') {
        const blob = new Blob(['\ufeff'+csvContent], { type: 'text/csv;charset=utf-8;' })
        download(blob, `ESAT_${tipo}_${meses.length===1?meses[0]:'multiple'}.${fmt}`)
      } else if (fmt === 'excel') {
        const { utils, writeFile } = await import('xlsx')
        const ws = utils.aoa_to_sheet([
          [`REPORTE DE ${tipo.toUpperCase()} · ${mesesTexto}`],
          [`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
          [''],
          dataPreview.headers,
          ...dataPreview.rows
        ])
        ws['!cols'] = dataPreview.headers.map(() => ({ wch: 20 }))
        const wb = utils.book_new()
        utils.book_append_sheet(wb, ws, 'Reporte')
        writeFile(wb, `ESAT_${tipo}_${meses.length===1?meses[0]:'multiple'}.xlsx`)
      } else if (fmt === 'pdf') {
        const { default: jsPDF } = await import('jspdf')
        const { default: autoTable } = await import('jspdf-autotable')
        const doc = new jsPDF({ orientation: 'landscape' })
        
        doc.setFontSize(16)
        doc.setTextColor(0, 47, 108)
        doc.text(`REPORTE DE ${tipo.toUpperCase()}`, 14, 18)
        doc.setFontSize(10)
        doc.setTextColor(100, 116, 139)
        doc.text(`${mesesTexto} | Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 24)
        
        autoTable(doc, { 
          head: [dataPreview.headers], 
          body: dataPreview.rows, 
          startY: 30, 
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [0, 47, 108] },
          didParseCell: (data: any) => {
            const rowText = (data.row.raw as any[])?.[0] || ''
            if (rowText && rowText.startsWith('📋 ')) {
              data.cell.styles.fontStyle = 'bold'
              data.cell.styles.fillColor = [239, 246, 255]
              data.cell.styles.textColor = [0, 47, 108]
              data.cell.styles.fontSize = 10
            } else if (rowText && rowText.startsWith('📊 Total')) {
              data.cell.styles.fontStyle = 'bold'
              data.cell.styles.fillColor = [220, 252, 231]
              data.cell.styles.textColor = [21, 128, 61]
            } else if (rowText && rowText.startsWith('📈 TOTAL')) {
              data.cell.styles.fontStyle = 'bold'
              data.cell.styles.fillColor = [254, 243, 199]
              data.cell.styles.textColor = [180, 83, 9]
            }
          }
        })
        doc.save(`ESAT_${tipo}_${meses.length===1?meses[0]:'multiple'}.pdf`)
      }
    } catch(err) {
      console.error('Error exportando:', err)
      alert('Error al generar el archivo.')
    } finally {
      setLoading(false)
    }
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

  function toggleMes(mes: string) {
    setMeses(prev => prev.includes(mes) ? prev.filter(m => m !== mes) : [...prev, mes])
  }

  return (
    <div style={{ padding:24, fontFamily:'sans-serif', background:'#f8fafc', minHeight:'100vh' }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'#002F6C', margin:0 }}>Exportar Reportes</h1>
        <p style={{ fontSize:13, color:'#64748b', marginTop:4 }}>Descarga datos filtrados en CSV, Excel o PDF</p>
      </div>

      {error && (
        <div style={{ background:'#fee2e2', border:'1.5px solid #fca5a5', borderRadius:10, padding:'12px 16px', marginBottom:20, color:'#b91c1c' }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:20, alignItems:'start' }}>
        
        {/* Panel de Controles */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          
          {/* 1. Meses (Múltiple) */}
          <div style={{ background:'white', borderRadius:12, border:'1.5px solid #e2e8f0', padding:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#475569', marginBottom:10, textTransform:'uppercase' }}>1. Meses (puede seleccionar varios)</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
              {MESES.map(m => (
                <button key={m.valor} onClick={() => toggleMes(m.valor)}
                  style={{ padding:'6px 4px', borderRadius:8, border:`1.5px solid ${meses.includes(m.valor)?'#002F6C':'#e2e8f0'}`,
                    background: meses.includes(m.valor) ? '#eff6ff' : 'white',
                    color: meses.includes(m.valor) ? '#002F6C' : '#475569',
                    fontSize:11, fontWeight: meses.includes(m.valor) ? 600 : 400, cursor:'pointer', fontFamily:'inherit',
                    textTransform:'capitalize' }}>
                  {m.label.split(' ')[0]}
                </button>
              ))}
            </div>
            {meses.length > 0 && (
              <div style={{ fontSize:11, color:'#002F6C', marginTop:8, fontWeight:600 }}>
                ✓ {meses.length} mes(es) seleccionado(s)
              </div>
            )}
          </div>

          {/* 2. Tipo */}
          <div style={{ background:'white', borderRadius:12, border:'1.5px solid #e2e8f0', padding:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#475569', marginBottom:10, textTransform:'uppercase' }}>2. Tipo de Reporte</div>
            {TIPOS.map(t => (
              <label key={t.value} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, cursor:'pointer', fontSize:13 }}>
                <input type="radio" name="tipo" value={t.value} checked={tipo===t.value}
                  onChange={() => setTipo(t.value)} style={{ accentColor:'#002F6C' }} />
                {t.label}
              </label>
            ))}
          </div>

          {/* 3. Personas */}
          <div style={{ background:'white', borderRadius:12, border:'1.5px solid #e2e8f0', padding:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#475569', marginBottom:10, textTransform:'uppercase' }}>3. Personas ({selPersonas.length === 0 ? 'Todas' : selPersonas.length})</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, maxHeight:140, overflowY:'auto', padding:4 }}>
              {personas.map(p => (
                <button key={p.id} onClick={() => togglePersona(p.id)}
                  style={{ padding:'4px 10px', borderRadius:20, border:`1.5px solid ${selPersonas.includes(p.id)?'#002F6C':'#e2e8f0'}`,
                    background: selPersonas.includes(p.id) ? '#eff6ff' : 'white',
                    color: selPersonas.includes(p.id) ? '#002F6C' : '#475569',
                    fontSize:11, fontWeight: selPersonas.includes(p.id) ? 600 : 400, cursor:'pointer', fontFamily:'inherit' }}>
                  {p.nombre.split(' ')[0]} {p.nombre.split(' ')[1]?.[0]}.
                </button>
              ))}
            </div>
          </div>

          {/* 4. Formato & Botón */}
          <div style={{ background:'white', borderRadius:12, border:'1.5px solid #e2e8f0', padding:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#475569', marginBottom:10, textTransform:'uppercase' }}>4. Formato</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
              {([['csv','📄','CSV'],['excel','📊','Excel'],['pdf','📋','PDF']] as const).map(([f,ic,l]) => (
                <label key={f} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor:'pointer',
                  padding:'10px 6px', border:`2px solid ${fmt===f?'#002F6C':'#e2e8f0'}`,
                  borderRadius:10, background: fmt===f ? '#eff6ff' : 'white', transition:'all .2s' }}>
                  <input type="radio" name="fmt" value={f} checked={fmt===f} onChange={() => setFmt(f)} style={{ display:'none' }} />
                  <span style={{ fontSize:20 }}>{ic}</span>
                  <span style={{ fontSize:11, fontWeight:600, color:'#0f172a' }}>{l}</span>
                </label>
              ))}
            </div>
            <button onClick={exportar} disabled={loading || dataPreview.rows.length===0}
              style={{ width:'100%', padding:12, borderRadius:9, border:'none', background: dataPreview.rows.length===0 ? '#cbd5e1' : '#002F6C', 
                color:'white', cursor: loading || dataPreview.rows.length===0 ? 'not-allowed' : 'pointer', 
                fontSize:13, fontWeight:600, fontFamily:'inherit', opacity: loading?.6:1 }}>
              {loading ? '⏳ Generando...' : `📥 Descargar ${fmt.toUpperCase()}`}
            </button>
          </div>
        </div>

        {/* Vista Previa */}
        <div style={{ background:'white', borderRadius:12, border:'1.5px solid #e2e8f0', overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#d97706' }}/>
            <span style={{ fontSize:14, fontWeight:600, color:'#0f172a' }}>Vista previa ({dataPreview.rows.length} filas)</span>
          </div>
          <div style={{ overflowX:'auto', maxHeight:520, overflowY:'auto' }}>
            {dataPreview.headers.length > 0 ? (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'#f8fafc', position:'sticky', top:0 }}>
                    {dataPreview.headers.map(h => (
                      <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontWeight:600, color:'#475569', borderBottom:'1.5px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataPreview.rows.map((r, i) => {
                    const isFirstCol = r[0]?.startsWith('📋') || r[0]?.startsWith('📊') || r[0]?.startsWith('📈')
                    return (
                      <tr key={i} style={{ 
                        background: isFirstCol ? (r[0]?.startsWith('📋') ? '#eff6ff' : r[0]?.startsWith('📊') ? '#dcfce7' : '#fef3c7') : (i%2===0 ? 'white' : '#f8fafc'),
                        fontWeight: isFirstCol ? 600 : 400
                      }}>
                        {r.map((cell, j) => (
                          <td key={j} style={{ padding:'8px 12px', borderBottom:'1px solid #f1f5f9', color:'#0f172a' }}>{cell}</td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ padding:40, textAlign:'center', color:'#94a3b8', fontSize:13 }}>
                Selecciona un mes para cargar datos...
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}