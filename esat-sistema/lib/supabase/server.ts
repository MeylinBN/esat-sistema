import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options?: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error: any) {
            // Ignorar error
          }
        },
        remove(name: string, options?: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error: any) {
            // Ignorar error si se llama desde Server Component
          }
        },
      },
    }
  )
}