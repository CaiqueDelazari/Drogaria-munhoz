/* ============================================================
   DROGARIA MUNHOZ — dados da loja na página

   Usado pelo site e também pela Política de Privacidade e pelos
   Termos. Fica num arquivo só para o CNPJ, o CRF e o telefone
   nunca ficarem diferentes entre uma página e outra.

   Convenção no HTML:
     data-zap            → vira o link do WhatsApp
     data-mapa           → vira o link do mapa
     data-instagram      → vira o link do Instagram ("texto" também escreve o @)
     data-loja="campo"   → recebe o texto daquele campo
     data-linha="campo"  → o bloco inteiro some se o campo estiver vazio
   ============================================================ */

const $$ = (s) => Array.from(document.querySelectorAll(s));

export function aplicarDadosLoja(loja) {
  $$("[data-zap]").forEach((a) => { a.href = "https://wa.me/" + loja.whatsapp; });
  $$("[data-mapa]").forEach((a) => { if (loja.mapa) a.href = loja.mapa; });
  $$("[data-instagram]").forEach((a) => {
    a.href = "https://instagram.com/" + loja.instagram;
    if (a.dataset.instagram === "texto") a.textContent = "@" + loja.instagram;
  });

  const textos = {
    nome: loja.nome,
    telefone: loja.telefone,
    horario: loja.horario,
    endereco: loja.endereco,
    cidade: loja.cidade,
    sobre: loja.sobre,
    aviso: loja.aviso,
    endereco_cidade: loja.endereco + ", " + loja.cidade,
    // dados obrigatórios de farmácia
    razao_social: loja.razao_social,
    cnpj: loja.cnpj,
    farmaceutico: loja.farmaceutico,
    crf: loja.crf,
    afe: loja.afe,
    licenca: loja.licenca,
    email_dados: loja.email_dados,
  };
  Object.entries(textos).forEach(([chave, valor]) => {
    $$('[data-loja="' + chave + '"]').forEach((el) => { el.textContent = valor || ""; });
  });

  /* Linha que depende de um dado que o cliente ainda não passou some da
     página. Melhor faltar a linha do que mostrar "CNPJ:" em branco — ou,
     pior, um número inventado. O painel avisa o que está faltando. */
  $$("[data-linha]").forEach((el) => { el.hidden = !loja[el.dataset.linha]; });

  /* e o bloco inteiro some quando nenhuma linha dele sobrou — senão fica
     um vão vazio no rodapé enquanto o cliente não passa os dados */
  $$("[data-bloco]").forEach((bloco) => {
    const sobrou = Array.from(bloco.querySelectorAll("[data-linha]")).some((el) => !el.hidden);
    bloco.hidden = !sobrou;
  });
}
