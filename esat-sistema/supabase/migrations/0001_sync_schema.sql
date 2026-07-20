-- ============================================================
--  ESAT · CIAD — Migración 0001: sincronizar el esquema real
--  con lo que el código de la app espera.
--
--  SEGURO DE RE-EJECUTAR: todo usa IF NOT EXISTS / DROP+CREATE
--  de constraints y políticas, así que puedes correr este
--  script varias veces sin duplicar nada ni perder datos.
--
--  Cómo ejecutarlo: Supabase Dashboard → SQL Editor → pega todo
--  el archivo → Run.
-- ============================================================

-- ─── 1. COLUMNAS FALTANTES EN TABLAS EXISTENTES ────────────

-- personas: vínculo con Supabase Auth + datos de contacto
alter table public.personas add column if not exists auth_id uuid references auth.users(id) on delete set null;
alter table public.personas add column if not exists origen text;
alter table public.personas add column if not exists fecha_cumpleanos date;
alter table public.personas add column if not exists celular text;
alter table public.personas add column if not exists correo_personal text;
alter table public.personas add column if not exists domicilio text;
alter table public.personas add column if not exists contacto_emergencia_nombre text;
alter table public.personas add column if not exists contacto_emergencia_telefono text;
alter table public.personas add column if not exists contacto_emergencia_parentesco text;

create unique index if not exists personas_auth_id_key on public.personas(auth_id) where auth_id is not null;

-- asistencias: registro de horas de recuperación
alter table public.asistencias add column if not exists hora_recuperacion time;
alter table public.asistencias add column if not exists recuperacion_motivo text;
alter table public.asistencias add column if not exists recuperacion_aprobada boolean;

-- permisos: flujo de recuperación de horas + auditoría de revisión
alter table public.permisos add column if not exists dia_recuperacion date;
alter table public.permisos add column if not exists hora_recuperacion_inicio time;
alter table public.permisos add column if not exists hora_recuperacion_fin time;
alter table public.permisos add column if not exists sustento_texto text;
alter table public.permisos add column if not exists recuperacion_aprobada boolean not null default false;
alter table public.permisos add column if not exists revisado_por uuid references public.personas(id);

-- permisos.tipo: el módulo de horarios registra cambios de horario como "permiso" especial
alter table public.permisos drop constraint if exists permisos_tipo_check;
alter table public.permisos add constraint permisos_tipo_check check (tipo in (
  'permiso_medico','permiso_personal','permiso_academico',
  'falta_justificada','falta_injustificada','vacaciones','cambio_horario'
));

-- tareas: flujo ampliado de estados (asignado → en_progreso → pendiente_revision → subsanacion → completada)
alter table public.tareas add column if not exists fecha_revision date;
alter table public.tareas drop constraint if exists tareas_estado_check;
alter table public.tareas add constraint tareas_estado_check check (estado in (
  'pendiente','asignado','en_progreso','pendiente_revision','subsanacion','completada','cancelada'
));

-- avances_semanales: comentario opcional del practicante
alter table public.avances_semanales add column if not exists comentario text;

-- avisos: se agregó el tipo "reunion"
alter table public.avisos drop constraint if exists avisos_tipo_check;
alter table public.avisos add constraint avisos_tipo_check check (tipo in (
  'horario','permiso','anuncio','recordatorio','urgente','reunion'
));

-- ─── 2. TABLAS NUEVAS ───────────────────────────────────────

-- NOTA: usamos "create table if not exists" con la MÍNIMA forma (id, nombre)
-- y luego "alter table add column if not exists" para el resto, porque estas
-- tablas pueden haber quedado ya creadas a medias en un intento anterior
-- (por eso el error "column orden does not exist" la primera vez: la tabla
-- areas ya existía sin esa columna, y CREATE TABLE IF NOT EXISTS no la altera).

-- Catálogo de áreas (dropdown en Personas)
create table if not exists public.areas (
  id      uuid primary key default uuid_generate_v4(),
  nombre  text not null
);
alter table public.areas add column if not exists activo boolean not null default true;
alter table public.areas add column if not exists orden int default 0;
create unique index if not exists areas_nombre_key on public.areas(nombre);

-- Catálogo de orígenes (UNASAM, SENATI, Externo, ...)
create table if not exists public.origenes (
  id      uuid primary key default uuid_generate_v4(),
  nombre  text not null
);
alter table public.origenes add column if not exists activo boolean not null default true;
alter table public.origenes add column if not exists orden int default 0;
create unique index if not exists origenes_nombre_key on public.origenes(nombre);

-- Catálogo de roles configurables (complementa el enum fijo de personas.rol)
create table if not exists public.config_roles (
  id      uuid primary key default uuid_generate_v4(),
  nombre  text not null
);
alter table public.config_roles add column if not exists orden int default 0;
create unique index if not exists config_roles_nombre_key on public.config_roles(nombre);

-- Catálogo de grupos (ESAT, EcoBIOTEM, GAMH, PAMEC, CIAD, ...)
create table if not exists public.config_grupos (
  id      uuid primary key default uuid_generate_v4(),
  nombre  text not null
);
alter table public.config_grupos add column if not exists orden int default 0;
create unique index if not exists config_grupos_nombre_key on public.config_grupos(nombre);

