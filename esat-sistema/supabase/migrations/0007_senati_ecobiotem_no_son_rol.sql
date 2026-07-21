-- ============================================================
--  ESAT · CIAD — Migración 0007: SENATI y EcoBIOTEM no son un rol
--
--  Error de diseño original: "SENATI" y "EcoBIOTEM" se guardaban en
--  personas.rol, pero en realidad describen otra cosa:
--   - EcoBIOTEM ya es un GRUPO (personas.grupo) — su rol real es el
--     puesto que ocupan (Investigador, en todos los casos actuales).
--   - SENATI es de dónde viene la persona, no su puesto — ya existe
--     la columna personas.origen con ese valor para eso.
--
--  Esta migración reclasifica a las personas existentes y quita esos
--  dos valores de la lista de roles válidos.
-- ============================================================

-- 1. Reclasificar quienes tienen rol='EcoBIOTEM' -> Investigador
--    (su grupo ya es 'EcoBIOTEM', eso no cambia)
update public.personas
set rol = 'Investigador'
where rol = 'EcoBIOTEM';

-- 2. Reclasificar quienes tienen rol='SENATI' -> Practicante + origen SENATI
--    (su grupo actual, ej. 'ESAT', no cambia)
update public.personas
set rol = 'Practicante',
    origen = 'SENATI'
where rol = 'SENATI';

-- 3. Quitar SENATI y EcoBIOTEM de los valores permitidos en personas.rol
alter table public.personas drop constraint if exists personas_rol_check;
alter table public.personas add constraint personas_rol_check check (rol in (
  'Practicante','Tesista','Voluntario','Investigador','Investigador Formativo',
  'Asistente','Coordinador'
));

-- 4. Quitarlos del catálogo config_roles (ya no deben ofrecerse como Rol
--    al crear personal nuevo)
delete from public.config_roles where nombre in ('SENATI','EcoBIOTEM');
