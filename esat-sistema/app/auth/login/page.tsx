'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Card = 'coordinador' | 'logistico' | 'miembro'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [card, setCard] = useState<Card | null>(null)
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [personas, setPersonas] = useState<any[]>([])

  useEffect(() => {
    supabase.from('personas')
      .select('id,nombre,color,rol,dni')
      .eq('activo', true)
      .in('rol', ['Practicante','SENATI','Voluntario','Asistente'])
      .order('nombre')
      .then(({ data }) => setPersonas(data ?? []))
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const email = card === 'miembro' ? `${user.trim()}@esat.local` : user.trim()
    const password = pass || user.trim()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError('Credenciales incorrectas.'); setLoading(false); return }
    router.push('/dashboard')
  }

  async function loginWithChip(persona: any) {
    setLoading(true); setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: `${persona.dni}@esat.local`,
      password: persona.dni,
    })
    if (authError) {
      setError(`Sin usuario para ${persona.nombre}. Pide al coordinador que lo cree.`)
      setLoading(false); return
    }
    router.push('/dashboard')
  }

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#0a2a5e 0%,#003087 45%,#0a3fa8 100%)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px',position:'relative',overflow:'hidden'}}>
      <style>{`@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}} @keyframes floatIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:160,opacity:.12,backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 1200 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolygon points='0,160 200,40 380,100 550,20 720,90 900,30 1100,80 1200,50 1200,160' fill='white'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'bottom',backgroundSize:'cover',pointerEvents:'none'}}/>

      {/* Header */}
      <div style={{textAlign:'center',marginBottom:40,position:'relative',zIndex:1}}>
        <div style={{width:60,height:60,background:'rgba(255,255,255,.15)',border:'1.5px solid rgba(255,255,255,.3)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',backdropFilter:'blur(8px)',fontSize:26}}>🛡️</div>
        <h1 style={{fontFamily:'Lora,serif',fontSize:22,color:'#fff',fontWeight:600}}>ESAT · UNASAM</h1>
        <p style={{fontSize:11,color:'rgba(255,255,255,.55)',marginTop:4,letterSpacing:'.1em',textTransform:'uppercase'}}>ESAT-FCAM · CIAD-FCAM · UNASAM · HUARAZ, ÁNCASH</p>
      </div>

      {!card ? (
        <div style={{display:'flex',flexDirection:'column',gap:16,position:'relative',zIndex:1,width:'100%',maxWidth:580,alignItems:'center'}}>
          <div style={{display:'flex',gap:16,flexWrap:'wrap',justifyContent:'center',width:'100%'}}>
            {[
              {id:'coordinador' as Card,badge:'⭐ DIRECCIÓN',bc:'gold',icon:'👨‍💼',title:'Coordinadores Generales',desc:'Ing. Loarte Cadenas · Katy Medina — Acceso completo al sistema ESAT'},
              {id:'logistico' as Card,badge:'📋 LOGÍSTICO',bc:'blue',icon:'🗂️',title:'Coordinadores Logísticos',desc:'Fransisco · EcoBIOTEM — Pamela · ESAT — Hairo · ESAT'},
            ].map(c=>(
              <div key={c.id} onClick={()=>setCard(c.id)} style={{flex:'1 1 230px',maxWidth:260,background:'rgba(255,255,255,.08)',border:'1.5px solid rgba(255,255,255,.18)',borderRadius:20,padding:'28px 22px',cursor:'pointer',backdropFilter:'blur(12px)',display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',transition:'all .25s'}}
                onMouseEnter={e=>{(e.currentTarget as any).style.transform='translateY(-4px)';(e.currentTarget as any).style.borderColor='rgba(255,255,255,.4)'}}
                onMouseLeave={e=>{(e.currentTarget as any).style.transform='';(e.currentTarget as any).style.borderColor='rgba(255,255,255,.18)'}}>
                <div style={{marginBottom:14}}>
                  <span style={{display:'inline-flex',alignItems:'center',padding:'4px 12px',borderRadius:20,fontSize:10,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase' as const,background:c.bc==='gold'?'rgba(201,162,39,.25)':'rgba(99,162,255,.2)',color:c.bc==='gold'?'#fde68a':'#bfdbfe',border:`1px solid ${c.bc==='gold'?'rgba(201,162,39,.4)':'rgba(99,162,255,.3)'}`}}>{c.badge}</span>
                </div>
                <div style={{fontSize:36,marginBottom:10}}>{c.icon}</div>
                <div style={{fontSize:16,fontWeight:600,color:'#fff',marginBottom:8}}>{c.title}</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,.55)',lineHeight:1.5}}>{c.desc}</div>
              </div>
            ))}
          </div>

          {/* Equipo card grande */}
          <div style={{width:'100%',background:'rgba(255,255,255,.08)',border:'1.5px solid rgba(255,255,255,.18)',borderRadius:20,padding:'24px 28px',backdropFilter:'blur(12px)'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:20}}>
              <div style={{fontSize:48}}>👩‍🔬</div>
              <div style={{flex:1}}>
                <span style={{padding:'4px 12px',borderRadius:20,fontSize:10,fontWeight:600,textTransform:'uppercase' as const,background:'rgba(74,222,128,.2)',color:'#bbf7d0',border:'1px solid rgba(74,222,128,.3)'}}>👜 EQUIPO</span>
                <div style={{fontSize:18,fontWeight:700,color:'#fff',margin:'10px 0 6px'}}>Practicantes, SENATI, Voluntarios y Asistentes</div>
                <div style={{fontSize:13,color:'rgba(255,255,255,.7)',marginBottom:14}}>Ingresa con tu <strong style={{color:'#fde68a'}}>DNI</strong> para registrar tu asistencia y reportar tus avances semanales</div>
                <div style={{display:'flex',flexWrap:'wrap' as const,gap:6}}>
                  {[['🎓','Practicantes'],['🔧','SENATI'],['🤝','Voluntarios'],['💼','Asistentes']].map(([ic,lb])=>(
                    <span key={lb} onClick={()=>setCard('miembro')} style={{padding:'5px 12px',borderRadius:20,fontSize:11,background:'rgba(255,255,255,.12)',color:'rgba(255,255,255,.8)',border:'1px solid rgba(255,255,255,.2)',cursor:'pointer'}}>{ic} {lb}</span>
                  ))}
                </div>
              </div>
            </div>
            {personas.length>0&&(
              <div style={{marginTop:20,borderTop:'1px solid rgba(255,255,255,.12)',paddingTop:16}}>
                <p style={{fontSize:11,color:'rgba(255,255,255,.5)',marginBottom:10}}>Selecciona tu nombre para ingresar directamente:</p>
                <div style={{display:'flex',flexWrap:'wrap' as const,gap:6}}>
                  {personas.map(p=>(
                    <button key={p.id} onClick={()=>loginWithChip(p)} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 10px 6px 6px',borderRadius:24,border:'1.5px solid rgba(255,255,255,.25)',cursor:'pointer',background:'rgba(255,255,255,.08)',color:'rgba(255,255,255,.85)',fontSize:11,fontWeight:500,fontFamily:'inherit',transition:'all .2s'}}
                      onMouseEnter={e=>{(e.currentTarget as any).style.borderColor='#c9a227';(e.currentTarget as any).style.background='rgba(201,162,39,.15)'}}
                      onMouseLeave={e=>{(e.currentTarget as any).style.borderColor='rgba(255,255,255,.25)';(e.currentTarget as any).style.background='rgba(255,255,255,.08)'}}>
                      <div style={{width:26,height:26,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white'}}>{p.nombre.charAt(0)}</div>
                      {p.nombre.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {error&&<p style={{marginTop:12,fontSize:12,color:'#fca5a5',textAlign:'center'}}>{error}</p>}
            {loading&&<p style={{marginTop:12,fontSize:12,color:'rgba(255,255,255,.6)',textAlign:'center'}}>Ingresando...</p>}
          </div>
        </div>
      ) : (
        <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:380,background:'rgba(255,255,255,.97)',borderRadius:20,padding:'32px 28px',boxShadow:'0 32px 80px rgba(0,0,0,.35)',animation:'slideUp .3s ease'}}>
          <button onClick={()=>{setCard(null);setError('')}} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#475569',cursor:'pointer',marginBottom:20,border:'none',background:'none',fontFamily:'inherit'}}>← Volver a opciones</button>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24,padding:'12px 14px',background:'#EFF6FF',borderRadius:10}}>
            <span style={{fontSize:24}}>{card==='coordinador'?'👨‍💼':'🗂️'}</span>
            <div>
              <div style={{fontSize:15,fontWeight:600,color:'#002F6C'}}>{card==='coordinador'?'Coordinador General':'Coordinador Logístico'}</div>
              <div style={{fontSize:11,color:'#475569'}}>{card==='coordinador'?'Acceso completo al sistema':'Gestión de asistencias y avisos'}</div>
            </div>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',letterSpacing:'.04em',textTransform:'uppercase' as const,marginBottom:6}}>USUARIO</label>
              <input type="email" value={user} onChange={e=>setUser(e.target.value)} placeholder="correo@ejemplo.com" required style={{width:'100%',padding:'11px 14px',border:'1.5px solid #CBD5E1',borderRadius:10,fontFamily:'inherit',fontSize:14,outline:'none'}}/>
            </div>
            <div style={{marginBottom:20}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',letterSpacing:'.04em',textTransform:'uppercase' as const,marginBottom:6}}>CONTRASEÑA</label>
              <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" required style={{width:'100%',padding:'11px 14px',border:'1.5px solid #CBD5E1',borderRadius:10,fontFamily:'inherit',fontSize:14,outline:'none'}}/>
            </div>
            {error&&<p style={{fontSize:12,color:'#DC2626',textAlign:'center',marginBottom:12}}>{error}</p>}
            <button type="submit" disabled={loading} style={{width:'100%',padding:13,background:'#002F6C',color:'white',border:'none',borderRadius:10,fontFamily:'inherit',fontSize:14,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              🔒 {loading?'Ingresando...':'Ingresar'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
