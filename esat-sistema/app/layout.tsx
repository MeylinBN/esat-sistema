import type { Metadata } from 'next'
import './globals.css'
import SessionTimeoutProvider from '@/components/SessionTimeoutProvider'

export const metadata: Metadata = {
  title: 'ESAT · CIAD — Sistema de Gestión',
  description: 'Sistema de gestión de asistencias, horarios y tareas del equipo ESAT-CIAD',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <SessionTimeoutProvider>
          {children}
        </SessionTimeoutProvider>
      </body>
    </html>
  )
}