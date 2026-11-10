/* ============================================================
   DROGARIA MUNHOZ — caderno do balcão (abas Devedores e Pedidos)

   Fiado: cada cliente tem uma comanda. Item anotado = o que ele levou
   (texto livre + valor, sem ligação com o catálogo do site). Pagamento
   abate parte ou tudo. O saldo é calculado pelo servidor somando a comanda.

   Pedidos: lista do que precisa pedir, com "falta fazer" / "feito".

   Tudo aqui exige login também para LER: são dados de cliente, e o
   servidor recusa sem sessão (servidor.mjs, "caderno do balcão").
   ============================================================ */

const $ = (s, raiz = document) => raiz.querySelector(s);
const $$ = (s, raiz = document) => Array.from(raiz.querySelectorAll(s));

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const semAcento = (t) => (t || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
const escapar = (t) => String(t ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

async function api(caminho, opcoes = {}) {
  const r = await fetch("/api" + caminho, {
    credentials: "same-origin",
    ...opcoes,
    headers: { "Content-Type": "application/json", ...opcoes.headers },
  });
  if (!r.ok) {
    let m = "Falha na operação (" + r.status + ")";
    try { const c = await r.json(); if (c?.erro) m = c.erro; } catch {}
    if (r.status === 401) m = "Sua sessão expirou. Entre de novo no painel.";
    throw new Error(m);
  }
  return r.json();
}

const enviar = (caminho, metodo, corpo) =>
  api(caminho, { method: metodo, body: corpo === undefined ? undefined : JSON.stringify(corpo) });

/* "12,50" -> 12.5 só para conferir antes de mandar; quem decide é o servidor */
function lerValor(t) {
  let s = String(t || "").trim().replace(/\s|R\$/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function mostrarErro(el, e) {
  el.textContent = e?.message || String(e);
  el.hidden = false;
}

function abrirDlg(dlg) { if (!dlg.open) dlg.showModal(); }
$$("[data-fechar-dlg]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));

/* ============================================================
   DEVEDORES
   ============================================================ */
const fiado = { devedores: [], busca: "", atual: null, lancamentos: [], editando: null };

async function carregarDevedores() {
  fiado.devedores = await api("/devedores");
  desenharDevedores();
}

function desenharDevedores() {
  const devendo = fiado.devedores.filter((d) => Number(d.saldo) > 0);
  $("#totalFiado").textContent = moeda.format(devendo.reduce((s, d) => s + Number(d.saldo), 0));
  $("#qtdDevendo").textContent = String(devendo.length);

  const t = semAcento(fiado.busca).trim();
  const achados = fiado.devedores.filter((d) => !t || semAcento(d.nome + " " + d.telefone).includes(t));
  const alvo = $("#listaDevedores");
  if (!achados.length) {
    alvo.innerHTML = '<div class="painel"><p class="vazio-adm">' +
      (fiado.devedores.length ? "Nenhum cliente com esse nome." : "Nenhum cliente no caderno. Use <b>+ Novo cliente</b>.") +
      "</p></div>";
    return;
  }
  alvo.innerHTML = achados.map((d) => {
    const saldo = Number(d.saldo);
    const quitado = saldo <= 0;
    const quando = d.ultimo_movimento ? "última anotação " + dataCurta.format(new Date(d.ultimo_movimento)) : "sem anotações";
    return '<button type="button" class="fila devedor" data-devedor="' + escapar(d.id) + '" data-quitado="' + quitado + '">' +
      "<div>" +
        '<p class="fila__nome">' + escapar(d.nome) + "</p>" +
        '<p class="fila__meta">' + escapar(quando) + (d.obs ? " · " + escapar(d.obs) : "") + "</p>" +
      "</div>" +
      '<span class="devedor__saldo">' + (quitado ? "Em dia" : moeda.format(saldo)) +
        "<small>" + (quitado ? "nada a pagar" : "deve") + "</small></span>" +
    "</button>";
  }).join("");
}

$("#buscaFiado").addEventListener("input", (ev) => { fiado.busca = ev.target.value; desenharDevedores(); });
$("#listaDevedores").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-devedor]");
  if (b) abrirComanda(b.dataset.devedor);
});

/* ---- cadastro do cliente ---- */
function abrirFormDevedor(d) {
  fiado.editando = d || null;
  const f = $("#formDevedor");
  f.reset();
  $("#erroDevedor").hidden = true;
  $("#tituloDevedor").textContent = d ? "Editar cliente" : "Novo cliente";
  f.nome.value = d?.nome || "";
  f.telefone.value = d?.telefone || "";
  f.obs.value = d?.obs || "";
  abrirDlg($("#dlgDevedor"));
  f.nome.focus();
}
$("#btNovoDevedor").addEventListener("click", () => abrirFormDevedor(null));

$("#formDevedor").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  const dados = { nome: f.nome.value.trim(), telefone: f.telefone.value, obs: f.obs.value.trim() };
  try {
    let id;
    if (fiado.editando) {
      await enviar("/devedores/" + fiado.editando.id, "PUT", dados);
      id = fiado.editando.id;
    } else {
      id = (await enviar("/devedores", "POST", dados)).id;
    }
    $("#dlgDevedor").close();
    await carregarDevedores();
    abrirComanda(id); // cliente novo já abre a comanda para anotar
  } catch (e) { mostrarErro($("#erroDevedor"), e); }
});

