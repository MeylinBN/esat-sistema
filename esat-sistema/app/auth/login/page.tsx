'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const DOMINIO = 'sistema.esat'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [modo,    setModo]    = useState<'inicio'|'form'>('inicio')
  const [user,    setUser]    = useState('')
  const [pass,    setPass]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [personas,setPersonas]= useState<any[]>([])

  useEffect(()=>{
    supabase.from('personas')
      .select('id,nombre,color,rol,dni,subrol')
      .eq('activo',true)
      .order('nombre')
      .then(({data})=>setPersonas(data??[]))
  },[])

  async function login(dni: string, password: string) {
    setLoading(true); setError('')
    const email = `${dni}@${DOMINIO}`
    const {error:e} = await supabase.auth.signInWithPassword({email, password})
    if(e){
      setError(`DNI o contraseña incorrectos. Si es la primera vez, pide al coordinador que te cree el usuario.`)
      setLoading(false); return
    }
    router.push('/dashboard')
  }

  async function handleFormSubmit(e: React.FormEvent){
    e.preventDefault()
    await login(user.trim(), pass)
  }

  const esat  = personas.filter(p=>p.grupo!=='EcoBIOTEM'||p.rol!=='EcoBIOTEM')
  const coords= personas.filter(p=>p.rol==='Coordinador')
  const equipo= personas.filter(p=>p.rol!=='Coordinador')

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#0a2a5e 0%,#003087 45%,#0a3fa8 100%)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:160,opacity:.12,backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 1200 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolygon points='0,160 200,40 380,100 550,20 720,90 900,30 1100,80 1200,50 1200,160' fill='white'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'bottom',backgroundSize:'cover',pointerEvents:'none'}}/>

      {/* Header */}
      <div style={{textAlign:'center',marginBottom:36,position:'relative',zIndex:1}}>
        <div style={{width:60,height:60,background:'rgba(255,255,255,.15)',border:'1.5px solid rgba(255,255,255,.3)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',backdropFilter:'blur(8px)',fontSize:26}}>🛡️</div>
        <h1 style={{fontFamily:'Lora,serif',fontSize:22,color:'#fff',fontWeight:600}}>ESAT · UNASAM</h1>
        <p style={{fontSize:11,color:'rgba(255,255,255,.55)',marginTop:4,letterSpacing:'.1em',textTransform:'uppercase'}}>ESAT-FCAM · CIAD-FCAM · UNASAM · HUARAZ, ÁNCASH</p>
      </div>

      {modo==='inicio' ? (
        <div style={{display:'flex',flexDirection:'column',gap:14,position:'relative',zIndex:1,width:'100%',maxWidth:600}}>
          
          {/* Coordinadores */}
          <div style={{display:'flex',gap:14,flexWrap:'wrap',justifyContent:'center'}}>
            {[
              {badge:'⭐ DIRECCIÓN',bc:'rgba(201,162,39,.25)',bt:'#fde68a',bb:'rgba(201,162,39,.4)',icon:'👨‍💼',title:'Coordinadores Generales',desc:'Ing. Loarte Cadenas · Katy Medina'},
              {badge:'📋 LOGÍSTICO',bc:'rgba(99,162,255,.2)',bt:'#bfdbfe',bb:'rgba(99,162,255,.3)',icon:'🗂️',title:'Coordinadores Logísticos',desc:'Fransisco · Pamela · Hairo'},
            ].map(c=>(
              <div key={c.title} onClick={()=>{setModo('form');setError('')}}
                style={{flex:'1 1 220px',maxWidth:260,background:'rgba(255,255,255,.08)',border:'1.5px solid rgba(255,255,255,.18)',borderRadius:20,padding:'24px 20px',cursor:'pointer',backdropFilter:'blur(12px)',display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',transition:'all .25s'}}
                onMouseEnter={e=>{(e.currentTarget as any).style.transform='translateY(-3px)'}}
                onMouseLeave={e=>{(e.currentTarget as any).style.transform=''}}>
                <span style={{display:'inline-flex',padding:'4px 12px',borderRadius:20,fontSize:10,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase' as const,background:c.bc,color:c.bt,border:`1px solid ${c.bb}`,marginBottom:12}}>{c.badge}</span>
                <div style={{fontSize:32,marginBottom:8}}>{c.icon}</div>
                <div style={{fontSize:14,fontWeight:600,color:'#fff',marginBottom:5}}>{c.title}</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,.55)',lineHeight:1.5}}>{c.desc}</div>
                <div style={{marginTop:10,fontSize:10,color:'rgba(255,255,255,.4)'}}>DNI + contraseña →</div>
              </div>
            ))}
          </div>

          {/* Card equipo con chips */}
          <div style={{background:'rgba(255,255,255,.08)',border:'1.5px solid rgba(255,255,255,.18)',borderRadius:20,padding:'22px 24px',backdropFilter:'blur(12px)'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:16,marginBottom:16}}>
              <div style={{fontSize:40,flexShrink:0}}>👩‍🔬</div>
              <div>
                <span style={{padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:600,textTransform:'uppercase' as const,background:'rgba(74,222,128,.2)',color:'#bbf7d0',border:'1px solid rgba(74,222,128,.3)'}}>👜 EQUIPO</span>
                <div style={{fontSize:16,fontWeight:700,color:'#fff',margin:'8px 0 4px'}}>Practicantes, SENATI, Voluntarios y Asistentes</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,.65)'}}>Ingresa con tu <strong style={{color:'#fde68a'}}>DNI</strong> y contraseña</div>
              </div>
            </div>

            {/* Chips — click directo */}
            {equipo.length>0&&(
              <div style={{borderTop:'1px solid rgba(255,255,255,.12)',paddingTop:14}}>
                <p style={{fontSize:11,color:'rgba(255,255,255,.45)',marginBottom:10}}>Selecciona tu nombre o usa el formulario:</p>
                <div style={{display:'flex',flexWrap:'wrap' as const,gap:6,marginBottom:12}}>
                  {equipo.map(p=>(
                    <button key={p.id} disabled={loading}
                      onClick={()=>{
                        // Click en chip → va al formulario con el DNI pre-llenado
                        setUser(p.dni)
                        setPass('')
                        setModo('form')
                        setError('')
                      }}
                      style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px 5px 5px',borderRadius:24,border:'1.5px solid rgba(255,255,255,.22)',cursor:'pointer',background:'rgba(255,255,255,.07)',color:'rgba(255,255,255,.82)',fontSize:11,fontWeight:500,fontFamily:'inherit',transition:'all .2s'}}
                      onMouseEnter={e=>{(e.currentTarget as any).style.borderColor='#c9a227';(e.currentTarget as any).style.background='rgba(201,162,39,.15)'}}
                      onMouseLeave={e=>{(e.currentTarget as any).style.borderColor='rgba(255,255,255,.22)';(e.currentTarget as any).style.background='rgba(255,255,255,.07)'}}>
                      <div style={{width:24,height:24,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'white'}}>{p.nombre.charAt(0)}</div>
                      {p.nombre.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      ) : (
        /* Formulario único para todos */
        <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:380,background:'rgba(255,255,255,.97)',borderRadius:20,padding:'32px 28px',boxShadow:'0 32px 80px rgba(0,0,0,.35)'}}>
          <button onClick={()=>{setModo('inicio');setError('');setUser('');setPass('')}}
            style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#475569',cursor:'pointer',marginBottom:20,border:'none',background:'none',fontFamily:'inherit'}}>
            ← Volver
          </button>

          <div style={{textAlign:'center',marginBottom:20}}>
            <div style={{fontSize:32,marginBottom:6}}>🔐</div>
            <div style={{fontSize:16,fontWeight:700,color:'#002F6C'}}>Ingresar al sistema</div>
            <div style={{fontSize:12,color:'#94a3b8',marginTop:3}}>ESAT · CIAD — Gestión del equipo</div>
          </div>

          <form onSubmit={handleFormSubmit}>
            <div style={{marginBottom:14}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',letterSpacing:'.04em',textTransform:'uppercase' as const,marginBottom:6}}>DNI</label>
              <input
                type="text"
                value={user}
                onChange={e=>setUser(e.target.value)}
                placeholder="Ej: 73066140"
                required
                autoFocus
                style={{width:'100%',padding:'11px 14px',border:'1.5px solid #CBD5E1',borderRadius:10,fontFamily:'inherit',fontSize:14,outline:'none'}}
                onFocus={e=>(e.target as any).style.borderColor='#2563C8'}
                onBlur={e=>(e.target as any).style.borderColor='#CBD5E1'}
              />
            </div>
            <div style={{marginBottom:20}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#475569',letterSpacing:'.04em',textTransform:'uppercase' as const,marginBottom:6}}>CONTRASEÑA</label>
              <input
                type="password"
                value={pass}
                onChange={e=>setPass(e.target.value)}
                placeholder="••••••••"
                required
                style={{width:'100%',padding:'11px 14px',border:'1.5px solid #CBD5E1',borderRadius:10,fontFamily:'inherit',fontSize:14,outline:'none'}}
                onFocus={e=>(e.target as any).style.borderColor='#2563C8'}
                onBlur={e=>(e.target as any).style.borderColor='#CBD5E1'}
              />
            </div>
            {error&&<div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:9,padding:'10px 14px',fontSize:12,color:'#b91c1c',marginBottom:14,lineHeight:1.5}}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{width:'100%',padding:13,background:loading?'#94a3b8':'#002F6C',color:'white',border:'none',borderRadius:10,fontFamily:'inherit',fontSize:14,fontWeight:600,cursor:loading?'not-allowed':'pointer',transition:'background .2s'}}>
              {loading?'Verificando...':'Ingresar →'}
            </button>
          </form>

          <div style={{marginTop:16,padding:'10px 14px',background:'#f8fafc',borderRadius:9,fontSize:11,color:'#94a3b8',lineHeight:1.7}}>
            💡 Tu DNI es tu usuario. Si no tienes contraseña, pide al coordinador que la configure.
          </div>
        </div>
      )}
    </div>
  )
}