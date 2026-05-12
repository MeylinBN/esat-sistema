import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Obtener usuario
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  // Obtener TODAS las cookies para debug
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  
  console.log('🍪 Cookies:', allCookies.length)
  console.log('👤 User:', user?.email)
  console.log('👤 User ID:', user?.id)
  console.log('❌ User Error:', userError)
  
  if (!user) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f1f5f9',
        padding: 40
      }}>
        <div style={{
          background: 'white',
          padding: 32,
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          maxWidth: 500,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
            No hay sesión activa
          </h1>
          <p style={{ color: '#64748b', marginBottom: 24 }}>
            El sistema no pudo verificar tu sesión. Esto puede deberse a:
          </p>
          <ul style={{ 
            textAlign: 'left', 
            color: '#475569', 
            lineHeight: 2,
            marginBottom: 24,
            paddingLeft: 20
          }}>
            <li>Cookies bloqueadas por el navegador</li>
            <li>Sesión expirada</li>
            <li>Problemas de configuración en Supabase</li>
          </ul>
          <div style={{ 
            background: '#f8fafc', 
            padding: 16, 
            borderRadius: 8, 
            textAlign: 'left',
            marginBottom: 24,
            fontSize: 12,
            fontFamily: 'monospace'
          }}>
            <strong>User Error:</strong> {userError?.message || 'Ninguno'}<br/>
            <strong>Cookies encontradas:</strong> {allCookies.length}
          </div>
          <a 
            href="/auth/login"
            style={{
              display: 'inline-block',
              padding: '12px 32px',
              background: '#002F6C',
              color: 'white',
              textDecoration: 'none',
              borderRadius: 8,
              fontWeight: 600
            }}
          >
            Volver al login →
          </a>
        </div>
      </div>
    )
  }
  
  // Si hay usuario, mostrar datos básicos
  const { data: persona } = await supabase
    .from('personas')
    .select('*')
    .eq('auth_id', user.id)
    .single()
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f1f5f9',
      padding: 40
    }}>
      <div style={{
        maxWidth: 800,
        margin: '0 auto',
        background: 'white',
        padding: 32,
        borderRadius: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1e293b', marginBottom: 24 }}>
          ✅ ¡Login Exitoso!
        </h1>
        
        <div style={{ 
          display: 'grid', 
          gap: 16,
          marginBottom: 32
        }}>
          <div style={{ 
            padding: 16, 
            background: '#f0f9ff', 
            borderRadius: 8,
            border: '1px solid #bae6fd'
          }}>
            <strong style={{ color: '#0369a1' }}>Email:</strong> {user.email}
          </div>
          <div style={{ 
            padding: 16, 
            background: '#f0fdf4', 
            borderRadius: 8,
            border: '1px solid #bbf7d0'
          }}>
            <strong style={{ color: '#15803d' }}>User ID:</strong> {user.id}
          </div>
          {persona && (
            <div style={{ 
              padding: 16, 
              background: '#fefce8', 
              borderRadius: 8,
              border: '1px solid #fef08a'
            }}>
              <strong style={{ color: '#854d0e' }}>Persona encontrada:</strong><br/>
              Nombre: {persona.nombre}<br/>
              DNI: {persona.dni}<br/>
              Rol: {persona.rol}
            </div>
          )}
          {!persona && (
            <div style={{ 
              padding: 16, 
              background: '#fef2f2', 
              borderRadius: 8,
              border: '1px solid #fecaca',
              color: '#b91c1c'
            }}>
              ⚠️ <strong>Persona NO encontrada en la tabla personas</strong><br/>
              El usuario existe en Auth pero no está vinculado con la tabla personas.
            </div>
          )}
        </div>
        
        <a 
          href="/auth/login"
          style={{
            display: 'inline-block',
            padding: '12px 32px',
            background: '#002F6C',
            color: 'white',
            textDecoration: 'none',
            borderRadius: 8,
            fontWeight: 600,
            marginRight: 12
          }}
        >
          Cerrar sesión
        </a>
      </div>
    </div>
  )
}