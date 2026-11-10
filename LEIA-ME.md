# Drogaria Munhoz — site catálogo

Site em HTML, CSS e JavaScript puro, com o catálogo vindo de um **Postgres na VPS**.
Não precisa de build nem de servidor Node: é só publicar a pasta.

O banco é **próprio desta farmácia** (banco `drogaria` na VPS). Até 18/09/2026 ficava no mesmo projeto Supabase da Agropecuária JG, e era por isso que as
duas lojas não se atrapalharem, todas as tabelas da farmácia começam com
`farmacia_` e as fotos vão para um bucket próprio (`farmacia`). Nada aqui
mexe nos dados da agropecuária.

## Arquivos

```
index.html              o site que o cliente vê
privacidade.html        Política de Privacidade (LGPD)
termos.html             Termos de Uso
admin.html              painel do lojista (login + cadastro)
banco/schema.sql        estrutura do banco (Postgres da VPS)
banco/002-medicamento.sql  coluna `medicamento` (rodar uma vez em produção)
banco/003-fiado-e-pedidos.sql  tabelas do fiado e dos pedidos (idem)
supabase.sql            OBSOLETO: como o banco era no Supabase, só histórico
limpar-exemplos.sql     apaga catálogo de exemplo (só se rodou a versão antiga)
vercel.json             cabeçalhos de segurança da hospedagem
robots.txt              o que o Google indexa (tudo, menos o /admin)
sitemap.xml             mapa do site para busca
og-imagem.html          fonte da imagem de preview — abra e print para regerar
assets/config.js        dados de reserva da loja (sem chave nenhuma)
assets/banco.js         conversa com a API do próprio site (catálogo e admin)
assets/dados-loja.js    joga os dados da loja nas páginas (site e documentos)
assets/rastreio.js      banner de cookies + Pixel/Google Tag
assets/app.js           comportamento do site
assets/admin.js         comportamento do painel (catálogo e loja)
assets/caderno.js       abas Devedores e Pedidos do painel
assets/legal.js         preenche a privacidade e os termos
assets/artes.js         desenhos SVG dos produtos e ícones dos serviços
assets/styles.css       visual (cores, tipografia, layout)
assets/favicon.svg      ícone da aba do navegador
assets/og.png           imagem que aparece quando o link é colado no WhatsApp
```

## Como o banco funciona (desde 18/09/2026)

O site **saiu do Supabase**. Antes o navegador falava direto com o banco, com a
chave pública à vista, e quem barrava escrita indevida eram 8 políticas de RLS.

Agora existe um servidor próprio (`servidor/servidor.mjs`, express + pg) que
entrega o site e responde a API que o `assets/banco.js` consome. O navegador
nunca alcança o Postgres, e a regra virou uma só: **leitura é pública, escrita
exige sessão de administrador** (`exigirAdmin`, no servidor).

- **Banco:** Postgres na VPS, banco `drogaria`. A estrutura está em
  `banco/schema.sql` (o antigo `supabase.sql` ficou só como histórico).
- **Login:** tabela `admins`, senha em bcrypt — o mesmo formato que o Auth do
  Supabase usava, então a senha da dona foi migrada sem precisar trocar.
- **Trocar a senha:**
  `printf '%s
' 'nova-senha' | docker exec -i dlz-restaurantes-drogaria-1 node servidor/scripts/criar-admin.mjs drogariamunhoz29@hotmail.com "Drogaria Munhoz"`
- **Fotos:** vão para o disco (volume `drogaria_uploads`), servidas em
  `/uploads/produtos/...`. Antes ficavam no Storage do Supabase.

A dona entra em `admin.html` e edita tudo por lá: produtos, categorias,
serviços do balcão e os dados da loja.

## O que dá pra editar no painel

| Aba | O que muda |
|-----|------------|
| **Produtos** | Nome, tipo (produto / sem receita / com receita), linha técnica, preço, categoria, foto ou desenho, selo (Oferta / Mais pedido), posição e se aparece no catálogo |
| **Categorias** | As abas que aparecem em cima do catálogo — criar, renomear, reordenar, apagar |
| **Serviços** | Os quadros da seção "Serviços do balcão" |
| **Dados da loja** | WhatsApp, telefone, endereço, horário, Instagram, mapa e o aviso legal — muda no site inteiro de uma vez |
| **Devedores** | O fiado: cada cliente tem uma comanda com o que levou (texto livre + valor, sem ligação com o catálogo). Recebe parte ou tudo, e o saldo se atualiza. Manda o extrato no WhatsApp do cliente e imprime a notinha (bobina de 80 mm; quem está em dia sai com comprovante de quitação) |
| **Pedidos** | Lista do que precisa pedir (ao fornecedor ou para um cliente), com "ainda não feito" / "feito em ...". A aba mostra quantos faltam |

