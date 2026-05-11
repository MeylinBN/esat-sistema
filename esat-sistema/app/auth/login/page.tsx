'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Card = 'coordinador' | 'logistico' | 'miembro'

const CARDS = [
  { id: 'coordinador' as Card, icon: '🏔', badge: 'Coordinación', color: '#c9a227', desc: 'Acceso completo al sistema', hint: 'Correo institucional + contraseña' },
  { id: 'logistico'   as Card, icon: '📋', badge: 'Logístico',    color: '#63a2ff', desc: 'Gestión de asistencias y avisos', hint: 'Correo institucional + contraseña' },
  { id: 'miembro'     as Card, icon: '👤', badge: 'Practicante / Voluntario', color: '#86efac', desc: 'Mi panel, tareas y horario', hint: 'DNI como usuario y contraseña' },
]

export default function AsistenciaPage() {
  const router = useRouter()
  const supabase =  createClient()

  const [card, setCard]       = useState<Card | null>(null)
  const [user, setUser]       = useState('')
  const [pass, setPass]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!card) return
    setLoading(true)
    setError('')

    // Para 'miembro': login con DNI — construimos email ficticio
    const email = card === 'miembro'
      ? `${user.trim()}@esat.local`
      : user.trim()
    const password = card === 'miembro' ? pass || user.trim() : pass

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('Credenciales incorrectas. Intenta de nuevo.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg,#0a2a5e 0%,#003087 45%,#0a3fa8 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', overflow: 'hidden'
    }}>
      {/* Background decorations */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none',
        background: 'radial-gradient(ellipse 60% 40% at 20% 80%,rgba(201,162,39,.08) 0%,transparent 70%),radial-gradient(ellipse 40% 60% at 80% 10%,rgba(255,255,255,.04) 0%,transparent 60%)' }} />
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:160, opacity:.12,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 1200 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolygon points='0,160 200,40 380,100 550,20 720,90 900,30 1100,80 1200,50 1200,160' fill='white'/%3E%3C/svg%3E\")",
        backgroundRepeat:'no-repeat', backgroundPosition:'bottom', backgroundSize:'cover' }} />

      {/* Header */}
      <div style={{ textAlign:'center', marginBottom:40, position:'relative', zIndex:1 }}>
        <div style={{ width:60, height:60, background:'rgba(255,255,255,.15)', border:'1.5px solid rgba(255,255,255,.3)',
          borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px',
          backdropFilter:'blur(8px)', fontSize:28 }}>🏔</div>
        <h1 style={{ fontFamily:'Lora,serif', fontSize:22, color:'#fff', fontWeight:600 }}>ESAT · CIAD</h1>
        <p style={{ fontSize:12, color:'rgba(255,255,255,.6)', marginTop:4, letterSpacing:'.08em', textTransform:'uppercase' }}>
          Sistema de Gestión del Equipo
        </p>
      </div>

      {/* Cards */}
      <div style={{ display:'flex', gap:16, position:'relative', zIndex:1, flexWrap:'wrap', justifyContent:'center', maxWidth:860, marginBottom: card ? 32 : 0 }}>
        {CARDS.map(c => (
          <div key={c.id}
            onClick={() => { setCard(c.id); setError('') }}
            style={{
              width:260, background: card===c.id ? `rgba(${c.id==='coordinador'?'201,162,39':'99,162,255'},0.12)` : 'rgba(255,255,255,.08)',
              border: `1.5px solid ${card===c.id ? c.color : 'rgba(255,255,255,.18)'}`,
              borderRadius:20, padding:'28px 22px', cursor:'pointer',
              transition:'all .25s', backdropFilter:'blur(12px)',
              display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center',
              transform: card===c.id ? 'translateY(-4px)' : undefined,
              boxShadow: card===c.id ? '0 20px 60px rgba(0,0,0,.3)' : undefined,
            }}>
            <div style={{ fontSize:36, marginBottom:14 }}>{c.icon}</div>
            <div style={{ display:'inline-flex', alignItems:'center', padding:'4px 12px', borderRadius:20,
              fontSize:10, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', marginBottom:12,
              background:`rgba(255,255,255,.12)`, color:'rgba(255,255,255,.9)', border:`1px solid rgba(255,255,255,.2)` }}>
              {c.badge}
            </div>
            <p style={{ fontSize:12, color:'rgba(255,255,255,.75)', lineHeight:1.6, marginBottom:8 }}>{c.desc}</p>
            <p style={{ fontSize:10, color:'rgba(255,255,255,.4)' }}>{c.hint}</p>
          </div>
        ))}
      </div>

      {/* Login form */}
      {card && (
        <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:380,
          background:'rgba(255,255,255,.1)', border:'1.5px solid rgba(255,255,255,.2)',
          borderRadius:20, padding:'28px 24px', backdropFilter:'blur(16px)' }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:'#fff', marginBottom:20, textAlign:'center' }}>
            {card === 'miembro' ? 'Acceso con DNI' : 'Acceso institucional'}
          </h3>
          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="ig">
              <label style={{ color:'rgba(255,255,255,.7)' }}>{card === 'miembro' ? 'DNI' : 'Correo'}</label>
              <input
                type={card === 'miembro' ? 'text' : 'email'}
                value={user}
                onChange={e => setUser(e.target.value)}
                placeholder={card === 'miembro' ? 'Ej: 73066140' : 'correo@ejemplo.com'}
                required
                style={{ background:'rgba(255,255,255,.15)', border:'1.5px solid rgba(255,255,255,.2)', color:'#fff' }}
              />
            </div>
            <div className="ig">
              <label style={{ color:'rgba(255,255,255,.7)' }}>
                {card === 'miembro' ? 'Contraseña (DNI por defecto)' : 'Contraseña'}
              </label>
              <input
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="••••••••"
                required={card !== 'miembro'}
                style={{ background:'rgba(255,255,255,.15)', border:'1.5px solid rgba(255,255,255,.2)', color:'#fff' }}
              />
            </div>
            {error && <p style={{ fontSize:12, color:'#fca5a5', textAlign:'center' }}>{error}</p>}
            <button type="submit" disabled={loading}
              style={{ background:'linear-gradient(135deg,#c9a227,#d97706)', color:'#fff', border:'none',
                borderRadius:10, padding:'12px', fontSize:14, fontWeight:700, cursor:'pointer',
                marginTop:4, opacity: loading ? .7 : 1 }}>
              {loading ? 'Ingresando...' : 'Ingresar →'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
