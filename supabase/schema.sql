-- =========================================================
-- B²GC BROKERS — Base de datos real (Supabase)
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pega todo
-- este archivo → Run. Se puede volver a ejecutar sin romper nada.
--
-- Partes:
--   · Entidad vendedora (banco, fintech o cooperativa): publica cartera.
--   · B²GC Brokers (administradores): aprueba empresas y supervisa.
--   · Casa de cobranza: oferta y compra la cartera.
--
-- Seguridad: cada tabla tiene RLS. Las acciones que deben cumplir
-- reglas (ofertar, adjudicar, avanzar el cierre) solo se hacen con
-- funciones que validan todo en el servidor.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- TABLAS
-- ---------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null unique references auth.users on delete cascade,
  role text not null check (role in ('vendedor', 'comprador')),
  entity_type text not null check (entity_type in ('banco', 'fintech', 'cooperativa', 'casa_cobranza', 'otro')),
  name text not null check (length(trim(name)) >= 3),
  nit text not null check (length(regexp_replace(nit, '\D', '', 'g')) >= 8),
  contact_name text not null,
  city text,
  email text not null,
  phone text not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada', 'suspendida')),
  docs jsonb not null default '{}'::jsonb,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create sequence if not exists public.portfolio_seq;
create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('LOTE-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.portfolio_seq')::text, 4, '0')),
  seller_company uuid not null references public.companies,
  seller_name text not null,
  title text not null check (length(trim(title)) >= 4),
  type text not null,
  modality text not null check (modality in ('Subasta privada', 'Compra directa', 'Híbrida')),
  nominal numeric(14, 1) not null check (nominal > 0),            -- millones de COP
  debtors integer not null check (debtors > 0),
  obligations integer not null check (obligations > 0),
  reserve_percent numeric(5, 1) not null check (reserve_percent between 0.1 and 100), -- tarifa mínima, solo la ve el vendedor
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  description text,
  status text not null default 'publicada' check (status in ('publicada', 'adjudicada', 'vendida', 'cancelada')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios on delete cascade,
  buyer_company uuid not null references public.companies,
  buyer_name text not null,
  percent numeric(5, 1) not null check (percent between 0.1 and 100),
  note text,
  prev_best numeric(5, 1),
  below_last boolean not null default false,
  status text not null default 'enviada' check (status in ('enviada', 'rechazada', 'adjudicada', 'no_adjudicada')),
  created_at timestamptz not null default now()
);

create sequence if not exists public.operation_seq;
create table if not exists public.operations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('OP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.operation_seq')::text, 3, '0')),
  portfolio_id uuid not null references public.portfolios,
  bid_id uuid not null references public.bids,
  seller_company uuid not null references public.companies,
  buyer_company uuid not null references public.companies,
  seller_name text not null,
  buyer_name text not null,
  portfolio_code text not null,
  portfolio_title text not null,
  percent numeric(5, 1) not null,
  nominal numeric(14, 1) not null,
  value numeric(14, 1) not null,
  status text not null default 'en_cierre' check (status in ('en_cierre', 'cerrada', 'cancelada')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index if not exists one_active_operation_per_portfolio on public.operations (portfolio_id) where status <> 'cancelada';

create table if not exists public.operation_steps (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations on delete cascade,
  step_key text not null check (step_key in ('adjudicacion', 'firmaVendedor', 'firmaComprador', 'pago', 'confirmacionPago', 'entrega', 'recepcion')),
  done_by uuid not null references auth.users,
  company_name text not null,
  signer text,
  reference text,
  amount numeric(14, 1),
  file_path text,
  created_at timestamptz not null default now(),
  unique (operation_id, step_key)
);

-- ---------------------------------------------------------
-- FUNCIONES DE APOYO
-- ---------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.my_company_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.companies where owner = auth.uid();
$$;

create or replace function public.i_am_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.companies where owner = auth.uid() and status = 'aprobada');
$$;

-- Empresa aprobada del usuario con el rol pedido; si no, error
create or replace function public.require_company(p_role text) returns public.companies
language plpgsql stable security definer set search_path = public as $$
declare c public.companies;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  select * into c from public.companies where owner = auth.uid();
  if c.id is null then raise exception 'Tu usuario no tiene una empresa registrada.'; end if;
  if c.status <> 'aprobada' then raise exception 'Tu empresa aún no está aprobada por B²GC Brokers.'; end if;
  if p_role is not null and c.role <> p_role then
    raise exception 'Esta acción le corresponde %.', case p_role when 'vendedor' then 'a la entidad vendedora' else 'a la casa de cobranza' end;
  end if;
  return c;
