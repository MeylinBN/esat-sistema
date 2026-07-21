'use client'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const NAV_PRINCIPAL = [
  {href:'/dashboard',            icon:'📊', label:'Dashboard'},
  {href:'/dashboard/asistencia', icon:'✅', label:'Asistencia'},
  {href:'/dashboard/avisos',     icon:'🔔', label:'Avisos'},
]
const NAV_GESTION = [
  {href:'/dashboard/avance-semanal',  icon:'📈', label:'Avances'},
  {href:'/dashboard/horas-acumuladas',icon:'⏱',  label:'Horas acumuladas'},
  {href:'/dashboard/horarios',        icon:'🕐', label:'Horarios'},
  {href:'/dashboard/permisos',        icon:'📝', label:'Permisos / Faltas'},
  {href:'/dashboard/tareas',          icon:'📌', label:'Tareas'},
]
const NAV_ADMIN = [
  {href:'/dashboard/personas', icon:'👥', label:'Personal'},
  {href:'/dashboard/exportar', icon:'📤', label:'Exportar'},
]

function NavLink({href,icon,label}:{href:string,icon:string,label:string}){
  const pathname=usePathname()
  const active=pathname===href||(href!=='/dashboard'&&pathname.startsWith(href))
  return (
    <Link href={href} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:9,marginBottom:1,
      background:active?'rgba(255,255,255,.15)':'transparent',
      border:active?'1px solid rgba(255,255,255,.2)':'1px solid transparent',
      color:active?'#fff':'rgba(255,255,255,.65)',fontSize:13,fontWeight:active?600:400,
      textDecoration:'none',transition:'all .15s'}}>
      <span style={{fontSize:15}}>{icon}</span>{label}
    </Link>
  )
}

export default function Sidebar(){
  const router=useRouter()
  const pathname = usePathname()
  const supabase=createClient()
  const [usuario, setUsuario] = useState<any>(null)
  
  useEffect(() => {
    async function cargarUsuario() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          console.error('Error obteniendo usuario:', userError)
          return
        }
        
       const { data: userData, error: dataError } = await supabase
  .from('personas')
  .select('nombre, rol')
  .eq('auth_id', user.id)
  .single()
          
        if (dataError) {
          console.error('Error obteniendo datos:', dataError)
          return
        }
        
        setUsuario(userData)
      } catch (err) {
        console.error('Error en cargarUsuario:', err)
      }
    }
    cargarUsuario()
  }, []) // ← Sin dependencias para evitar re-renders

  async function logout(){await supabase.auth.signOut();router.push('/auth/login')}

  return (
    <div className="sidebar">
      {/* Logo */}
      <div style={{padding:'22px 18px 16px',borderBottom:'1px solid rgba(255,255,255,.1)'}}>
  <div style={{display:'flex',alignItems:'center',gap:10}}>
    <div style={{width:38,height:38,borderRadius:10,background:'rgba(255,255,255,.12)',border:'1.5px solid rgba(255,255,255,.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>📊</div>
    <div>
      <div style={{fontFamily:'Lora,serif',fontSize:14,fontWeight:700,color:'#fff',lineHeight:1.2}}>SIGAAE · ESAT</div>
      <div style={{fontSize:8,color:'rgba(255,255,255,.6)',marginTop:2}}>Sistema Integral de Gestión</div>
    </div>
  </div>
</div>
      
      {/* Usuario Logueado */}
      {usuario && (
        <div style={{padding:'14px 18px',background:'rgba(255,255,255,.05)',borderBottom:'1px solid rgba(255,255,255,.1)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg, #10b981, #059669)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'white',boxShadow:'0 2px 8px rgba(16, 185, 129, .3)'}}>
              {usuario.nombre?.charAt(0).toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                {usuario.nombre}
              </div>
              <div style={{fontSize:9,color:'rgba(255,255,255,.5)',textTransform:'capitalize'}}>
                {usuario.rol?.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>
      )}

      <nav style={{padding:'12px 10px',flex:1,overflowY:'auto'}}>
        <div style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,.35)',letterSpacing:'.12em',textTransform:'uppercase',padding:'4px 12px 8px'}}>PRINCIPAL</div>
        {NAV_PRINCIPAL.map(n=><NavLink key={n.href} {...n}/>)}

        <div style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,.35)',letterSpacing:'.12em',textTransform:'uppercase',padding:'14px 12px 8px'}}>GESTIÓN</div>
        {NAV_GESTION.map(n=><NavLink key={n.href} {...n}/>)}

        <div style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,.35)',letterSpacing:'.12em',textTransform:'uppercase',padding:'14px 12px 8px'}}>ADMINISTRACIÓN</div>
        {NAV_ADMIN.map(n=><NavLink key={n.href} {...n}/>)}
      </nav>

      <div style={{padding:'12px 10px',borderTop:'1px solid rgba(255,255,255,.1)'}}>
        <button onClick={logout} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,.15)',background:'transparent',color:'rgba(255,255,255,.6)',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
          <span>🚪</span> Cerrar sesión
        </button>
      </div>
    </div>
  )
}