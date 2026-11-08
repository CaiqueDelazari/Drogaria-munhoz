-- ---------------------------------------------------------------------------
-- Drogaria Munhoz no Postgres da VPS.
--
-- Vem do `supabase.sql`, com três diferenças de propósito:
--
--  1. Sem o prefixo `farmacia_`. Lá as tabelas dividiam o projeto com a
--     Agropecuária JG; aqui a farmácia tem banco próprio e o prefixo só
--     repetiria o nome do banco em toda consulta.
--  2. Sem RLS. As 8 políticas viraram UMA regra no servidor: leitura é
--     pública, escrita exige sessão de administrador (`exigirAdmin`). RLS
--     protegia o banco de um navegador que falava direto com ele — aqui o
--     navegador nunca alcança o Postgres.
--  3. Com `admins` e `sessoes`: o login sai do Auth do Supabase e passa a
--     ser deste servidor. O hash continua bcrypt, o MESMO formato, então a
--     senha atual da dona segue valendo.
--
-- As TRAVAS vieram todas, e uma delas não é estética: medicamento de tarja
-- não pode ter preço exposto ao público (`produtos_tarja_sem_preco`). É
-- exigência de propaganda de medicamento sujeito a receita.
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------- loja
create table if not exists loja (
  id            int primary key default 1,
  nome          text,
  nome_curto    text,
  tagline       text,
  sobre         text,
  whatsapp      text,   -- só números, com DDI + DDD: 551434431470
  telefone      text,   -- como aparece na tela: (14) 3443-1470
  email         text,
  endereco      text,
  cidade        text,
  mapa          text,
  abre          int,    -- hora de abertura em 24h (8 = 08h)
  fecha         int,    -- hora de fechamento em 24h (21 = 21h)
  horario       text,   -- texto que aparece pro cliente
  instagram     text,   -- só o @, sem a URL
  aviso         text,   -- tarja legal do catálogo

  -- dados obrigatórios de farmácia (rodapé, política de privacidade e
  -- aprovação em anúncio pago)
  razao_social  text,
  cnpj          text,
  farmaceutico  text,   -- nome do responsável técnico
  crf           text,   -- registro dele no Conselho Regional de Farmácia
  afe           text,   -- Autorização de Funcionamento da ANVISA
  licenca       text,   -- licença sanitária municipal
  email_dados   text,   -- canal do titular de dados (LGPD)
  meta_pixel    text,   -- ID do Pixel do Meta (vazio = não carrega)
  google_tag    text,   -- ID do Google Tag (vazio = não carrega)

  atualizado_em timestamptz not null default now(),
  constraint loja_linha_unica check (id = 1)
);

-- ------------------------------------------------------------ categorias
-- As "abas" em cima do catálogo. Ficam no banco para a dona criar,
-- renomear, reordenar e apagar pelo painel.
create table if not exists categorias (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique,
  ordem     int  not null default 0,   -- menor aparece primeiro
  criado_em timestamptz not null default now()
);
create index if not exists categorias_ordem_idx on categorias (ordem);

-- -------------------------------------------------------------- produtos
create table if not exists produtos (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  spec      text default '',               -- dosagem, quantidade, marca
  preco     numeric(10, 2),                -- NULO = "Consultar valor"
  categoria text not null,                 -- bate com categorias.nome
  arte      text not null default 'caixa', -- desenho do card quando não há foto
  selo      text,                          -- null | promo | top | receita
  foto      text default '',               -- caminho da foto; vazio = desenho
  medicamento boolean not null default false, -- true = leva a advertência da RDC 96
  ativo     boolean not null default true, -- false = some do catálogo
  ordem     int not null default 0,
  criado_em timestamptz not null default now(),

  constraint produtos_arte_valida
    check (arte in ('caixa','frasco','bisnaga','garrafa','bebe','aparelho','beleza')),
  constraint produtos_selo_valido
    check (selo is null or selo in ('promo','top','receita')),

  -- Medicamento de tarja NÃO pode ter preço público. Fica no banco, e não
  -- só na tela, porque tela se contorna: painel novo, importação, consulta
  -- manual. Aqui não passa por caminho nenhum.
  constraint produtos_tarja_sem_preco
    check (selo is distinct from 'receita' or preco is null),

  -- Remédio de receita é medicamento por definição (ver 002-medicamento.sql).
  constraint produtos_receita_e_medicamento
    check (selo is distinct from 'receita' or medicamento)
);

-- Produto com selo `receita` fica no banco para a loja, mas NUNCA sai pela
-- API pública: nem nome, nem preço, nem foto (servidor.mjs). A lei veda a
-- propaganda de medicamento sob prescrição ao público leigo, e catálogo
-- aberto com nome e embalagem já é propaganda (Lei 9.294/96, art. 7º;
-- RDC 96/2008).
create index if not exists produtos_ativo_ordem_idx on produtos (ativo, ordem);

-- -------------------------------------------------------------- serviços
create table if not exists servicos (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  texto     text default '',
  nota      text default '',
  ico       text not null default 'coracao',  -- coracao | seringa | gota | moto
  ordem     int not null default 0,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint servicos_ico_valido
    check (ico in ('coracao','seringa','gota','moto'))
);

-- ---------------------------------------------------------------- acesso
-- Substitui o Auth do Supabase. O hash é bcrypt (`$2a$`/`$2b$`), o mesmo
-- formato que o Auth guardava -- por isso a senha atual pôde ser migrada
-- sem obrigar ninguém a trocar.
create table if not exists admins (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  nome       text not null default 'Administrador',
  senha_hash text not null,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

-- Sessão em tabela, com o HASH do token no lugar do token: vazamento de
-- backup não vira acesso ao painel.
create table if not exists sessoes (
  token_hash text primary key,
  admin_id   uuid not null references admins(id) on delete cascade,
  criada_em  timestamptz not null default now(),
  expira_em  timestamptz not null
);
create index if not exists sessoes_admin_idx on sessoes (admin_id);
create index if not exists sessoes_expira_idx on sessoes (expira_em);
