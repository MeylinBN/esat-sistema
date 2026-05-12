import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { redirect } from 'next/navigation'

// Server Action para cerrar sesión
async function handleSignOut() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // 1. Verificar sesión (CORREGIDO: data: { user })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // 2. Obtener datos de la persona (CORREGIDO: data: persona)
  const { data: persona } = await supabase
    .from('personas')
    .select('*')
    .eq('auth_id', user.id)
    .single()

  if (!persona) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h1 style={{ color: 'red' }}>Error de configuración</h1>
        <p>No se encontró tu perfil.</p>
        <form action={handleSignOut}>
          <button type="submit" style={{ marginTop: 20, padding: '10px 20px', background: 'red', color: 'white', border: 'none', cursor: 'pointer' }}>Salir</button>
        </form>
      </div>
    )
  }

  const esCoordinador = persona.rol === 'Coordinador'

  // ==========================================
  // CASO 1: VISTA DE MIEMBRO (Practicante, Asistente, etc.)
  // ==========================================
 if (!esCoordinador) {
  redirect('/panel2')
  }
    

  // ==========================================
  // CASO 2: VISTA DE COORDINADOR
  // ==========================================
  
  const hoy = format(new Date(), 'yyyy-MM-dd')
  let listaPersonas: any[] = []
  let asistenciasHoy: any[] = []
  let avisos: any[] = []

  const [resPersonas, resAsis, resAvs] = await Promise.all([
    supabase.from('personas').select('*').eq('activo', true).order('nombre'),
    supabase.from('asistencias').select('*').eq('fecha', hoy),
    supabase.from('avisos').select('*').order('created_at', { ascending: false }).limit(5),
  ])
  listaPersonas = resPersonas.data || []
  asistenciasHoy = resAsis.data || []
  avisos = resAvs.data || []

  const total = listaPersonas.length
  const presentes = asistenciasHoy.filter((a: any) => a.estado === 'presente' || a.estado === 'tarde').length
  const ausentes = total - presentes

  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', margin: 0, color: '#1e293b' }}>Dashboard General</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>
            {format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <form action={handleSignOut}>
          <button type="submit" style={{ background: '#ef4444', color: 'white', padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Cerrar Sesión</button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>TOTAL</div>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{total}</div>
        </div>
        <div style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 'bold' }}>PRESENTES</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#16a34a' }}>{presentes}</div>
        </div>
        <div style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #fecaca' }}>
          <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 'bold' }}>AUSENTES</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#dc2626' }}>{ausentes}</div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: 16, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>👥 Estado del Equipo</div>
        <div>
          {listaPersonas.map((p: any) => {
            const asist = asistenciasHoy.find((a: any) => a.persona_id === p.id)
            const estado = asist?.estado || 'Sin registrar'
            return (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                <span>{p.nombre}</span>
                <span style={{ color: estado === 'presente' ? 'green' : 'gray' }}>{estado}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}