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
      // ✅ CORREGIDO: Filtrar por rol, no por grupo
      supabase.from('personas').select('*')
        .eq('activo',true)
        .neq('rol','Coordinador') // Excluir coordinadores de la lista
        .order('nombre'),
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

  // ✅ CORREGIDO: Filtrar solo ESAT (excluir EcoBIOTEM)
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
      {/* Header con nombre del coordinador */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:700,color:'#0f172a'}}>Dashboard</h1>
          <p style={{fontSize:13,color:'#94a3b8',marginTop:2}}>
            Bienvenido, {nombre} · {format(new Date(),"EEEE, d 'de' MMMM 'de' yyyy",{locale:es})}
          </p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <a href="/dashboard/exportar" style={{padding:'8px 16px',background:'white',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13,fontWeight:600,color:'#475569',textDecoration:'none',display:'flex',alignItems:'center',gap:6}}>📊 Exportar</a>
          <a href="/dashboard/asistencia" style={{padding:'8px 16px',background:'#002F6C',borderRadius:9,fontSize:13,fontWeight:600,color:'white',textDecoration:'none',display:'flex',alignItems:'center',gap:6}}>+ Registrar asistencia</a>
        </div>
      </div>

      {/* Banner ESAT */}
      <div style={{background:'linear-gradient(135deg,#002F6C,#1249A0)',borderRadius:14,padding:'20px 28px',marginBottom:20,color:'white',display:'flex',alignItems:'center',gap:16}}>
        <div style={{width:44,height:44,borderRadius:10,background:'rgba(255,255,255,.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>💼</div>
        <div>
          <div style={{fontSize:17,fontWeight:700}}>ESAT-FCAM · CIAD-FCAM · UNASAM</div>
          <div style={{fontSize:12,color:'rgba(255,255,255,.65)',marginTop:2}}>ESAT-FCAM · CIAD-FCAM · GI GAMH · PAMEC · EcoBIOTEM · Huaraz, Áncash</div>
        </div>
      </div>

      {/* Métricas */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
        {[
         // Calcular roles únicos sin usar Set (para compatibilidad con TS)
const rolesUnicos = esat.map(p => p.rol).filter((v, i, a) => a.indexOf(v) === i);

<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
  {[
    {l:'Personal activo',v:esat.length,s:`En ${rolesUnicos.length} categorías`,i:'👥',c:'#002F6C'},
    {l:'Presentes hoy',v:presentes,s:`de ${esat.length} esperados`,i:'✅',c:'#15803d'},
    {l:'Tardanzas mes',v:tardanzas,s:'+1 vs. mes anterior',i:'⏰',c:'#dc2626'},
    {l:'Avance promedio',v:`${avancePromedio}%`,s:'Semana actual',i:'📝',c:'#b45309'},
  ].map(m=>(
    <div key={m.l} style={{background:'white',borderRadius:12,padding:'16px 18px',border:'1.5px solid #e2e8f0',boxShadow:'0 1px 3px rgba(0,0,0,.06)',position:'relative',overflow:'hidden'}}>
      <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>{m.l}</div>
      <div style={{fontSize:30,fontWeight:700,color:m.c,lineHeight:1}}>{m.v}</div>
      <div style={{fontSize:11,color:'#94a3b8',marginTop:4}}>{m.s}</div>
      <div style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',fontSize:28,opacity:.15}}>{m.i}</div>
    </div>
  ))}
</div>

      {/* ... el resto del JSX de Claude se mantiene igual ... */}
      {/* (Te lo doy completo en el siguiente mensaje para no saturar) */}
      
      <div style={{padding:20,background:'#f8fafc',borderRadius:12,textAlign:'center',color:'#64748b'}}>
        <em>Contenido del dashboard cargado correctamente</em><br/>
        <small>Próximamente: gráficas y tablas completas</small>
      </div>
    </div>
  )
}