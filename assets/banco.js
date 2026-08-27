/* =====================================================================
   Conversa com o Supabase. Usado tanto pelo catálogo quanto pelo admin.

   Todas as tabelas têm o prefixo "farmacia_" porque o banco é
   compartilhado com a Agropecuária JG (mesmo projeto Supabase).
   ===================================================================== */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  LOJA_PADRAO,
  PRODUTOS_PADRAO,
  CATEGORIAS_PADRAO,
  SERVICOS_PADRAO,
} from "./config.js";

export const configurado =
  !!SUPABASE_URL &&
  !SUPABASE_URL.startsWith("COLE_AQUI") &&
  !!SUPABASE_ANON_KEY &&
  !SUPABASE_ANON_KEY.startsWith("COLE_AQUI");

export const sb = configurado ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const BUCKET = "farmacia";

/* ---------- Loja ---------- */
export async function carregarLoja() {
  if (!sb) return { ...LOJA_PADRAO, _offline: true };
  const { data, error } = await sb.from("farmacia_loja").select("*").eq("id", 1).maybeSingle();
  if (error || !data) return { ...LOJA_PADRAO, _offline: true };
  // campo vazio no banco cai no padrão, pro rodapé nunca ficar com buraco
  const loja = { ...LOJA_PADRAO };
  for (const [k, v] of Object.entries(data)) {
    if (v !== null && v !== "") loja[k] = v;
  }
  return loja;
}

export async function salvarLoja(loja) {
  const { error } = await sb.from("farmacia_loja").update(loja).eq("id", 1);
  if (error) throw error;
}

/* ---------- Produtos ---------- */
export async function carregarProdutos({ incluirInativos = false } = {}) {
  if (!sb) return { produtos: PRODUTOS_PADRAO, offline: true };
  let q = sb.from("farmacia_produtos").select("*").order("ordem", { ascending: true }).order("nome");
  if (!incluirInativos) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) return { produtos: PRODUTOS_PADRAO, offline: true, erro: error.message };
  return { produtos: data ?? [], offline: false };
}

export async function criarProduto(p) {
  const { data, error } = await sb.from("farmacia_produtos").insert(p).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarProduto(id, p) {
  const { error } = await sb.from("farmacia_produtos").update(p).eq("id", id);
  if (error) throw error;
}

export async function apagarProduto(id) {
  const { error } = await sb.from("farmacia_produtos").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Categorias ----------
   São as "abas" que aparecem em cima do catálogo. Ficam no banco para o
   dono poder criar, renomear, reordenar e apagar pelo painel. */
const categoriasDeReserva = () =>
  CATEGORIAS_PADRAO.map((nome, i) => ({ id: `padrao-${i}`, nome, ordem: i + 1 }));

export async function carregarCategorias() {
  if (!sb) return { categorias: categoriasDeReserva(), offline: true };
  const { data, error } = await sb
    .from("farmacia_categorias")
    .select("*")
    .order("ordem", { ascending: true })
    .order("nome");
  if (error) return { categorias: categoriasDeReserva(), offline: true, erro: error.message };
  if (!data?.length) return { categorias: categoriasDeReserva(), offline: false, vazio: true };
  return { categorias: data, offline: false };
}

export async function criarCategoria(nome, ordem) {
  const { data, error } = await sb
    .from("farmacia_categorias")
    .insert({ nome, ordem })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* Renomear troca o nome também em todos os produtos daquela categoria,
   senão eles ficariam órfãos e sumiriam do filtro. */
export async function renomearCategoria(id, nomeAntigo, nomeNovo) {
  const { error } = await sb.from("farmacia_categorias").update({ nome: nomeNovo }).eq("id", id);
  if (error) throw error;
  const { error: erroProdutos } = await sb
    .from("farmacia_produtos")
    .update({ categoria: nomeNovo })
    .eq("categoria", nomeAntigo);
  if (erroProdutos) throw erroProdutos;
}

export async function apagarCategoria(id) {
  const { error } = await sb.from("farmacia_categorias").delete().eq("id", id);
  if (error) throw error;
}

/* Grava a posição de cada categoria depois de subir/descer uma delas. */
export async function salvarOrdemCategorias(categorias) {
  for (const [i, c] of categorias.entries()) {
    if (c.ordem === i + 1) continue;
    const { error } = await sb.from("farmacia_categorias").update({ ordem: i + 1 }).eq("id", c.id);
    if (error) throw error;
    c.ordem = i + 1;
  }
}

/* ---------- Serviços do balcão ---------- */
export async function carregarServicos({ incluirInativos = false } = {}) {
  if (!sb) return { servicos: SERVICOS_PADRAO, offline: true };
  let q = sb.from("farmacia_servicos").select("*").order("ordem", { ascending: true });
  if (!incluirInativos) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) return { servicos: SERVICOS_PADRAO, offline: true, erro: error.message };
  if (!data?.length) return { servicos: SERVICOS_PADRAO, offline: false, vazio: true };
  return { servicos: data, offline: false };
}

export async function criarServico(s) {
  const { data, error } = await sb.from("farmacia_servicos").insert(s).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarServico(id, s) {
  const { error } = await sb.from("farmacia_servicos").update(s).eq("id", id);
  if (error) throw error;
}

export async function apagarServico(id) {
  const { error } = await sb.from("farmacia_servicos").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Foto do produto ---------- */
export async function enviarFoto(arquivo) {
  const ext = (arquivo.name.split(".").pop() || "jpg").toLowerCase();
  // randomUUID em vez de Math.random: o upload usa upsert:false, entao nome
  // repetido faz a foto falhar na hora de subir.
  const nome = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(nome, arquivo, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(nome);
  return data.publicUrl;
}

/* ---------- Login ---------- */
export async function entrar(email, senha) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data.user;
}

export async function sair() {
  await sb.auth.signOut();
}

export async function usuarioAtual() {
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}

/* Confere no próprio banco se o usuário logado é o dono DA FARMÁCIA.
   Sem isso, alguém logado na conta da agropecuária abriria o painel da
   farmácia e só descobriria que não pode salvar na hora de salvar. */
export async function ehDono() {
  if (!sb) return false;
  const { data, error } = await sb.rpc("eh_dono_farmacia");
  if (error) return false;
  return data === true;
}