**Devedores e Pedidos não aparecem no site.** São do balcão: o servidor exige
login até para ler (`/api/devedores`, `/api/lancamentos`, `/api/pedidos`), porque
têm nome, telefone e dívida de cliente. Regras do fiado, garantidas no servidor:
pagamento não passa do que o cliente deve (dois cliques em "Receber" não
abatem duas vezes), e apagar um item que deixaria o pagamento maior que a
dívida é recusado -- apague o pagamento antes. Apagar anotação é para corrigir
erro; apagar o cliente apaga a conta inteira.

Detalhes úteis:

- **Preço vazio** = o card mostra "Consultar valor" e o pedido no WhatsApp sai
  como "consultar valor" naquele item.
- **Foto** é opcional. Sem foto, o card usa o desenho escolhido em
  "Desenho do card".
- **Esconder** um produto tira ele do site sem apagar o cadastro.
- Renomear uma categoria renomeia ela em todos os produtos junto, para nenhum
  item ficar órfão.

## O catálogo nasce vazio

De propósito. Produto e preço de farmácia quem cadastra é a loja, pelo
`admin.html` — catálogo de exemplo com preço inventado é problema de
consumidor e reprova anúncio no Meta e no Google.

A ordem no painel é: **Categorias primeiro, depois Produtos** (o formulário
de produto exige uma categoria; sem nenhuma, o botão "Novo produto" manda
você criar uma antes).

> Se você rodou uma versão antiga do `supabase.sql` (quando o banco era lá), ela semeou 41 produtos
> e 7 categorias de exemplo. Rode o `limpar-exemplos.sql` uma vez pra tirar
> tudo do ar. Ele não mexe nos serviços nem nos dados da loja.

## Se o banco cair

O site não quebra: o `assets/config.js` guarda dados de reserva que entram
no ar sozinhos quando a API não responde. Contato, horário e serviços
têm reserva; **produtos e categorias estão vazios de propósito** — melhor o
catálogo aparecer vazio por alguns minutos do que mostrar preço que não é o
da loja. Se um dia quiser reserva de catálogo, copie pra lá os produtos
reais já cadastrados.

## Conformidade e tráfego pago

O site já nasce montado para rodar anúncio no Meta e no Google — falta só o
cliente entregar os dados. Farmácia é **categoria restrita** nas duas
plataformas e ainda responde à ANVISA e ao CRF, então isso não é opcional.

**O que o código já resolve:**

- **Política de Privacidade e Termos de Uso** (`privacidade.html` e
  `termos.html`), com link no rodapé de todas as páginas. Meta e Google
  reprovam domínio sem esses documentos.
- **Banner de cookies** que aparece antes de qualquer pixel disparar. Se o
  visitante recusar, nada carrega. Se a loja ainda não tem Pixel nem Google
  Tag cadastrados, o banner nem aparece — não há o que consentir.
- **Pixel do Meta e Google Tag** entram só pelo ID cadastrado no painel, nunca
  no código. O clique no WhatsApp já vai como evento de conversão.
- **Remédio com receita não aparece no site.** No painel, o campo **Tipo**
  separa quatro casos:

  | Tipo | No site |
  |------|---------|
  | Produto (higiene, beleza…) | aparece normal |
  | Medicamento sem receita | aparece, com a advertência da RDC 96/2008 ("… é um medicamento. Seu uso pode trazer riscos. Procure o médico e o farmacêutico. Leia a bula.") |
  | Medicamento com receita | **não aparece**: nem nome, nem preço, nem foto. Fica só no painel |
  | Controlado | o painel não deixa cadastrar |

  A regra está no servidor (`VISIVEL_AO_PUBLICO`), não só na tela: a API
  pública não entrega o item, e `/uploads/produtos/...` devolve 404 para a
  foto de produto de receita ou escondido — link antigo, compartilhado ou
  indexado não abre. A lista completa (`?incluirInativos=1`) exige sessão.
  No banco, "com receita" é `selo = 'receita'`, sem preço
  (`produtos_tarja_sem_preco`) e sempre `medicamento`
  (`produtos_receita_e_medicamento`). No lugar dos itens, o catálogo mostra
  o aviso "Medicamentos com receita… envie a receita no WhatsApp".
  Base: Lei 9.294/96, art. 7º, e RDC 96/2008 (propaganda de medicamento sob
  prescrição só para profissionais); Portaria 344/98 e RDC 44/2009
  (controlado não é oferecido por meio remoto).
- **Rodapé com os dados obrigatórios** (razão social, CNPJ, farmacêutico
  responsável + CRF, AFE e licença sanitária). Enquanto um dado não for
  preenchido, **a linha some** — nunca aparece campo em branco nem número
  inventado.
- **Checklist no painel** (aba "Dados da loja") mostrando exatamente o que
  ainda falta para poder anunciar.

**O que o código não automatiza:** a RDC 96 pede advertências extras para
algumas substâncias (ácido acetilsalicílico, dipirona, entre outras). Se a
loja divulgar esses itens, a advertência específica vai na linha técnica do
produto. Vale o farmacêutico responsável conferir.

