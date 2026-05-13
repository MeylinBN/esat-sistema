'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const TIPO_LABEL: Record<string,string> = {
  permiso_medico:'🏥 Médico', 
  permiso_personal:'👤 Personal',
  permiso_academico:'🎓 Académico', 
  falta_justificada:'📋 F. Justificada',
  falta_injustificada:'⚠️ F. Injustificada', 
  vacaciones:'🏖 Vacaciones',
}

const ESTADO_CFG: Record<string,{bg:string,txt:string}> = {
  aprobado: {bg:'#dcfce7',txt:'#15803d'},
  pendiente:{bg:'#fef3c7',txt:'#b45309'},
  rechazado:{bg:'#fee2e2',txt:'#b91c1c'},
}

export default function PermisosPage() {
  const supabase = createClient()
  const [permisos, setPermisos] = useState<any[]>([])
  const [personas, setPersonas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  
  // Estados del formulario
  const [mPerId, setMPerId] = useState('')
  const [mTipo, setMTipo] = useState('permiso_personal')
  const [mFI, setMFI] = useState('')
  const [mFF, setMFF] = useState('')
  const [mMotivo, setMMotivo] = useState('')
  const [mEstado, setMEstado] = useState('pendiente')
  const [mRecup, setMRecup] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string|null>(null)

  useEffect(()=>{
    load()
  },[])

  async function load(){
    try {
      setError(null)
      
      // Cargar personas
      const { data: personasData } = await supabase
  .from('personas')
  .select('id,nombre,color')
  .eq('activo', true)
        .order('nombre')
      
      setPersonas(personasData ?? [])

      // Cargar permisos
      const { data: permisosData } = await supabase
  .from('permisos')
  .select('*')
  .order('created_at', { ascending: false })
      
      // Unir manualmente con personas
      const permisosConPersonas = (permisosData ?? []).map(perm => {
        const persona = personasData?.find(p => p.id === perm.persona_id)
        return {
          ...perm,
          persona_nombre: persona?.nombre ?? 'Desconocido',
          persona_color: persona?.color ?? '#94a3b8'
        }
      })
      
      setPermisos(permisosConPersonas)
      
    } catch(err) {
      console.error('Error:', err)
      setError('Error cargando datos')
    } finally {
      setLoading(false)
    }
  }

  async function guardarPermiso(){
    // Validaciones estrictas
    if(!mPerId){
      setError('Selecciona una persona')
      return
    }
    if(!mFI || !mFF){
      setError('Selecciona fecha de inicio y fin')
      return
    }
    if(new Date(mFI) > new Date(mFF)){
      setError('La fecha de inicio no puede ser mayor a la fecha fin')
      return
    }
    if(!mMotivo.trim()){
      setError('Ingresa un motivo para el permiso')
      return
    }

    setSaving(true)
    setError(null)
    
    try {
      const data = {
        persona_id: mPerId,
        tipo: mTipo,
        fecha_inicio: mFI,
        fecha_fin: mFF,
        motivo: mMotivo.trim(),
        estado: mEstado,
        dias_recuperacion: mRecup.trim() || null,
        created_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('permisos')
        .insert(data)
      
      if(error) {
        console.error('Error insertando:', error)
        setError('Error al guardar: ' + error.message)
      } else {
        console.log('✅ Permiso registrado correctamente')
        cerrarModal()
        load()
      }
    } catch(err) {
      setError('Error inesperado al guardar')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  function cerrarModal(){
    setModal(false)
    setMPerId('')
    setMFI('')
    setMFF('')
    setMMotivo('')
    setMEstado('pendiente')
    setMRecup('')
    setError(null)
  }

  async function cambiarEstado(id:string, estado:string){
    const { error } = await supabase
      .from('permisos')
      .update({ estado })
      .eq('id', id)
    
    if(error) {
      alert('Error al actualizar: ' + error.message)
    } else {
      load()
    }
  }

  async function eliminar(id:string){
    if(!confirm('¿Eliminar este permiso?')) return
    const { error } = await supabase
      .from('permisos')
      .delete()
      .eq('id', id)
    
    if(error) {
      alert('Error al eliminar: ' + error.message)
    } else {
      load()
    }
  }

  const pendientes = permisos.filter(p=>p.estado==='pendiente').length
  const aprobados = permisos.filter(p=>p.estado==='aprobado').length
  
  const permisosFiltrados = filtro === 'todos' 
    ? permisos 
    : permisos.filter(p=>p.estado===filtro)

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando permisos...</div>

  return (
    <div>
      {/* Header con botón Registrar */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22}}>
        <div>
          <h1 style={{fontFamily:'Lora,serif',fontSize:24,color:'#002F6C',fontWeight:600}}>Permisos y Faltas</h1>
          <p style={{fontSize:12,color:'#475569',marginTop:3}}>Registro y aprobación de ausencias justificadas</p>
        </div>
        <button onClick={()=>setModal(true)} 
          style={{background:'#002F6C',color:'white',padding:'10px 20px',borderRadius:9,border:'none',cursor:'pointer',fontWeight:600,fontSize:13}}>
          + Registrar permiso
        </button>
      </div>

      {/* Alerta de pendientes */}
      {pendientes>0 && (
        <div style={{background:'#fef3c7',border:'1.5px solid #fde68a',borderRadius:10,padding:'12px 16px',marginBottom:20}}>
          ⏳ {pendientes} permiso(s) pendiente(s)
        </div>
      )}

      {/* Métricas */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:20}}>
        <div style={{background:'white',borderRadius:12,padding:'16px',border:'1.5px solid #e2e8f0'}}>
          <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',marginBottom:6}}>Total registros</div>
          <div style={{fontSize:28,fontWeight:700,color:'#002F6C'}}>{permisos.length}</div>
        </div>
        <div style={{background:'white',borderRadius:12,padding:'16px',border:'1.5px solid #e2e8f0'}}>
          <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',marginBottom:6}}>Aprobados</div>
          <div style={{fontSize:28,fontWeight:700,color:'#15803d'}}>{aprobados}</div>
        </div>
        <div style={{background:'white',borderRadius:12,padding:'16px',border:'1.5px solid #e2e8f0'}}>
          <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',marginBottom:6}}>Pendientes</div>
          <div style={{fontSize:28,fontWeight:700,color:'#b45309'}}>{pendientes}</div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{display:'flex',gap:4,marginBottom:16}}>
        {['todos','pendiente','aprobado','rechazado'].map(f=>(
          <button key={f} onClick={()=>setFiltro(f)}
            style={{padding:'6px 14px',borderRadius:8,border:'none',fontSize:12,fontWeight:filtro===f?600:400,cursor:'pointer',
              background:filtro===f?'#002F6C':'white',color:filtro===f?'white':'#475569'}}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>

      {/* Lista de permisos */}
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {permisosFiltrados.map(p=>{
          const ec = ESTADO_CFG[p.estado]??ESTADO_CFG.pendiente
          return (
            <div key={p.id} style={{background:'white',borderRadius:12,border:'1.5px solid #e2e8f0',padding:'14px 18px'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                    <div style={{width:26,height:26,borderRadius:'50%',background:p.persona_color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white'}}>
                      {p.persona_nombre?.charAt(0)}
                    </div>
                    <span style={{fontSize:13,fontWeight:700}}>{p.persona_nombre}</span>
                    <span style={{fontSize:11,padding:'2px 9px',borderRadius:20,background:'#dbeafe',color:'#1d4ed8'}}>
                      {TIPO_LABEL[p.tipo]??p.tipo}
                    </span>
                    <span style={{fontSize:11,padding:'2px 9px',borderRadius:20,fontWeight:600,background:ec.bg,color:ec.txt}}>
                      {p.estado}
                    </span>
                  </div>
                  <div style={{fontSize:12,color:'#475569',marginBottom:4}}>
                    📅 {format(new Date(p.fecha_inicio+'T12:00:00'),"d MMM yyyy",{locale:es})}
                    {p.fecha_fin!==p.fecha_inicio && ` → ${format(new Date(p.fecha_fin+'T12:00:00'),"d MMM yyyy",{locale:es})}`}
                  </div>
                  {p.motivo && <div style={{fontSize:12,color:'#475569',marginBottom:4}}>"{p.motivo}"</div>}
                  {p.dias_recuperacion && (
                    <div style={{fontSize:11,color:'#15803d',fontWeight:500}}>🔁 Recuperación: {p.dias_recuperacion}</div>
                  )}
                </div>
                <div style={{display:'flex',gap:6}}>
                  {p.estado==='pendiente' && (
                    <>
                      <button onClick={()=>cambiarEstado(p.id,'aprobado')} 
                        style={{background:'#dcfce7',color:'#15803d',border:'1px solid #86efac',borderRadius:7,padding:'5px 10px',fontSize:11,cursor:'pointer'}}>
                        ✓ Aprobar
                      </button>
                      <button onClick={()=>cambiarEstado(p.id,'rechazado')} 
                        style={{background:'#fee2e2',color:'#b91c1c',border:'1px solid #fca5a5',borderRadius:7,padding:'5px 10px',fontSize:11,cursor:'pointer'}}>
                        ✗ Rechazar
                      </button>
                    </>
                  )}
                  <button onClick={()=>eliminar(p.id)} 
                    style={{background:'#fee2e2',color:'#b91c1c',border:'1px solid #fca5a5',borderRadius:7,padding:'5px 10px',fontSize:11,cursor:'pointer'}}>
                    🗑
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {!permisosFiltrados.length && (
          <div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>
            Sin permisos {filtro!=='todos' ? `con estado "${filtro}"` : 'registrados'}
          </div>
        )}
      </div>

      {/* Modal para registrar permiso */}
      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
          onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div style={{background:'white',borderRadius:18,padding:24,width:'100%',maxWidth:500,boxShadow:'0 24px 80px rgba(0,0,0,.25)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{fontSize:16,fontWeight:700}}>Registrar permiso / falta</h3>
              <button onClick={cerrarModal} style={{width:28,height:28,borderRadius:'50%',border:'none',background:'#f1f5f9',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            
            {error && (
              <div style={{background:'#fee2e2',border:'1px solid #fca5a5',borderRadius:8,padding:'10px 14px',marginBottom:16,color:'#b91c1c',fontSize:13}}>
                ⚠️ {error}
              </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Persona *</label>
                <select value={mPerId} onChange={e=>setMPerId(e.target.value)} 
                  style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}>
                  <option value="">Seleccionar...</option>
                  {personas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Tipo *</label>
                <select value={mTipo} onChange={e=>setMTipo(e.target.value)}
                  style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}>
                  {Object.entries(TIPO_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Fecha inicio *</label>
                <input type="date" value={mFI} onChange={e=>setMFI(e.target.value)}
                  style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}/>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Fecha fin *</label>
                <input type="date" value={mFF} onChange={e=>setMFF(e.target.value)}
                  style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}/>
              </div>
            </div>
            
            <div style={{marginBottom:12}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Motivo *</label>
              <textarea value={mMotivo} onChange={e=>setMMotivo(e.target.value)} rows={3} 
                placeholder="Explica el motivo del permiso o falta..."
                style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,resize:'vertical'}}/>
            </div>
            
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Estado</label>
                <select value={mEstado} onChange={e=>setMEstado(e.target.value)}
                  style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}>
                  <option value="pendiente">Pendiente</option>
                  <option value="aprobado">Aprobado</option>
                  <option value="rechazado">Rechazado</option>
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Días recuperación</label>
                <input value={mRecup} onChange={e=>setMRecup(e.target.value)} 
                  placeholder="Opcional: Ej: martes 28/04"
                  style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13}}/>
              </div>
            </div>
            
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={cerrarModal} 
                style={{padding:'8px 16px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'white',cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>
                Cancelar
              </button>
              <button onClick={guardarPermiso} disabled={saving}
                style={{padding:'8px 18px',borderRadius:9,border:'none',background:'#002F6C',color:'white',cursor:saving?'not-allowed':'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit',opacity:saving?.6:1}}>
                {saving?'Guardando...':'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}