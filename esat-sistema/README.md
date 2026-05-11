# ESAT · CIAD — Sistema de Gestión
**Stack:** Next.js 14 · Supabase · Tailwind CSS · Vercel

---

## 🚀 Pasos para subir a producción

### 1. Supabase — crear la base de datos

1. Ve a [supabase.com](https://supabase.com) → tu proyecto → **SQL Editor**
2. Copia y pega todo el contenido de `supabase/schema.sql`
3. Ejecuta → esto crea las tablas, RLS y carga todos los datos reales del equipo
4. Ve a **Settings → API** y copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Crear usuarios de login en Supabase Auth

Para cada persona del equipo, ve a **Authentication → Users → Invite user** o usa el SQL:

```sql
-- Coordinadores / logísticos: email + password
-- Practicantes / voluntarios: DNI@esat.local + password (DNI por defecto)

-- Ejemplo para Meylin (practicante, login con DNI):
-- Email: 73066140@esat.local
-- Password: 73066140  (se puede cambiar después)
```

O desde el dashboard de Supabase: **Auth → Users → Add user**

### 3. Subir a Vercel

**Opción A — GitHub (recomendado):**
```bash
# En la carpeta del proyecto:
git init
git add .
git commit -m "Initial commit — ESAT Sistema v1"
git remote add origin https://github.com/TU_USUARIO/esat-sistema.git
git push -u origin main
```
Luego en [vercel.com](https://vercel.com):
1. Import Project → selecciona el repo
2. En **Environment Variables** agrega las 3 variables de Supabase
3. Deploy ✅

**Opción B — Vercel CLI:**
```bash
npm i -g vercel
vercel login
vercel --prod
# Te pedirá las env vars durante el proceso
```

### 4. Variables de entorno en Vercel

En Vercel → Settings → Environment Variables:

| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` |

---

## 🗂 Estructura del proyecto

```
esat-sistema/
├── app/
│   ├── auth/login/          # Pantalla de login (3 cards)
│   ├── dashboard/
│   │   ├── page.tsx         # Dashboard principal
│   │   ├── asistencia/      # Registro de asistencia diaria
│   │   ├── horarios/        # Tabla de horarios semanales
│   │   ├── permisos/        # Permisos y faltas
│   │   ├── avisos/          # Comunicados del equipo
│   │   ├── tareas/          # Asignación y seguimiento
│   │   ├── personas/        # Gestión del equipo
│   │   ├── exportar/        # CSV / Excel / PDF
│   │   └── reportes/        # Gráficos y estadísticas
│   └── globals.css          # Estilos globales (tokens ESAT)
├── components/
│   └── dashboard/Sidebar.tsx
├── lib/supabase/
│   ├── client.ts            # Cliente browser
│   └── server.ts            # Cliente servidor
├── types/index.ts           # Tipos + helpers (getRolLabel, getTurno)
├── supabase/schema.sql      # 🔑 BASE DE DATOS COMPLETA
└── vercel.json
```

---

## 🔐 Sistema de login

| Tipo | Usuario | Contraseña |
|------|---------|-----------|
| Coordinador / Logístico | correo institucional | password asignado |
| Practicante / Voluntario / SENATI | DNI (ej: `73066140`) | DNI por defecto (cambiar después) |

---

## 🛠 Desarrollo local

```bash
# 1. Instalar dependencias
npm install

# 2. Crear archivo de variables
cp .env.local.example .env.local
# Editar .env.local con tus credenciales de Supabase

# 3. Ejecutar
npm run dev
# → http://localhost:3000
```

---

## 📦 Datos incluidos en el schema

- ✅ **33 personas** del equipo (ESAT + EcoBIOTEM) con DNIs reales
- ✅ **Horarios semanales** de todos (Patricia con lunes=Mañana correcto)
- ✅ **6 avisos reales** del equipo
- ✅ Lógica de turnos: M = entra antes 1pm · T = entra desde 1pm · M+T = dos franjas separadas

---

## 🔄 Próximos pasos recomendados

1. Ejecutar el schema en Supabase
2. Crear usuarios en Supabase Auth
3. Deploy en Vercel
4. Cambiar contraseñas por defecto (DNI)
5. Cargar tareas históricas via tabla `tareas` en Supabase

---

*ESAT · CIAD — Sistema de Gestión v1.0*