/* ---- comanda ---- */
async function abrirComanda(id) {
  fiado.atual = fiado.devedores.find((d) => String(d.id) === String(id)) || null;
  if (!fiado.atual) return;
  $("#erroComanda").hidden = true;
  $("#formCompra").reset();
  $("#formPagamento").reset();
  abrirDlg($("#dlgComanda"));
  await recarregarComanda();
  $("#formCompra").descricao.focus();
}

async function recarregarComanda() {
  const id = fiado.atual.id;
  const [lancamentos, devedores] = await Promise.all([api("/devedores/" + id + "/lancamentos"), api("/devedores")]);
  fiado.lancamentos = lancamentos;
  fiado.devedores = devedores;
  fiado.atual = devedores.find((d) => d.id === id) || fiado.atual;
  desenharDevedores();
  desenharComanda();
}

function desenharComanda() {
  const d = fiado.atual;
  const saldo = Number(d.saldo);
  $("#tituloComanda").textContent = d.nome;
  $("#infoComanda").textContent = [d.telefone && formatarTelefone(d.telefone), d.obs].filter(Boolean).join(" · ") || "sem telefone";

  const caixa = $("#saldoComanda");
  caixa.dataset.quitado = String(saldo <= 0);
  caixa.innerHTML = saldo > 0
    ? "Deve<b>" + moeda.format(saldo) + "</b>"
    : "Em dia<b>" + moeda.format(0) + "</b>";
  $("#formPagamento").hidden = saldo <= 0;

  const lista = $("#listaLancamentos");
  if (!fiado.lancamentos.length) {
    lista.innerHTML = '<p class="vazio-adm">Nada anotado ainda. Digite o que o cliente levou e o valor.</p>';
  } else {
    // mais recente em cima: é o que o balconista quer conferir
    lista.innerHTML = fiado.lancamentos.slice().reverse().map((l) => {
      const pago = l.tipo === "pagamento";
      return '<div class="lanc" data-tipo="' + l.tipo + '">' +
        '<span class="lanc__data">' + dataHora.format(new Date(l.criado_em)) + "</span>" +
        "<span>" + (pago ? "Pagou" + (l.descricao ? " · " + escapar(l.descricao) : "") : escapar(l.descricao)) + "</span>" +
        '<span class="lanc__valor">' + (pago ? "− " : "") + moeda.format(Number(l.valor)) + "</span>" +
        '<button type="button" class="lanc__x" data-apagar-lanc="' + escapar(l.id) + '" aria-label="Apagar esta anotação" title="Apagar (corrigir erro)">✕</button>' +
      "</div>";
    }).join("");
  }

  const zap = $("#btZapComanda");
  zap.hidden = !d.telefone;
  if (d.telefone) zap.href = linkExtrato(d, saldo);
}

function formatarTelefone(t) {
  const n = String(t).replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (n.length === 11) return "(" + n.slice(0, 2) + ") " + n.slice(2, 7) + "-" + n.slice(7);
  if (n.length === 10) return "(" + n.slice(0, 2) + ") " + n.slice(2, 6) + "-" + n.slice(6);
  return t;
}

/* Extrato pronto para mandar ao cliente: os itens desde o último momento em
   que ele ficou em dia, o que já pagou desde então e o saldo. */
