-- ============================================================
--  ESAT · CIAD — Migración 0004: soportar 2 turnos por día
--
--  Problema: personas con horario de mañana Y tarde el mismo día
--  no podían tener ambos registros de asistencia, porque la tabla
--  solo permitía 1 fila por (persona_id, fecha). Al marcar el
--  segundo turno, el upsert sobrescribía el primero.
--
--  Solución: agregar columna "turno" ('manana' | 'tarde' | 'unico')
--  y ampliar la restricción única a (persona_id, fecha, turno).
--  Los registros existentes quedan como 'unico' (no se tocan).
-- ============================================================

alter table public.asistencias add column if not exists turno text not null default 'unico';
alter table public.asistencias drop constraint if exists asistencias_turno_check;
alter table public.asistencias add constraint asistencias_turno_check check (turno in ('manana','tarde','unico'));

-- Buscar y eliminar el constraint único original (persona_id, fecha) sea
-- cual sea su nombre real, en vez de asumirlo.
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.asistencias'::regclass
    and contype = 'u'
    and (
      select array_agg(attname::text order by attname::text)
      from unnest(conkey) as k(attnum)
      join pg_attribute a on a.attrelid = 'public.asistencias'::regclass and a.attnum = k.attnum
    ) = array['fecha','persona_id']::text[];

  if cname is not null then
    execute format('alter table public.asistencias drop constraint %I', cname);
  end if;
end $$;

alter table public.asistencias drop constraint if exists asistencias_persona_fecha_turno_key;
alter table public.asistencias add constraint asistencias_persona_fecha_turno_key unique (persona_id, fecha, turno);
