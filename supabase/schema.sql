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

-- Cierre de mes: congela los gastos e ingresos de un periodo (resumen = foto de los totales al cerrar)
create table public.cierres_mes (
  periodo date primary key check (extract(day from periodo) = 1),
  resumen jsonb not null default '{}'::jsonb,
  cerrado_por text default (auth.jwt() ->> 'email'),
  cerrado_en timestamptz not null default now()
);
alter table public.cierres_mes enable row level security;
create policy cierres_mes_sel on public.cierres_mes for select to authenticated using (public.es_miembro());
create policy cierres_mes_ins on public.cierres_mes for insert to authenticated with check (public.es_miembro());
create policy cierres_mes_upd on public.cierres_mes for update to authenticated using (public.es_miembro()) with check (public.es_miembro());
create policy cierres_mes_del on public.cierres_mes for delete to authenticated using (public.es_miembro());

-- Un mes cerrado no admite cambios en sus gastos ni ingresos.
-- Excepción: las llaves foráneas "on delete set null" (borrar un ítem de la plantilla o una deuda).
create or replace function public.validar_mes_abierto()
returns trigger language plpgsql security definer set search_path = public as $$
declare cerrado date;
begin
  if tg_op = 'UPDATE' and tg_table_name = 'gastos'
     and (to_jsonb(new) - 'concepto_id' - 'obligacion_id') = (to_jsonb(old) - 'concepto_id' - 'obligacion_id') then
    return new;
  end if;
  select c.periodo into cerrado from public.cierres_mes c
   where c.periodo = case when tg_op = 'INSERT' then new.periodo else old.periodo end
      or (tg_op = 'UPDATE' and c.periodo = new.periodo)
   limit 1;
  if cerrado is not null then
    raise exception 'El mes % está cerrado. Reábrelo para modificarlo.', to_char(cerrado, 'MM/YYYY') using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke execute on function public.validar_mes_abierto() from public, anon;
create trigger gastos_mes_abierto before insert or update or delete on public.gastos
  for each row execute function public.validar_mes_abierto();
create trigger ingresos_mes_abierto before insert or update or delete on public.ingresos
  for each row execute function public.validar_mes_abierto();

-- ── Movimientos: lo REAL (gastos pagados e ingresos recibidos); el mes sale de la fecha ─────────
-- La tabla gastos es el PLAN del mes (compromisos). Pagar un compromiso = crear su movimiento.
create table public.movimientos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('gasto','ingreso')),
  fecha date not null default current_date,
  periodo date generated always as (date_trunc('month', fecha::timestamp)::date) stored,
  valor numeric(14,0) not null check (valor > 0),
  categoria_id uuid references public.categorias(id),
  descripcion text not null,
  medio_pago text,
  responsable text not null default 'Familiar',
  gasto_id uuid references public.gastos(id) on delete set null,   -- compromiso del plan que paga
  obligacion_id uuid references public.obligaciones(id) on delete set null,
  abono_capital numeric(14,0),
  tipo_ingreso text,
  pagado_por text,
  notas text,
  creado_por text default (auth.jwt() ->> 'email'),
  creado_en timestamptz not null default now(),
  constraint movimientos_gasto_con_categoria check (tipo = 'ingreso' or categoria_id is not null)
);
create index on public.movimientos(periodo);
create index on public.movimientos(obligacion_id);
create unique index movimientos_un_pago_por_compromiso on public.movimientos(gasto_id) where gasto_id is not null;
alter table public.movimientos enable row level security;
create policy movimientos_sel on public.movimientos for select to authenticated using (public.es_miembro());
create policy movimientos_ins on public.movimientos for insert to authenticated with check (public.es_miembro());
create policy movimientos_upd on public.movimientos for update to authenticated using (public.es_miembro()) with check (public.es_miembro());
create policy movimientos_del on public.movimientos for delete to authenticated using (public.es_miembro());

-- validar_mes_abierto (reemplaza la versión anterior): también cubre movimientos (mes = mes de la fecha)
create or replace function public.validar_mes_abierto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cerrado date;
  p_old date;
  p_new date;
  libres text[] := array['concepto_id','obligacion_id','gasto_id'];
begin
  if tg_op = 'UPDATE' and (to_jsonb(new) - libres) = (to_jsonb(old) - libres) then
    return new;
  end if;
  if tg_table_name = 'movimientos' then
    if tg_op <> 'INSERT' then p_old := date_trunc('month', old.fecha::timestamp)::date; end if;
    if tg_op <> 'DELETE' then p_new := date_trunc('month', new.fecha::timestamp)::date; end if;
  else
    if tg_op <> 'INSERT' then p_old := (to_jsonb(old) ->> 'periodo')::date; end if;
    if tg_op <> 'DELETE' then p_new := (to_jsonb(new) ->> 'periodo')::date; end if;
  end if;
  select c.periodo into cerrado from public.cierres_mes c where c.periodo in (p_old, p_new) limit 1;
  if cerrado is not null then
    raise exception 'El mes % está cerrado. Reábrelo para modificarlo.', to_char(cerrado, 'MM/YYYY') using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger movimientos_mes_abierto before insert or update or delete on public.movimientos
  for each row execute function public.validar_mes_abierto();

-- El compromiso del plan refleja su pago: estado, valor y fecha salen del movimiento.
create or replace function public.sincronizar_compromiso()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op in ('UPDATE','DELETE') and old.gasto_id is not null
     and (tg_op = 'DELETE' or new.gasto_id is distinct from old.gasto_id) then
    update public.gastos set estado = 'pendiente', valor_pagado = null, fecha_pago = null, abono_capital = null, pagado_por = null
     where id = old.gasto_id;
  end if;
  if tg_op in ('INSERT','UPDATE') and new.gasto_id is not null then
    update public.gastos set estado = 'pagado', valor_pagado = new.valor, fecha_pago = new.fecha,
           abono_capital = new.abono_capital, pagado_por = new.pagado_por
     where id = new.gasto_id
       and (estado, valor_pagado, fecha_pago, abono_capital, pagado_por) is distinct from ('pagado', new.valor, new.fecha, new.abono_capital, new.pagado_por);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger movimientos_sincronizar after insert or update or delete on public.movimientos
  for each row execute function public.sincronizar_compromiso();

-- v_obligaciones (reemplaza la anterior): saldo a partir de los movimientos reales
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
  select m.obligacion_id,
    sum(m.valor) as pagado,
    sum(coalesce(m.abono_capital, m.valor)) as abonos,
    count(*) as cuotas_pagadas,
    max(m.fecha) as ultimo_pago
  from public.movimientos m
  join public.obligaciones x on x.id = m.obligacion_id
  where m.tipo = 'gasto' and m.fecha >= coalesce(x.fecha_saldo, '1900-01-01')
  group by m.obligacion_id
) p on p.obligacion_id = o.id;
