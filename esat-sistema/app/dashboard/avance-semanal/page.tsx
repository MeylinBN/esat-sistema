'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, addDays, subDays, startOfWeek, getDay } from 'date-fns'
import { es } from 'date-fns/locale'

// Inicio del año operativo: Semana 1 = 12 de Enero
const DIA_INICIO_SEMANA_1 = 12

// Calcular info de semana basado en fecha
function getSemanaInfo(fecha: Date) {
    try {
        const year = fecha.getFullYear()
        const inicioAnio = new Date(year, 0, DIA_INICIO_SEMANA_1)
        
        const diffTime = fecha.getTime() - inicioAnio.getTime()
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        const numSemana = Math.max(1, Math.floor(diffDays / 7) + 1)
        
        const lunes = new Date(inicioAnio)
        lunes.setDate(inicioAnio.getDate() + (numSemana - 1) * 7)
        
        const viernes = new Date(lunes)
        viernes.setDate(lunes.getDate() + 4)
        
        return {
            numSemana,
            key: `${year}-${numSemana}`,
            label: `Semana ${numSemana} (${format(lunes, 'dd/MM')} - ${format(viernes, 'dd/MM')})`,
            inicio: lunes,
            fin: viernes
        }
    } catch (error) {
        console.error('Error calculando semana:', error)
        return {
            numSemana: 1,
            key: `${new Date().getFullYear()}-1`,
            label: 'Semana desconocida',
            inicio: new Date(),
            fin: new Date()
        }
    }
}

// ✅ CORREGIDO: Formatear etiqueta desde clave de BD
function formatSemanaLabel(semanaKey: string, fechaRegistro?: string) {
    try {
        if (!semanaKey || !semanaKey.includes('-')) return 'Semana no especificada'
        
        const [yearStr, weekStr] = semanaKey.split('-')
        const year = parseInt(yearStr)
        const week = parseInt(weekStr)
        
        if (isNaN(year) || isNaN(week)) return 'Semana inválida'
        
        const inicioAnio = new Date(year, 0, DIA_INICIO_SEMANA_1)
        const lunes = new Date(inicioAnio)
        lunes.setDate(inicioAnio.getDate() + (week - 1) * 7)
        
        const viernes = new Date(lunes)
        viernes.setDate(lunes.getDate() + 4)
        
        // Calcular día si hay fecha de registro
        let diaTexto = ''
        if (fechaRegistro) {
            const fechaReg = new Date(fechaRegistro)
            const diffDays = Math.floor((fechaReg.getTime() - lunes.getTime()) / (1000 * 60 * 60 * 24))
            const diaSemana = diffDays + 1 // Día 1 = lunes, Día 5 = viernes
            if (diaSemana >= 1 && diaSemana <= 5) {
                diaTexto = ` · día ${diaSemana}`
            }
        }
        
        return `Semana ${week} (${format(lunes, 'dd/MM')} - ${format(viernes, 'dd/MM')})${diaTexto}`
    } catch (error) {
        console.error('Error formateando semana:', semanaKey, error)
        return semanaKey || 'Semana desconocida'
    }
}