> Os textos de privacidade e termos descrevem com precisão o que este site faz
> hoje, mas **não substituem revisão de advogado**. Vale o cliente dar uma
> passada antes de pôr a campanha no ar. Se o site um dia passar a vender
> online com pagamento na página, os dois documentos precisam ser reescritos.

## O que ainda precisa vir do cliente

- **Dados obrigatórios de farmácia** — sem eles o site **não pode anunciar**:
  razão social, CNPJ, nome e CRF do farmacêutico responsável técnico, número
  da AFE (ANVISA), licença sanitária municipal e um e-mail para assuntos de
  dados (LGPD). Todos se preenchem no painel, aba "Dados da loja".
- **Categorias e produtos**: o banco entrega vazio. A loja cria as abas na
  aba Categorias e cadastra o estoque real na aba Produtos, com os preços
  que ela pratica. Item do tipo "Medicamento com receita" não leva preço e
  não aparece no site.
- **Logo em alta**: a logo está redesenhada em SVG (fica nítida em qualquer
  tamanho). Se o cliente tiver o arquivo original, dá pra trocar pelos blocos
  `<svg>` marcados com `marca__selo` no `index.html`.
- **Fotos dos produtos** (opcional): já dá pra subir pelo painel; sem foto o
  card usa o desenho da categoria.
- **Serviços**: confira a lista na aba Serviços — ajuste conforme o que a
  loja realmente oferece.

## Link no WhatsApp, Google e segurança da hospedagem

O pedido chega pelo WhatsApp, então o link colado lá **é** a vitrine. As três
páginas públicas trazem `og:` e `twitter:` completos, apontando para
`assets/og.png` (1200×630) — sem isso o link aparece cru, só a URL.

- **Regerar a imagem**: abra o `og-imagem.html` no navegador e tire um print de
  1200×630, ou rode o Chrome em modo headless:
  `chrome --headless --window-size=1200,630 --screenshot=assets/og.png og-imagem.html`.
  Refaça sempre que endereço ou horário mudarem — o texto está lá dentro.
- **`robots.txt`** libera o catálogo e **bloqueia o `/admin.html`**, que também
  já sai com `noindex` na página e no cabeçalho HTTP. Painel de lojista não
  aparece no Google.
- **`index.html` tem JSON-LD de `Pharmacy`** com endereço, telefone e horário —
  é o que alimenta a busca local ("farmácia perto de mim" / Google Maps). Os
  dados ali precisam bater com os da tela; dado inventado vira penalização.
- **`vercel.json`** aplica `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy` e `X-Frame-Options`. O `/admin.html` ainda recebe
  `X-Frame-Options: DENY` e `Cache-Control: no-store`, para o painel não poder
  ser embutido em iframe de outro site nem ficar em cache de navegador
  compartilhado.

### Domínio

O site atende em **https://drogariamunhoz.com.br** (e no `www`). O DNS fica no
registro.br, com dois registros `A → 76.76.21.21` — raiz e `www` — e a Vercel
cuida do certificado HTTPS sozinha, renovando sem intervenção.

O endereço antigo `drogaria-munhoz.vercel.app` continua funcionando como
atalho interno; não use em material de divulgação.

Se um dia trocar de domínio, os lugares a atualizar são: `canonical`, `og:url`
e `og:image` em `index.html`, `privacidade.html` e `termos.html`; o JSON-LD no
`index.html`; o `robots.txt`; e o `sitemap.xml`
(Authentication > URL Configuration), que é o que os links de e-mail usam.

## Como publicar

O site roda na VPS, no compose de `/opt/dlz-restaurantes` (serviço `drogaria`).
O Dockerfile faz `COPY . ./`, então **editar arquivo na VPS não muda nada** sem
reconstruir a imagem:

```bash
# da máquina local, enviando o que mudou
tar -cf - index.html admin.html assets servidor banco   | ssh -i ~/.ssh/id_ed25519_dlz root@187.127.62.147 'tar -x -C /opt/dlz-restaurantes/drogaria'

# na VPS
cd /opt/dlz-restaurantes
docker compose build drogaria && docker compose up -d --no-deps drogaria
```

> Os arquivos JS são módulos ES e usam `import`. Abrir o `index.html` com
> duplo clique (`file://`) não funciona por causa do CORS do navegador —
> rode o servidor (`cd servidor && npm start`) ou use o ambiente da VPS.

## Detalhes de implementação

- A `anon key` no `config.js` é pública por design. Quem protege os dados são
  a regra do servidor (`exigirAdmin`): **qualquer um lê, só o administrador escreve**.
- A lista de compras fica no `localStorage`, então o cliente não perde o
  pedido se recarregar. Produto apagado no painel some da lista sozinho.
- O botão "Enviar pedido no WhatsApp" monta a mensagem com itens,
  quantidades e total, e abre o `wa.me` do número cadastrado no painel.
- A tarja "Aberto agora / Fechado agora" usa o relógio do visitante e as
  horas de abrir/fechar dos dados da loja.
- Responsivo até 360px, com foco visível no teclado e `prefers-reduced-motion`
  respeitado.
