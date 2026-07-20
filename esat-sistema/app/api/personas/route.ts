// app/api/personas/route.ts
// Crea una persona nueva Y su usuario de Supabase Auth en un solo paso.
// Necesario porque el cliente del navegador (anon key) no puede llamar
// auth.admin.createUser — eso solo lo puede hacer la service role key,
// que jamás debe exponerse en el cliente.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: solicitante } = await supabase
    .from('personas')
    .select('rol')
    .eq('auth_id', user.id)
    .single()

  if (solicitante?.rol !== 'Coordinador') {
    return NextResponse.json({ error: 'Solo un coordinador puede agregar personal' }, { status: 403 })
  }

  const body = await req.json()
  const { persona, horarios } = body as {
    persona: Record<string, any>
    horarios?: Array<{ dia: string; hora_entrada: string; hora_salida: string }>
  }

  if (!persona?.dni || !persona?.nombre) {
    return NextResponse.json({ error: 'Nombre y DNI son obligatorios' }, { status: 400 })
  }

  const admin = createAdminClient()
  const email = `${persona.dni}@sistema.esat`

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: persona.dni,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Error creando usuario de acceso: ' + authError?.message }, { status: 400 })
  }

  const { data: nuevaPersona, error: personaError } = await admin
    .from('personas')
    .insert({ ...persona, auth_id: authData.user.id, activo: true })
    .select()
    .single()

  if (personaError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: 'Error guardando persona: ' + personaError.message }, { status: 400 })
  }

  if (horarios?.length) {
    const rows = horarios.map(h => ({ ...h, persona_id: nuevaPersona.id }))
    const { error: horError } = await admin.from('horarios').insert(rows)
    if (horError) {
      return NextResponse.json(
        { error: 'Persona creada, pero falló el horario: ' + horError.message, persona: nuevaPersona },
        { status: 207 }
      )
    }
  }

  return NextResponse.json({ persona: nuevaPersona })
}
