'use client'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const TIMEOUT_DURATION = 30 * 60 * 1000 // 30 minutos
// const TIMEOUT_DURATION = 5 * 60 * 1000 // 5 min para pruebas

export default function SessionTimeoutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const timeoutRef = useRef<NodeJS.Timeout>()
  const lastActivityRef = useRef<number>(Date.now())

  useEffect(() => {
    const clearSession = async () => {
      console.log('⏰ Sesión expirada por inactividad')
      await supabase.auth.signOut()
      router.push('/auth/login?reason=timeout')
    }

    const resetTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      lastActivityRef.current = Date.now()
      
      timeoutRef.current = setTimeout(() => {
        const timeSinceLastActivity = Date.now() - lastActivityRef.current
        if (timeSinceLastActivity >= TIMEOUT_DURATION) {
          clearSession()
        }
      }, TIMEOUT_DURATION)
    }

    // Eventos que resetean el timer
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'keypress']
    
    const handleActivity = () => {
      lastActivityRef.current = Date.now()
      resetTimer()
    }

    // Agregar listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity)
    })

    // Iniciar timer
    resetTimer()

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      events.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [router])

  return <>{children}</>
}