function linkExtrato(d, saldo) {
  let inicio = 0;
  let acumulado = 0;
  fiado.lancamentos.forEach((l, i) => {
    acumulado += l.tipo === "compra" ? Number(l.valor) : -Number(l.valor);
    if (acumulado <= 0) inicio = i + 1;
  });
  const linhas = fiado.lancamentos.slice(inicio).map((l) =>
    "• " + dataCurta.format(new Date(l.criado_em)) + " — " +
    (l.tipo === "pagamento" ? "pagamento: −" : l.descricao + ": ") + moeda.format(Number(l.valor)));
  const texto = "Olá, " + d.nome.split(" ")[0] + "! Segue sua conta na Drogaria Munhoz:\n\n" +
    (linhas.length ? linhas.join("\n") + "\n\n" : "") +
    (saldo > 0 ? "Total em aberto: " + moeda.format(saldo) : "Sua conta está em dia. Obrigado!");
  let numero = String(d.telefone).replace(/\D/g, "");
  if (numero.length <= 11) numero = "55" + numero;
  return "https://wa.me/" + numero + "?text=" + encodeURIComponent(texto);
}

$("#formCompra").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  $("#erroComanda").hidden = true;
  if (lerValor(f.valor.value) === null) return mostrarErro($("#erroComanda"), new Error("Valor inválido. Ex.: 12,50"));
  const bt = $('button[type="submit"]', f);
  bt.disabled = true;
  try {
    await enviar("/devedores/" + fiado.atual.id + "/compras", "POST", { descricao: f.descricao.value, valor: f.valor.value });
    f.reset();
    await recarregarComanda();
    f.descricao.focus(); // já pronto para o próximo item
  } catch (e) { mostrarErro($("#erroComanda"), e); }
  finally { bt.disabled = false; }
});

$("#btPagarTudo").addEventListener("click", () => {
  const saldo = Number(fiado.atual?.saldo || 0);
  $("#formPagamento").valor.value = saldo.toFixed(2).replace(".", ",");
  $("#formPagamento").valor.focus();
});

$("#formPagamento").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  $("#erroComanda").hidden = true;
  const valor = lerValor(f.valor.value);
  if (valor === null) return mostrarErro($("#erroComanda"), new Error("Valor inválido. Ex.: 50,00"));
  const saldo = Number(fiado.atual.saldo);
  const quita = Math.abs(valor - saldo) < 0.005;
  if (!confirm("Receber " + moeda.format(valor) + " de " + fiado.atual.nome + "?" +
    (quita ? "\nA conta fica quitada." : "\nFica faltando " + moeda.format(Math.max(saldo - valor, 0)) + "."))) return;
  const bt = $('button[type="submit"]', f);
  bt.disabled = true;
  try {
    await enviar("/devedores/" + fiado.atual.id + "/pagamentos", "POST", { valor: f.valor.value });
    f.reset();
    await recarregarComanda();
  } catch (e) { mostrarErro($("#erroComanda"), e); }
  finally { bt.disabled = false; }
});

$("#listaLancamentos").addEventListener("click", async (ev) => {
  const b = ev.target.closest("[data-apagar-lanc]");
  if (!b) return;
  const l = fiado.lancamentos.find((x) => x.id === b.dataset.apagarLanc);
  const nome = l.tipo === "pagamento" ? "o pagamento de " + moeda.format(Number(l.valor)) : '"' + l.descricao + '"';
  if (!confirm("Apagar " + nome + "? Use só para corrigir anotação errada.")) return;
  try {
    await enviar("/lancamentos/" + l.id, "DELETE");
    await recarregarComanda();
  } catch (e) { mostrarErro($("#erroComanda"), e); }
});

$("#btEditarDevedor").addEventListener("click", () => {
  const d = fiado.atual;
  $("#dlgComanda").close();
  abrirFormDevedor(d);
});

$("#btApagarDevedor").addEventListener("click", async () => {
  const d = fiado.atual;
  const saldo = Number(d.saldo);
  const aviso = saldo > 0
    ? d.nome + " ainda deve " + moeda.format(saldo) + ".\nApagar o cliente apaga a conta inteira e não dá para desfazer. Continuar?"
    : "Apagar " + d.nome + " e todo o histórico? Não dá para desfazer.";
  if (!confirm(aviso)) return;
  try {
    await enviar("/devedores/" + d.id, "DELETE");
    $("#dlgComanda").close();
    await carregarDevedores();
  } catch (e) { mostrarErro($("#erroComanda"), e); }
});

/* ============================================================
   PEDIDOS
   ============================================================ */
const ped = { lista: [], filtro: "falta", editando: null };

async function carregarPedidos() {
  ped.lista = await api("/pedidos");
  desenharPedidos();
}

