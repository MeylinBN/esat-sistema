-- ============================================================
--  ESAT · CIAD — Migración 0002: arreglar catálogo de roles
--
--  Problema: config_roles quedó con datos sucios de un intento
--  anterior (minúsculas como "practicante", "coordinador", etc.)
--  que NO coinciden con los valores exactos que exige el check
--  constraint de personas.rol. Elegir esos valores en el
--  formulario de Personas provoca el error:
--  "violates check constraint personas_rol_check"
--
--  Solución: vaciar config_roles (no tiene nada que dependa de
--  sus filas, es solo el catálogo para el desplegable) y volver
--  a sembrarlo con los valores exactos, incluyendo el rol nuevo
--  "Investigador Formativo".
-- ============================================================

-- 1. Agregar "Investigador Formativo" como rol válido en personas
alter table public.personas drop constraint if exists personas_rol_check;
alter table public.personas add constraint personas_rol_check check (rol in (
  'Practicante','Tesista','Voluntario','Investigador','Investigador Formativo',
  'Asistente','SENATI','EcoBIOTEM','Coordinador'
));

-- 2. Limpiar y resembrar el catálogo config_roles con los valores correctos
truncate table public.config_roles;
insert into public.config_roles (nombre, orden) values
  ('Practicante',1),
  ('Tesista',2),
  ('Voluntario',3),
  ('Investigador',4),
  ('Investigador Formativo',5),
  ('Asistente',6),
  ('SENATI',7),
  ('EcoBIOTEM',8),
  ('Coordinador',9);
