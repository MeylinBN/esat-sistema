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
  const [error, setError] = useState<string|null>(null)
  const [filtro, setFiltro] = useState('todos')

  useEffect(()=>{
    load()
  },[])

  async function load(){
    try {
      setError(null)
      console.log('🔄 Cargando permisos...')
      
      // Cargar personas primero
      const { data: personasData, error: errorPersonas } = await supabase
        .from('personas')
        .select('id,nombre,color')
        .eq('activo', true)
        .order('nombre')
      
      if(errorPersonas) {
        console.error('❌ Error cargando personas:', errorPersonas)
        setError('Error cargando personas')
        return
      }
      
      setPersonas(personasData ?? [])
      console.log('✅ Personas cargadas:', personasData?.length)

      // Cargar permisos SIN JOIN (lo haremos manualmente)
      const { data: permisosData, error: errorPermisos } = await supabase
        .from('permisos')
        .select('*')
        .order('created_at', { ascending: false })
      
      if(errorPermisos) {
        console.error('❌ Error cargando permisos:', errorPermisos)
        setError('Error cargando permisos: ' + errorPermisos.message)
        return
      }
      
      console.log('✅ Permisos cargados:', permisosData?.length)
      
      // Unir manualmente con personas
      const permisosConPersonas = (permisosData ?? []).map(perm => {
        const persona = personasData?.find(p => p.id === perm.persona_id)
        return {
          ...perm,
          persona_nombre: persona?.nombre ?? 'Desconocido',
          persona_color: persona?.color ?? '#94a3b8'
        }
      })
      
      console.log('📊 Permisos con personas:', permisosConPersonas)
      setPermisos(permisosConPersonas)
      
    } catch(err) {
      console.error('❌ Error inesperado:', err)
      setError('Error inesperado: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function cambiarEstado(id:string, estado:string){
    console.log(`🔄 Cambiando estado de ${id} a ${estado}`)
    const { error } = await supabase
      .from('permisos')
      .update({ estado })
      .eq('id', id)
    
    if(error) {
      console.error('❌ Error actualizando:', error)
      alert('Error al actualizar: ' + error.message)
    } else {
      console.log('✅ Estado actualizado')
      load()
    }
  }

  async function eliminar(id:string){
    if(!confirm('¿Eliminar este permiso?')) return
    console.log(`🗑 Eliminando permiso ${id}`)
    const { error } = await supabase
      .from('permisos')
      .delete()
      .eq('id', id)
    
    if(error) {
      console.error('❌ Error eliminando:', error)
      alert('Error al eliminar: ' + error.message)
    } else {
      console.log('✅ Permiso eliminado')
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
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22}}>
        <div>
          <h1 style={{fontFamily:'Lora,serif',fontSize:24,color:'#002F6C',fontWeight:600}}>Permisos y Faltas</h1>
          <p style={{fontSize:12,color:'#475569',marginTop:3}}>Registro y aprobación de ausencias justificadas</p>
        </div>
        <button onClick={load} 
          style={{background:'#002F6C',color:'white',padding:'10px 20px',borderRadius:9,border:'none',cursor:'pointer',fontWeight:600}}>
          🔄 Recargar
        </button>
      </div>

      {error && (
        <div style={{background:'#fee2e2',border:'1.5px solid #fca5a5',borderRadius:10,padding:'12px 16px',marginBottom:20,color:'#b91c1c'}}>
          ⚠️ {error}
        </div>
      )}

      {pendientes>0 && (
        <div style={{background:'#fef3c7',border:'1.5px solid #fde68a',borderRadius:10,padding:'12px 16px',marginBottom:20}}>
          ⏳ {pendientes} permiso(s) pendiente(s)
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:20}}>
        <div style={{background:'white',borderRadius:12,padding:'16px',border:'1.5px solid #e2e8f0'}}>
          <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase'}}>Total registros</div>
          <div style={{fontSize:28,fontWeight:700,color:'#002F6C'}}>{permisos.length}</div>
        </div>
        <div style={{background:'white',borderRadius:12,padding:'16px',border:'1.5px solid #e2e8f0'}}>
          <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase'}}>Aprobados</div>
          <div style={{fontSize:28,fontWeight:700,color:'#15803d'}}>{aprobados}</div>
        </div>
        <div style={{background:'white',borderRadius:12,padding:'16px',border:'1.5px solid #e2e8f0'}}>
          <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase'}}>Pendientes</div>
          <div style={{fontSize:28,fontWeight:700,color:'#b45309'}}>{pendientes}</div>
        </div>
      </div>

      <div style={{display:'flex',gap:4,marginBottom:16}}>
        {['todos','pendiente','aprobado','rechazado'].map(f=>(
          <button key={f} onClick={()=>setFiltro(f)}
            style={{padding:'6px 14px',borderRadius:8,border:'none',fontSize:12,fontWeight:filtro===f?600:400,cursor:'pointer',
              background:filtro===f?'#002F6C':'white',color:filtro===f?'white':'#475569'}}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>

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
                  {p.motivo && <div style={{fontSize:12,color:'#475569'}}>"{p.motivo}"</div>}
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
    </div>
  )
}