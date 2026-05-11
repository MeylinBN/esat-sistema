'use client'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const NAV = [
  { href: '/dashboard',            icon: '📊', label: 'Dashboard'      },
  { href: '/dashboard/asistencia', icon: '✅', label: 'Asistencia'     },
  { href: '/dashboard/horarios',   icon: '🕐', label: 'Horarios'       },
  { href: '/dashboard/permisos',   icon: '📝', label: 'Permisos'       },
  { href: '/dashboard/avisos',     icon: '🔔', label: 'Avisos'         },
  { href: '/dashboard/tareas',     icon: '📌', label: 'Tareas'         },
  { href: '/dashboard/personas',   icon: '👥', label: 'Personas'       },
  { href: '/dashboard/exportar',   icon: '📤', label: 'Exportar'       },
  { href: '/dashboard/reportes',   icon: '📈', label: 'Reportes'       },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient() 

  async function logout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="sidebar">
      {/* Logo */}
      <div style={{ padding:'22px 18px 16px', borderBottom:'1px solid rgba(255,255,255,.1)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:'rgba(255,255,255,.12)',
            border:'1.5px solid rgba(255,255,255,.25)', display:'flex', alignItems:'center',
            justifyContent:'center', fontSize:20 }}>🏔</div>
          <div>
            <div style={{ fontFamily:'Lora,serif', fontSize:15, fontWeight:600, color:'#fff', lineHeight:1.2 }}>ESAT · CIAD</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,.5)', letterSpacing:'.1em', textTransform:'uppercase' }}>Sistema de Gestión</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding:'12px 10px', flex:1 }}>
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'9px 12px', borderRadius:9, marginBottom:2,
              background: active ? 'rgba(255,255,255,.15)' : 'transparent',
              border: active ? '1px solid rgba(255,255,255,.2)' : '1px solid transparent',
              color: active ? '#fff' : 'rgba(255,255,255,.65)',
              fontSize:13, fontWeight: active ? 600 : 400,
              textDecoration:'none', transition:'all .15s',
            }}>
              <span style={{ fontSize:15 }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding:'12px 10px', borderTop:'1px solid rgba(255,255,255,.1)' }}>
        <button onClick={logout} style={{
          width:'100%', display:'flex', alignItems:'center', gap:10,
          padding:'9px 12px', borderRadius:9, border:'1px solid rgba(255,255,255,.15)',
          background:'transparent', color:'rgba(255,255,255,.6)', fontSize:13,
          cursor:'pointer', fontFamily:'inherit',
        }}>
          <span>🚪</span> Cerrar sesión
        </button>
      </div>
    </div>
  )
}
