'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [dni, setDni] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const email = `${dni.trim()}@sistema.esat`
    
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError) {
      setError('DNI o contraseña incorrectos')
      setLoading(false)
      return
    }

    window.location.href = '/dashboard'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg,#0a2a5e 0%,#003087 45%,#0a3fa8 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        background: 'rgba(255,255,255,.97)',
        borderRadius: 20,
        padding: '32px 28px',
        width: '100%',
        maxWidth: 450,
        boxShadow: '0 32px 80px rgba(0,0,0,.35)'
      }}>
        {/* Botón Volver */}
        <button
          onClick={() => router.push('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 20,
            padding: '6px 0',
            transition: 'color .2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#002F6C'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
        >
          ← Volver a opciones
        </button>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#002F6C', margin: 0, lineHeight: 1.3 }}>
            Sistema Integral de Gestión de Asistencias y Actividades del Equipo
          </h1>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '8px 0 0' }}>
            ESAT-FCAM · CIAD-FCAM
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              color: '#475569',
              marginBottom: 6,
              textTransform: 'uppercase'
            }}>
              DNI
            </label>
            <input
              type="text"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="Ej: 73066140"
              required
              style={{
                width: '100%',
                padding: '11px 14px',
                border: '1.5px solid #CBD5E1',
                borderRadius: 10,
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              color: '#475569',
              marginBottom: 6,
              textTransform: 'uppercase'
            }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                padding: '11px 14px',
                border: '1.5px solid #CBD5E1',
                borderRadius: 10,
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: 9,
              padding: '10px 14px',
              fontSize: 12,
              color: '#b91c1c',
              marginBottom: 14
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: 13,
              background: loading ? '#94a3b8' : '#002F6C',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background .2s'
            }}
          >
            {loading ? 'Ingresando...' : 'Ingresar →'}
          </button>
        </form>

        <div style={{
          marginTop: 16,
          padding: '10px 14px',
          background: '#f8fafc',
          borderRadius: 9,
          fontSize: 11,
          color: '#64748b',
          textAlign: 'center',
          lineHeight: 1.6
        }}>
          💡 <strong>Tu DNI es tu usuario</strong><br/>
          Coordinadores: contraseña personalizada<br/>
          Equipo: DNI por defecto
        </div>
      </div>
    </div>
  )
}