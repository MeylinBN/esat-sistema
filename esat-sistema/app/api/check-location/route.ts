// app/api/check-location/route.ts
import { NextRequest, NextResponse } from 'next/server'
 
// ──────────────────────────────────────────────
//  IPs públicas autorizadas de la universidad
//  Para obtener la IP actual: conectate al WiFi
//  de ESAT y entra a https://api.ipify.org
//  Puedes agregar varias si hay más de un router
// ──────────────────────────────────────────────
const AUTHORIZED_IPS: string[] = [
  process.env.AUTHORIZED_IP_1 ?? '',
  process.env.AUTHORIZED_IP_2 ?? '',
].filter(Boolean)
 
function getClientIP(req: NextRequest): string {
  // Vercel pone la IP real en este header
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? '0.0.0.0'
}
 
export async function GET(req: NextRequest) {
  const clientIP = getClientIP(req)
  const authorized = AUTHORIZED_IPS.length > 0 && AUTHORIZED_IPS.includes(clientIP)
 
  return NextResponse.json({
    authorized,
    ip: clientIP,
    // Solo muestra las IPs autorizadas en desarrollo para debug
    ...(process.env.NODE_ENV === 'development' && {
      authorizedIPs: AUTHORIZED_IPS,
    }),
  })
}
 