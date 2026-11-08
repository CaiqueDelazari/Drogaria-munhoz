-- ---------------------------------------------------------------------------
-- Marca o que é medicamento, para o site saber onde vai a advertência.
--
-- Medicamento isento de prescrição (MIP) pode aparecer no catálogo, mas a
-- RDC 96/2008 exige a advertência "É UM MEDICAMENTO. SEU USO PODE TRAZER
-- RISCOS..." junto. Sem esta coluna o site não distingue um analgésico de um
-- shampoo.
--
-- Item com selo `receita` é medicamento por definição: a migração já marca
-- os que existem, e a trava impede o contrário dali em diante.
--
-- Rodar uma vez em produção (idempotente):
--   docker exec -i dlz-restaurantes-db-local psql -U dlz -d drogaria < banco/002-medicamento.sql
-- ---------------------------------------------------------------------------
begin;

alter table produtos add column if not exists medicamento boolean not null default false;

update produtos set medicamento = true where selo = 'receita' and not medicamento;

alter table produtos drop constraint if exists produtos_receita_e_medicamento;
alter table produtos add constraint produtos_receita_e_medicamento
  check (selo is distinct from 'receita' or medicamento);

commit;