end $$;

-- ---------------------------------------------------------
-- RLS: lectura. Las escrituras van por las funciones de abajo.
-- ---------------------------------------------------------
alter table public.admins enable row level security;
alter table public.companies enable row level security;
alter table public.portfolios enable row level security;
alter table public.bids enable row level security;
alter table public.operations enable row level security;
alter table public.operation_steps enable row level security;

drop policy if exists "admins: ver" on public.admins;
create policy "admins: ver" on public.admins for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "empresas: la propia o admin" on public.companies;
create policy "empresas: la propia o admin" on public.companies for select to authenticated
  using (owner = auth.uid() or public.is_admin());

-- Las casas de cobranza no leen esta tabla directamente (no deben ver la tarifa): usan market_portfolios()
drop policy if exists "carteras: el vendedor o admin" on public.portfolios;
create policy "carteras: el vendedor o admin" on public.portfolios for select to authenticated
  using (seller_company = public.my_company_id() or public.is_admin());

drop policy if exists "ofertas: partes o admin" on public.bids;
create policy "ofertas: partes o admin" on public.bids for select to authenticated
  using (buyer_company = public.my_company_id()
         or exists (select 1 from public.portfolios p where p.id = portfolio_id and p.seller_company = public.my_company_id())
         or public.is_admin());

drop policy if exists "operaciones: partes o admin" on public.operations;
create policy "operaciones: partes o admin" on public.operations for select to authenticated
  using (seller_company = public.my_company_id() or buyer_company = public.my_company_id() or public.is_admin());

drop policy if exists "pasos: partes o admin" on public.operation_steps;
create policy "pasos: partes o admin" on public.operation_steps for select to authenticated
  using (exists (select 1 from public.operations o where o.id = operation_id
                 and (o.seller_company = public.my_company_id() or o.buyer_company = public.my_company_id() or public.is_admin())));

-- ---------------------------------------------------------
-- EMPRESAS
-- ---------------------------------------------------------
create or replace function public.create_my_company(p_role text, p_entity_type text, p_name text, p_nit text,
  p_contact text, p_city text, p_phone text) returns public.companies
language plpgsql security definer set search_path = public as $$
declare c public.companies;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  select * into c from public.companies where owner = auth.uid();
  if c.id is not null then return c; end if;
  if p_role = 'vendedor' and p_entity_type not in ('banco', 'fintech', 'cooperativa', 'otro') then raise exception 'Tipo de entidad vendedora no válido.'; end if;
  if p_role = 'comprador' and p_entity_type not in ('casa_cobranza', 'otro') then raise exception 'Tipo de comprador no válido.'; end if;
  insert into public.companies (owner, role, entity_type, name, nit, contact_name, city, email, phone)
  values (auth.uid(), p_role, p_entity_type, trim(p_name), trim(p_nit), trim(p_contact), nullif(trim(p_city), ''),
          lower(auth.jwt() ->> 'email'), trim(p_phone))
  returning * into c;
  return c;
end $$;

-- Registra un documento ya subido (RUT, Cámara de Comercio, cédula)
create or replace function public.set_company_doc(p_key text, p_path text, p_name text, p_size bigint) returns public.companies
language plpgsql security definer set search_path = public as $$
declare c public.companies;
begin
  if p_key not in ('rut', 'camara', 'cc') then raise exception 'Documento no válido.'; end if;
  select * into c from public.companies where owner = auth.uid();
  if c.id is null then raise exception 'No tienes una empresa registrada.'; end if;
  if c.status = 'suspendida' then raise exception 'Tu cuenta está suspendida.'; end if;
  if p_path not like c.id::text || '/%' then raise exception 'Ruta de archivo no válida.'; end if;
  update public.companies
     set docs = docs || jsonb_build_object(p_key, jsonb_build_object('path', p_path, 'name', p_name, 'size', p_size, 'at', now())),
         status = case when status = 'rechazada' then 'pendiente' else status end
   where id = c.id returning * into c;
  return c;
