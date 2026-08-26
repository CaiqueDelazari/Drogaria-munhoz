-- =====================================================================
-- DROGARIA MUNHOZ — estrutura do banco
--
-- Este arquivo roda DENTRO DO MESMO PROJETO SUPABASE da Agropecuária JG.
-- Por isso todas as tabelas começam com "farmacia_": assim elas convivem
-- com as tabelas "loja", "produtos" e "categorias" da agropecuária sem
-- nenhuma colisão. Nada do que está aqui mexe nos dados da agropecuária.
--
-- Como rodar: painel do Supabase > SQL Editor > New query > cole tudo
-- > Run. Pode rodar de novo quantas vezes quiser, não quebra nada.
--
-- ⚠️ O e-mail do dono (seção 5) já está preenchido. Só é preciso criar a
--    conta com esse mesmo e-mail em Authentication > Users.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Dados da farmácia (uma linha só, id = 1)
-- ---------------------------------------------------------------------
create table if not exists public.farmacia_loja (
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
  -- aprovação em anúncio pago). Ver seção 8.
  razao_social  text,
  cnpj          text,
  farmaceutico  text,   -- nome do responsável técnico
  crf           text,   -- registro dele no Conselho Regional de Farmácia
  afe           text,   -- Autorização de Funcionamento da ANVISA
  licenca       text,   -- licença sanitária municipal
  email_dados   text,   -- canal do titular de dados (LGPD)
  meta_pixel    text,   -- ID do Pixel do Meta (vazio = não carrega)
  google_tag    text,   -- ID do Google Tag (vazio = não carrega)

  atualizado_em timestamptz default now(),
  constraint farmacia_loja_linha_unica check (id = 1)
);

insert into public.farmacia_loja (
  id, nome, nome_curto, tagline, sobre, whatsapp, telefone,
  endereco, cidade, mapa, abre, fecha, horario, instagram, aviso
) values (
  1,
  'Drogaria Munhoz',
  'Munhoz',
  'Agudos — SP',
  'Produtos farmacêuticos, saúde e beleza. Monte sua lista pelo site e receba em casa no mesmo dia.',
  '551434431470',
  '(14) 3443-1470',
  'Rua 13 de Maio, 807 — Centro',
  'Agudos — SP',
  'https://www.google.com/maps/search/?api=1&query=Rua+13+de+Maio,+807,+Centro,+Agudos,+SP',
  8,
  21,
  'Todos os dias, das 08h às 21h',
  'drogaria_munhoz',
  'Medicamentos sujeitos a receita só são entregues com a apresentação da prescrição. Preços e disponibilidade são confirmados no atendimento.'
) on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- 2) Categorias (as abas que aparecem em cima do catálogo)
-- ---------------------------------------------------------------------
create table if not exists public.farmacia_categorias (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique,
  ordem     int  not null default 0,   -- menor aparece primeiro
  criado_em timestamptz default now()
);

create index if not exists farmacia_categorias_ordem_idx on public.farmacia_categorias (ordem);

-- Sem categorias de exemplo: quem monta as abas é a farmácia, pelo
-- /admin.html > aba Categorias. É a primeira coisa a fazer no painel,
-- porque produto precisa de uma categoria pra entrar.


-- ---------------------------------------------------------------------
-- 3) Produtos
-- ---------------------------------------------------------------------
create table if not exists public.farmacia_produtos (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  spec      text default '',            -- linha técnica: dosagem, quantidade, marca
  preco     numeric(10, 2),             -- NULO = aparece "Consultar valor"
  categoria text not null,              -- precisa bater com farmacia_categorias.nome
  arte      text not null default 'caixa',  -- desenho do card, quando não há foto
  selo      text,                       -- null | 'promo' | 'top' | 'receita'
  foto      text default '',            -- URL da foto; vazio = usa o desenho
  ativo     boolean not null default true,  -- false = some do catálogo
  ordem     int not null default 0,     -- menor aparece primeiro
  criado_em timestamptz default now(),
  constraint farmacia_produtos_arte_valida
    check (arte in ('caixa','frasco','bisnaga','garrafa','bebe','aparelho','beleza')),
  constraint farmacia_produtos_selo_valido
    check (selo is null or selo in ('promo','top','receita'))
);

