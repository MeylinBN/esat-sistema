'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfWeek, addDays } from 'date-fns'
import { es } from 'date-fns/locale'

const DIAS_SEMANA = ['L','M','X','J','V']
const DIAS_LABEL  = ['Lun','Mar','Mié','Jue','Vie']

interface DashboardClientProps {
  nombre: string
}

export default function DashboardClient({ nombre }: DashboardClientProps) {
  const supabase = createClient()
  const hoy = format(new Date(),'yyyy-MM-dd')

  const [personas,    setPersonas]    = useState<any[]>([])
  const [asistHoy,    setAsistHoy]    = useState<any[]>([])
  const [asistSemana, setAsistSemana] = useState<any[]>([])
  const [avisos,      setAvisos]      = useState<any[]>([])
  const [tareas,      setTareas]      = useState<any[]>([])
  const [avances,     setAvances]     = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)

  useEffect(()=>{load()},[])

  async function load(){
    const lunes = format(startOfWeek(new Date(),{weekStartsOn:1}),'yyyy-MM-dd')
    const viernes = format(addDays(startOfWeek(new Date(),{weekStartsOn:1}),4),'yyyy-MM-dd')
    
    const [p,ah,as,av,t,avs] = await Promise.all([
      supabase.from('personas').select('*').eq('activo',true).neq('rol','Coordinador').order('nombre'),
      supabase.from('asistencias').select('*').eq('fecha',hoy),
      supabase.from('asistencias').select('*').gte('fecha',lunes).lte('fecha',viernes),
      supabase.from('avisos').select('*').order('created_at',{ascending:false}).limit(5),
      supabase.from('tareas').select('*').neq('estado','cancelada'),
      supabase.from('avances_semanales').select('*'),
    ])
    setPersonas(p.data??[])
    setAsistHoy(ah.data??[])
    setAsistSemana(as.data??[])
    setAvisos(av.data??[])
    setTareas(t.data??[])
    setAvances(avs.data??[])
    setLoading(false)
  }

  // Filtro ESAT (excluir EcoBIOTEM y Coordinadores)
  const esat = (personas??[]).filter(p=>p.rol!=='EcoBIOTEM' && p.rol!=='Coordinador')
  const presentes = asistHoy.filter(a=>['presente','tarde'].includes(a.estado)).length
  const tardanzas = asistHoy.filter(a=>a.estado==='tarde').length

  // Avance promedio de tareas activas
  const tareasActivas = tareas.filter(t=>t.estado==='en_progreso')
  const avancePromedio = tareasActivas.length===0 ? 0 : Math.round(
    tareasActivas.reduce((acc,t)=>{
      const ua = avances.filter(a=>a.tarea_id===t.id).sort((a:any,b:any)=>b.semana.localeCompare(a.semana))[0]
      return acc+(ua?.porcentaje??0)
    },0)/tareasActivas.length
  )

  // Datos gráfica semanal por día
  const lunes0 = startOfWeek(new Date(),{weekStartsOn:1})
  const datosSemana = DIAS_SEMANA.map((_,i)=>{
    const fecha = format(addDays(lunes0,i),'yyyy-MM-dd')
    const del_dia = asistSemana.filter(a=>a.fecha===fecha)
    const practica = del_dia.filter(a=>{const p=personas.find(x=>x.id===a.persona_id);return p?.rol==='Practicante'})
    const senati   = del_dia.filter(a=>{const p=personas.find(x=>x.id===a.persona_id);return p?.rol==='SENATI'})
    const volunt   = del_dia.filter(a=>{const p=personas.find(x=>x.id===a.persona_id);return p?.rol==='Voluntario'})
    return {practica:practica.length, senati:senati.length, volunt:volunt.length, total:del_dia.length}
  })
  const maxBar = Math.max(...datosSemana.map(d=>d.total),1)

  // Contar roles únicos sin usar Set
  const rolesUnicos = esat.map(p => p.rol).filter((v, i, a) => a.indexOf(v) === i);

  const AVISO_CFG: Record<string,{bg:string,txt:string,border:string}> = {
    permiso:     {bg:'#f3e8ff',txt:'#7c3aed',border:'#7c3aed'},
    anuncio:     {bg:'#dcfce7',txt:'#15803d',border:'#15803d'},
    urgente:     {bg:'#fee2e2',txt:'#b91c1c',border:'#b91c1c'},
    horario:     {bg:'#dbeafe',txt:'#1d4ed8',border:'#1d4ed8'},
    recordatorio:{bg:'#fef3c7',txt:'#b45309',border:'#d97706'},
  }

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando dashboard...</div>

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:700,color:'#0f172a'}}>Dashboard</h1>
          <p style={{fontSize:13,color:'#94a3b8',marginTop:2}}>
  Bienvenido, {nombre} · {format(new Date(),"EEEE d 'de' MMMM 'del' yyyy",{locale:es})}