end $$;

create or replace function public.admin_review_company(p_company uuid, p_status text, p_note text) returns public.companies
language plpgsql security definer set search_path = public as $$
declare c public.companies;
begin
  if not public.is_admin() then raise exception 'Solo B²GC Brokers puede revisar empresas.'; end if;
  if p_status not in ('aprobada', 'rechazada', 'suspendida', 'pendiente') then raise exception 'Estado no válido.'; end if;
  if p_status = 'rechazada' and coalesce(trim(p_note), '') = '' then raise exception 'Escribe el motivo del rechazo.'; end if;
  update public.companies set status = p_status, review_note = nullif(trim(p_note), ''), reviewed_at = now()
   where id = p_company returning * into c;
  if c.id is null then raise exception 'Empresa no encontrada.'; end if;
  return c;
end $$;

-- ---------------------------------------------------------
-- CARTERAS
-- ---------------------------------------------------------
create or replace function public.create_portfolio(p_title text, p_type text, p_modality text, p_nominal numeric,
  p_debtors integer, p_obligations integer, p_reserve numeric, p_starts timestamptz, p_ends timestamptz, p_description text)
returns public.portfolios
language plpgsql security definer set search_path = public as $$
declare c public.companies; p public.portfolios;
begin
  c := public.require_company('vendedor');
  if p_ends <= now() then raise exception 'La fecha de cierre debe ser futura.'; end if;
  if p_ends <= p_starts then raise exception 'El cierre debe ser después del inicio.'; end if;
  insert into public.portfolios (seller_company, seller_name, title, type, modality, nominal, debtors, obligations,
                                 reserve_percent, starts_at, ends_at, description)
  values (c.id, c.name, trim(p_title), p_type, p_modality, p_nominal, p_debtors, p_obligations, p_reserve, p_starts, p_ends, p_description)
  returning * into p;
  return p;
end $$;

create or replace function public.cancel_portfolio(p_portfolio uuid) returns public.portfolios
language plpgsql security definer set search_path = public as $$
declare c public.companies; p public.portfolios;
begin
  c := public.require_company('vendedor');
  update public.portfolios set status = 'cancelada'
   where id = p_portfolio and seller_company = c.id and status = 'publicada' returning * into p;
  if p.id is null then raise exception 'Solo puedes retirar carteras tuyas que no estén adjudicadas.'; end if;
  return p;
end $$;

