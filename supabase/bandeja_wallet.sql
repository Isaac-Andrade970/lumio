-- Bandeja de entrada de pagos de Wallet para Lumio.
--
-- Cómo usarlo: en Supabase → SQL Editor → New query, pega TODO este archivo,
-- cambia 'CAMBIA-ESTA-CLAVE' por tu clave secreta (una sola vez, abajo) y presiona Run.
-- ⚠️ No subas a GitHub este archivo con tu clave real: en el repositorio debe quedar el texto de ejemplo.

-- 1) La tabla: cada fila es un pago esperando que Lumio lo recoja.
create table if not exists public.pagos_pendientes (
  id bigint generated always as identity primary key,
  linea text not null check (length(linea) <= 300), -- "2026-10-23T13:45:10|$5.990|Starbucks|Visa"
  creado timestamptz not null default now()
);

-- 2) Seguridad: se activa RLS y NO se crea ninguna política.
--    Resultado: nadie puede leer ni escribir la tabla directamente desde internet.
--    Solo se puede usar a través de las funciones de abajo, que exigen la clave.
alter table public.pagos_pendientes enable row level security;

-- 3) La clave secreta vive en un solo lugar. Esta función no se puede llamar desde internet.
create or replace function public.lumio_clave_ok(clave text)
returns boolean
language sql
immutable
as $$
  select clave = 'CAMBIA-ESTA-CLAVE'
$$;
revoke execute on function public.lumio_clave_ok(text) from public, anon, authenticated;

-- 4) La usa el atajo del iPhone para dejar un pago en la bandeja.
create or replace function public.agregar_pago(clave text, linea text)
returns void
language plpgsql
security definer -- corre con permisos del dueño, por eso puede escribir en la tabla bloqueada
set search_path = public
as $$
begin
  if not lumio_clave_ok(clave) then
    raise exception 'clave incorrecta';
  end if;
  insert into pagos_pendientes (linea) values (agregar_pago.linea);
end;
$$;

-- 5) La usa Lumio al abrirse: entrega los pagos pendientes.
--    De paso borra los que llevan más de 30 días esperando, para que nada quede guardado para siempre.
create or replace function public.leer_pagos(clave text)
returns table (id bigint, linea text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not lumio_clave_ok(clave) then
    raise exception 'clave incorrecta';
  end if;
  delete from pagos_pendientes p where p.creado < now() - interval '30 days';
  return query select p.id, p.linea from pagos_pendientes p order by p.id;
end;
$$;

-- 6) La usa Lumio DESPUÉS de guardar los pagos en el teléfono: los quita de la nube.
create or replace function public.borrar_pagos(clave text, ids bigint[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not lumio_clave_ok(clave) then
    raise exception 'clave incorrecta';
  end if;
  delete from pagos_pendientes p where p.id = any(ids);
end;
$$;

-- 7) Permite que la app y el atajo (rol "anon") llamen solo a estas tres funciones.
revoke execute on function public.agregar_pago(text, text) from public;
revoke execute on function public.leer_pagos(text) from public;
revoke execute on function public.borrar_pagos(text, bigint[]) from public;
grant execute on function public.agregar_pago(text, text) to anon;
grant execute on function public.leer_pagos(text) to anon;
grant execute on function public.borrar_pagos(text, bigint[]) to anon;
