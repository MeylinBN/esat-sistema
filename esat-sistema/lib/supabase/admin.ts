// lib/supabase/admin.ts — SOLO para uso server-side (API routes).
// Usa la service role key: nunca importar este archivo desde un componente 'use client'.
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