-- Mercado para casas de cobranza: sin la tarifa del vendedor
create or replace function public.market_portfolios()
returns table (id uuid, code text, seller_name text, title text, type text, modality text, nominal numeric,
               debtors integer, obligations integer, starts_at timestamptz, ends_at timestamptz, description text,
               status text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_company(null);
  return query
    select p.id, p.code, p.seller_name, p.title, p.type, p.modality, p.nominal, p.debtors, p.obligations,
           p.starts_at, p.ends_at, p.description, p.status, p.created_at
      from public.portfolios p
     where p.status <> 'cancelada'
     order by p.ends_at;
end $$;

-- ---------------------------------------------------------
-- OFERTAS
-- ---------------------------------------------------------
-- Libro de ofertas: el vendedor ve los nombres; la casa de cobranza ve a los demás en anónimo
create or replace function public.bid_book()
returns table (id uuid, portfolio_id uuid, percent numeric, note text, created_at timestamptz, status text,
               below_last boolean, prev_best numeric, buyer_label text, is_mine boolean)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.my_company_id(); adm boolean := public.is_admin();
begin
  if not adm then perform public.require_company(null); end if;
  return query
    with firsts as (
      select b.portfolio_id, b.buyer_company, min(b.created_at) as first_at
        from public.bids b group by b.portfolio_id, b.buyer_company
    ), aliases as (
      select f.portfolio_id, f.buyer_company,
             dense_rank() over (partition by f.portfolio_id order by f.first_at, f.buyer_company) as n
        from firsts f
    )
    select b.id, b.portfolio_id, b.percent,
           case when adm or p.seller_company = me or b.buyer_company = me then b.note end,
           b.created_at, b.status, b.below_last, b.prev_best,
           case when adm or p.seller_company = me then b.buyer_name
                when b.buyer_company = me then 'Tú'
                else 'Postor anónimo #' || a.n end,
           b.buyer_company = me
      from public.bids b
      join public.portfolios p on p.id = b.portfolio_id
      join aliases a on a.portfolio_id = b.portfolio_id and a.buyer_company = b.buyer_company
     where p.status <> 'cancelada' and (adm or p.seller_company = me or me is not null)
     order by b.portfolio_id, b.percent desc, b.created_at;
end $$;

create or replace function public.place_bid(p_portfolio uuid, p_percent numeric, p_note text) returns public.bids
language plpgsql security definer set search_path = public as $$
declare c public.companies; p public.portfolios; best numeric; b public.bids;
begin
  c := public.require_company('comprador');
  select * into p from public.portfolios where id = p_portfolio for update;
  if p.id is null or p.status = 'cancelada' then raise exception 'Cartera no encontrada.'; end if;
  if p.status <> 'publicada' then raise exception 'Esta cartera ya fue adjudicada.'; end if;
  if now() < p.starts_at then raise exception 'La subasta aún no ha comenzado.'; end if;
  if now() >= p.ends_at then raise exception 'La subasta de esta cartera ya cerró.'; end if;
  if p_percent is null or p_percent < 0.1 or p_percent > 100 then raise exception 'El porcentaje debe estar entre 0,1%% y 100%%.'; end if;
  select max(percent) into best from public.bids where portfolio_id = p.id and status <> 'rechazada';
  insert into public.bids (portfolio_id, buyer_company, buyer_name, percent, note, prev_best, below_last)
  values (p.id, c.id, c.name, round(p_percent, 1), nullif(trim(p_note), ''), best, best is not null and p_percent < best)
  returning * into b;
  return b;
end $$;

create or replace function public.reject_bid(p_bid uuid, p_undo boolean default false) returns public.bids
language plpgsql security definer set search_path = public as $$
declare c public.companies; b public.bids;
begin
  c := public.require_company('vendedor');
  update public.bids set status = case when p_undo then 'enviada' else 'rechazada' end
   where id = p_bid
     and status = case when p_undo then 'rechazada' else 'enviada' end
     and exists (select 1 from public.portfolios p where p.id = portfolio_id and p.seller_company = c.id and p.status = 'publicada')
  returning * into b;
  if b.id is null then raise exception 'No se pudo actualizar la oferta.'; end if;
  return b;
end $$;

-- ---------------------------------------------------------
-- CIERRE DE OPERACIONES
-- ---------------------------------------------------------
create or replace function public.adjudicate_bid(p_bid uuid) returns public.operations
language plpgsql security definer set search_path = public as $$
declare c public.companies; b public.bids; p public.portfolios; o public.operations;
begin
  c := public.require_company('vendedor');
  select * into b from public.bids where id = p_bid;
  if b.id is null then raise exception 'Oferta no encontrada.'; end if;
  select * into p from public.portfolios where id = b.portfolio_id for update;
  if p.seller_company <> c.id then raise exception 'Solo la entidad dueña de la cartera puede adjudicarla.'; end if;
  if p.status <> 'publicada' then raise exception 'Esta cartera ya fue adjudicada.'; end if;
  if b.status <> 'enviada' then raise exception 'Esta oferta no se puede adjudicar (está %).', b.status; end if;

  insert into public.operations (portfolio_id, bid_id, seller_company, buyer_company, seller_name, buyer_name,
                                 portfolio_code, portfolio_title, percent, nominal, value)
  values (p.id, b.id, c.id, b.buyer_company, c.name, b.buyer_name, p.code, p.title, b.percent, p.nominal,
          round(p.nominal * b.percent / 100, 1))
  returning * into o;
  insert into public.operation_steps (operation_id, step_key, done_by, company_name) values (o.id, 'adjudicacion', auth.uid(), c.name);
  update public.bids set status = 'adjudicada' where id = b.id;
  update public.bids set status = 'no_adjudicada' where portfolio_id = p.id and id <> b.id and status = 'enviada';
  update public.portfolios set status = 'adjudicada' where id = p.id;
  return o;
end $$;

create or replace function public.advance_operation(p_operation uuid, p_step text, p_signer text, p_reference text,
  p_amount numeric, p_file text, p_accept boolean) returns public.operations
language plpgsql security definer set search_path = public as $$
declare
  steps text[] := array['adjudicacion', 'firmaVendedor', 'firmaComprador', 'pago', 'confirmacionPago', 'entrega', 'recepcion'];
  seller_steps text[] := array['adjudicacion', 'firmaVendedor', 'confirmacionPago', 'entrega'];
  o public.operations; c public.companies; nxt text; s text;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  select * into o from public.operations where id = p_operation for update;
  if o.id is null then raise exception 'Operación no encontrada.'; end if;
  if o.status <> 'en_cierre' then raise exception 'La operación ya está %.', o.status; end if;

  foreach s in array steps loop
    if not exists (select 1 from public.operation_steps where operation_id = o.id and step_key = s) then nxt := s; exit; end if;
  end loop;
  if nxt is null or nxt <> p_step then raise exception 'Este paso aún no está habilitado.'; end if;

  if p_step = any(seller_steps) then
    c := public.require_company('vendedor');
    if c.id <> o.seller_company then raise exception 'Este paso le corresponde a la entidad vendedora de la operación.'; end if;
  else
    c := public.require_company('comprador');
    if c.id <> o.buyer_company then raise exception 'Este paso le corresponde a la casa de cobranza de la operación.'; end if;
  end if;

  if p_step in ('firmaVendedor', 'firmaComprador') then
    if length(coalesce(trim(p_signer), '')) < 3 then raise exception 'Escribe el nombre completo de quien firma.'; end if;
    if not coalesce(p_accept, false) then raise exception 'Debes aceptar los términos del contrato de cesión.'; end if;
  elsif p_step = 'pago' then
    if length(coalesce(trim(p_reference), '')) < 4 then raise exception 'Escribe la referencia de la transferencia.'; end if;
    if p_amount is null or abs(p_amount - o.value) > 0.05 then raise exception 'El valor pagado no coincide con el valor adjudicado (% M).', o.value; end if;
    if p_file is null then raise exception 'Adjunta el comprobante de pago.'; end if;
  elsif not coalesce(p_accept, false) then
    raise exception 'Marca la confirmación para continuar.';
  end if;
  if p_file is not null and p_file not like o.id::text || '/%' then raise exception 'Ruta de archivo no válida.'; end if;

  insert into public.operation_steps (operation_id, step_key, done_by, company_name, signer, reference, amount, file_path)
  values (o.id, p_step, auth.uid(), c.name, nullif(trim(p_signer), ''), nullif(trim(p_reference), ''), p_amount, p_file);

  if p_step = 'recepcion' then
    update public.operations set status = 'cerrada', closed_at = now() where id = o.id returning * into o;
    update public.portfolios set status = 'vendida' where id = o.portfolio_id;
  end if;
  return o;
end $$;

create or replace function public.cancel_operation(p_operation uuid) returns public.operations
language plpgsql security definer set search_path = public as $$
declare c public.companies; o public.operations;
begin
  c := public.require_company('vendedor');
  select * into o from public.operations where id = p_operation for update;
  if o.id is null or o.seller_company <> c.id then raise exception 'Operación no encontrada.'; end if;
  if o.status <> 'en_cierre' then raise exception 'La operación ya está %.', o.status; end if;
  if (select count(*) from public.operation_steps where operation_id = o.id) > 1 then
    raise exception 'Ya hay firmas o pagos registrados; la adjudicación no se puede deshacer.';
  end if;
  update public.operations set status = 'cancelada' where id = o.id returning * into o;
  update public.bids set status = 'enviada' where portfolio_id = o.portfolio_id and status in ('adjudicada', 'no_adjudicada');
  update public.portfolios set status = 'publicada' where id = o.portfolio_id;
  return o;
end $$;

-- Solo usuarios con sesión pueden llamar las funciones
do $$
declare f text;
begin
  foreach f in array array['is_admin()', 'my_company_id()', 'i_am_approved()', 'require_company(text)',
    'create_my_company(text,text,text,text,text,text,text)', 'set_company_doc(text,text,text,bigint)',
    'admin_review_company(uuid,text,text)', 'create_portfolio(text,text,text,numeric,integer,integer,numeric,timestamptz,timestamptz,text)',
    'cancel_portfolio(uuid)', 'market_portfolios()', 'bid_book()', 'place_bid(uuid,numeric,text)', 'reject_bid(uuid,boolean)',
    'adjudicate_bid(uuid)', 'advance_operation(uuid,text,text,text,numeric,text,boolean)', 'cancel_operation(uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------
-- ARCHIVOS (almacenamiento privado)
--   company-docs/<empresa>/...     RUT, Cámara de Comercio, cédula
--   portfolio-docs/<cartera>/...   data room de cada cartera
--   operation-docs/<operación>/... contratos firmados y comprobantes
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('company-docs', 'company-docs', false, 5242880),
       ('portfolio-docs', 'portfolio-docs', false, 20971520),
       ('operation-docs', 'operation-docs', false, 10485760)
on conflict (id) do nothing;

drop policy if exists "docs empresa: subir la propia" on storage.objects;
create policy "docs empresa: subir la propia" on storage.objects for insert to authenticated
  with check (bucket_id = 'company-docs' and (storage.foldername(name))[1] = public.my_company_id()::text);
drop policy if exists "docs empresa: reemplazar la propia" on storage.objects;
create policy "docs empresa: reemplazar la propia" on storage.objects for update to authenticated
  using (bucket_id = 'company-docs' and (storage.foldername(name))[1] = public.my_company_id()::text);
drop policy if exists "docs empresa: ver propia o admin" on storage.objects;
create policy "docs empresa: ver propia o admin" on storage.objects for select to authenticated
  using (bucket_id = 'company-docs' and ((storage.foldername(name))[1] = public.my_company_id()::text or public.is_admin()));

drop policy if exists "data room: subir el vendedor" on storage.objects;
create policy "data room: subir el vendedor" on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio-docs' and exists (
    select 1 from public.portfolios p where p.id::text = (storage.foldername(name))[1] and p.seller_company = public.my_company_id()));