create index if not exists farmacia_produtos_ativo_ordem_idx on public.farmacia_produtos (ativo, ordem);

-- se algum produto já usa uma categoria fora da lista, ela entra também,
-- pra aba não sumir do site depois de uma atualização
insert into public.farmacia_categorias (nome, ordem)
select distinct p.categoria, 99
from public.farmacia_produtos p
where coalesce(p.categoria, '') <> ''
on conflict (nome) do nothing;


-- ---------------------------------------------------------------------
-- 4) Serviços do balcão
-- ---------------------------------------------------------------------
create table if not exists public.farmacia_servicos (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  texto     text default '',
  nota      text default '',
  ico       text not null default 'coracao',  -- coracao | seringa | gota | moto
  ordem     int not null default 0,
  ativo     boolean not null default true,
  criado_em timestamptz default now(),
  constraint farmacia_servicos_ico_valido
    check (ico in ('coracao','seringa','gota','moto'))
);

insert into public.farmacia_servicos (nome, texto, nota, ico, ordem)
select * from (values
  ('Aferição de pressão',      'Medição gratuita no balcão, sem precisar agendar.',            'Todos os dias',    'coracao', 1),
  ('Aplicação de injetáveis',  'Feita por profissional habilitado, mediante receita.',         'Com receita',      'seringa', 2),
  ('Teste de glicemia',        'Resultado na hora, com material descartável.',                 'Consulte o valor', 'gota',    3),
  ('Entrega em domicílio',     'Pedidos pelo WhatsApp entregues no mesmo dia em Agudos.',      '08h às 21h',       'moto',    4)
) as novos
where not exists (select 1 from public.farmacia_servicos);


-- ---------------------------------------------------------------------
-- 5) Segurança (RLS)
--
--    Qualquer visitante LÊ. Só O DONO DA FARMÁCIA ESCREVE.
--    É isto — e não senha no código — que protege os dados.
--
--    O e-mail do dono já está preenchido abaixo:
--    drogariamunhoz29@hotmail.com. Precisa existir uma conta com
--    EXATAMENTE esse e-mail em Authentication > Users, senão o admin
--    abre e não salva nada. Se um dia o e-mail mudar, troque aqui e
--    rode o arquivo de novo.
--
--    E continua valendo pro projeto inteiro:
--      Authentication > Sign In / Providers > Email
--      > "Allow new users to sign up" = DESLIGADO
--    senão qualquer um cria conta e vira "usuário logado".
--
--    Repare que esta função é SEPARADA da eh_dono() da agropecuária:
--    o dono da farmácia não enxerga nem edita nada da agropecuária,
--    e vice-versa.
-- ---------------------------------------------------------------------
create or replace function public.eh_dono_farmacia()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and lower(email) = lower('drogariamunhoz29@hotmail.com')
  );
$$;

revoke all on function public.eh_dono_farmacia() from public;
grant execute on function public.eh_dono_farmacia() to anon, authenticated;

alter table public.farmacia_loja       enable row level security;
alter table public.farmacia_produtos   enable row level security;
alter table public.farmacia_categorias enable row level security;
alter table public.farmacia_servicos   enable row level security;

drop policy if exists "farmacia loja: todos leem"         on public.farmacia_loja;
drop policy if exists "farmacia loja: dono atualiza"      on public.farmacia_loja;
drop policy if exists "farmacia produtos: todos leem"     on public.farmacia_produtos;
drop policy if exists "farmacia produtos: dono escreve"   on public.farmacia_produtos;
drop policy if exists "farmacia categorias: todos leem"   on public.farmacia_categorias;
drop policy if exists "farmacia categorias: dono escreve" on public.farmacia_categorias;
drop policy if exists "farmacia servicos: todos leem"     on public.farmacia_servicos;
drop policy if exists "farmacia servicos: dono escreve"   on public.farmacia_servicos;

create policy "farmacia loja: todos leem"
  on public.farmacia_loja for select
  to anon, authenticated
  using (true);

create policy "farmacia loja: dono atualiza"
  on public.farmacia_loja for update
  to authenticated
  using (public.eh_dono_farmacia()) with check (public.eh_dono_farmacia());

