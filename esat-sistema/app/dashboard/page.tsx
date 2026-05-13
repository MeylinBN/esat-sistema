import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: perfil } = await supabase
    .from('personas')
    .select('rol, subrol, nombre, dni') 
    .eq('auth_id', user.id)
    .single()

  if (!perfil) {
    await supabase.auth.signOut()
    redirect('/auth/login')
  }

  // Debug: ver qué valores tiene
  const subrolLimpio = (perfil.subrol || '').trim().toLowerCase()
  const dni = perfil.dni
  
  // Lógica específica para Francisco (DNI: 70189681)
  if (dni === '70189681' || dni === '72121099' || dni === '77678583' || dni === '72728855' || dni === '32646306') {
    // Coordinadores Logísticos por DNI
    redirect('/dashboard/logisticos')
  }

  // Lógica por subrol
  if (perfil.rol === 'Coordinador') {
    if