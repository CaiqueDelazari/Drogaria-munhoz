/* ============================================================
   Preenche a Política de Privacidade e os Termos com os dados
   reais da loja, vindos do banco. Assim, quando o CNPJ ou o
   farmacêutico responsável mudar no painel, os documentos
   acompanham sozinhos.
   ============================================================ */
import { carregarLoja } from "./banco.js";
import { aplicarDadosLoja } from "./dados-loja.js";
import { iniciarRastreio } from "./rastreio.js";

carregarLoja().then((loja) => {
  aplicarDadosLoja(loja);
  document.title = document.title.replace("Drogaria Munhoz", loja.nome);
  iniciarRastreio(loja);
});