-- Horas extra aprobadas por logística
create table if not exists public.horas_extras (
  id          uuid primary key default uuid_generate_v4(),
  persona_id  uuid not null references public.personas(id) on delete cascade
);
alter table public.horas_extras add column if not exists fecha date not null default current_date;
alter table public.horas_extras add column if not exists hora_inicio time;
alter table public.horas_extras add column if not exists hora_fin time;
alter table public.horas_extras add column if not exists horas_solicitadas numeric(5,2);
alter table public.horas_extras add column if not exists motivo text;
alter table public.horas_extras add column if not exists aprobado boolean not null default false;
alter table public.horas_extras add column if not exists aprobado_por uuid references public.personas(id);
alter table public.horas_extras add column if not exists created_at timestamptz default now();

-- Flexibilidad horaria (minutos de gracia) autorizada por logística
create table if not exists public.flexibilidad_horaria (
  id          uuid primary key default uuid_generate_v4(),
  persona_id  uuid not null references public.personas(id) on delete cascade
);
alter table public.flexibilidad_horaria add column if not exists fecha date not null default current_date;
alter table public.flexibilidad_horaria add column if not exists minutos_gracia int not null default 0;
alter table public.flexibilidad_horaria add column if not exists motivo text;
alter table public.flexibilidad_horaria add column if not exists autorizado_por uuid references public.personas(id);
alter table public.flexibilidad_horaria add column if not exists created_at timestamptz default now();

-- ─── 3. RLS EN TABLAS NUEVAS ────────────────────────────────
alter table public.areas              enable row level security;
alter table public.origenes           enable row level security;
alter table public.config_roles       enable row level security;
alter table public.config_grupos      enable row level security;
alter table public.horas_extras       enable row level security;
alter table public.flexibilidad_horaria enable row level security;

drop policy if exists "Autenticado lee areas"    on public.areas;
drop policy if exists "Autenticado lee origenes" on public.origenes;
drop policy if exists "Autenticado lee roles"    on public.config_roles;
drop policy if exists "Autenticado lee grupos"   on public.config_grupos;
drop policy if exists "Autenticado lee horas_extras" on public.horas_extras;
drop policy if exists "Autenticado lee flex"     on public.flexibilidad_horaria;
drop policy if exists "Autenticado escribe horas_extras" on public.horas_extras;
drop policy if exists "Autenticado escribe flex" on public.flexibilidad_horaria;
drop policy if exists "Autenticado escribe areas" on public.areas;
drop policy if exists "Autenticado escribe origenes" on public.origenes;
drop policy if exists "Autenticado escribe roles" on public.config_roles;
drop policy if exists "Autenticado escribe grupos" on public.config_grupos;

create policy "Autenticado lee areas"    on public.areas    for select using (auth.role() = 'authenticated');
create policy "Autenticado lee origenes" on public.origenes for select using (auth.role() = 'authenticated');
create policy "Autenticado lee roles"    on public.config_roles  for select using (auth.role() = 'authenticated');
create policy "Autenticado lee grupos"   on public.config_grupos for select using (auth.role() = 'authenticated');
create policy "Autenticado lee horas_extras" on public.horas_extras for select using (auth.role() = 'authenticated');
create policy "Autenticado lee flex"     on public.flexibilidad_horaria for select using (auth.role() = 'authenticated');

create policy "Autenticado escribe horas_extras" on public.horas_extras for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe flex" on public.flexibilidad_horaria for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe areas" on public.areas for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe origenes" on public.origenes for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe roles" on public.config_roles for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe grupos" on public.config_grupos for all using (auth.role() = 'authenticated');

-- ─── 4. SEEDS BÁSICOS (edítalos luego desde el SQL Editor o
--        crea una pantalla de configuración; por ahora el
--        código solo LEE de estas tablas) ───────────────────
insert into public.areas (nombre, orden) values
  ('Ambiental',1),('Sistemas',2),('Técnico',3),('General',4),
  ('Ecología',5),('Biodiversidad',6),('Biotecnología',7)
on conflict (nombre) do nothing;

insert into public.origenes (nombre, orden) values
  ('UNASAM',1),('SENATI',2),('Externo',3)
on conflict (nombre) do nothing;

insert into public.config_roles (nombre, orden) values
  ('Practicante',1),('Tesista',2),('Voluntario',3),('Investigador',4),
  ('Asistente',5),('SENATI',6),('EcoBIOTEM',7),('Coordinador',8)
on conflict (nombre) do nothing;

insert into public.config_grupos (nombre, orden) values
  ('ESAT',1),('EcoBIOTEM',2),('GAMH',3),('PAMEC',4),('CIAD',5)
on conflict (nombre) do nothing;

-- ─── 5. VINCULAR personas.auth_id CON LOS USUARIOS DE AUTH YA CREADOS ───
-- Si ya invitaste usuarios de Supabase Auth manualmente y el email
-- sigue el patrón '<dni>@sistema.esat', esto los vincula automáticamente.
-- Es seguro re-ejecutar: solo actualiza donde el DNI coincide.
update public.personas p
set auth_id = u.id
from auth.users u
where p.auth_id is null
  and u.email = p.dni || '@sistema.esat';
