/* =====================================================================
   Conversa com a API deste próprio site.

   Antes este arquivo falava DIRETO com o Supabase: a chave pública ficava à
   vista no config.js e quem protegia os dados eram 8 políticas de RLS. O site
   saiu do Supabase; agora quem guarda a credencial do Postgres é o servidor
   (servidor/servidor.mjs), que nunca a envia para a página.

   As 21 funções exportadas continuam com o MESMO nome e o MESMO formato de
   retorno de antes — é por isso que o app.js (catálogo) e o admin.js (painel,
   645 linhas) não precisaram de uma linha de mudança.
   ===================================================================== */
import { LOJA_PADRAO, PRODUTOS_PADRAO, CATEGORIAS_PADRAO, SERVICOS_PADRAO } from "./config.js";

/* O site agora é servido pelo mesmo endereço da API: não há o que configurar.
   A constante fica porque o app.js e o admin.js a consultam. */
export const configurado = true;

async function api(caminho, opcoes = {}) {
  const resposta = await fetch(`/api${caminho}`, {
    credentials: "same-origin",
    ...opcoes,
    headers: opcoes.body instanceof Blob ? opcoes.headers : { "Content-Type": "application/json", ...opcoes.headers },
  });
  if (!resposta.ok) {
    let mensagem = `Falha na operação (${resposta.status})`;
    try {
      const corpo = await resposta.json();
      if (corpo?.erro) mensagem = corpo.erro;
    } catch {}
    throw new Error(mensagem);
  }
  if (resposta.status === 204) return null;
  return resposta.json();
}

/* ---------- Loja ---------- */
export async function carregarLoja() {
  try {
    const data = await api("/loja");
    if (!data) return { ...LOJA_PADRAO, _offline: true };
    // campo vazio no banco cai no padrão, pro rodapé nunca ficar com buraco
    const loja = { ...LOJA_PADRAO };
    for (const [k, v] of Object.entries(data)) {
      if (v !== null && v !== "") loja[k] = v;
    }
    return loja;
  } catch {
    return { ...LOJA_PADRAO, _offline: true };
  }
}

export async function salvarLoja(loja) {
  await api("/loja", { method: "PUT", body: JSON.stringify(loja) });
}

/* ---------- Produtos ---------- */
export async function carregarProdutos({ incluirInativos = false } = {}) {
  try {
    const produtos = await api(`/produtos${incluirInativos ? "?incluirInativos=1" : ""}`);
    return { produtos: produtos ?? [], offline: false };
  } catch (e) {
    return { produtos: PRODUTOS_PADRAO, offline: true, erro: e.message };
  }
}

export async function criarProduto(p) {
  return api("/produtos", { method: "POST", body: JSON.stringify(p) });
}

export async function atualizarProduto(id, p) {
  await api(`/produtos/${id}`, { method: "PUT", body: JSON.stringify(p) });
}

export async function apagarProduto(id) {
  await api(`/produtos/${id}`, { method: "DELETE" });
}

/* ---------- Categorias ----------
   São as "abas" que aparecem em cima do catálogo. Ficam no banco para o
   dono poder criar, renomear, reordenar e apagar pelo painel. */
const categoriasDeReserva = () =>
  CATEGORIAS_PADRAO.map((nome, i) => ({ id: `padrao-${i}`, nome, ordem: i + 1 }));

export async function carregarCategorias() {
  try {
    const categorias = await api("/categorias");
    if (!categorias?.length) return { categorias: categoriasDeReserva(), offline: false, vazio: true };
    return { categorias, offline: false };
  } catch (e) {
    return { categorias: categoriasDeReserva(), offline: true, erro: e.message };
  }
}

export async function criarCategoria(nome, ordem) {
  return api("/categorias", { method: "POST", body: JSON.stringify({ nome, ordem }) });
}

/* Renomear troca o nome também em todos os produtos daquela categoria,
   senão eles ficariam órfãos e sumiriam do filtro. Isso agora acontece numa
   transação no servidor: antes eram duas chamadas soltas, e falhar no meio
   deixava produto apontando para categoria que não existe mais. */
export async function renomearCategoria(id, _nomeAntigo, nomeNovo) {
  await api(`/categorias/${id}`, { method: "PUT", body: JSON.stringify({ nome: nomeNovo }) });
}

export async function apagarCategoria(id) {
  await api(`/categorias/${id}`, { method: "DELETE" });
}

/* Grava a posição de cada categoria depois de subir/descer uma delas. */
export async function salvarOrdemCategorias(categorias) {
  await api("/categorias/ordem", {
    method: "PUT",
    body: JSON.stringify({ categorias: categorias.map((c) => ({ id: c.id })) }),
  });
  categorias.forEach((c, i) => { c.ordem = i + 1; });
}

/* ---------- Serviços do balcão ---------- */
export async function carregarServicos({ incluirInativos = false } = {}) {
  try {
    const servicos = await api(`/servicos${incluirInativos ? "?incluirInativos=1" : ""}`);
    if (!servicos?.length) return { servicos: SERVICOS_PADRAO, offline: false, vazio: true };
    return { servicos, offline: false };
  } catch (e) {
    return { servicos: SERVICOS_PADRAO, offline: true, erro: e.message };
  }
}

export async function criarServico(s) {
  return api("/servicos", { method: "POST", body: JSON.stringify(s) });
}

export async function atualizarServico(id, s) {
  await api(`/servicos/${id}`, { method: "PUT", body: JSON.stringify(s) });
}

export async function apagarServico(id) {
  await api(`/servicos/${id}`, { method: "DELETE" });
}

/* ---------- Foto do produto ----------
   Vai como corpo cru: sem multipart, sem dependência a mais. Quem confere se
   é imagem de verdade é o servidor, pela assinatura dos bytes — e é ele quem
   batiza o arquivo, porque nome vindo do navegador não é confiável. */
export async function enviarFoto(arquivo) {
  const { url } = await api("/upload", {
    method: "POST",
    body: arquivo,
    headers: { "Content-Type": arquivo.type || "application/octet-stream" },
  });
  return url;
}

/* Tirar ou trocar a foto de um produto não apagava o arquivo: ele ficava
   ocupando espaço pra sempre. Falha aqui é engolida de propósito — foto órfã
   é chateação, produto que não salva é prejuízo. */
export async function apagarFoto(url) {
  if (!url) return;
  try {
    await api(`/foto?url=${encodeURIComponent(url)}`, { method: "DELETE" });
  } catch {}
}

/* ---------- Login ---------- */
export async function entrar(email, senha) {
  return api("/login", { method: "POST", body: JSON.stringify({ email, senha }) });
}

export async function sair() {
  try {
    await api("/logout", { method: "POST" });
  } catch {}
}

export async function usuarioAtual() {
  try {
    return await api("/eu");
  } catch {
    return null;
  }
}

/* Antes isto perguntava ao banco (`rpc("eh_dono_farmacia")`) se o usuário
   logado era o dono DA FARMÁCIA — o mesmo projeto Supabase atendia a
   Agropecuária, e alguém logado na conta dela abriria este painel.

   Aqui o banco é só desta farmácia e só existe uma lista de administradores:
   quem tem sessão válida é dono. A função fica porque o admin.js a chama. */
export async function ehDono() {
  return (await usuarioAtual()) !== null;
}
