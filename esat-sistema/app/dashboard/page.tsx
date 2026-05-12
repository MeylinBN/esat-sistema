import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  
  // Obtener usuario desde las cookies (más confiable que getSession)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  console.log('🔍 Dashboard - User:', user?.email)
  console.log('🔍 Dashboard - User Error:', userError)
  
  if (!user) {
    console.log('❌ No hay usuario, redirigiendo')
    redirect('/auth/login')
  }
  
  console.log('✅ Usuario válido:', user.email)
  
  // Obtener persona por auth_id
  const { data: persona, error: personaError } = await supabase
    .from('personas')
    .select('*')
    .eq('auth_id', user.id)
    .single()
  
  console.log('👤 Persona encontrada:', persona?.nombre)
  console.log('👤 Persona Error:', personaError)
  
  if (!persona) {
    console.log('❌ No se encontró persona con auth_id:', user.id)
    // No cerrar sesión, solo mostrar error
    return (
      <div style={{ padding: 40 }}>
        <h1>Error</h1>
        <p>No se encontró tu perfil en la base de datos.</p>
        <p>Email: {user.email}</p>
        <p>User ID: {user.id}</p>
        <p>Contacta al coordinador.</p>
        <form action={async () => {
          'use server'
          const supabase = await createClient()
          await supabase.auth.signOut()
          redirect('/auth/login')
        }}>
          <button type="submit">Cerrar sesión</button>
        </form>
      </div>
    )
  }
  
  // Éxito - Dashboard completo
  return (
    <div style={{ padding: 40 }}>
      <h1>¡Bienvenido, {persona.nombre}!</h1>
      <p><strong>DNI:</strong> {persona.dni}</p>
      <p><strong>Rol:</strong> {persona.rol}</p>
      <p><strong>Área:</strong> {persona.area}</p>
      <p><strong>Email Auth:</strong> {user.email}</p>
      
      <form action={async () => {
        'use server'
        const supabase = await createClient()
        await supabase.auth.signOut()
        redirect('/auth/login')
      }}>
        <button type="submit" style={{ 
          marginTop: 20, 
          padding: '10px 20px', 
          background: '#ef4444', 
          color: 'white', 
          border: 'none', 
          borderRadius: 8,
          cursor: 'pointer'
        }}>
          Cerrar sesión
        </button>
      </form>
    </div>
  )
}