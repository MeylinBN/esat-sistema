// types/index.ts

export type Rol = 'Practicante' | 'Tesista' | 'Voluntario' | 'Investigador' | 'Asistente' | 'SENATI' | 'EcoBIOTEM' | 'Coordinador'

export interface Persona {
  id: string
  nombre: string
  dni: string
  rol: Rol
  subrol?: string
  grupo: string
  hora_ingreso?: string | null
  tolerancia: number
  activo: boolean
  color: string
  area?: string
  hs_semanales?: number | null
  sin_horario: boolean
  created_at?: string
}

export interface Horario {
  id: string
  persona_id: string
  dia: 'L' | 'M' | 'X' | 'J' | 'V' | 'S' | 'D'
  hora_entrada: string
  hora_salida: string
}

export type EstadoAsistencia = 'presente' | 'tarde' | 'ausente' | 'permiso' | 'falta_justificada' | 'falta_injustificada' | 'vacaciones'

export interface Asistencia {
  id: string
  persona_id: string
  fecha: string
  hora_entrada?: string | null
  hora_salida?: string | null
  estado: EstadoAsistencia
  tardanza_min?: number
  observacion?: string
  registrado_por?: string | null
}

export type TipoPermiso = 'permiso_medico' | 'permiso_personal' | 'permiso_academico' | 'falta_justificada' | 'falta_injustificada' | 'vacaciones'
export type EstadoPermiso = 'aprobado' | 'pendiente' | 'rechazado'

export interface Permiso {
  id: string
  persona_id: string
  tipo: TipoPermiso
  fecha_inicio: string
  fecha_fin: string
  motivo?: string
  estado: EstadoPermiso
  dias_recuperacion?: string
  aprobado_por?: string | null
  created_at?: string
}

export type TipoAviso = 'horario' | 'permiso' | 'anuncio' | 'recordatorio' | 'urgente'

export interface Aviso {
  id: string
  tipo: TipoAviso
  titulo: string
  descripcion?: string
  destinatario: string
  fecha_evento?: string | null
  urgente: boolean
  autor_id?: string | null
  created_at?: string
}

export type Prioridad = 'alta' | 'media' | 'baja'
export type EstadoTarea = 'pendiente' | 'en_progreso' | 'completada' | 'cancelada'

export interface Tarea {
  id: string
  titulo: string
  descripcion?: string
  persona_id: string
  prioridad: Prioridad
  estado: EstadoTarea
  fecha_limite?: string | null
  horas_estimadas?: number | null
  semana?: string
  asignado_por?: string
  comentario?: string
  created_at?: string
  avances?: AvanceSemanal[]
}

export interface AvanceSemanal {
  id: string
  tarea_id: string
  semana: string
  porcentaje: number
}

export interface SesionEco {
  id: string
  persona_id: string
  fecha: string
  inicio?: string | null
  fin?: string | null
  minutos?: number | null
  nota?: string
}

// Helpers
export function getRolLabel(persona: Persona): string {
  if (persona.rol === 'EcoBIOTEM') return '🌿 GI EcoBIOTEM'
  if (persona.rol === 'SENATI') return `Practicante SENATI · ${persona.subrol ?? ''}`
  if (persona.rol === 'Practicante') return `Practicante UNASAM · ${persona.subrol ?? ''}`
  return `${persona.rol}${persona.subrol ? ' · ' + persona.subrol : ''}`
}

export function getTurno(franjas: { hora_entrada: string; hora_salida: string }[]): string {
  if (!franjas || franjas.length === 0) return '—'
  const tieneManana = franjas.some(f => parseInt(f.hora_entrada.split(':')[0]) < 13)
  const tieneTarde  = franjas.some(f => parseInt(f.hora_entrada.split(':')[0]) >= 13)
  if (tieneManana && tieneTarde) return 'M+T'
  if (tieneManana) return 'Mañana'
  if (tieneTarde)  return 'Tarde'
  return '—'
}

export const DIAS_LABEL: Record<string, string> = {
  L: 'Lunes', M: 'Martes', X: 'Miércoles', J: 'Jueves', V: 'Viernes', S: 'Sábado', D: 'Domingo'
}

export const TIPO_AVISO_LABEL: Record<TipoAviso, string> = {
  horario: 'Cambio de horario',
  permiso: 'Permiso / Falta',
  anuncio: 'Anuncio',
  recordatorio: 'Recordatorio',
  urgente: 'URGENTE',
}
