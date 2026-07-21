-- ============================================================
--  ESAT · CIAD — Sistema de Gestión  |  Supabase Schema
--  Ejecutar en el SQL Editor de tu proyecto Supabase
--
--  Este archivo es la fuente de verdad para una instalación
--  NUEVA desde cero. Si ya tienes datos en producción, NO lo
--  vuelvas a ejecutar entero: usa en su lugar los scripts de
--  supabase/migrations/ (son idempotentes y no borran nada).
-- ============================================================

-- ─── EXTENSIONES ───────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── TABLA: personas ───────────────────────────────────────
create table if not exists public.personas (
  id            uuid primary key default uuid_generate_v4(),
  nombre        text not null,
  dni           text unique not null,
  rol           text not null check (rol in ('Practicante','Tesista','Voluntario','Investigador','Investigador Formativo','Asistente','SENATI','EcoBIOTEM','Coordinador')),
  subrol        text,
  grupo         text not null default 'ESAT',  -- 'ESAT' | 'EcoBIOTEM' | 'GAMH' | 'PAMEC' | 'CIAD'
  origen        text,                          -- 'UNASAM' | 'SENATI' | 'Externo' | ...
  hora_ingreso  time,                           -- null para EcoBIOTEM
  tolerancia    int not null default 5,         -- minutos
  activo        boolean not null default true,
  color         text not null default '#1e40af',
  area          text,
  hs_semanales  numeric(5,2),
  sin_horario   boolean not null default false,
  password_hash text,                           -- bcrypt, se gestiona por Supabase Auth
  auth_id       uuid references auth.users(id) on delete set null,  -- vínculo con Supabase Auth
  fecha_cumpleanos date,
  celular       text,
  correo_personal text,
  domicilio     text,
  contacto_emergencia_nombre     text,
  contacto_emergencia_telefono   text,
  contacto_emergencia_parentesco text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create unique index if not exists personas_auth_id_key on public.personas(auth_id) where auth_id is not null;

-- ─── TABLA: horarios ───────────────────────────────────────
-- Cada fila es una franja horaria de un día para una persona
create table if not exists public.horarios (
  id          uuid primary key default uuid_generate_v4(),
  persona_id  uuid not null references public.personas(id) on delete cascade,
  dia         char(1) not null check (dia in ('L','M','X','J','V','S','D')),
  hora_entrada time not null,
  hora_salida  time not null,
  created_at   timestamptz default now()
);

-- ─── TABLA: asistencias ────────────────────────────────────
create table if not exists public.asistencias (
  id          uuid primary key default uuid_generate_v4(),
  persona_id  uuid not null references public.personas(id) on delete cascade,
  fecha       date not null default current_date,
  turno       text not null default 'unico' check (turno in ('manana','tarde','unico')),
  hora_entrada time,
  hora_salida  time,
  estado      text not null default 'presente'
              check (estado in ('presente','tarde','ausente','permiso','falta_justificada','falta_injustificada','vacaciones')),
  tardanza_min int default 0,
  observacion text,
  hora_recuperacion time,          -- hora marcada fuera de horario (recuperación)
  recuperacion_motivo text,
  recuperacion_aprobada boolean,
  registrado_por uuid references public.personas(id),
  created_at  timestamptz default now(),
  unique (persona_id, fecha, turno)
);

-- ─── TABLA: permisos ───────────────────────────────────────
create table if not exists public.permisos (
  id          uuid primary key default uuid_generate_v4(),
  persona_id  uuid not null references public.personas(id) on delete cascade,
  tipo        text not null check (tipo in (
    'permiso_medico','permiso_personal','permiso_academico',
    'falta_justificada','falta_injustificada','vacaciones','cambio_horario')),
  fecha_inicio date not null,
  fecha_fin    date not null,
  motivo       text,
  sustento_texto text,
  estado       text not null default 'pendiente'
               check (estado in ('aprobado','pendiente','rechazado')),
  dias_recuperacion text,          -- descripción libre ("Martes 08:30-13:00")
  dia_recuperacion  date,          -- fecha concreta de recuperación
  hora_recuperacion_inicio time,
  hora_recuperacion_fin    time,
  recuperacion_aprobada boolean not null default false,
  aprobado_por uuid references public.personas(id),
  revisado_por uuid references public.personas(id),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ─── TABLA: avisos ─────────────────────────────────────────
create table if not exists public.avisos (
  id          uuid primary key default uuid_generate_v4(),
  tipo        text not null check (tipo in ('horario','permiso','anuncio','recordatorio','urgente','reunion')),
  titulo      text not null,
  descripcion text,
  destinatario text not null default 'todos',
  fecha_evento date,
  urgente     boolean default false,
  autor_id    uuid references public.personas(id),
  created_at  timestamptz default now()
);

-- ─── TABLA: tareas ─────────────────────────────────────────
create table if not exists public.tareas (
  id            uuid primary key default uuid_generate_v4(),
  titulo        text not null,
  descripcion   text,
  persona_id    uuid not null references public.personas(id) on delete cascade,
  prioridad     text not null default 'media' check (prioridad in ('alta','media','baja')),
  estado        text not null default 'pendiente'
                check (estado in ('pendiente','asignado','en_progreso','pendiente_revision','subsanacion','completada','cancelada')),
  fecha_limite  date,
  fecha_revision date,
  horas_estimadas numeric(6,2),
  semana        text,
  asignado_por  text,
  comentario    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── TABLA: avances_semanales ──────────────────────────────
create table if not exists public.avances_semanales (
  id         uuid primary key default uuid_generate_v4(),
  tarea_id   uuid not null references public.tareas(id) on delete cascade,
  fecha      date not null default current_date,  -- día real del registro (avance diario)
  porcentaje int not null default 0 check (porcentaje between 0 and 100),
  comentario text,  -- también usado para dudas/comentarios del alumno
  created_at timestamptz default now(),
  unique (tarea_id, fecha)
);

-- ─── TABLA: sesiones_eco ───────────────────────────────────
-- Temporizador para miembros EcoBIOTEM (sin horario fijo)
create table if not exists public.sesiones_eco (
  id         uuid primary key default uuid_generate_v4(),
  persona_id uuid not null references public.personas(id) on delete cascade,
  fecha      date not null default current_date,
  inicio     timestamptz,
  fin        timestamptz,
  minutos    int,           -- calculado al cerrar
  nota       text,
  created_at timestamptz default now()
);

-- ─── TABLA: cambios_horario ────────────────────────────────
create table if not exists public.cambios_horario (
  id         uuid primary key default uuid_generate_v4(),
  persona_id uuid references public.personas(id) on delete cascade, -- null = todo el equipo
  dia        text,
  nueva_entrada time,
  nueva_salida  time,
  motivo     text,
  fecha_cambio date,
  publicado_por uuid references public.personas(id),
  created_at timestamptz default now()
);

-- ─── TABLA: horas_extras ───────────────────────────────────
create table if not exists public.horas_extras (
  id                uuid primary key default uuid_generate_v4(),
  persona_id        uuid not null references public.personas(id) on delete cascade,
  fecha             date not null default current_date,
  hora_inicio       time not null,
  hora_fin          time not null,
  horas_solicitadas numeric(5,2),
  motivo            text,
  aprobado          boolean not null default false,
  aprobado_por      uuid references public.personas(id),
  created_at        timestamptz default now()
);

-- ─── TABLA: flexibilidad_horaria ───────────────────────────
create table if not exists public.flexibilidad_horaria (
  id              uuid primary key default uuid_generate_v4(),
  persona_id      uuid not null references public.personas(id) on delete cascade,
  fecha           date not null default current_date,
  minutos_gracia  int not null default 0,
  motivo          text,
  autorizado_por  uuid references public.personas(id),
  created_at      timestamptz default now()
);

-- ─── TABLAS DE CATÁLOGO (dropdowns configurables) ──────────
-- Se usa create+alter (en vez de todo en el create table) para que este
-- script también sea seguro de correr sobre una base donde estas tablas
-- ya existan a medias.
create table if not exists public.areas (
  id      uuid primary key default uuid_generate_v4(),
  nombre  text not null
);
alter table public.areas add column if not exists activo boolean not null default true;
alter table public.areas add column if not exists orden int default 0;
create unique index if not exists areas_nombre_key on public.areas(nombre);

create table if not exists public.origenes (
  id      uuid primary key default uuid_generate_v4(),
  nombre  text not null
);
alter table public.origenes add column if not exists activo boolean not null default true;
alter table public.origenes add column if not exists orden int default 0;
create unique index if not exists origenes_nombre_key on public.origenes(nombre);

create table if not exists public.config_roles (
  id      uuid primary key default uuid_generate_v4(),
  nombre  text not null
);
alter table public.config_roles add column if not exists orden int default 0;
create unique index if not exists config_roles_nombre_key on public.config_roles(nombre);

create table if not exists public.config_grupos (
  id      uuid primary key default uuid_generate_v4(),
  nombre  text not null
);
alter table public.config_grupos add column if not exists orden int default 0;
create unique index if not exists config_grupos_nombre_key on public.config_grupos(nombre);

-- ─── RLS: Row Level Security ───────────────────────────────
alter table public.personas          enable row level security;
alter table public.horarios          enable row level security;
alter table public.asistencias       enable row level security;
alter table public.permisos          enable row level security;
alter table public.avisos            enable row level security;
alter table public.tareas            enable row level security;
alter table public.avances_semanales enable row level security;
alter table public.sesiones_eco      enable row level security;
alter table public.cambios_horario   enable row level security;
alter table public.horas_extras      enable row level security;
alter table public.flexibilidad_horaria enable row level security;
alter table public.areas             enable row level security;
alter table public.origenes          enable row level security;
alter table public.config_roles      enable row level security;
alter table public.config_grupos     enable row level security;

-- Política: Coordinadores ven todo (usar rol de Supabase Auth)
-- Por ahora: acceso abierto autenticado (ajustar según roles de auth)
create policy "Autenticado lee personas"  on public.personas  for select using (auth.role() = 'authenticated');
create policy "Autenticado lee horarios"  on public.horarios  for select using (auth.role() = 'authenticated');
create policy "Autenticado lee asist"     on public.asistencias for select using (auth.role() = 'authenticated');
create policy "Autenticado lee permisos"  on public.permisos  for select using (auth.role() = 'authenticated');
create policy "Autenticado lee avisos"    on public.avisos    for select using (auth.role() = 'authenticated');
create policy "Autenticado lee tareas"    on public.tareas    for select using (auth.role() = 'authenticated');
create policy "Autenticado lee avances"   on public.avances_semanales for select using (auth.role() = 'authenticated');
create policy "Autenticado lee sesiones"  on public.sesiones_eco for select using (auth.role() = 'authenticated');
create policy "Autenticado lee horas_extras" on public.horas_extras for select using (auth.role() = 'authenticated');
create policy "Autenticado lee flex"      on public.flexibilidad_horaria for select using (auth.role() = 'authenticated');
create policy "Autenticado lee areas"     on public.areas    for select using (auth.role() = 'authenticated');
create policy "Autenticado lee origenes"  on public.origenes for select using (auth.role() = 'authenticated');
create policy "Autenticado lee roles"     on public.config_roles  for select using (auth.role() = 'authenticated');
create policy "Autenticado lee grupos"    on public.config_grupos for select using (auth.role() = 'authenticated');

create policy "Autenticado escribe asist" on public.asistencias for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe tareas" on public.tareas for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe permisos" on public.permisos for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe avisos"   on public.avisos   for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe personas" on public.personas for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe horarios" on public.horarios for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe avances"  on public.avances_semanales for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe sesiones" on public.sesiones_eco for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe cambios"  on public.cambios_horario for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe horas_extras" on public.horas_extras for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe flex"     on public.flexibilidad_horaria for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe areas"    on public.areas for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe origenes" on public.origenes for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe roles"    on public.config_roles for all using (auth.role() = 'authenticated');
create policy "Autenticado escribe grupos"   on public.config_grupos for all using (auth.role() = 'authenticated');

-- ─── SEED: catálogos ────────────────────────────────────────
-- areas: sin seed por defecto, se define desde la app según la
-- estructura real de la organización.

insert into public.origenes (nombre, orden) values
  ('UNASAM',1),('SENATI',2),('Externo',3)
on conflict (nombre) do nothing;

insert into public.config_roles (nombre, orden) values
  ('Practicante',1),('Tesista',2),('Voluntario',3),('Investigador',4),
  ('Investigador Formativo',5),('Asistente',6),('SENATI',7),('EcoBIOTEM',8),('Coordinador',9)
on conflict (nombre) do nothing;

insert into public.config_grupos (nombre, orden) values
  ('ESAT',1),('EcoBIOTEM',2),('GAMH',3),('PAMEC',4),('CIAD',5)
on conflict (nombre) do nothing;

-- ─── SEED: personas iniciales ──────────────────────────────
-- Los DNIs reales ya están en el HTML; passwords se crean vía Supabase Auth invite
insert into public.personas (nombre, dni, rol, subrol, grupo, hora_ingreso, tolerancia, activo, color, area, hs_semanales) values
('Patricia Broncano',  '00000001', 'Practicante', 'Ing. Ambiental',  'ESAT',     '09:45', 10, true, '#1e40af', 'Ambiental', 14),
('Yennifer Yanac',     '00000002', 'Practicante', 'Ing. Ambiental',  'ESAT',     '10:00', 10, true, '#7c3aed', 'Ambiental', 12),
('Cesar Quesada',      '00000003', 'Practicante', 'Ing. Ambiental',  'ESAT',     '08:30', 10, true, '#b91c1c', 'Ambiental', 9),
('Milagros Miranda',   '00000004', 'Practicante', 'Ing. Ambiental',  'ESAT',     '08:30', 10, true, '#0369a1', 'Ambiental', 15),
('Edinson Jara',       '00000005', 'Practicante', 'Ing. Ambiental',  'ESAT',     '10:00', 10, true, '#0e7490', 'Ambiental', 13),
('Meylin Baltazar',    '73066140', 'Practicante', 'Ing. Sistemas',   'ESAT',     '08:30', 10, true, '#be185d', 'Sistemas',  20.17),
('Ruben Quispe',       '00000007', 'SENATI',      'Ing. de Software','ESAT',     '08:30', 10, true, '#92400e', 'Técnico',   13.5),
('Mayte Quiñonez',     '00000008', 'SENATI',      'Ing. de Software','ESAT',     '08:30', 10, true, '#065f46', 'Técnico',   13.5),
('Andrea Huerta',      '00000009', 'Voluntario',  'Ing. Ambiental',  'ESAT',     '09:00', 10, true, '#15803d', 'Ambiental', 8.5),
('Manuel Milla',       '00000010', 'Voluntario',  'Ing. Ambiental',  'ESAT',     '14:00', 10, true, '#1d4ed8', 'Ambiental', 7),
('Brighit Jamanca',    '00000011', 'Asistente',   'T. Completo',     'ESAT',     '08:30', 5,  true, '#475569', 'General',   42.5),
('Alex Mendoza',       '00000012', 'Asistente',   'T. Completo',     'ESAT',     '08:30', 5,  true, '#374151', 'General',   42.5),
('Jorge',              '00000013', 'Asistente',   'T. Completo',     'ESAT',     '08:30', 5,  true, '#1e3a5f', 'General',   42.5),
('Yosmel Palma',       '00000014', 'Asistente',   'T. Completo',     'ESAT',     '08:30', 5,  true, '#5b21b6', 'General',   42.5),
('Ebert Giraldo',      '70835337', 'EcoBIOTEM',   'Investigador',    'EcoBIOTEM', null,   0,  true, '#166534', 'Ecología',  null),
('Daniella Padilla',   '71477430', 'EcoBIOTEM',   'Investigador',    'EcoBIOTEM', null,   0,  true, '#1e40af', 'Biodiversidad', null),
('Mayté Ramirez',      '70288914', 'EcoBIOTEM',   'Investigador',    'EcoBIOTEM', null,   0,  true, '#9333ea', 'Biotecnología', null),
('Alessa Mendez',      '75806358', 'EcoBIOTEM',   'Investigador',    'EcoBIOTEM', null,   0,  true, '#dc2626', 'Ecología',  null),
('Madeli Quito',       '76095437', 'EcoBIOTEM',   'Investigador',    'EcoBIOTEM', null,   0,  true, '#d97706', 'Biodiversidad', null),
('Lucia Castillo',     '76214409', 'EcoBIOTEM',   'Investigador',    'EcoBIOTEM', null,   0,  true, '#0369a1', 'Biotecnología', null),
('Jean Pierre Velasquez','73048791','EcoBIOTEM',   'Investigador',    'EcoBIOTEM', null,   0,  true, '#065f46', 'Ecología',  null),
('Brenda Castro',      '71587180', 'EcoBIOTEM',   'Investigador',    'EcoBIOTEM', null,   0,  true, '#be185d', 'Biodiversidad', null),
('Helen Del Castillo', '77084130', 'EcoBIOTEM',   'Investigador',    'EcoBIOTEM', null,   0,  true, '#4338ca', 'Biotecnología', null),
('José León',          '75182258', 'EcoBIOTEM',   'Investigador',    'EcoBIOTEM', null,   0,  true, '#0e7490', 'Ecología',  null),
('Yoner Quiñones',     '73529762', 'EcoBIOTEM',   'Investigador',    'EcoBIOTEM', null,   0,  true, '#92400e', 'Biodiversidad', null),
('Marycielo Depaz',    '72098336', 'EcoBIOTEM',   'Investigador',    'EcoBIOTEM', null,   0,  true, '#b91c1c', 'Biotecnología', null),
('Lolly Ramirez',      '72756815', 'EcoBIOTEM',   'Investigador',    'EcoBIOTEM', null,   0,  true, '#15803d', 'Ecología',  null),
('Mayumi Colonia',     '72756815', 'EcoBIOTEM',   'Investigador',    'EcoBIOTEM', null,   0,  true, '#7c3aed', 'Biodiversidad', null),
('Renzo Quiñones',     '75719369', 'EcoBIOTEM',   'Investigador',    'EcoBIOTEM', null,   0,  true, '#c2410c', 'Biotecnología', null),
('Gretna Chinchay',    '77472296', 'EcoBIOTEM',   'Investigador',    'EcoBIOTEM', null,   0,  true, '#1e3a5f', 'Ecología',  null),
('Claribel Asencios',  '71980899', 'EcoBIOTEM',   'Investigador',    'EcoBIOTEM', null,   0,  true, '#5b21b6', 'Biodiversidad', null),
('Angie Palacios',     '72809892', 'EcoBIOTEM',   'Investigador',    'EcoBIOTEM', null,   0,  true, '#0f766e', 'Biotecnología', null)
on conflict (dni) do nothing;

-- ─── SEED: horarios iniciales ──────────────────────────────
-- Patricia Broncano: L mañana, X tarde, J tarde, V mañana+tarde
with p as (select id from public.personas where dni='00000001')
insert into public.horarios (persona_id, dia, hora_entrada, hora_salida)
select p.id, d.dia, d.entrada::time, d.salida::time from p,
(values ('L','09:45','13:45'),('X','14:00','15:45'),('J','15:30','18:45'),('V','08:30','10:30'),('V','13:00','16:00')) as d(dia,entrada,salida)
on conflict do nothing;

-- Meylin Baltazar: L-V mañana
with p as (select id from public.personas where dni='73066140')
insert into public.horarios (persona_id, dia, hora_entrada, hora_salida)
select p.id, d.dia, d.entrada::time, d.salida::time from p,
(values ('L','08:30','13:00'),('M','09:20','13:00'),('X','08:30','13:00'),('J','10:00','13:00'),('V','08:30','13:00')) as d(dia,entrada,salida)
on conflict do nothing;

-- Ruben Quispe & Mayte Quiñonez: L-X mañana
with p as (select id from public.personas where dni in ('00000007','00000008'))
insert into public.horarios (persona_id, dia, hora_entrada, hora_salida)
select p.id, d.dia, d.entrada::time, d.salida::time from p,
(values ('L','08:30','13:00'),('M','08:30','13:00'),('X','08:30','13:00')) as d(dia,entrada,salida)
on conflict do nothing;

-- Asistentes tiempo completo: L-V doble turno
with p as (select id from public.personas where dni in ('00000011','00000012','00000013','00000014'))
insert into public.horarios (persona_id, dia, hora_entrada, hora_salida)
select p.id, d.dia, d.entrada::time, d.salida::time from p,
(values ('L','08:30','13:00'),('L','14:30','18:00'),
        ('M','08:30','13:00'),('M','14:30','18:00'),
        ('X','08:30','13:00'),('X','14:30','18:00'),
        ('J','08:30','13:00'),('J','14:30','18:00'),
        ('V','08:30','13:00'),('V','14:30','18:00')) as d(dia,entrada,salida)
on conflict do nothing;

-- ─── SEED: avisos reales ───────────────────────────────────
insert into public.avisos (tipo, titulo, descripcion, destinatario, fecha_evento, urgente) values
('permiso', 'Permiso Meyli — con oficio de justificación (4am)',
 'Permiso justificado con oficio (4am). Pendiente mencionar los días de recuperación para seguimiento.',
 'todos', '2026-04-14', false),
('permiso', 'Permiso Milagros — viaje por salud de familiar (2:31pm)',
 'Permiso por viaje de salud de familiar, comunicado a las 2:31pm. Pendiente días de recuperación.',
 'todos', '2026-04-15', false),
('anuncio', '24/04 ✅ Patricia — turno mañana a cuenta de turno tarde',
 'Patricia trabajó turno mañana (10:30am a 1:55pm) a cuenta del turno tarde (1pm a 4pm). Aprobado.',
 'todos', '2026-04-24', false),
('permiso', '27/04 Patricia — permiso lunes, recupera martes 28/04',
 'Patricia tomó permiso el lunes 27/04. Recuperará el martes 28/04.',
 'todos', '2026-04-27', false),
('permiso', '27/04 Andrea — permiso lunes turno tarde',
 'Andrea con permiso el lunes 27/04 turno tarde.',
 'todos', '2026-04-27', false),
('permiso', '27/04 Jorge — permiso lunes de 4:30 a 6pm, recupera martes-jueves',
 'Jorge con permiso el lunes 27/04 de 4:30 a 6pm. Recuperará entre el martes y jueves.',
 'todos', '2026-04-27', false)
on conflict do nothing;
