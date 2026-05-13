import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: perfil } = await supabase
    .from('personas')
    .select('rol, subrol')
    .eq('auth_id', user.id)
    .single()

  if (!perfil) {
    await supabase.auth.signOut()
    redirect('/auth/login')
  }

  // Redirigir según rol
  if (perfil.rol === 'Coordinador') {
    if (perfil.subrol?.toLowerCase().includes('logístico') || perfil.subrol?.toLowerCase().includes('logistico')) {
      redirect('/dashboard/logisticos')
    }
    // Si es general, continúa y muestra el dashboard (código abajo)
  } else {
    redirect('/panel2')
  }

  // Si llegó aquí, es Coordinador General → Mostrar dashboard simple por ahora
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Dashboard General - Coordinador</h1>
      <p>Bienvenido, {perfil.nombre}</p>
      <p><em>(Aquí irá el contenido completo después)</em></p>
    </div>
  )
}