-- visitante só enxerga produto ativo; o dono enxerga tudo
create policy "farmacia produtos: todos leem"
  on public.farmacia_produtos for select
  to anon, authenticated
  using (ativo or public.eh_dono_farmacia());

create policy "farmacia produtos: dono escreve"
  on public.farmacia_produtos for all
  to authenticated
  using (public.eh_dono_farmacia()) with check (public.eh_dono_farmacia());

create policy "farmacia categorias: todos leem"
  on public.farmacia_categorias for select
  to anon, authenticated
  using (true);

create policy "farmacia categorias: dono escreve"
  on public.farmacia_categorias for all
  to authenticated
  using (public.eh_dono_farmacia()) with check (public.eh_dono_farmacia());

create policy "farmacia servicos: todos leem"
  on public.farmacia_servicos for select
  to anon, authenticated
  using (ativo or public.eh_dono_farmacia());

create policy "farmacia servicos: dono escreve"
  on public.farmacia_servicos for all
  to authenticated
  using (public.eh_dono_farmacia()) with check (public.eh_dono_farmacia());


-- ---------------------------------------------------------------------
-- 6) Fotos dos produtos (Storage)
--    Bucket próprio da farmácia — separado do bucket "produtos" que a
--    agropecuária já usa no mesmo projeto.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('farmacia', 'farmacia', true)
on conflict (id) do nothing;

drop policy if exists "farmacia fotos: todos veem" on storage.objects;
drop policy if exists "farmacia fotos: dono envia" on storage.objects;
drop policy if exists "farmacia fotos: dono troca" on storage.objects;
drop policy if exists "farmacia fotos: dono apaga" on storage.objects;

create policy "farmacia fotos: todos veem"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'farmacia');

create policy "farmacia fotos: dono envia"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'farmacia' and public.eh_dono_farmacia());

create policy "farmacia fotos: dono troca"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'farmacia' and public.eh_dono_farmacia())
  with check (bucket_id = 'farmacia' and public.eh_dono_farmacia());

create policy "farmacia fotos: dono apaga"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'farmacia' and public.eh_dono_farmacia());


-- ---------------------------------------------------------------------
-- 7) Catálogo
--    Nasce vazio, de propósito. Preço e produto de farmácia quem
--    cadastra é a loja, no /admin.html — exemplo com preço inventado
--    no ar é problema de consumidor e reprova anúncio.
--
--    Se algum dia precisar zerar o catálogo de novo, use o arquivo
--    limpar-exemplos.sql.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 8) Conformidade: dados obrigatórios de farmácia, LGPD e anúncio pago
--
--    Esta seção existe por dois motivos:
--    a) quem já rodou a versão anterior deste arquivo não tem as colunas
--       novas da farmacia_loja — os "add column if not exists" resolvem;
--    b) medicamento de tarja (sujeito a receita) NÃO pode ter preço
--       exposto ao público. A constraint no fim garante isso no banco,
--       não só na tela.
-- ---------------------------------------------------------------------
alter table public.farmacia_loja add column if not exists razao_social text;
alter table public.farmacia_loja add column if not exists cnpj         text;
alter table public.farmacia_loja add column if not exists farmaceutico text;
alter table public.farmacia_loja add column if not exists crf          text;
alter table public.farmacia_loja add column if not exists afe          text;
alter table public.farmacia_loja add column if not exists licenca      text;
alter table public.farmacia_loja add column if not exists email_dados  text;
alter table public.farmacia_loja add column if not exists meta_pixel   text;
alter table public.farmacia_loja add column if not exists google_tag   text;

-- tira o preço público de qualquer item de tarja que já esteja cadastrado
update public.farmacia_produtos
   set preco = null
 where selo = 'receita' and preco is not null;

-- e impede que volte a entrar, pelo painel ou por qualquer outro caminho
alter table public.farmacia_produtos
  drop constraint if exists farmacia_produtos_tarja_sem_preco;
alter table public.farmacia_produtos
  add constraint farmacia_produtos_tarja_sem_preco
  check (selo is distinct from 'receita' or preco is null);
