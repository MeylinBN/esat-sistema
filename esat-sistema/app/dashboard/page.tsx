import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './_components/DashboardClient'

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // 1. Verificar sesión
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // 2. Obtener perfil
  const { data: perfil } = await supabase
    .from('personas')
    .select('rol, subrol, nombre, dni') 
    .eq('auth_id', user.id)
    .single()

  if (!perfil) {
    await supabase.auth.signOut()
    redirect('/auth/login')
  }

  // 3. Redirección por roles
  const dniLogisticos = ['70189681', '72121099', '77678583', '72728855', '32646306']
  if (dniLogisticos.includes(perfil.dni)) {
    redirect('/dashboard/logisticos')
  }
  if (perfil.rol === 'Coordinador') {
    const subrolLimpio = (perfil.subrol || '').trim().toLowerCase()
    if (subrolLimpio.includes('logistico') || subrolLimpio.includes('l.')) {
      redirect('/dashboard/logisticos')
    }
  } else {
    redirect('/panel2')
  }

  // 4. Si llegó aquí, es Coordinador General → Mostrar Dashboard completo
  return (
    <div>
      <DashboardClient nombre={perfil.nombre} />
    </div>
  )
}