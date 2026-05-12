import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Verificar sesión
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  
  console.log('🔍 Dashboard - Session:', session)
  console.log('🔍 Dashboard - Session Error:', sessionError)
  
  if (!session) {
    console.log('❌ No hay sesión, redirigiendo')
    redirect('/auth/login')
  }
  
  console.log('✅ Sesión válida:', session.user.email)
  
  // Obtener persona
  const { data: persona, error: personaError } = await supabase
    .from('personas')
    .select('*')
    .eq('auth_id', session.user.id)
    .single()
  
  console.log('👤 Persona:', persona)
  console.log('👤 Persona Error:', personaError)
  
  if (!persona) {
    console.log('❌ No se encontró persona con auth_id:', session.user.id)
    await supabase.auth.signOut()
    redirect('/auth/login')
  }
  
  // Éxito - mostrar dashboard simple
  return (
    <div style={{ padding: 40 }}>
      <h1>¡Bienvenido, {persona.nombre}!</h1>
      <p><strong>DNI:</strong> {persona.dni}</p>
      <p><strong>Rol:</strong> {persona.rol}</p>
      <p><strong>Área:</strong> {persona.area}</p>
      <p><strong>Auth ID:</strong> {persona.auth_id}</p>
      <p><strong>User ID:</strong> {session.user.id}</p>
      
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