-- ---------------------------------------------------------------------------
-- Caderno do balcão: fiado (devedores) e pedidos a fazer.
--
-- Nada disso aparece no site: é anotação interna da loja, lida e escrita só
-- com sessão de administrador (servidor.mjs). Os itens do fiado são texto
-- livre, de propósito -- não têm ligação com o catálogo.
--
-- Rodar uma vez em produção (idempotente):
--   docker exec -i dlz-restaurantes-db-local psql -U dlz -d drogaria < banco/003-fiado-e-pedidos.sql
-- ---------------------------------------------------------------------------
begin;

-- Cliente que compra para pagar depois.
create table if not exists devedores (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  telefone  text not null default '',   -- só números; usado no link do WhatsApp
  obs       text not null default '',
  criado_em timestamptz not null default now(),
  constraint devedores_nome_preenchido check (length(trim(nome)) > 0)
);

-- A comanda: cada item anotado é uma `compra`, cada valor recebido é um
-- `pagamento`. O saldo é a diferença, calculado na hora -- não fica gravado
-- em lugar nenhum para não ter como desencontrar.
create table if not exists fiado_lancamentos (
  id         uuid primary key default gen_random_uuid(),
  devedor_id uuid not null references devedores(id) on delete cascade,
  tipo       text not null,
  descricao  text not null default '',
  valor      numeric(10, 2) not null,
  criado_em  timestamptz not null default now(),
  constraint fiado_tipo_valido check (tipo in ('compra', 'pagamento')),
  constraint fiado_valor_positivo check (valor > 0)
);
create index if not exists fiado_lancamentos_devedor_idx on fiado_lancamentos (devedor_id, criado_em);

-- Pedido a fazer (ao fornecedor, encomenda de cliente...). `feito_em` vazio
-- = ainda não foi feito; preenchido = quando foi.
create table if not exists pedidos (
  id        uuid primary key default gen_random_uuid(),
  texto     text not null,
  para_quem text not null default '',
  feito_em  timestamptz,
  criado_em timestamptz not null default now(),
  constraint pedidos_texto_preenchido check (length(trim(texto)) > 0)
);
create index if not exists pedidos_feito_idx on pedidos (feito_em);

commit;
