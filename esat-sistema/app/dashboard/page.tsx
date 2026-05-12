import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // 1. Verificar sesión
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // 2. Obtener datos de la persona
  const { data: persona } = await supabase
    .from('personas')
    .select('*')
    .eq('auth_id', user.id)
    .single()

  // Si no encuentra la persona, mostramos error
  if (!persona) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h1 style={{ color: 'red' }}>Error de configuración</h1>
        <p>Tu usuario existe pero no está vinculado a un perfil.</p>
        <Link href="/auth/login">Volver al login</Link>
      </div>
    )
  }

  const hoy = format(new Date(), 'yyyy-MM-dd')
  const esCoordinador = persona.rol === 'Coordinador'

  // 3. Cargar datos según rol
  let listaPersonas: any[] = []
  let asistenciasHoy: any[] = []
  let avisos: any[] = []

  if (esCoordinador) {
    // Coordinador ve todo
    const [{ data: personas }, { data: asis }, { data: avs }] = await Promise.all([
      supabase.from('personas').select('*').eq('activo', true).order('nombre'),
      supabase.from('asistencias').select('*').eq('fecha', hoy),
      supabase.from('avisos').select('*').order('created_at', { ascending: false }).limit(5),
    ])
    listaPersonas = personas || []
    asistenciasHoy = asis || []
    avisos = avs || []
  } else {
    // Practicante ve solo lo suyo
    const [{ data: miAsistencia }, { data: avs }] = await Promise.all([
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

  // 4. Renderizar Dashboard
  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>Dashboard</h1>
          <p style={{ color: '#666', margin: '4px 0 0' }}>
            {format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        {esCoordinador && (
          <Link href="/dashboard/asistencia" style={{ background: '#2563eb', color: 'white', padding: '8px 16px', borderRadius: 8, textDecoration: 'none' }}>
            Registrar Asistencia
          </Link>
        )}
      </div>

      {/* Bienvenida */}
      <div style={{ background: '#eff6ff', padding: 16, borderRadius: 8, marginBottom: 24, border: '1px solid #bfdbfe' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Hola, {persona.nombre.split(' ')[0]} 👋</h2>
        <p style={{ margin: '4px 0 0', color: '#1e40af' }}>
          {esCoordinador ? 'Tienes acceso total.' : `Tu horario: ${persona.hora_ingreso || 'Flexible'}`}
        </p>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'white', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>TOTAL</div>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{total}</div>
        </div>
        <div style={{ background: 'white', padding: 16, borderRadius: 8, border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 'bold' }}>PRESENTES</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#16a34a' }}>{presentes}</div>
        </div>
        <div style={{ background: 'white', padding: 16, borderRadius: 8, border: '1px solid #fecaca' }}>
          <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 'bold' }}>AUSENTES</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#dc2626' }}>{ausentes}</div>
        </div>
      </div>

      {/* Lista de Personas / Mi Estado */}
      <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: 16, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>
          {esCoordinador ? '👥 Estado del Equipo' : '👤 Mi Estado Hoy'}
        </div>
        
        <div>
          {listaPersonas.map((p: any) => {
            const asist = asistenciasHoy.find((a: any) => a.persona_id === p.id)
            const estado = asist?.estado || 'Sin registrar'
            
            // Color simple
            let colorFondo = '#f1f5f9'
            let colorTexto = '#64748b'
            if (estado === 'presente') { colorFondo = '#dcfce7'; colorTexto = '#166534' }
            if (estado === 'tarde') { colorFondo = '#fef3c7'; colorTexto = '#92400e' }

            return (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.color || '#cbd5e1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {p.nombre.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{p.nombre}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{p.rol}</div>
                  </div>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: colorFondo, color: colorTexto }}>
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