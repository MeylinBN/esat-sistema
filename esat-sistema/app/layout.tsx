import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ESAT · CIAD — Sistema de Gestión',
  description: 'Sistema de gestión de asistencias, horarios y tareas del equipo ESAT-CIAD',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}