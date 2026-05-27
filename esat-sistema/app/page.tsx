import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session) redirect('/dashboard')

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0a2a5e 0%, #003087 45%, #0a3fa8 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ maxWidth: 1200, width: '100%' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            width: 80, height: 80,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '50%',
            margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40
          }}>️</div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: 'white', margin: '0 0 8px', fontFamily: 'Lora, serif' }}>
            Sistema Integral de Gestión de Asistencias y Actividades del Equipo
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
            ESAT-FCAM · CIAD-FCAM
          </p>
        </div>

        {/* Tarjetas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24,
          maxWidth: 1000,
          margin: '0 auto'
        }}>
          
          {/* 1. Coordinadores de Grupos */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            borderRadius: 20,
            padding: 32,
            border: '1px solid rgba(255,255,255,0.2)',
            textAlign: 'center'
          }}>
            <div style={{
              display: 'inline-block', background: '#fbbf24', color: '#78350f',
              padding: '4px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              marginBottom: 16, textTransform: 'uppercase'
            }}>👑 COORDINADORES</div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👔</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: '0 0 12px' }}>
              Coordinadores de Grupos de Investigación
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', margin: '0 0 20px', lineHeight: 1.6 }}>
              Ph.D. Edwin Loarte - GAMH<br/>
              M.Sc. Katy Medina - PAMEC<br/>
              M.Sc. Francisco Castillo - EcoBIOTEM<br/>
              <span style={{color:'white', fontWeight:600}}>— Acceso completo al sistema ESAT</span>
            </p>
            <Link href="/auth/login" style={{
              display: 'inline-block', background: 'rgba(255,255,255,0.15)', color: 'white',
              padding: '10px 24px', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14
            }}>Ingresar →</Link>
          </div>

          {/* 2. Asistentes Supervisores */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            borderRadius: 20,
            padding: 32,
            border: '1px solid rgba(255,255,255,0.2)',
            textAlign: 'center'
          }}>
            <div style={{
              display: 'inline-block', background: '#60a5fa', color: '#1e3a8a',
              padding: '4px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              marginBottom: 16, textTransform: 'uppercase'
            }}> ASISTENTES</div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: '0 0 12px' }}>
              Asistentes Supervisores
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', margin: '0 0 20px', lineHeight: 1.6 }}>
              Hairo León – ESAT<br/>
              Pamela Alejo – ESAT<br/>
              <span style={{color:'white', fontWeight:600}}>— Control de asistencias, permisos y avances del equipo</span>
            </p>
            <Link href="/auth/login" style={{
              display: 'inline-block', background: 'rgba(255,255,255,0.15)', color: 'white',
              padding: '10px 24px', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14
            }}>Ingresar →</Link>
          </div>

          {/* 3. Equipo Técnico */}
          <div style={{
            gridColumn: '1 / -1',
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            borderRadius: 20,
            padding: 32,
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', gap: 24
          }}>
            <div style={{ fontSize: 64 }}>👥</div>
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'inline-block', background: '#34d399', color: '#065f46',
                padding: '4px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                marginBottom: 12, textTransform: 'uppercase'
              }}> EQUIPO TÉCNICO</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: '0 0 8px' }}>
                Equipo Técnico y Administrativo
              </h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', margin: '0 0 16px', lineHeight: 1.6 }}>
                Ingresa con tu <strong style={{ color: 'white' }}>DNI</strong> para registrar tu asistencia y reportar tus avances diarios
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ background: 'rgba(255,255,255,0.15)', color: 'white', padding: '6px 14px', borderRadius: 20, fontSize: 12 }}>‍💼 Asistentes</span>
                <span style={{ background: 'rgba(255,255,255,0.15)', color: 'white', padding: '6px 14px', borderRadius: 20, fontSize: 12 }}>🎓 Practicantes</span>
                <span style={{ background: 'rgba(255,255,255,0.15)', color: 'white', padding: '6px 14px', borderRadius: 20, fontSize: 12 }}> Voluntarios</span>
              </div>
            </div>
            <Link href="/auth/login" style={{
              background: 'rgba(255,255,255,0.2)', color: 'white',
              padding: '12px 28px', borderRadius: 10, textDecoration: 'none',
              fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap'
            }}>Ingresar →</Link>
          </div>

        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 48, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
          Equipo Técnico y Administrativo · Huaraz, Áncash
        </div>
      </div>
    </div>
  )
}