function desenharPedidos() {
  const faltam = ped.lista.filter((p) => !p.feito_em).length;
  const conta = $("#contaPedidos");
  conta.textContent = String(faltam);
  conta.hidden = faltam === 0;
  $$("[data-filtro-pedido]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.filtroPedido === ped.filtro));
    if (b.dataset.filtroPedido === "falta") b.textContent = "Falta fazer (" + faltam + ")";
  });

  const achados = ped.lista.filter((p) =>
    ped.filtro === "todos" || (ped.filtro === "feito" ? !!p.feito_em : !p.feito_em));
  const alvo = $("#listaPedidos");
  if (!achados.length) {
    alvo.innerHTML = '<div class="painel"><p class="vazio-adm">' +
      (ped.filtro === "falta" ? "Nenhum pedido para fazer. Tudo em dia." : "Nada por aqui.") + "</p></div>";
    return;
  }
  alvo.innerHTML = achados.map((p) => {
    const feito = !!p.feito_em;
    const meta = ["anotado " + dataHora.format(new Date(p.criado_em))]
      .concat(p.para_quem ? [p.para_quem] : []);
    return '<div class="pedido" data-feito="' + feito + '">' +
      "<div>" +
        '<span class="estado">' + (feito ? "✓ Feito em " + escapar(dataHora.format(new Date(p.feito_em))) : "● Ainda não feito") + "</span>" +
        '<p class="pedido__texto">' + escapar(p.texto) + "</p>" +
        '<p class="fila__meta">' + meta.map(escapar).join(" · ") + "</p>" +
      "</div>" +
      '<div class="fila__acoes">' +
        (feito
          ? '<button class="bt bt--mini" data-pedido-feito="false" data-id="' + escapar(p.id) + '">Desfazer</button>'
          : '<button class="bt bt--mini bt--verde" data-pedido-feito="true" data-id="' + escapar(p.id) + '">Marcar como feito</button>') +
        '<button class="bt bt--mini" data-pedido-editar="' + escapar(p.id) + '">Editar</button>' +
        '<button class="bt bt--mini bt--perigo" data-pedido-apagar="' + escapar(p.id) + '">Apagar</button>' +
      "</div>" +
    "</div>";
  }).join("");
}

$$("[data-filtro-pedido]").forEach((b) => b.addEventListener("click", () => {
  ped.filtro = b.dataset.filtroPedido;
  desenharPedidos();
}));

$("#formPedido").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  const bt = $('button[type="submit"]', f);
  bt.disabled = true;
  try {
    await enviar("/pedidos", "POST", { texto: f.texto.value, para_quem: f.para_quem.value });
    f.reset();
    ped.filtro = "falta";
    await carregarPedidos();
  } catch (e) { alert(e.message); }
  finally { bt.disabled = false; }
});

$("#listaPedidos").addEventListener("click", async (ev) => {
  const marcar = ev.target.closest("[data-pedido-feito]");
  const editar = ev.target.closest("[data-pedido-editar]");
  const apagar = ev.target.closest("[data-pedido-apagar]");
  try {
    if (marcar) {
      await enviar("/pedidos/" + marcar.dataset.id, "PUT", { feito: marcar.dataset.pedidoFeito === "true" });
      await carregarPedidos();
    }
    if (editar) {
      ped.editando = ped.lista.find((p) => p.id === editar.dataset.pedidoEditar);
      const f = $("#formEditarPedido");
      $("#erroPedido").hidden = true;
      f.texto.value = ped.editando.texto;
      f.para_quem.value = ped.editando.para_quem;
      abrirDlg($("#dlgPedido"));
    }
    if (apagar) {
      const p = ped.lista.find((x) => x.id === apagar.dataset.pedidoApagar);
      if (!confirm("Apagar este pedido?\n\n" + p.texto)) return;
      await enviar("/pedidos/" + p.id, "DELETE");
      await carregarPedidos();
    }
  } catch (e) { alert(e.message); }
});

$("#formEditarPedido").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  try {
    await enviar("/pedidos/" + ped.editando.id, "PUT", { texto: f.texto.value, para_quem: f.para_quem.value });
    $("#dlgPedido").close();
    await carregarPedidos();
  } catch (e) { mostrarErro($("#erroPedido"), e); }
});

/* ============================================================
   ENTRADA: carrega quando a aba abre; o número de pedidos pendentes
   aparece na aba assim que o painel é aberto.
   ============================================================ */
$$('.aba[data-aba="fiado"], .aba[data-aba="pedidos"]').forEach((b) => b.addEventListener("click", () => {
  const carregar = b.dataset.aba === "fiado" ? carregarDevedores : carregarPedidos;
  carregar().catch((e) => alert(e.message));
}));

new MutationObserver((_m, obs) => {
  if ($("#telaPainel").hidden) return;
  obs.disconnect();
  carregarPedidos().catch(() => {});
}).observe($("#telaPainel"), { attributes: true, attributeFilter: ["hidden"] });
