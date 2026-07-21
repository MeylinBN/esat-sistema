'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function CargaLaboralPage() {
  const supabase = createClient()
  const [personas, setPersonas] = useState<any[]>([])
  const [tareas,   setTareas]   = useState<any[]>([])
  const [horarios, setHorarios] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(()=>{
    async function load(){
      const [p,t,h]=await Promise.all([
        supabase.from('personas').select('*').eq('activo',true).order('nombre'),
        supabase.from('tareas').select('*'),
        supabase.from('horarios').select('*'),
      ])
      setPersonas(p.data??[]);setTareas(t.data??[]);setHorarios(h.data??[])
      setLoading(false)
    }
    load()
  },[])

  function horasSemanales(pid:string){
    return horarios.filter(h=>h.persona_id===pid).reduce((acc,h)=>{
      const [he,me]=h.hora_entrada.split(':').map(Number)
      const [hs,ms]=h.hora_salida.split(':').map(Number)
      return acc+((hs*60+ms)-(he*60+me))/60
    },0)
  }

  function tareasActivas(pid:string){return tareas.filter(t=>t.persona_id===pid&&t.estado==='en_progreso')}
  function horasAsignadas(pid:string){
    return tareasActivas(pid).reduce((acc,t)=>acc+(t.horas_estimadas??0),0)
  }

  const esat=personas.filter(p=>p.grupo==='ESAT')

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando carga laboral...</div>

  return (
    <div>
      <div style={{marginBottom:22}}>
        <h1 style={{fontFamily:'Lora,serif',fontSize:24,color:'#002F6C',fontWeight:600}}>Carga Laboral</h1>
        <p style={{fontSize:12,color:'#475569',marginTop:3}}>Horas de horario vs horas asignadas en tareas activas</p>
      </div>

      <div className="card" style={{marginBottom:20}}>
        <div className="card-body">
          <div className="card-title"><span className="dot" style={{background:'#002F6C'}}/>Distribución de carga por persona</div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'#f8fafc'}}>
                  {['Persona','Rol','Hrs/semana (horario)','Tareas activas','Hrs asignadas','Carga estimada'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:'#475569',textTransform:'uppercase',letterSpacing:'.06em',borderBottom:'2px solid #e2e8f0'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {esat.map((p,i)=>{
                  const hs=horasSemanales(p.id)
                  const ta=tareasActivas(p.id)
                  const ha=horasAsignadas(p.id)
                  const pct=hs>0?Math.min(100,Math.round(ha/hs*100)):0
                  const color=pct>100?'#b91c1c':pct>80?'#d97706':'#15803d'
                  return (
                    <tr key={p.id} style={{background:i%2===0?'white':'#f8fafc'}}>
                      <td style={{padding:'10px 14px',borderBottom:'1px solid #e2e8f0'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:28,height:28,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white'}}>{p.nombre.charAt(0)}</div>
                          <span style={{fontSize:12,fontWeight:600}}>{p.nombre}</span>
                        </div>
                      </td>
                      <td style={{padding:'10px 14px',borderBottom:'1px solid #e2e8f0',fontSize:11,color:'#94a3b8'}}>
                        {p.origen==='SENATI'?`SENATI · ${p.subrol}`:p.rol==='Practicante'?`Prac. · ${p.subrol}`:p.rol}
                      </td>
                      <td style={{padding:'10px 14px',borderBottom:'1px solid #e2e8f0',fontSize:12,fontWeight:600,color:'#002F6C'}}>{hs.toFixed(1)}h</td>
                      <td style={{padding:'10px 14px',borderBottom:'1px solid #e2e8f0',fontSize:12,fontWeight:600}}>{ta.length}</td>
                      <td style={{padding:'10px 14px',borderBottom:'1px solid #e2e8f0',fontSize:12,fontWeight:600}}>{ha}h</td>
                      <td style={{padding:'10px 14px',borderBottom:'1px solid #e2e8f0'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{flex:1,height:8,background:'#e2e8f0',borderRadius:10,overflow:'hidden',minWidth:80}}>
                            <div style={{height:'100%',width:`${Math.min(100,pct)}%`,background:color,borderRadius:10,transition:'width .4s'}}/>
                          </div>
                          <span style={{fontSize:12,fontWeight:700,color,minWidth:38}}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Resumen por rol */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:14}}>
        {[
          {rol:'Practicante', match:(p:any)=>p.rol==='Practicante' && p.origen!=='SENATI'},
          {rol:'SENATI',       match:(p:any)=>p.origen==='SENATI'},
          {rol:'Voluntario',   match:(p:any)=>p.rol==='Voluntario'},
          {rol:'Asistente',    match:(p:any)=>p.rol==='Asistente'},
        ].map(({rol,match})=>{
          const gp=esat.filter(match)
          if(!gp.length) return null
          const totalHs=gp.reduce((a,p)=>a+horasSemanales(p.id),0)
          const totalTareas=gp.reduce((a,p)=>a+tareasActivas(p.id).length,0)
          return (
            <div key={rol} className="card">
              <div className="card-body">
                <div style={{fontSize:13,fontWeight:600,marginBottom:10,color:'#002F6C'}}>{rol}s</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <div style={{textAlign:'center',padding:'10px',background:'#eff6ff',borderRadius:9}}>
                    <div style={{fontSize:22,fontWeight:700,color:'#002F6C'}}>{gp.length}</div>
                    <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase'}}>Personas</div>
                  </div>
                  <div style={{textAlign:'center',padding:'10px',background:'#f0fdf4',borderRadius:9}}>
                    <div style={{fontSize:22,fontWeight:700,color:'#15803d'}}>{totalTareas}</div>
                    <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase'}}>Tareas activas</div>
                  </div>
                </div>
                <div style={{marginTop:8,textAlign:'center',fontSize:12,color:'#475569'}}>Total horas semana: <strong>{totalHs.toFixed(1)}h</strong></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