drop policy if exists "data room: borrar el vendedor" on storage.objects;
create policy "data room: borrar el vendedor" on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio-docs' and exists (
    select 1 from public.portfolios p where p.id::text = (storage.foldername(name))[1] and p.seller_company = public.my_company_id()));
drop policy if exists "data room: ver empresas aprobadas" on storage.objects;
create policy "data room: ver empresas aprobadas" on storage.objects for select to authenticated
  using (bucket_id = 'portfolio-docs' and (public.i_am_approved() or public.is_admin()));

drop policy if exists "docs operación: subir las partes" on storage.objects;
create policy "docs operación: subir las partes" on storage.objects for insert to authenticated
  with check (bucket_id = 'operation-docs' and exists (
    select 1 from public.operations o where o.id::text = (storage.foldername(name))[1]
      and (o.seller_company = public.my_company_id() or o.buyer_company = public.my_company_id())));
drop policy if exists "docs operación: ver las partes o admin" on storage.objects;
create policy "docs operación: ver las partes o admin" on storage.objects for select to authenticated
  using (bucket_id = 'operation-docs' and (public.is_admin() or exists (
    select 1 from public.operations o where o.id::text = (storage.foldername(name))[1]
      and (o.seller_company = public.my_company_id() or o.buyer_company = public.my_company_id()))));