export default function AvanceSemanalPage() {
  const supabase = createClient()
  const [personas, setPersonas] = useState<any[]>([])
  const [tareas, setTareas] = useState<any[]>([])
  const [avances, setAvances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selPer, setSelPer] = useState('')
  
  const [modalAv, setModalAv] = useState(false)
  const [mTarea, setMTarea] = useState<any>(null)
  const [mPct, setMPct] = useState(0)
  const [mSem, setMSem] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(()=>{load()},[])

  async function load(){
    try {
        const [p,t,a]=await Promise.all([
        supabase.from('personas').select('id,nombre,color,rol,subrol').eq('activo',true).order('nombre'),
        supabase.from('tareas').select('*,personas(nombre,color)').neq('estado','cancelada').order('created_at',{ascending:false}),
        supabase.from('avances_semanales').select('*').order('semana',{ascending:false}),
        ])
        setPersonas(p.data??[]);setTareas(t.data??[]);setAvances(a.data??[])
    } catch (error) {
        console.error('Error cargando datos:', error)
    } finally {
        setLoading(false)
    }
  }

  async function guardar(){
    if(!mTarea||!mSem) return
    setSaving(true)
    try {
        await supabase.from('avances_semanales').upsert(
        {tarea_id:mTarea.id,semana:mSem,porcentaje:mPct},
        {onConflict:'tarea_id,semana'}
        )
        if(mPct>=100) await supabase.from('tareas').update({estado:'completada'}).eq('id',mTarea.id)
    } catch (error) {
        console.error('Error guardando:', error)
    } finally {
        setModalAv(false);setSaving(false);load()
    }
  }

  function ultimoAv(tid:string){ 
    return avances.filter(a=>a.tarea_id===tid).sort((a,b)=>b.semana.localeCompare(a.semana))[0] 
  }

  function avancesPorSemana(tid:string) {
    const avancesTarea = avances.filter(a => a.tarea_id === tid)
    const porSemana: Record<string, any> = {}
    
    avancesTarea.forEach(av => {
      if (!porSemana[av.semana] || av.created_at > porSemana[av.semana].created_at) {
        porSemana[av.semana] = av
      }
    })
    
    return Object.values(porSemana).sort((a, b) => b.semana.localeCompare(a.semana))
  }

  function generarSemanasDisponibles() {
    try {
        const hoy = new Date()
        const infoHoy = getSemanaInfo(hoy)
        
        const semanas: any[] = []
        
        // Semana Anterior
        const infoAnterior = getSemanaInfo(subDays(infoHoy.inicio, 7))
        semanas.push({ 
            ...infoAnterior, 
            esAnterior: true,
            esActual: false
        })
        
        // Actual + 4 Próximas
        for (let i = 0; i <= 4; i++) {
            const fechaIteracion = addDays(infoHoy.inicio, i * 7)
            semanas.push({ 
                ...getSemanaInfo(fechaIteracion), 
                esAnterior: false,
                esActual: i === 0 
            })
        }
        
        return semanas
    } catch (error) {
        console.error('Error generando semanas:', error)
        return []
    }
  }

  const personasFiltro = selPer ? personas.filter(p=>p.id===selPer) : personas
  const tareasVistaPer = selPer ? tareas.filter(t=>t.persona_id===selPer) : tareas
  const semanasDisponibles = generarSemanasDisponibles()

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando avances...</div>

  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,color:'#002F6C'}}>Avance Semanal</h1>
          <p style={{fontSize:12,color:'#94a3b8',marginTop:2}}>Registro de progreso por semana</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <select value={selPer} onChange={e=>setSelPer(e.target.value)} style={{padding:'8px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13,fontFamily:'inherit',maxWidth:200}}>
            <option value="">Todas las personas</option>
            {personas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        {personasFiltro.filter(p=>tareasVistaPer.some(t=>t.persona_id===p.id)).map(p=>{
          const tpers=tareasVistaPer.filter(t=>t.persona_id===p.id)
          const activas=tpers.filter(t=>t.estado!=='completada')
          const comp=tpers.filter(t=>t.estado==='completada')
          
          return (
            <div key={p.id} style={{background:'white',borderRadius:14,border:'1.5px solid #e2e8f0',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
              <div style={{padding:'14px 20px',borderBottom:'1px solid #e2e8f0',background:'#f8fafc',display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:38,height:38,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'white'}}>{p.nombre.charAt(0)}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:600}}>{p.nombre}</div>
                  <div style={{fontSize:11,color:'#94a3b8'}}>{p.rol==='SENATI'?`SENATI · ${p.subrol}`:p.subrol??p.rol}</div>
                </div>
                <div style={{display:'flex',gap:16}}>
                  <div style={{textAlign:'center'}}><div style={{fontSize:20,fontWeight:700,color:'#1d4ed8'}}>{activas.length}</div><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>Activas</div></div>
                  <div style={{textAlign:'center'}}><div style={{fontSize:20,fontWeight:700,color:'#15803d'}}>{comp.length}</div><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>Completadas</div></div>
                </div>
              </div>

              <div style={{padding:'16px 20px'}}>
                {activas.length>0 && (
                  <>
                    <div style={{fontSize:11,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:12}}>En Progreso / Pendientes</div>
                    {activas.map(t=>{
                      const avancesSemana = avancesPorSemana(t.id)
                      const ultimo = ultimoAv(t.id)
                      
                      return (
                        <div key={t.id} style={{marginBottom:16,padding:'14px',background:'#f8fafc',borderRadius:10,border:'1px solid #e2e8f0'}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
                            <span style={{fontSize:13,fontWeight:700,color:'#0f172a'}}>{t.titulo}</span>
                            <button onClick={()=>{setMTarea(t);setMPct(ultimo?.porcentaje??0);setMSem('');setModalAv(true)}}
                              style={{background:'#dbeafe',color:'#1d4ed8',border:'1px solid #93c5fd',borderRadius:7,padding:'5px 12px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                              + Registrar Avance
                            </button>
                          </div>
                          
                          {avancesSemana.length > 0 ? (
                            <div>
                              <div style={{fontSize:10,fontWeight:600,color:'#64748b',marginBottom:8,textTransform:'uppercase'}}>📊 Historial de Avances</div>
                              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                                {avancesSemana.map((av,idx)=>(
                                  <div key={idx} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',background:'white',borderRadius:8,border:'1px solid #e2e8f0'}}>
                                    <div style={{flex:1}}>
                                      <div style={{fontSize:11,fontWeight:600,color:'#002F6C'}}>
                                        {formatSemanaLabel(av.semana, av.created_at)}
                                      </div>
                                    </div>
                                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                                      <div style={{width:100,height:6,background:'#e2e8f0',borderRadius:10,overflow:'hidden'}}>
                                        <div style={{height:'100%',width:`${av.porcentaje}%`,background:av.porcentaje>=100?'#15803d':'#2563C8',borderRadius:10}}/>
                                      </div>
                                      <span style={{fontSize:12,fontWeight:700,color:av.porcentaje>=100?'#15803d':'#002F6C',minWidth:40,textAlign:'right'}}>{av.porcentaje}%</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div style={{padding:'12px',background:'white',borderRadius:8,border:'1px dashed #cbd5e1',textAlign:'center',color:'#94a3b8',fontSize:12}}>
                              Sin avances registrados aún
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </>
                )}

                {comp.length>0&&(
                  <details style={{marginTop:activas.length>0?16:0}}>
                    <summary style={{fontSize:12,fontWeight:600,color:'#15803d',cursor:'pointer',padding:'8px 0',userSelect:'none'}}>
                      ✅ {comp.length} tarea(s) completada(s) — ver
                    </summary>
                    <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:8}}>
                      {comp.map(t=>{
                        const ua=ultimoAv(t.id)
                        return (
                          <div key={t.id} style={{padding:'10px 12px',background:'#f0fdf4',borderRadius:9,border:'1px solid #86efac',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <span style={{fontSize:12,fontWeight:600,color:'#15803d'}}>{t.titulo}</span>
                            <span style={{fontSize:11,color:'#15803d',fontWeight:700}}>
                                100% · {ua?.semana ? formatSemanaLabel(ua.semana, ua.created_at) : '—'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </details>
                )}
                
                {activas.length===0 && comp.length===0 && (
                  <div style={{textAlign:'center',padding:32,color:'#94a3b8',fontSize:13}}>Sin tareas registradas</div>
                )}
              </div>
            </div>
          )
        })}
        
        {personasFiltro.filter(p=>tareasVistaPer.some(t=>t.persona_id===p.id)).length===0 && (
          <div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13}}>No hay personas o tareas para mostrar</div>
        )}
      </div>

      {modalAv&&mTarea&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={e=>{if(e.target===e.currentTarget)setModalAv(false)}}>
          <div style={{background:'white',borderRadius:18,padding:24,width:'100%',maxWidth:450,boxShadow:'0 24px 80px rgba(0,0,0,.25)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{fontSize:16,fontWeight:700,margin:0}}>Registrar avance</h3>
              <button onClick={()=>setModalAv(false)} style={{width:28,height:28,borderRadius:'50%',border:'none',background:'#f1f5f9',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            <div style={{marginBottom:14,padding:'10px 14px',background:'#eff6ff',borderRadius:9,fontSize:13,fontWeight:600,color:'#002F6C'}}>{mTarea.titulo}</div>
            
            <div style={{marginBottom:12}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Semana</label>
              <select 
                value={mSem} 
                onChange={e=>setMSem(e.target.value)}
                style={{width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontFamily:'inherit',fontSize:13,outline:'none'}}
              >
                <option value="">Seleccionar semana...</option>
                {semanasDisponibles.map((sem,idx)=>(
                  <option key={sem.key} value={sem.key}>
                    {sem.esAnterior ? '⬅️ ' : sem.esActual ? '📍 ' : ''}{sem.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{marginBottom:8}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',marginBottom:5,textTransform:'uppercase'}}>Avance: {mPct}%</label>
              <input type="range" min={0} max={100} step={5} value={mPct} onChange={e=>setMPct(+e.target.value)} style={{width:'100%',accentColor:'#002F6C'}}/>
            </div>
            <div style={{height:8,background:'#e2e8f0',borderRadius:10,overflow:'hidden',marginBottom:14}}>
              <div style={{height:'100%',width:`${mPct}%`,background:mPct>=100?'#15803d':'#2563C8',borderRadius:10,transition:'width .3s'}}/>
            </div>
            {mPct>=100&&<p style={{fontSize:12,color:'#15803d',fontWeight:600,textAlign:'center',marginBottom:12}}>✓ Se marcará como completada</p>}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setModalAv(false)} style={{padding:'8px 16px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'white',cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>Cancelar</button>
              <button onClick={guardar} disabled={saving||!mSem} style={{padding:'8px 18px',borderRadius:9,border:'none',background:'#002F6C',color:'white',cursor:(!mSem||saving)?'not-allowed':'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit',opacity:(!mSem||saving)?0.6:1}}>{saving?'Guardando...':'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}