import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // ✅ CORREGIDO: Agregué 'nombre' al select para que no falle
  const { data: perfil } = await supabase
    .from('personas')
    .select('rol, subrol, nombre') 
    .eq('auth_id', user.id)
    .single()

  if (!perfil) {
    await supabase.auth.signOut()
    redirect('/auth/login')
  }

  // Redirigir según rol
  if (perfil.rol === 'Coordinador') {
    // Verificar si es logístico
    if (perfil.subrol?.toLowerCase().includes('logístico') || perfil.subrol?.toLowerCase().includes('logistico')) {
      redirect('/dashboard/logisticos')
    }
    // Si es general, continúa y muestra el dashboard
  } else {
    // Practicantes, SENATI, etc.
    redirect('/panel2')
  }

  // Si llegó aquí, es Coordinador General
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>👋 Dashboard General</h1>
      <p>Bienvenido, {perfil.nombre}</p>
      <p style={{ color: 'gray' }}><em>(Aquí pegaremos el contenido completo en el siguiente paso)</em></p>
    </div>
  )
}