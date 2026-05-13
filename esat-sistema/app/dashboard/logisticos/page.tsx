import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function DashboardLogisticosPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: perfil } = await supabase
    .from('personas')
    .select('*')
    .eq('auth_id', user.id)
    .single()

  if (!perfil) {
    await supabase.auth.signOut()
    redirect('/auth/login')
  }

  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', margin: 0, color: '#1e293b' }}>📦 Dashboard Logístico</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>
            Gestión de tareas, permisos y avances del equipo
          </p>
        </div>
        <form action={async () => {
          'use server'
          await supabase.auth.signOut()
          redirect('/auth/login')
        }}>
          <button type="submit" style={{ background: '#ef4444', color: 'white', padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
            Cerrar Sesión
          </button>
        </form>
      </div>

      <div style={{ background: 'white', padding: 32, borderRadius: 12, border: '1px solid #e2e8f0', textAlign: 'center' }}>
        <h2 style={{ marginBottom: 16 }}>Panel de Coordinación Logística</h2>
        <p style={{ color: '#64748b', marginBottom: 24 }}>
          Bienvenido, {perfil.nombre}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 600, margin: '0 auto' }}>
          <div style={{ padding: 24, background: '#dbeafe', borderRadius: 12, textDecoration: 'none', color: '#1e40af', fontWeight: 'bold' }}>
            📌 Gestionar Tareas
          </div>
          <div style={{ padding: 24, background: '#fef3c7', borderRadius: 12, textDecoration: 'none', color: '#92400e', fontWeight: 'bold' }}>
            ✅ Aprobar Permisos
          </div>
        </div>
      </div>
    </div>
  )
}