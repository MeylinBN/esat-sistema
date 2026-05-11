'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Persona, Rol, getRolLabel } from '@/types'

const ROLES: Rol[] = ['Practicante','Tesista','Voluntario','Investigador','Asistente','SENATI','EcoBIOTEM','Coordinador']

export default function AsistenciaPage() {
  const supabase = createClient()
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading]   = useState(true)
  const [buscar, setBuscar]     = useState('')
  const [modal, setModal]       = useState(false)
  const [mNombre, setMNombre]   = useState('')
  const [mDni, setMDni]         = useState('')
  const [mRol, setMRol]         = useState<Rol>('Practicante')
  const [mSubrol, setMSubrol]   = useState('')
  const [mGrupo, setMGrupo]     = useState('ESAT')
  const [mHora, setMHora]       = useState('08:30')
  const [mTol, setMTol]         = useState(10)
  const [mArea, setMArea]       = useState('')
  const [mColor, setMColor]     = useState('#1e40af')
  const [saving, setSaving]     = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('personas').select('*').order('nombre')
    setPersonas(data ?? [])
    setLoading(false)
  }

  async function toggleActivo(id: string, activo: boolean) {
    await supabase.from('personas').update({ activo: !activo }).eq('id', id)
    load()
  }

  async function guardar() {
    if (!mNombre || !mDni) return
    setSaving(true)
    const esEco = mRol === 'EcoBIOTEM'
    await supabase.from('personas').insert({
      nombre: mNombre, dni: mDni, rol: mRol, subrol: mSubrol || null,
      grupo: mGrupo, hora_ingreso: esEco ? null : mHora,
      tolerancia: mTol, activo: true, color: mColor, area: mArea || null,
      sin_horario: esEco,
    })
    setModal(false)
    setMNombre(''); setMDni(''); setMSubrol(''); setMArea('')
    setSaving(false)
    load()
  }

  const filtradas = personas.filter(p =>
    p.nombre.toLowerCase().includes(buscar.toLowerCase()) ||
    p.rol.toLowerCase().includes(buscar.toLowerCase()) ||
    (p.dni ?? '').includes(buscar)
  )

  const grupos = ['ESAT', 'EcoBIOTEM']

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'var(--txt3)' }}>Cargando...</div>

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--azul)' }}>Personas</h1>
          <p style={{ fontSize:12, color:'var(--txt3)', marginTop:2 }}>{personas.filter(p=>p.activo).length} activas · {personas.length} total</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar..." style={{ padding:'8px 12px', border:'1.5px solid var(--borde2)',
              borderRadius:9, fontSize:13, fontFamily:'inherit', outline:'none', width:180 }} />
          <button className="btn btn-p" onClick={() => setModal(true)}>+ Agregar</button>
        </div>
      </div>

      {grupos.map(grupo => {
        const gPersonas = filtradas.filter(p => p.grupo === grupo)
        if (!gPersonas.length) return null
        return (
          <div key={grupo} style={{ marginBottom:28 }}>
            <h2 style={{ fontSize:13, fontWeight:600, color: grupo==='EcoBIOTEM' ? 'var(--verde)' : 'var(--txt2)',
              textTransform:'uppercase', letterSpacing:'.06em', marginBottom:12 }}>
              {grupo === 'EcoBIOTEM' ? '🌿 ' : ''}{grupo}
            </h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
              {gPersonas.map(p => (
                <div key={p.id} style={{ background:'white', borderRadius:12,
                  border:`1.5px solid ${p.activo ? 'var(--borde2)' : '#fca5a5'}`,
                  padding:14, boxShadow:'var(--shadow)', opacity: p.activo ? 1 : .6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:p.color+'25',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontWeight:700, fontSize:16, color:p.color }}>
                      {p.nombre.charAt(0)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{p.nombre}</div>
                      <div style={{ fontSize:11, color:'var(--txt3)' }}>{getRolLabel(p)}</div>
                    </div>
                    <button onClick={() => toggleActivo(p.id, p.activo)}
                      style={{ fontSize:10, padding:'3px 8px', borderRadius:20, border:'none', cursor:'pointer',
                        background: p.activo ? 'var(--verde-lt)' : 'var(--rojo-lt)',
                        color: p.activo ? 'var(--verde)' : 'var(--rojo2)', fontWeight:600, fontFamily:'inherit' }}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:11, color:'var(--txt3)' }}>
                    <span>📋 DNI: {p.dni}</span>
                    {p.hora_ingreso && <span>🕐 {p.hora_ingreso.slice(0,5)}</span>}
                    {p.area && <span>📍 {p.area}</span>}
                    {p.hs_semanales && <span>⏱ {p.hs_semanales}h/sem</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {modal && (
        <div className="mo" onClick={e => { if(e.target===e.currentTarget) setModal(false) }}>
          <div className="mo-box">
            <div className="mo-head">
              <h3>Agregar persona</h3>
              <button className="mo-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div className="ig"><label>Nombre completo</label><input value={mNombre} onChange={e=>setMNombre(e.target.value)} placeholder="Nombres y apellidos" /></div>
              <div className="ig"><label>DNI</label><input value={mDni} onChange={e=>setMDni(e.target.value)} placeholder="Nro. de documento" /></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div className="ig">
                <label>Rol</label>
                <select value={mRol} onChange={e=>setMRol(e.target.value as Rol)}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="ig"><label>Subrol / Especialidad</label><input value={mSubrol} onChange={e=>setMSubrol(e.target.value)} placeholder="Ej: Ing. Ambiental" /></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
              <div className="ig">
                <label>Grupo</label>
                <select value={mGrupo} onChange={e=>setMGrupo(e.target.value)}>
                  <option value="ESAT">ESAT</option>
                  <option value="EcoBIOTEM">EcoBIOTEM</option>
                </select>
              </div>
              <div className="ig"><label>Hora ingreso</label><input type="time" value={mHora} onChange={e=>setMHora(e.target.value)} /></div>
              <div className="ig"><label>Tolerancia (min)</label><input type="number" value={mTol} onChange={e=>setMTol(+e.target.value)} min={0} max={30} /></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:12, marginBottom:16 }}>
              <div className="ig"><label>Área</label><input value={mArea} onChange={e=>setMArea(e.target.value)} placeholder="Ej: Ambiental, Sistemas..." /></div>
              <div className="ig"><label>Color</label><input type="color" value={mColor} onChange={e=>setMColor(e.target.value)} style={{ height:38, padding:'2px 4px' }} /></div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn btn-s" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={guardar} disabled={saving || !mNombre || !mDni}>
                {saving ? 'Guardando...' : 'Agregar persona'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