-- ---------------------------------------------------------
-- PERMISOS DE LECTURA (RLS decide qué filas ve cada uno) y
-- recarga de la API para que vea las tablas y funciones nuevas
-- ---------------------------------------------------------
grant usage on schema public to anon, authenticated;
revoke all on public.admins, public.companies, public.portfolios, public.bids, public.operations, public.operation_steps from anon;
grant select on public.admins, public.companies, public.portfolios, public.bids, public.operations, public.operation_steps to authenticated;
notify pgrst, 'reload schema';

-- Verificación: debe mostrar "B²GC instalado" y cuántas administradoras hay
select 'B²GC instalado' as resultado,
       (select count(*) from public.admins) as administradoras,
       (select count(*) from pg_proc where proname in ('place_bid', 'adjudicate_bid', 'advance_operation')) as funciones_clave;

-- =========================================================
-- ÚLTIMO PASO: hacerte administradora de B²GC Brokers.
-- 1) Authentication → Users → Add user → Create new user
--    (tu correo + contraseña, marca "Auto Confirm User").
-- 2) Cambia el correo de abajo por el tuyo y ejecuta solo esta línea:
--
-- insert into public.admins (user_id) select id from auth.users where email = 'TU_CORREO@AQUI.COM' on conflict do nothing;
-- =========================================================
