-- ============================================================
--  ESAT · CIAD — Migración 0006: tolerancia estándar de 5 minutos
--
--  Regla: si el horario es 9:00am, marcar hasta 9:05am cuenta como
--  puntual; desde 9:06am ya es tardanza. Eso ya lo calcula bien el
--  código (tardanza = minutos_tarde - tolerancia), solo faltaba que
--  todas las personas tuvieran tolerancia = 5 por defecto.
-- ============================================================

alter table public.personas alter column tolerancia set default 5;

update public.personas set tolerancia = 5;
