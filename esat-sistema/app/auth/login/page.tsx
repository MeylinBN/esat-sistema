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
    
    console.log('🔐 Intentando login:', email)
    
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    console.log('📊 Response:', data)
    console.log('❌ Error:', authError)

    if (authError) {
      setError('DNI o contraseña incorrectos')
      setLoading(false)
      return
    }

    console.log('✅ Login exitoso, redirigiendo...')
    
    // Forzar recarga completa para asegurar cookies
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
        maxWidth: 380,
        boxShadow: '0 32px 80px rgba(0,0,0,.35)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#002F6C', margin: 0 }}>
            ESAT · CIAD
          </h1>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
            Sistema de Gestión del Equipo
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
                outline: 'none'
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
                outline: 'none'
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
              cursor: loading ? 'not-allowed' : 'pointer'
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