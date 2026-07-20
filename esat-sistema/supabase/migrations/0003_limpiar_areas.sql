-- ============================================================
--  ESAT · CIAD — Migración 0003: quitar áreas de ejemplo
--
--  Las áreas Ambiental/Sistemas/Técnico/General/Ecología/
--  Biodiversidad/Biotecnología eran datos de ejemplo inventados
--  al crear la migración 0001, no la estructura real de la
--  organización. Se eliminan del catálogo.
-- ============================================================

delete from public.areas
where nombre in ('Ambiental','Sistemas','Técnico','General','Ecología','Biodiversidad','Biotecnología');
