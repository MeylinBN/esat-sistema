import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: perfil } = await supabase
    .from('personas')
    .select('rol, subrol, nombre') 
    .eq('auth_id', user.id)
    .single()

  if (!perfil) {
    await supabase.auth.signOut()
    redirect('/auth/login')
  }

  // Redirigir según rol (lógica mejorada)
  if (perfil.rol === 'Coordinador') {
    // Normalizar texto para comparar sin tildes ni mayúsculas
    const subrolNormalizado = (perfil.subrol || '').toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quita tildes
    
    // Si es logístico (en rol o subrol)
    if (subrolNormalizado.includes('logistico') || perfil.rol?.toLowerCase().includes('logistico')) {
      redirect('/dashboard/logisticos')
    }
    // Si es general, se queda en /dashboard
  } else {
    // Todos los demás → panel2
    redirect('/panel2')
  }

  // Dashboard para Coordinador General
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>👋 Dashboard General</h1>
      <p>Bienvenido, {perfil.nombre}</p>
      <p style={{ color: 'gray' }}><em>Próximamente: métricas y estado del equipo</em></p>
    </div>
  )
}