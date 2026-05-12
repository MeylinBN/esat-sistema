import { createClient } from '@/lib/supabase/server'
import { getRolLabel } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // 1. Verificar sesión (ya sabemos que funciona)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // 2. Obtener datos de la persona logueada
  const { data: persona } = await supabase
    .from('personas')
    .select('*')
    .eq('auth_id', user.id)
    .single()

  if (!persona) {
    // Si por alguna razón no encuentra la persona, mostramos error simple
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Error de configuración</h1>
        <p className="mt-2 text-gray-600">Tu usuario existe pero no está vinculado a un perfil de persona.</p>
        <a href="/auth/login" className="mt-4 inline-block text-blue-600 underline">Volver al login</a>
      </div>
    )
  }

  const hoy = format(new Date(), 'yyyy-MM-dd')
  const esCoordinador = persona.rol === 'Coordinador'

  // 3. Cargar datos dinámicos según el rol
  let asistenciasHoy: any[] = []
  let listaPersonas: any[] = []
  let avisos: any[] = []

  if (esCoordinador) {
    // Si es Coordinador: ve TODO
    const [{ data: personas }, { data: asis }, { data: avs }] = await Promise.all([
      supabase.from('personas').select('*').eq('activo', true).order('nombre'),
      supabase.from('asistencias').select('*').eq('fecha', hoy),
      supabase.from('avisos').select('*').order('created_at', { ascending: false }).limit(5),
    ])
    listaPersonas = personas || []
    asistenciasHoy = asis || []
    avisos = avs || []
  } else {
    // Si es Practicante/Asistente: ve SOLO lo suyo
    const [{ data: miAsistencia }, { data: avs }] = await Promise.all([
      supabase.from('asistencias').select('*').eq('fecha', hoy).eq('persona_id', persona.id),
      supabase.from('avisos').select('*').order('created_at', { ascending: false }).limit(5),
    ])
    // Para los practicantes, solo mostramos su propia tarjeta en la lista
    listaPersonas = [persona] 
    asistenciasHoy = miAsistencia || []
    avisos = avs || []
  }

  const total = listaPersonas.length
  const presentes = asistenciasHoy.filter(a => ['presente', 'tarde'].includes(a.estado)).length
  const ausentes = total - presentes

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500 capitalize">
            {format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        {esCoordinador && (
          <Link href="/dashboard/asistencia" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition">
            ✅ Registrar asistencia
          </Link>
        )}
      </div>

      {/* Mensaje de bienvenida personalizado */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <h2 className="text-lg font-semibold text-blue-900">
          Hola, {persona.nombre.split(' ')[0]} 👋
        </h2>
        <p className="text-sm text-blue-700">
          {esCoordinador 
            ? 'Tienes acceso total a la gestión del equipo.' 
            : `Tu horario de hoy es: ${persona.hora_ingreso || 'Flexible'}`}
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-semibold uppercase">Total Equipo</div>
          <div className="text-2xl font-bold text-slate-800">{total}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-green-200 shadow-sm">
          <div className="text-green-600 text-xs font-semibold uppercase">Presentes Hoy</div>
          <div className="text-2xl font-bold text-green-700">{presentes}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm">
          <div className="text-red-600 text-xs font-semibold uppercase">Ausentes</div>
          <div className="text-2xl font-bold text-red-700">{ausentes}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
          <div className="text-amber-600 text-xs font-semibold uppercase">Avisos Activos</div>
          <div className="text-2xl font-bold text-amber-700">{avisos.length}</div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Estado del equipo (o mi estado) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-semibold text-slate-700">
              {esCoordinador ? '👥 Estado del Equipo Hoy' : ' Mi Asistencia Hoy'}
            </h3>
          </div>
          <div className