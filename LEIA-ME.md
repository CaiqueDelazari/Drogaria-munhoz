# Drogaria Munhoz — site catálogo

Site em HTML, CSS e JavaScript puro, com o catálogo vindo do **Supabase**.
Não precisa de build nem de servidor Node: é só publicar a pasta.

O banco fica **dentro do mesmo projeto Supabase da Agropecuária JG**. Para as
duas lojas não se atrapalharem, todas as tabelas da farmácia começam com
`farmacia_` e as fotos vão para um bucket próprio (`farmacia`). Nada aqui
mexe nos dados da agropecuária.

## Arquivos

```
index.html              o site que o cliente vê
privacidade.html        Política de Privacidade (LGPD)
termos.html             Termos de Uso
admin.html              painel do lojista (login + cadastro)
supabase.sql            estrutura do banco — rode uma vez no Supabase
limpar-exemplos.sql     apaga catálogo de exemplo (só se rodou a versão antiga)
vercel.json             cabeçalhos de segurança da hospedagem
robots.txt              o que o Google indexa (tudo, menos o /admin)
sitemap.xml             mapa do site para busca
og-imagem.html          fonte da imagem de preview — abra e print para regerar
assets/config.js        chaves do Supabase + dados de reserva
assets/banco.js         conversa com o Supabase (catálogo e admin)
assets/dados-loja.js    joga os dados da loja nas páginas (site e documentos)
assets/rastreio.js      banner de cookies + Pixel/Google Tag
assets/app.js           comportamento do site
assets/admin.js         comportamento do painel
assets/legal.js         preenche a privacidade e os termos
assets/artes.js         desenhos SVG dos produtos e ícones dos serviços
assets/styles.css       visual (cores, tipografia, layout)
assets/favicon.svg      ícone da aba do navegador
assets/og.png           imagem que aparece quando o link é colado no WhatsApp
```

## Como ligar o banco (uma vez só)

1. **Rode o SQL.** Painel do Supabase (projeto da Agropecuária JG) >
   SQL Editor > New query > cole o `supabase.sql` inteiro > Run.
   Pode rodar de novo depois sem quebrar nada.

2. **E-mail do dono já configurado.** A função `eh_dono_farmacia()` (seção 5
   do `supabase.sql`) está com `drogariamunhoz29@hotmail.com`. Se um dia o
   e-mail mudar, troque lá e rode o arquivo de novo — enquanto o e-mail da
   função não bater com o da conta logada, o painel abre mas **não salva
   nada**, e ele avisa isso na tela.

3. **Crie a conta do dono.** Authentication > Users > Add user, com
   `drogariamunhoz29@hotmail.com` — exatamente o mesmo e-mail da função.

4. **Desligue o auto-cadastro.** Authentication > Sign In / Providers >
   Email > "Allow new users to sign up" = **desligado**. Sem isso qualquer
   um cria conta e vira "usuário logado".

Já ligado, o dono entra em `admin.html` e edita tudo por lá: produtos,
categorias, serviços do balcão e os dados da loja.

## O que dá pra editar no painel

| Aba | O que muda |
|-----|------------|
| **Produtos** | Nome, linha técnica, preço, categoria, foto ou desenho, selo (Oferta / Mais pedido / Só com receita), posição e se aparece no catálogo |
| **Categorias** | As abas que aparecem em cima do catálogo — criar, renomear, reordenar, apagar |
| **Serviços** | Os quadros da seção "Serviços do balcão" |
| **Dados da loja** | WhatsApp, telefone, endereço, horário, Instagram, mapa e o aviso legal — muda no site inteiro de uma vez |

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

> Se você rodou uma versão antiga do `supabase.sql`, ela semeou 41 produtos
> e 7 categorias de exemplo. Rode o `limpar-exemplos.sql` uma vez pra tirar
> tudo do ar. Ele não mexe nos serviços nem nos dados da loja.

## Se o banco cair

O site não quebra: o `assets/config.js` guarda dados de reserva que entram
no ar sozinhos quando o Supabase não responde. Contato, horário e serviços
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
- **Medicamento de tarja não mostra preço.** Item com selo "Só com receita"
  aparece como "Sob receita — consulte no balcão", no card, na lista e na
  mensagem do WhatsApp. O banco também barra
  (`farmacia_produtos_tarja_sem_preco`), e no painel o campo de preço se
  tranca sozinho quando o selo é marcado.
- **Rodapé com os dados obrigatórios** (razão social, CNPJ, farmacêutico
  responsável + CRF, AFE e licença sanitária). Enquanto um dado não for
  preenchido, **a linha some** — nunca aparece campo em branco nem número
  inventado.
- **Checklist no painel** (aba "Dados da loja") mostrando exatamente o que
  ainda falta para poder anunciar.

**Leitura mais rigorosa das normas:** RDC 96/2008 chega a vedar a divulgação
de medicamento de tarja ao público leigo, e não só do preço. O site esconde o
preço, mas o item continua visível no catálogo. Se o farmacêutico responsável
preferir o caminho mais seguro, é só marcar esses itens como **"Esconder"** no
painel — essa decisão é dele.

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
  que ela pratica. Item marcado como "Só com receita" não leva preço.
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

### ⚠️ Quando o domínio entrar no ar

O domínio `drogariamunhoz.com.br` já está no projeto da Vercel, esperando dois
registros **A → 76.76.21.21** no registro.br (raiz e `www`). Assim que resolver:

1. Troque `https://drogaria-munhoz.vercel.app` por `https://drogariamunhoz.com.br`
   em `index.html`, `privacidade.html`, `termos.html` (canonical + og:url +
   og:image), no `robots.txt` e no `sitemap.xml`.
2. No Supabase, Authentication > URL Configuration, ponha o domínio no
   *Site URL* — é o que os links de e-mail (recuperação de senha) usam.

## Como publicar

Qualquer hospedagem de site estático serve. A mais rápida:

```bash
npx vercel deploy --prod
```

Ou arraste a pasta para o painel da Vercel / Netlify. Também funciona em
hospedagem comum via FTP.

> Os arquivos JS são módulos ES e usam `import`. Abrir o `index.html` com
> duplo clique (`file://`) não funciona por causa do CORS do navegador —
> rode um servidor local (`npx serve .`) ou publique.

## Detalhes de implementação

- A `anon key` no `config.js` é pública por design. Quem protege os dados são
  as políticas RLS do `supabase.sql`: **qualquer um lê, só o dono escreve**.
- A lista de compras fica no `localStorage`, então o cliente não perde o
  pedido se recarregar. Produto apagado no painel some da lista sozinho.
- O botão "Enviar pedido no WhatsApp" monta a mensagem com itens,
  quantidades e total, e abre o `wa.me` do número cadastrado no painel.
- A tarja "Aberto agora / Fechado agora" usa o relógio do visitante e as
  horas de abrir/fechar dos dados da loja.
- Responsivo até 360px, com foco visível no teclado e `prefers-reduced-motion`
  respeitado.
