// lib/useLocationCheck.ts
'use client'
import { useState, useEffect, useCallback } from 'react'

// ──────────────────────────────────────────────
//  Coordenadas del centro de ESAT UNASAM
//  Cámbialas por las coordenadas exactas:
//  Abre Google Maps, haz clic en la ubicación
//  exacta de ESAT y copia lat/lng
// ──────────────────────────────────────────────
const ESAT_LAT = -9.521389262026704      // ← reemplaza con lat exacta
const ESAT_LNG = -77.52848854200074     // ← reemplaza con lng exacta
const RADIO_METROS = 150        // radio permitido en metros

type LocationStatus = 'checking' | 'authorized' | 'unauthorized' | 'gps_denied' | 'error'

export interface LocationCheckResult {
  status: LocationStatus
  ipOk: boolean
  gpsOk: boolean | null      // null = no se pudo verificar
  distanciaMetros: number | null
  mensaje: string
  checking: boolean
}

function haversineMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function useLocationCheck(): LocationCheckResult & { recheck: () => void } {
  const [state, setState] = useState<LocationCheckResult>({
    status: 'checking',
    ipOk: false,
    gpsOk: null,
    distanciaMetros: null,
    mensaje: 'Verificando tu ubicación...',
    checking: true,
  })

  const check = useCallback(async () => {
    setState(s => ({ ...s, status: 'checking', checking: true, mensaje: 'Verificando ubicación...' }))

    // ── 1. Verificar IP ──────────────────────────────
    let ipOk = false
    try {
      const res = await fetch('/api/check-location')
      const data = await res.json()
      ipOk = data.authorized
    } catch {
      ipOk = false
    }

    // ── 2. Verificar GPS ─────────────────────────────
    const gpsResult = await new Promise<{ ok: boolean; distancia: number | null }>((resolve) => {
      if (!navigator.geolocation) {
        resolve({ ok: false, distancia: null })
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = haversineMetros(
            pos.coords.latitude,
            pos.coords.longitude,
            ESAT_LAT,
            ESAT_LNG
          )
          resolve({ ok: dist <= RADIO_METROS, distancia: Math.round(dist) })
        },
        () => resolve({ ok: false, distancia: null }),
        { timeout: 8000, maximumAge: 60_000, enableHighAccuracy: false }
      )
    })

    // ── 3. Evaluar resultado combinado ───────────────
    //  Requiere IP correcta O GPS dentro del radio
    //  (cualquiera de los dos basta para mayor comodidad)
    //  Si quieres que AMBOS sean obligatorios cambia || por &&
    const authorized = ipOk || gpsResult.ok

    let mensaje = ''
    let status: LocationStatus = 'authorized'

    if (authorized) {
      mensaje = ipOk
        ? '✅ Conectado a la red de ESAT'
        : `✅ Dentro del campus (${gpsResult.distancia}m de ESAT)`
      status = 'authorized'
    } else {
      if (gpsResult.distancia !== null) {
        mensaje = `🚫 Estás a ${gpsResult.distancia}m de ESAT. Debes estar en el campus para registrar asistencia.`
      } else {
        mensaje = '🚫 No estás en la red de ESAT. Activa el GPS o conéctate al WiFi del campus.'
      }
      status = 'unauthorized'
    }

    setState({
      status,
      ipOk,
      gpsOk: gpsResult.ok,
      distanciaMetros: gpsResult.distancia,
      mensaje,
      checking: false,
    })
  }, [])

  useEffect(() => { check() }, [check])

  return { ...state, recheck: check }
}