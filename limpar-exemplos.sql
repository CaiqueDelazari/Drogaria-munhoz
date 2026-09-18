-- =====================================================================
-- ⚠️ OBSOLETO desde 18/09/2026 — o banco saiu do Supabase.
--
-- Para apagar catálogo hoje, use o painel (/admin.html) ou o Postgres da
-- VPS. Este arquivo fica só como histórico.
-- =====================================================================

-- =====================================================================
-- DROGARIA MUNHOZ — apagar o catálogo de exemplo
--
-- O supabase.sql antigo semeava 41 produtos e 7 categorias de exemplo,
-- só pra loja não nascer vazia. Quem cadastra o estoque de verdade é a
-- farmácia, pelo /admin.html — então isso sai do ar.
--
-- Rode UMA VEZ: SQL Editor > New query > cole > Run.
--
-- ⚠️ Apaga TODOS os produtos e TODAS as categorias, não só os exemplos.
--    Se a farmácia já tiver cadastrado item de verdade, PARE: dá pra
--    apagar um por um pelo painel, sem risco.
--
-- Não mexe em: dados da loja, serviços do balcão, fotos, políticas RLS.
-- =====================================================================

delete from public.farmacia_produtos;
delete from public.farmacia_categorias;

-- confere: os dois primeiros têm que voltar 0
select
  (select count(*) from public.farmacia_produtos)   as produtos,
  (select count(*) from public.farmacia_categorias) as categorias,
  (select count(*) from public.farmacia_servicos)   as servicos_mantidos,
  (select count(*) from public.farmacia_loja)       as loja_mantida;
