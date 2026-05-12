'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// DOMINIO: cambia esto si en Supabase usaste otro dominio
const DOMINIO = 'sistema.esat'

type Card = 'coordinador' | 'logistico' | 'miembro' | null

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [card,     setCard]     = useState<Card>(null)
  const [user,     setUser]     = useState('')
  const [pass,     setPass]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [personas, setPersonas] = useState<any[]>([])

  useEffect(() => {
    supabase.from('personas')
      .select('id,nombre,color,rol,dni')
      .eq('activo', true)
      .in('rol', ['Practicante','SENATI','Voluntario','Asistente'])
      .order('nombre')
      .then(({ data }) => setPersonas(data ?? []))
  }, [])

  // Limpiar error cuando cambia de card
  function seleccionarCard(c: Card) {
    setCard(c)
    setError('')
    setUser('')
    setPass('')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    // Coordinadores y logísticos usan email real
    const email = user.trim()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (authError) {
      setError('Credenciales incorrectas. Verifica tu correo y contraseña.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  async function loginConDni(dni: string, nombre: string) {
    setLoading(true)
    setError('')
    // Intenta con @sistema.esat primero, luego @esat.local por compatibilidad
    const dominios = [`${dni}@${DOMINIO}`, `${dni}@sistema.local`]
    let loggedIn = false
    for (const email of dominios) {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: dni,  // password por defecto = DNI
      })
      if (!authError) { loggedIn = true; break }
    }
    if (!loggedIn) {
      setError(`Sin usuario para ${nombre}. Pide al coordinador que lo cree en Supabase Auth con email: ${dni}@${DOMINIO}`)
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  // Vista principal — selección de tipo
  if (!card) {
    return (
      <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#0a2a5e 0%,#003087 45%,#0a3fa8 100%)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',bottom:0,left:0,right:0,height:160,opacity:.12,backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 1200 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolygon points='0,160 200,40 380,100 550,20 720,90 900,30 1100,80 1200,50 1200,160' fill='white'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'bottom',backgroundSize:'cover',pointerEvents:'none'}}/>

        {/* Header */}
        <div style={{textAlign:'center',marginBottom:36,position:'relative',zIndex:1}}>
          <div style={{width:60,height:60,background:'rgba(255,255,255,.15)',border:'1.5px solid rgba(255,255,255,.3)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',backdropFilter:'blur(8px)',fontSize:26}}>🛡️</div>
          <h1 style={{fontFamily:'Lora,serif',fontSize:22,color:'#fff',fontWeight:600}}>ESAT · UNASAM</h1>
          <p style={{fontSize:11,color:'rgba(255,255,255,.55)',marginTop:4,letterSpacing:'.1em',textTransform:'uppercase'}}>ESAT-FCAM · CIAD-FCAM · UNASAM · HUARAZ, ÁNCASH</p>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:14,position:'relative',zIndex:1,width:'100%',maxWidth:560}}>
          {/* Cards coordinadores */}
          <div style={{display:'flex',gap:14,flexWrap:'wrap',justifyContent:'center'}}>
            {[
              {id:'coordinador' as Card, badge:'⭐ DIRECCIÓN', badgeC:'rgba(201,162,39,.25)', badgeTxt:'#fde68a', badgeBorder:'rgba(201,162,39,.4)', icon:'👨‍💼', title:'Coordinadores Generales', desc:'Ing. Loarte Cadenas · Katy Medina — Acceso completo al sistema ESAT'},
              {id:'logistico'   as Card, badge:'📋 LOGÍSTICO', badgeC:'rgba(99,162,255,.2)',  badgeTxt:'#bfdbfe', badgeBorder:'rgba(99,162,255,.3)',   icon:'🗂️', title:'Coordinadores Logísticos', desc:'Fransisco · EcoBIOTEM — Pamela · ESAT — Hairo · ESAT'},
            ].map(c=>(
              <div key={c.id as string} onClick={()=>seleccionarCard(c.id)}
                style={{flex:'1 1 230px',maxWidth:260,background:'rgba(255,255,255,.08)',border:'1.5px solid rgba(255,255,255,.18)',borderRadius:20,padding:'24px 20px',cursor:'pointer',backdropFilter:'blur(12px)',display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',transition:'all .25s'}}
                onMouseEnter={e=>{(e.currentTarget as any).style.transform='translateY(-3px)';(e.currentTarget as any).style.borderColor='rgba(255,255,255,.4)'}}
                onMouseLeave={e=>{(e.currentTarget as any).style.transform='';(e.currentTarget as any).style.borderColor='rgba(255,255,255,.18)'}}>
                <span style={{display:'inline-flex',padding:'4px 12px',borderRadius:20,fontSize:10,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase' as const,background:c.badgeC,color:c.badgeTxt,border:`1px solid ${c.badgeBorder}`,marginBottom:12}}>{c.badge}</span>
                <div style={{fontSize:32,marginBottom:8}}>{c.icon}</div>
                <div style={{fontSize:15,fontWeight:600,color:'#fff',marginBottom:6}}>{c.title}</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,.55)',lineHeight:1.5}}>{c.desc}</div>
              </div>
            ))}
          </div>

          {/* Card equipo grande */}
          <div style={{background:'rgba(255,255,255,.08)',border:'1.5px solid rgba(255,255,255,.18)',borderRadius:20,padding:'22px 24px',backdropFilter:'blur(12px)'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:16,marginBottom:16}}>
              <div style={{fontSize:44}}>👩‍🔬</div>
              <div style={{flex:1}}>
                <span style={{padding:'4px 12px',borderRadius:20,fontSize:10,fontWeight:600,textTransform:'uppercase' as const,background:'rgba(74,222,128,.2)',color:'#bbf7d0',border:'1px solid rgba(74,222,128,.3)'}}>👜 EQUIPO</span>
                <div style={{fontSize:17,fontWeight:700,color:'#fff',margin:'8px 0 5px'}}>Practicantes, SENATI, Voluntarios y Asistentes</div>
                <div style={{fontSize:13,color:'rgba(255,255,255,.7)',marginBottom:12}}>Ingresa con tu <strong style={{color:'#fde68a'}}>DNI</strong> para registrar tu asistencia y reportar tus avances semanales</div>
                <div style={{display:'flex',flexWrap:'wrap' as const,gap:6}}>
                  {[['🎓','Practicantes'],['🔧','SENATI'],['🤝','Voluntarios'],['💼','Asistentes']].map(([ic,lb])=>(
                    // ← Este click NO cambia card, solo es visual/informativo
                    <span key={lb} style={{padding:'5px 12px',borderRadius:20,fontSize:11,background:'rgba(255,255,255,.12)',color:'rgba(255,255,255,.8)',border:'1px solid rgba(255,255,255,.2)'}}>{ic} {lb}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Chips de personas */}
            {personas.length > 0 && (
              <>
                <div style={{borderTop:'1px solid rgba(255,255,255,.12)',paddingTop:14,marginBottom:8}}>
                  <p style={{fontSize:11,color:'rgba(255,255,255,.5)',marginBottom:10}}>Selecciona tu nombre para ingresar directamente:</p>
                  <div style={{display:'flex',flexWrap:'wrap' as const,gap:6}}>
                    {personas.map(p=>(
                      <button key={p.id} disabled={loading} onClick={()=>loginConDni(p.dni, p.nombre)}
                        style={{display:'flex',alignItems:'center',gap:6,padding:'6px 10px 6px 6px',borderRadius:24,border:'1.5px solid rgba(255,255,255,.25)',cursor:'pointer',background:'rgba(255,255,255,.08)',color:'rgba(255,255,255,.85)',fontSize:11,fontWeight:500,fontFamily:'inherit',transition:'all .2s',opacity:loading?.6:1}}
                        onMouseEnter={e=>{if(!loading){(e.currentTarget as any).style.borderColor='#c9a227';(e.currentTarget as any).style.background='rgba(201,162,39,.15)'}}}
                        onMouseLeave={e=>{(e.currentTarget as any).style.borderColor='rgba(255,255,255,.25)';(e.currentTarget as any).style.background='rgba(255,255,255,.08)'}}>
                        <div style={{width:26,height:26,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>{p.nombre.charAt(0)}</div>
                        {p.nombre.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
                {error && <p style={{fontSize:12,color:'#fca5a5',marginTop:8,lineHeight:1.5}}>{error}</p>}
                {loading && <p style={{fontSize:12,color:'rgba(255,255,255,.6)',marginTop:8}}>Ingresando...</p>}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Vista formulario — coordinador o logístico
  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#0a2a5e 0%,#003087 45%,#0a3fa8 100%)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:160,opacity:.12,backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 1200 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolygon points='0,160 200,40 380,100 550,20 720,90 900,30 1100,80 1200,50 1200,160' fill='white'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'bottom',backgroundSize:'cover',pointerEvents:'none'}}/>

      <div style={{textAlign:'center',marginBottom:28,position:'relative',zIndex:1}}>
        <div style={{width:50,height:50,background:'rgba(255,255,255,.15)',border:'1.5px solid rgba(255,255,255,.3)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 10px',fontSize:22}}>🛡️</div>
        <h1 style={{fontFamily:'Lora,serif',fontSize:18,color:'#fff',fontWeight:600}}>ESAT · UNASAM</h1>
      </div>

      <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:380,background:'rgba(255,255,255,.97)',borderRadius:20,padding:'32px 28px',boxShadow:'0 32px 80px rgba(0,0,0,.35)'}}>
        <button onClick={()=>seleccionarCard(null)} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#475569',cursor:'pointer',marginBottom:20,border:'none',background:'none',fontFamily:'inherit'}}>← Volver a opciones</button>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24,padding:'12px 14px',background:'#EFF6FF',borderRadius:10}}>
          <span style={{fontSize:22}}>{card==='coordinador'?'👨‍💼':'🗂️'}</span>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:'#002F6C'}}>{card==='coordinador'?'Coordinador General':'Coordinador Logístico'}</div>
            <div style={{fontSize:11,color:'#475569'}}>{card==='coordinador'?'Acceso completo al sistema':'Gestión de asistencias y avisos'}</div>
          </div>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{marginBottom:14}}>
            <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',letterSpacing:'.04em',textTransform:'uppercase' as const,marginBottom:6}}>CORREO</label>
            <input type="email" value={user} onChange={e=>setUser(e.target.value)} placeholder="correo@ejemplo.com" required
              style={{width:'100%',padding:'11px 14px',border:'1.5px solid #CBD5E1',borderRadius:10,fontFamily:'inherit',fontSize:14,outline:'none'}}/>
          </div>
          <div style={{marginBottom:20}}>
            <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',letterSpacing:'.04em',textTransform:'uppercase' as const,marginBottom:6}}>CONTRASEÑA</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" required
              style={{width:'100%',padding:'11px 14px',border:'1.5px solid #CBD5E1',borderRadius:10,fontFamily:'inherit',fontSize:14,outline:'none'}}/>
          </div>
          {error && <p style={{fontSize:12,color:'#DC2626',textAlign:'center',marginBottom:12,lineHeight:1.5}}>{error}</p>}
          <button type="submit" disabled={loading} style={{width:'100%',padding:13,background:'#002F6C',color:'white',border:'none',borderRadius:10,fontFamily:'inherit',fontSize:14,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:loading?.7:1}}>
            🔒 {loading?'Ingresando...':'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
