'use client'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const TIMEOUT_DURATION = 30 * 60 * 1000

export default function SessionTimeout() {
  const router = useRouter()
  const supabase = createClient()
  const timeoutRef = useRef<NodeJS.Timeout>()
  const lastActivityRef = useRef<number>(Date.now())

  useEffect(() => {
    const clearSession = async () => {
      await supabase.auth.signOut()
      router.push('/auth/login?reason=timeout')
    }

    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      lastActivityRef.current = Date.now()
      timeoutRef.current = setTimeout(() => {
        if (Date.now() - lastActivityRef.current >= TIMEOUT_DURATION) {
          clearSession()
        }
      }, TIMEOUT_DURATION)
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(e => window.addEventListener(e, resetTimer))
    resetTimer()

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      events.forEach(e => window.removeEventListener(e, resetTimer))
    }
  }, [router])

  return null
}