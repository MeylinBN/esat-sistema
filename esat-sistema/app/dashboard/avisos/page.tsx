'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, isSameDay, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const TIPO_CFG: Record<string,{bg:string,txt:string,border:string,label:string}> = {
  permiso:      {bg:'#f3e8ff',txt:'#7c3aed',border:'#a855f7',label:'PERMISO'},
  anuncio:      {bg:'#dcfce7',txt:'#15803d',border:'#86efac',label:'ANUNCIO'},
  urgente:      {bg:'#fee2e2',txt:'#b91c1c',border:'#fca5a5',label:'URGENTE'},
  horario:      {bg:'#dbeafe',txt:'#1d4ed8',border:'#93c5fd',label:'HORARIO'},
  recordatorio: {bg:'#fef3c7',txt:'#b45309',border:'#fde68a',label:'RECORDA.'},
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function AvisosPage() {
  const supabase = createClient()
  const [avisos, setAvisos]   = useState<any[]>([])
  const [loading,setLoading]  = useState(true)
  const [filtro, setFiltro]   = useState('Todos')
  const [mesVer, setMesVer]   = useState(new Date().getMonth())
  const [anioVer,setAnioVer]  = useState(new Date().getFullYear())
  const [modal,  setModal]    = useState(false)
  const [mTipo,  setMTipo]    = useState('anuncio')
  const [mTitulo,setMTitulo]  = useState('')
  const [mDesc,  setMDesc]    = useState('')
  const [mDest,  setMDest]    = useState('todos')
  const [mFecha, setMFecha]   = useState('')
  const [saving, setSaving]   = useState(false)

  useEffect(()=>{load()},[])

  async function load(){
    const {data}=await supabase.from('avisos').select('*').order('created_at',{ascending:false})
    setAvisos(data??[])
    setLoading(false)
  }

  async function guardar(){
    if(!mTitulo) return
    setSaving(true)
    await supabase.from('avisos').insert({tipo:mTipo,titulo:mTitulo,descripcion:mDesc,destinatario:mDest,fecha_evento:mFecha||null,urgente:mTipo==='urgente'})
    setModal(false);setMTitulo('');setMDesc('');setMFecha('');setSaving(false);load()
  }

  async function eliminar(id:string){
    if(!confirm('¿Eliminar este aviso?')) return
    await supabase.from('avisos').delete().eq('id',id);load()
  }

  const TABS = ['Todos','Horarios','Permisos','Anuncios','Urgentes']
  const filtrados = avisos.filter(a=>{
    if(filtro==='Todos') return true
    if(filtro==='Horarios')  return a.tipo==='horario'
    if(filtro==='Permisos')  return a.tipo==='permiso'
    if(filtro==='Anuncios')  return a.tipo==='anuncio'
    if(filtro==='Urgentes')  return a.urgente
    return true
  })

  // Calendario
  const diasEnMes = new Date(anioVer,mesVer+1,0).getDate()
  const primerDia = new Date(anioVer,mesVer,1).getDay()
  const avisosConFecha = avisos.filter(a=>a.fecha_evento)

  function avisosDelDia(dia:number){
    return avisosConFecha.filter(a=>{
      const f=parseISO(a.fecha_evento+'T12:00:00')
      return f.getDate()===dia&&f.getMonth()===mesVer&&f.getFullYear()===anioVer
    })
  }

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Cargando avisos...</div>

  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Lora,serif',fontSize:24,color:'#002F6C',fontWeight:600}}>Avisos y comunicados</h1>
          <p style={{fontSize:12,color:'#475569',marginTop:3}}>Cambios de horario, permisos, anuncios generales</p>
        </div>
        <button className="btn btn-p" onClick={()=>setModal(true)}>+ Nuevo aviso</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16,alignItems:'start'}}>
        {/* Lista */}
        <div>
          {/* Tabs */}
          <div style={{display:'flex',gap:4,marginBottom:16,background:'white',padding:4,borderRadius:10,border:'1px solid #e2e8f0',width:'fit-content'}}>
            {TABS.map(t=>(
              <button key={t} onClick={()=>setFiltro(t)}
                style={{padding:'6px 14px',borderRadius:8,border:'none',fontSize:12,fontWeight:filtro===t?600:400,cursor:'pointer',fontFamily:'inherit',
                  background:filtro===t?'#002F6C':'transparent',color:filtro===t?'white':'#475569',transition:'all .15s'}}>
                {t}
              </button>
            ))}
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {filtrados.map(a=>{
              const cfg=TIPO_CFG[a.tipo]??TIPO_CFG.anuncio
              return (
                <div key={a.id} style={{background:'white',border:`1px solid ${cfg.border}`,borderLeft:`4px solid ${cfg.txt}`,borderRadius:12,padding:'14px 18px',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                        <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:cfg.bg,color:cfg.txt}}>{cfg.label}</span>
                        {a.urgente&&<span style={{fontSize:10,fontWeight:700,color:'#b91c1c'}}>🔴 URGENTE</span>}
                      </div>
                      <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{a.titulo}</div>
                      {a.descripcion&&<div style={{fontSize:12,color:'#475569',lineHeight:1.6,marginBottom:6}}>{a.descripcion}</div>}
                      <div style={{display:'flex',gap:14,fontSize:10,color:'#94a3b8',flexWrap:'wrap'}}>
                        {a.fecha_evento&&<span>📅 {format(parseISO(a.fecha_evento+'T12:00:00'),"d 'de' MMM yyyy",{locale:es})}</span>}
                        <span>🕐 {format(new Date(a.created_at),"d MMM · HH:mm",{locale:es})}</span>
                        <span>👥 {a.destinatario==='todos'?'Todo el equipo':a.destinatario}</span>
                      </div>
                    </div>
                    <button onClick={()=>eliminar(a.id)} style={{background:'#fee2e2',border:'none',color:'#b91c1c',borderRadius:7,padding:'4px 8px',cursor:'pointer',fontSize:11,fontWeight:600,flexShrink:0,fontFamily:'inherit'}}>Eliminar</button>
                  </div>
                </div>
              )
            })}
            {!filtrados.length&&<div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13}}>Sin avisos en esta categoría</div>}
          </div>
        </div>

        {/* Calendario */}
        <div className="card" style={{position:'sticky',top:24}}>
          <div className="card-body">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <span style={{fontWeight:700,fontSize:13,color:'#002F6C'}}>● Calendario</span>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <button onClick={()=>{if(mesVer===0){setMesVer(11);setAnioVer(anioVer-1)}else setMesVer(mesVer-1)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,color:'#94a3b8'}}>‹</button>
                <span style={{fontSize:12,fontWeight:600,textTransform:'capitalize'}}>{MESES[mesVer]} {anioVer}</span>
                <button onClick={()=>{if(mesVer===11){setMesVer(0);setAnioVer(anioVer+1)}else setMesVer(mesVer+1)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,color:'#94a3b8'}}>›</button>
              </div>
            </div>
            {/* Leyenda */}
            <div style={{display:'flex',gap:10,marginBottom:10,flexWrap:'wrap'}}>
              {[['#dbeafe','Horario'],['#f3e8ff','Permiso'],['#fee2e2','Urgente'],['#dcfce7','Anuncio']].map(([c,l])=>(
                <div key={l} style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:'#475569'}}>
                  <div style={{width:10,height:10,borderRadius:2,background:c as string}}/>
                  {l}
                </div>
              ))}
            </div>
            {/* Días semana */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:4}}>
              {['L','M','M','J','V','S','D'].map((d,i)=>(
                <div key={i} style={{textAlign:'center',fontSize:10,fontWeight:600,color:'#94a3b8',padding:'4px 0'}}>{d}</div>
              ))}
            </div>
            {/* Días */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
              {Array.from({length:(primerDia===0?6:primerDia-1)}).map((_,i)=><div key={`e${i}`}/>)}
              {Array.from({length:diasEnMes}).map((_,i)=>{
                const dia=i+1
                const avisosD=avisosDelDia(dia)
                const esHoy=new Date().getDate()===dia&&new Date().getMonth()===mesVer&&new Date().getFullYear()===anioVer
                const tipoColor=avisosD.length>0?(TIPO_CFG[avisosD[0].tipo]?.bg??'#f3e8ff'):undefined
                return (
                  <div key={dia} title={avisosD.map(a=>a.titulo).join('\n')}
                    style={{textAlign:'center',padding:'5px 2px',borderRadius:6,fontSize:12,fontWeight:esHoy?700:400,
                      background:esHoy?'#002F6C':tipoColor??'transparent',
                      color:esHoy?'white':avisosD.length>0?TIPO_CFG[avisosD[0].tipo]?.txt??'#374151':'#374151',
                      cursor:avisosD.length>0?'help':'default',minHeight:28,display:'flex',alignItems:'center',justifyContent:'center',
                      border:esHoy?'none':'1px solid transparent'}}>
                    {dia}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {modal&&(
        <div className="mo" onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div className="mo-box">
            <div className="mo-head"><h3>Nuevo aviso</h3><button className="mo-close" onClick={()=>setModal(false)}>×</button></div>
            <div className="ig" style={{marginBottom:12}}>
              <label>Tipo</label>
              <select value={mTipo} onChange={e=>setMTipo(e.target.value)}>
                {Object.entries({anuncio:'Anuncio',permiso:'Permiso / Falta',horario:'Cambio de horario',recordatorio:'Recordatorio',urgente:'URGENTE'}).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="ig" style={{marginBottom:12}}>
              <label>Título</label>
              <input value={mTitulo} onChange={e=>setMTitulo(e.target.value)} placeholder="Título del aviso"/>
            </div>
            <div className="ig" style={{marginBottom:12}}>
              <label>Descripción</label>
              <textarea value={mDesc} onChange={e=>setMDesc(e.target.value)} rows={3} placeholder="Detalla el aviso..."/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
              <div className="ig"><label>Destinatario</label>
                <select value={mDest} onChange={e=>setMDest(e.target.value)}>
                  <option value="todos">Todo el equipo</option>
                  <option value="Practicante">Practicantes</option>
                  <option value="SENATI">SENATI</option>
                  <option value="Voluntario">Voluntarios</option>
                  <option value="Asistente">Asistentes</option>
                  <option value="EcoBIOTEM">EcoBIOTEM</option>
                </select>
              </div>
              <div className="ig"><label>Fecha del evento</label><input type="date" value={mFecha} onChange={e=>setMFecha(e.target.value)}/></div>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-s" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={guardar} disabled={saving||!mTitulo}>{saving?'Guardando...':'Publicar aviso'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
