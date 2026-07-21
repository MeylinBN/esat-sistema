-- ============================================================
--  ESAT · CIAD — Migración 0005: avance diario en vez de semanal
--
--  Problema: avances_semanales solo permitía 1 fila por (tarea_id,
--  semana). Cada vez que alguien registraba su avance esa semana,
--  se sobreescribía el valor anterior — nunca hubo forma real de
--  llevar un registro DIARIO del progreso, que es lo que se usa
--  en la oficina.
--
--  Solución: agregar columna "fecha" (el día real del registro) y
--  cambiar la restricción única a (tarea_id, fecha), permitiendo
--  una fila por tarea por día. La columna "semana" (con una
--  numeración de semana propia y confusa, sin relación con el
--  calendario real) se elimina: la semana/rango de fechas para
--  mostrar en pantalla ahora se calcula directamente desde "fecha".
--
--  Los registros viejos (guardados solo con "semana", sin día
--  exacto) se migran usando el LUNES de esa semana como fecha,
--  para no perder el historial.
-- ============================================================

alter table public.avances_semanales add column if not exists fecha date;

-- Backfill: mismo cálculo que usaba el código viejo (año, semana 1
-- empieza el 12 de enero) para reconstruir el lunes de cada semana.
update public.avances_semanales
set fecha = make_date(split_part(semana,'-',1)::int, 1, 12)
            + (split_part(semana,'-',2)::int - 1) * 7
where fecha is null
  and semana ~ '^\d{4}-\d+$';

-- Cualquier fila que no se pudo interpretar (semana con formato raro):
-- usar la fecha de creación como último recurso.
update public.avances_semanales
set fecha = created_at::date
where fecha is null;

alter table public.avances_semanales alter column fecha set not null;

-- Quitar el constraint único viejo (tarea_id, semana), sea cual sea su
-- nombre real (mismo patrón usado en la migración 0004).
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.avances_semanales'::regclass
    and contype = 'u'
    and (
      select array_agg(attname::text order by attname::text)
      from unnest(conkey) as k(attnum)
      join pg_attribute a on a.attrelid = 'public.avances_semanales'::regclass and a.attnum = k.attnum
    ) = array['semana','tarea_id']::text[];

  if cname is not null then
    execute format('alter table public.avances_semanales drop constraint %I', cname);
  end if;
end $$;

-- Registros viejos con "semana" en texto libre (ej. "Sem 19") pudieron
-- calcular la misma fecha para la misma tarea. Antes de exigir unicidad,
-- nos quedamos con el más reciente de cada (tarea_id, fecha) duplicado.
delete from public.avances_semanales
where id in (
  select id from (
    select id, row_number() over (
      partition by tarea_id, fecha order by created_at desc, id desc
    ) as rn
    from public.avances_semanales
  ) x where x.rn > 1
);

alter table public.avances_semanales drop constraint if exists avances_semanales_tarea_fecha_key;
alter table public.avances_semanales add constraint avances_semanales_tarea_fecha_key unique (tarea_id, fecha);

alter table public.avances_semanales drop column if exists semana;
