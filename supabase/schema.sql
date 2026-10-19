-- Esquema de "Presupuesto familia Etayo-Murillo" (Supabase / PostgreSQL).
-- Sólo estructura y seguridad; los datos de la familia viven únicamente en la base.

create table public.miembros (
  email text primary key,
  nombre text not null,
  creado_en timestamptz not null default now()
);

create or replace function public.es_miembro()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.miembros m where lower(m.email) = lower(auth.jwt() ->> 'email'));
$$;
revoke execute on function public.es_miembro() from public, anon;
grant execute on function public.es_miembro() to authenticated;

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  color text not null default '#64748b',
  icono text not null default 'circle',
  orden int not null default 0,
  activo boolean not null default true,
  clase text not null default 'necesidad' check (clase in ('necesidad','deseo','ahorro_deuda'))
);

create table public.obligaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  entidad text,
  tipo text not null default 'prestamo' check (tipo in ('prestamo','tarjeta','credito_cuotas','cadena','otro')),
  monto_inicial numeric(14,0),
  saldo_inicial numeric(14,0),
  fecha_saldo date,
  cuota numeric(14,0),
  tasa_mensual numeric(6,3),
  num_cuotas int,
  fecha_inicio date,
  fecha_cobro date,           -- cadena: fecha del turno en que se recibe
  activo boolean not null default true,
  notas text,
  logo text,                  -- dominio de la entidad para mostrar su logo
  responsable text not null default 'Familiar', -- a nombre de quién está la deuda
  dia_corte int check (dia_corte between 1 and 31), -- tarjetas: día de corte del extracto
  creado_en timestamptz not null default now()
);

create table public.conceptos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias(id),
  obligacion_id uuid references public.obligaciones(id) on delete set null,
  nombre text not null,
  medio_pago text,
  valor_base numeric(14,0) not null default 0,
  dia_limite int check (dia_limite between 1 and 31),
  recurrente boolean not null default true,
  activo boolean not null default true,
  orden int not null default 0,
  notas text,
  responsable text not null default 'Familiar',  -- Familiar, Pily, Juank…
  logo text,                                     -- dominio de la marca (favicon), p. ej. davivienda.com
  icono text,                                    -- icono isométrico cuando no hay logo
  hasta_periodo date                             -- último mes en que se genera (p. ej. un préstamo que termina)
);

create table public.ingresos (
  id uuid primary key default gen_random_uuid(),
  periodo date not null check (extract(day from periodo) = 1),
  descripcion text not null default 'Ingreso base',
  valor numeric(14,0) not null,
  tipo text not null default 'Salario',
  notas text,
  grupo uuid,                 -- ingresos repetidos en varios meses
  creado_en timestamptz not null default now()
);
create index on public.ingresos(periodo);

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  periodo date not null check (extract(day from periodo) = 1),
  concepto_id uuid references public.conceptos(id) on delete set null,
  categoria_id uuid not null references public.categorias(id),
  obligacion_id uuid references public.obligaciones(id) on delete set null,
  descripcion text not null,
  medio_pago text,
  valor_presupuestado numeric(14,0) not null default 0,
  valor_pagado numeric(14,0),
  abono_capital numeric(14,0),
  fecha_limite date,
  fecha_pago date,
  estado text not null default 'pendiente' check (estado in ('pendiente','pagado','omitido')),
  grupo_cuotas uuid,
  cuota_num int,
  cuotas_total int,
  notas text,
  pagado_por text,
  responsable text not null default 'Familiar',
  creado_por text default (auth.jwt() ->> 'email'),
  creado_en timestamptz not null default now()
);
create index on public.gastos(periodo);
create index on public.gastos(obligacion_id);
create index on public.gastos(grupo_cuotas);

create table public.metas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  objetivo numeric(14,0) not null,
  ahorrado numeric(14,0) not null default 0,
  fecha_meta date,
  icono text not null default 'piggy-bank',
  activo boolean not null default true,
  notas text,
  creado_en timestamptz not null default now()
);

create table public.configuracion (
  clave text primary key,
  valor jsonb not null
);

-- Saldo de obligaciones: saldo_inicial - abonos (cadenas: + aportes)
create or replace view public.v_obligaciones with (security_invoker = true) as
select o.*,
  coalesce(p.pagado, 0) as total_pagado,
  coalesce(p.abonos, 0) as total_abonos,
  coalesce(p.cuotas_pagadas, 0) as cuotas_pagadas,
  p.ultimo_pago,
  case when o.tipo = 'cadena' then coalesce(o.saldo_inicial,0) + coalesce(p.pagado,0)
       when o.saldo_inicial is null then null
       else greatest(o.saldo_inicial - coalesce(p.abonos,0), 0) end as saldo_actual
from public.obligaciones o
left join (
  select obligacion_id,
    sum(valor_pagado) as pagado,
    sum(coalesce(abono_capital, valor_pagado)) as abonos,
    count(*) as cuotas_pagadas,
    max(fecha_pago) as ultimo_pago
  from public.gastos
  where estado = 'pagado' and obligacion_id is not null
    and (fecha_pago is null or fecha_pago >= coalesce((select fecha_saldo from public.obligaciones x where x.id = gastos.obligacion_id), '1900-01-01'))
  group by obligacion_id
) p on p.obligacion_id = o.id;

-- RLS: sólo miembros de la familia
do $$
declare t text;
begin
  foreach t in array array['categorias','obligaciones','conceptos','ingresos','gastos','configuracion','miembros','metas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.es_miembro())', t||'_sel', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.es_miembro())', t||'_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.es_miembro()) with check (public.es_miembro())', t||'_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.es_miembro())', t||'_del', t);
  end loop;
end $$;