</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <a href="/dashboard/exportar" style={{padding:'8px 16px',background:'white',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13,fontWeight:600,color:'#475569',textDecoration:'none',display:'flex',alignItems:'center',gap:6}}>📊 Exportar</a>
          <a href="/dashboard/asistencia" style={{padding:'8px 16px',background:'#002F6C',borderRadius:9,fontSize:13,fontWeight:600,color:'white',textDecoration:'none',display:'flex',alignItems:'center',gap:6}}>+ Registrar asistencia</a>
        </div>
      </div>

      {/* Banner ESAT */}
      {/* Banner - Puntos 5 y 7 */}
<div style={{background:'linear-gradient(135deg,#002F6C,#1249A0)',borderRadius:14,padding:'20px 28px',marginBottom:20,color:'white',display:'flex',alignItems:'center',gap:16}}>
  <div style={{width:44,height:44,borderRadius:10,background:'rgba(255,255,255,.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>💼</div>
  <div>
    <div style={{fontSize:15,fontWeight:700,lineHeight:1.3}}>
      Sistema Integral de Gestión de Asistencias y Actividades del Equipo
    </div>
    <div style={{fontSize:12,color:'rgba(255,255,255,.65)',marginTop:4}}>
      Equipo Técnico y Administrativo · Huaraz, Áncash
    </div>
  </div>
</div>

      {/* Métricas */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
        {[
          {l:'Personal activo',v:esat.length,s:`En ${rolesUnicos.length} categorías`,i:'👥',c:'#002F6C'},
          {l:'Presentes hoy',v:presentes,s:`de ${esat.length} esperados`,i:'✅',c:'#15803d'},
          {l:'Tardanzas mes',v:tardanzas,s:'+1 vs. mes anterior',i:'',c:'#dc2626'},
          {l:'Avance promedio',v:`${avancePromedio}%`,s:'Semana actual',i:'',c:'#b45309'},
        ].map(m=>(
          <div key={m.l} style={{background:'white',borderRadius:12,padding:'16px 18px',border:'1.5px solid #e2e8f0',boxShadow:'0 1px 3px rgba(0,0,0,.06)',position:'relative',overflow:'hidden'}}>
            <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>{m.l}</div>
            <div style={{fontSize:30,fontWeight:700,color:m.c,lineHeight:1}}>{m.v}</div>
            <div style={{fontSize:11,color:'#94a3b8',marginTop:4}}>{m.s}</div>
            <div style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',fontSize:28,opacity:.15}}>{m.i}</div>
          </div>
        ))}
      </div>

      {/* Gráficas */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        {/* Gráfica asistencia semanal */}
        <div style={{background:'white',borderRadius:14,border:'1.5px solid #e2e8f0',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
          <div style={{fontSize:14,fontWeight:600,color:'#0f172a',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#002F6C'}}/>
            Asistencia semanal
          </div>
          <div style={{display:'flex',alignItems:'flex-end',gap:8,height:180,padding:'0 8px'}}>
            {datosSemana.map((d,i)=>(
              <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,height:'100%',justifyContent:'flex-end'}}>
                <div style={{width:'100%',display:'flex',flexDirection:'column',borderRadius:'6px 6px 0 0',overflow:'hidden',height:`${Math.round(d.total/maxBar*160)}px`,minHeight:d.total>0?4:0}}>
                  <div style={{background:'#002F6C',flex:d.practica,minHeight:d.practica>0?2:0}}/>
                  <div style={{background:'#c9a227',flex:d.senati,minHeight:d.senati>0?2:0}}/>
                  <div style={{background:'#15803d',flex:d.volunt,minHeight:d.volunt>0?2:0}}/>
                </div>
                <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>{DIAS_LABEL[i]}</span>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:14,marginTop:12,flexWrap:'wrap'}}>
            {[['#002F6C','Practicante'],['#c9a227','SENATI'],['#15803d','Voluntario'],['#7c3aed','EcoBIOTEM']].map(([c,l])=>(
              <div key={l} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#475569'}}>
                <div style={{width:10,height:10,borderRadius:2,background:c as string}}/>
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* Avance por área */}
        <div style={{background:'white',borderRadius:14,border:'1.5px solid #e2e8f0',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
          <div style={{fontSize:14,fontWeight:600,color:'#0f172a',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#d97706'}}/>
            Avance por área
          </div>
          {(['Ambiental','Sistemas','Técnico','General'] as string[]).map(area=>{
            const pArea=esat.filter(p=>p.area===area)
            if(!pArea.length) return null
            const tArea=tareas.filter(t=>pArea.some(p=>p.id===t.persona_id)&&t.estado==='en_progreso')
            const prom=tArea.length===0?0:Math.round(tArea.reduce((acc,t)=>{
              const ua=avances.filter(a=>a.tarea_id===t.id).sort((a:any,b:any)=>b.semana.localeCompare(a.semana))[0]
              return acc+(ua?.porcentaje??0)
            },0)/tArea.length)
            return (
              <div key={area} style={{marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5}}>
                  <span style={{fontWeight:500,color:'#475569'}}>{area}</span>
                  <span style={{fontWeight:600,color:'#002F6C'}}>{prom}%</span>
                </div>
                <div style={{height:8,background:'#f1f5f9',borderRadius:10,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${prom}%`,background:'#002F6C',borderRadius:10,transition:'width .4s'}}/>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Estado del equipo y Avisos */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {/* Estado del equipo */}
        <div style={{background:'white',borderRadius:14,border:'1.5px solid #e2e8f0',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
          <div style={{fontSize:14,fontWeight:600,color:'#0f172a',marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#15803d'}}/>
            Estado del equipo hoy
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:380,overflowY:'auto'}}>
            {esat.map(p=>{
              const a=asistHoy.find(x=>x.persona_id===p.id)
              const COLOR: Record<string,string>={presente:'#15803d',tarde:'#d97706',ausente:'#dc2626',permiso:'#7c3aed',sin_registrar:'#94a3b8'}
              const estado=a?.estado??'sin_registrar'
              return (
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:9,background:'#f8fafc',border:'1px solid #e2e8f0'}}>
                  <div style={{width:32,height:32,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white',flexShrink:0}}>{p.nombre.charAt(0)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.nombre}</div>
                    <div style={{fontSize:10,color:'#94a3b8'}}>{p.rol==='Practicante'?`Practicante UNASAM · ${p.subrol||''}`:p.rol==='SENATI'?`Practicante SENATI · ${p.subrol||''}`:p.rol} · {p.area||''}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:COLOR[estado]??'#94a3b8'}}/>
                    <span style={{fontSize:11,color:COLOR[estado]??'#94a3b8',fontWeight:500}}>{a?.hora_entrada?.slice(0,5)??'—'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Avisos recientes */}
        <div style={{background:'white',borderRadius:14,border:'1.5px solid #e2e8f0',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
          <div style={{fontSize:14,fontWeight:600,color:'#0f172a',marginBottom:14,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:8,height:8,borderRadius:'50%',background:'#dc2626'}}/>Avisos recientes</span>
            <a href="/dashboard/avisos" style={{fontSize:11,color:'#002F6C',textDecoration:'none',fontWeight:500}}>Ver todos →</a>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {avisos.map(a=>{
              const cfg=AVISO_CFG[a.tipo]??AVISO_CFG.anuncio
              return (
                <div key={a.id} style={{padding:'10px 14px',background:'white',borderRadius:9,border:'1px solid #e2e8f0',borderLeft:`3px solid ${cfg.border}`}}>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:cfg.txt,marginBottom:4}}>{a.tipo}</div>
                  <div style={{fontSize:12,fontWeight:600,color:'#0f172a',marginBottom:2}}>{a.titulo}</div>
                  {a.fecha_evento&&<div style={{fontSize:10,color:'#94a3b8'}}>{a.fecha_evento} · Coord. Logístico</div>}
                </div>
              )
            })}
            {!avisos.length&&<p style={{fontSize:13,color:'#94a3b8',textAlign:'center',padding:'16px 0'}}>Sin avisos recientes</p>}
          </div>
        </div>
      </div>
    </div>
  )
}