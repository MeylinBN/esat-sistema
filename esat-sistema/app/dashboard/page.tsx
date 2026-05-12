import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { redirect } from 'next/navigation'

// 1. SERVER ACTION para cerrar sesión correctamente
async function handleSignOut() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // 2. Verificar sesión
  const {  { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // 3. Obtener datos de la persona
  const {  persona } = await supabase
    .from('personas')
    .select('*')
    .eq('auth_id', user.id)
    .single()

  if (!persona) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h1 style={{ color: 'red' }}>Error de configuración</h1>
        <p>Tu usuario existe pero no está vinculado a un perfil.</p>
        <form action={handleSignOut}>
          <button type="submit" style={{ marginTop: 20, padding: '10px 20px', background: 'red', color: 'white', border: 'none', cursor: 'pointer' }}>Salir</button>
        </form>
      </div>
    )
  }

  const hoy = format(new Date(), 'yyyy-MM-dd')
  const esCoordinador = persona.rol === 'Coordinador'

  // 4. Cargar datos según rol
  let listaPersonas: any[] = []
  let asistenciasHoy: any[] = []
  let avisos: any[] = []

  if (esCoordinador) {
    const [{  personas }, {  asis }, {  avs }] = await Promise.all([
      supabase.from('personas').select('*').eq('activo', true).order('nombre'),
      supabase.from('asistencias').select('*').eq('fecha', hoy),
      supabase.from('avisos').select('*').order('created_at', { ascending: false }).limit(5),
    ])
    listaPersonas = personas || []
    asistenciasHoy = asis || []
    avisos = avs || []
  } else {
    const [{  miAsistencia }, {  avs }] = await Promise.all([
      supabase.from('asistencias').select('*').eq('fecha', hoy).eq('persona_id', persona.id),
      supabase.from('avisos').select('*').order('created_at', { ascending: false }).limit(5),
    ])
    listaPersonas = [persona]
    asistenciasHoy = miAsistencia || []
    avisos = avs || []
  }

  const total = listaPersonas.length
  const presentes = asistenciasHoy.filter((a: any) => a.estado === 'presente' || a.estado === 'tarde').length
  const ausentes = total - presentes

  // 5. Renderizar
  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', margin: 0, color: '#1e293b' }}>Dashboard</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>
            {format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        
        {/* Botón de Logout REAL */}
        <form action={handleSignOut}>
          <button type="submit" style={{ 
            background: '#ef4444', 
            color: 'white', 
            padding: '8px 16px', 
            borderRadius: 8, 
            border: 'none', 
            cursor: 'pointer',
            fontWeight: 'bold'
          }}>
            Cerrar sesión
          </button>
        </form>
      </div>

      {/* Bienvenida */}
      <div style={{ background: 'white', padding: 20, borderRadius: 12, marginBottom: 24, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Hola, {persona.nombre.split(' ')[0]} 👋</h2>
        <p style={{ margin: '8px 0 0', color: '#64748b' }}>
          {esCoordinador ? 'Tienes acceso total a la gestión del equipo.' : `Tu horario de hoy: ${persona.hora_ingreso || 'Flexible'}`}
        </p>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold', marginBottom: 4 }}>TOTAL</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#0f172a' }}>{total}</div>
        </div>
        <div style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #bbf7d0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 'bold', marginBottom: 4 }}>PRESENTES</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#16a34a' }}>{presentes}</div>
        </div>
        <div style={{ background: 'white', padding: 16, borderRadius: 12, border: '1px solid #fecaca', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 'bold', marginBottom: 4 }}>AUSENTES</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#dc2626' }}>{ausentes}</div>
        </div>
      </div>

      {/* Lista de Personas / Mi Estado */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: 16, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', color: '#334155' }}>
          {esCoordinador ? '👥 Estado del Equipo' : '👤 Mi Estado Hoy'}
        </div>
        
        <div>
          {listaPersonas.map((p: any) => {
            const asist = asistenciasHoy.find((a: any) => a.persona_id === p.id)
            const estado = asist?.estado || 'Sin registrar'
            
            let colorFondo = '#f1f5f9'
            let colorTexto = '#64748b'
            if (estado === 'presente') { colorFondo = '#dcfce7'; colorTexto = '#166534' }
            if (estado === 'tarde') { colorFondo = '#fef3c7'; colorTexto = '#92400e' }
            if (estado === 'ausente') { colorFondo = '#fee2e2'; colorTexto = '#991b1b' }

            return (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: p.color || '#cbd5e1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 16 }}>
                    {p.nombre.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.nombre}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{p.rol} - {p.dni}</div>
                  </div>
                </div>
                <span style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: colorFondo, color: colorTexto }}>
                  {estado === 'Sin registrar' ? '⏳ Pendiente' : estado}
                </span>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}