/* ============================================================
   DROGARIA MUNHOZ — painel do lojista

   Quem pode escrever de verdade é decidido pelo servidor: leitura é
   pública, escrita exige sessão de administrador. Esta tela só facilita
   a vida, avisando na entrada em vez de deixar o erro aparecer na hora
   de salvar. (Antes eram 8 políticas de RLS no Supabase.)
   ============================================================ */
import { ARTES, ICONES } from "./artes.js";
import {
  configurado, entrar, sair, usuarioAtual, ehDono,
  carregarLoja, salvarLoja,
  carregarProdutos, criarProduto, atualizarProduto, apagarProduto,
  carregarCategorias, criarCategoria, renomearCategoria, apagarCategoria, salvarOrdemCategorias,
  carregarServicos, criarServico, atualizarServico, apagarServico,
  enviarFoto, apagarFoto,
} from "./banco.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const semAcento = (t) => (t || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
const escapar = (t) => String(t ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const estado = {
  dono: false,
  produtos: [],
  categorias: [],
  servicos: [],
  loja: null,
  editando: null,       // produto em edição (null = novo)
  editandoServico: null,
  fotoAtual: "",
  fotoAnterior: "",
  busca: "",
  filtroCat: "",
};

/* ---------- recadinhos ---------- */
let sumir = null;
function avisar(texto, ok = true) {
  const el = $("#avisoOk");
  el.textContent = texto;
  el.classList.toggle("recado--ok", ok);
  el.hidden = false;
  clearTimeout(sumir);
  sumir = setTimeout(() => { el.hidden = true; }, 3500);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function erroDe(e) {
  const m = e?.message || String(e);
  if (/row-level security|violates row-level|entre no painel/i.test(m)) {
    return "Sua sessão expirou ou você não está logado como administrador. " +
           "Entre de novo para salvar.";
  }
  if (/duplicate key/i.test(m)) return "Já existe um registro com esse nome.";
  return m;
}

/* ============================================================
   LOGIN
   ============================================================ */
async function decidirTela() {
  if (!configurado) {
    $("#telaLogin").hidden = false;
    $("#erroLogin").hidden = false;
    $("#erroLogin").textContent = "O site não conseguiu falar com o próprio servidor. Recarregue a página em instantes.";
    $("#formLogin").hidden = true;
    return;
  }
  const usuario = await usuarioAtual();
  if (usuario) await abrirPainel(usuario);
  else $("#telaLogin").hidden = false;
}

$("#formLogin").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const bt = $("#btEntrar");
  bt.disabled = true;
  bt.textContent = "Entrando…";
  $("#erroLogin").hidden = true;
  try {
    const usuario = await entrar($("#loginEmail").value.trim(), $("#loginSenha").value);
    $("#telaLogin").hidden = true;
    await abrirPainel(usuario);
  } catch (e) {
    $("#erroLogin").hidden = false;
    $("#erroLogin").textContent = /invalid login/i.test(e.message || "")
      ? "E-mail ou senha incorretos."
      : erroDe(e);
  } finally {
    bt.disabled = false;
    bt.textContent = "Entrar";
  }
});

$("#btSair").addEventListener("click", async () => {
  await sair();
  location.reload();
});

async function abrirPainel(usuario) {
  $("#telaPainel").hidden = false;
  $("#quemSou").textContent = usuario.email || "";

  estado.dono = await ehDono();
  if (!estado.dono) {
    const a = $("#avisoDono");
    a.hidden = false;
    a.textContent =
      "Você está logado como " + (usuario.email || "?") + ", que não é uma conta de administrador. " +
      "Dá pra ver tudo, mas o servidor vai recusar qualquer alteração.";
  }

  await recarregarTudo();
}

async function recarregarTudo() {
  const [loja, cat, prod, serv] = await Promise.all([
    carregarLoja(),
    carregarCategorias(),
    carregarProdutos({ incluirInativos: true }),
    carregarServicos({ incluirInativos: true }),
  ]);
  estado.loja = loja;
  estado.categorias = cat.categorias;
  estado.produtos = prod.produtos;
  estado.servicos = serv.servicos;

  preencherLoja();
  montarSelectCategorias();
  desenharProdutos();
  desenharCategorias();
  desenharServicos();
}

/* ============================================================
   ABAS
   ============================================================ */
$$(".aba").forEach((b) => {
  b.addEventListener("click", () => {
    $$(".aba").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    $$("[data-painel]").forEach((p) => { p.hidden = p.dataset.painel !== b.dataset.aba; });
  });
});

/* ============================================================
   PRODUTOS
   ============================================================ */
function montarSelectCategorias() {
  const nomes = estado.categorias.map((c) => c.nome);

  $("#filtroCatAdm").innerHTML =
    '<option value="">Todas as categorias</option>' +
    nomes.map((n) => '<option value="' + escapar(n) + '">' + escapar(n) + "</option>").join("");
  $("#filtroCatAdm").value = estado.filtroCat;

  $('#formProduto [name="categoria"]').innerHTML =
    nomes.map((n) => '<option value="' + escapar(n) + '">' + escapar(n) + "</option>").join("");
}

function figuraAdm(p) {
  if (p.foto) return '<img src="' + escapar(p.foto) + '" alt="">';
  return ARTES[p.arte] || ARTES.caixa;
}

function desenharProdutos() {
  const t = semAcento(estado.busca).trim();
  const achados = estado.produtos.filter((p) => {
    if (estado.filtroCat && p.categoria !== estado.filtroCat) return false;
    if (!t) return true;
    return semAcento(p.nome + " " + (p.spec || "") + " " + p.categoria).includes(t);
  });

  const alvo = $("#listaProdutos");
  if (!achados.length) {
    alvo.innerHTML = '<div class="painel"><p class="vazio-adm">Nenhum produto por aqui. ' +
      'Use <b>+ Novo produto</b> para começar.</p></div>';
    return;
  }

  alvo.innerHTML = achados.map((p) => {
    const preco = p.selo === "receita"
      ? "Com receita — fora do site"
      : (p.preco === null || p.preco === undefined || p.preco === ""
          ? "Consultar valor" : moeda.format(Number(p.preco)));
    const selos = { top: "Mais pedido", promo: "Oferta" };
    const meta = [p.categoria, preco, "pos. " + p.ordem]
      .concat(p.medicamento && p.selo !== "receita" ? ["medicamento sem receita"] : [])
      .concat(selos[p.selo] ? [selos[p.selo]] : [])
      .concat(p.ativo ? [] : ["escondido"]);

    return '' +
      '<div class="fila" data-inativo="' + String(!p.ativo) + '">' +
        '<span class="fila__fig">' + figuraAdm(p) + "</span>" +
        "<div>" +
          '<p class="fila__nome">' + escapar(p.nome) + "</p>" +
          '<p class="fila__spec">' + escapar(p.spec) + "</p>" +
          '<p class="fila__meta">' + meta.map(escapar).join(" · ") + "</p>" +
        "</div>" +
        '<div class="fila__acoes">' +
          '<button class="bt bt--mini" data-editar="' + escapar(p.id) + '">Editar</button>' +
          '<button class="bt bt--mini" data-ativar="' + escapar(p.id) + '">' +
            (p.ativo ? "Esconder" : "Mostrar") + "</button>" +
          '<button class="bt bt--mini bt--perigo" data-apagar="' + escapar(p.id) + '">Apagar</button>' +
        "</div>" +
      "</div>";
  }).join("");
}

$("#buscaAdm").addEventListener("input", (ev) => { estado.busca = ev.target.value; desenharProdutos(); });
$("#filtroCatAdm").addEventListener("change", (ev) => { estado.filtroCat = ev.target.value; desenharProdutos(); });

$("#listaProdutos").addEventListener("click", async (ev) => {
  const editar = ev.target.closest("[data-editar]");
  const ativar = ev.target.closest("[data-ativar]");
  const remover = ev.target.closest("[data-apagar]");

  if (editar) return abrirModalProduto(acharProduto(editar.dataset.editar));

  if (ativar) {
    const p = acharProduto(ativar.dataset.ativar);
    try {
      await atualizarProduto(p.id, { ativo: !p.ativo });
      p.ativo = !p.ativo;
      desenharProdutos();
      avisar(p.ativo ? "Produto de volta ao catálogo." : "Produto escondido do catálogo.");
    } catch (e) { avisar(erroDe(e), false); }
  }

  if (remover) {
    const p = acharProduto(remover.dataset.apagar);
    if (!confirm('Apagar "' + p.nome + '" de vez? Não dá pra desfazer.')) return;
    try {
      await apagarProduto(p.id);
      apagarFoto(p.foto);
      estado.produtos = estado.produtos.filter((x) => x.id !== p.id);
      desenharProdutos();
      avisar("Produto apagado.");
    } catch (e) { avisar(erroDe(e), false); }
  }
});

const acharProduto = (id) => estado.produtos.find((p) => String(p.id) === String(id));

/* ---------- modal do produto ---------- */
function abrirModal(qual) {
  $("#fundoAdm").hidden = false;
  $(qual).hidden = false;
  document.body.style.overflow = "hidden";
}
function fecharModais() {
  $("#fundoAdm").hidden = true;
  $("#modalProduto").hidden = true;
  $("#modalServico").hidden = true;
  document.body.style.overflow = "";
}
$("#fundoAdm").addEventListener("click", fecharModais);
$$("[data-fechar]").forEach((b) => b.addEventListener("click", fecharModais));
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && !$("#fundoAdm").hidden) fecharModais();
});

function abrirModalProduto(p) {
  const f = $("#formProduto");
  estado.editando = p || null;
  estado.fotoAtual = p?.foto || "";
  estado.fotoAnterior = p?.foto || "";

  $("#tituloProduto").textContent = p ? "Editar produto" : "Novo produto";
  $("#erroProduto").hidden = true;
  f.reset();
  montarSelectCategorias();

  f.nome.value = p?.nome || "";
  f.spec.value = p?.spec || "";
  f.preco.value = (p?.preco ?? "") === null ? "" : (p?.preco ?? "");
  f.categoria.value = p?.categoria || estado.categorias[0]?.nome || "";
  f.arte.value = p?.arte || "caixa";
  f.tipo.value = tipoDo(p);
  f.selo.value = p?.selo === "receita" ? "" : (p?.selo || "");
  f.ordem.value = p?.ordem ?? proximaPosicao(estado.produtos);
  f.ativo.checked = p ? !!p.ativo : true;

  $("#fotoAtual").hidden = !estado.fotoAtual;
  if (estado.fotoAtual) $("#fotoPrevia").src = estado.fotoAtual;
  ajustarPorTipo();

  abrirModal("#modalProduto");
  f.nome.focus();
}

const proximaPosicao = (lista) =>
  lista.reduce((m, x) => Math.max(m, Number(x.ordem) || 0), 0) + 1;

/* Sem categoria cadastrada o select do formulario fica vazio e o produto
   entraria no banco sem categoria nenhuma - some das abas do catalogo.
   Melhor mandar o dono criar a categoria primeiro. */
$("#btNovoProduto").addEventListener("click", () => {
  if (!estado.categorias.length) {
    avisar("Crie uma categoria antes: aba Categorias.", false);
    document.querySelector('.aba[data-aba="categorias"]')?.click();
    return;
  }
  abrirModalProduto(null);
});

/* O tipo decide o que a lei deixa mostrar:
   - produto: aparece normal;
   - medicamento sem receita: aparece, com a advertência da RDC 96/2008;
   - com receita: fica só no painel. O servidor não entrega nome, preço nem
     foto ao público (propaganda de medicamento sob prescrição é vedada ao
     público leigo -- Lei 9.294/96, art. 7º);
   - controlado: não entra. Portaria 344/98 e RDC 44/2009 vedam oferecer
     controlado pela internet, e não há motivo para ele morar no catálogo.
   No banco, "com receita" continua sendo selo = 'receita'. */
const tipoDo = (p) => (p?.selo === "receita" ? "receita" : p?.medicamento ? "mip" : "produto");

const DICAS_TIPO = {
  receita: "Fica só aqui no painel: o site não mostra nome, preço nem foto. O cliente pede pelo WhatsApp.",
  controlado: "Controlado não pode ser oferecido pela internet. Não cadastre: atenda pelo balcão ou WhatsApp.",
  mip: "Aparece no site com a advertência obrigatória: “é um medicamento, seu uso pode trazer riscos…”.",
};

function ajustarPorTipo() {
  const f = $("#formProduto");
  const tipo = f.tipo.value;
  const semPreco = tipo === "receita" || tipo === "controlado";
  f.preco.disabled = semPreco;
  if (semPreco) f.preco.value = "";
  f.preco.placeholder = semPreco ? "Sem preço público" : "8.90";
  f.selo.disabled = semPreco;
  if (semPreco) f.selo.value = "";
  const dica = $("#dicaTipo");
  dica.textContent = DICAS_TIPO[tipo] || "";
  dica.hidden = !DICAS_TIPO[tipo];
  $("#btSalvarProduto").disabled = tipo === "controlado";
}
$('#formProduto [name="tipo"]').addEventListener("change", ajustarPorTipo);

$("#btTirarFoto").addEventListener("click", () => {
  estado.fotoAtual = "";
  $("#fotoAtual").hidden = true;
});

$("#formProduto").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  const bt = $("#btSalvarProduto");
  bt.disabled = true;
  bt.textContent = "Salvando…";
  $("#erroProduto").hidden = true;

  try {
    // antes do upload: controlado não entra, nem a foto dele
    const tipo = f.tipo.value;
    if (tipo === "controlado") throw new Error(DICAS_TIPO.controlado);
    let foto = estado.fotoAtual;
    const arquivo = f.arquivo.files[0];
    if (arquivo) {
      bt.textContent = "Enviando foto…";
      foto = await enviarFoto(arquivo);
    }

    const receita = tipo === "receita";
    const dados = {
      nome: f.nome.value.trim(),
      spec: f.spec.value.trim(),
      preco: (receita || f.preco.value === "") ? null : Number(f.preco.value),
      categoria: f.categoria.value,
      arte: f.arte.value,
      selo: receita ? "receita" : (f.selo.value || null),
      medicamento: tipo !== "produto",
      foto: foto || "",
      ordem: Number(f.ordem.value) || 0,
      ativo: f.ativo.checked,
    };

    if (estado.editando) {
      await atualizarProduto(estado.editando.id, dados);
      Object.assign(estado.editando, dados);
      avisar("Produto atualizado.");
    } else {
      const novo = await criarProduto(dados);
      estado.produtos.push(novo);
      avisar("Produto cadastrado.");
    }

    estado.produtos.sort((a, b) => (a.ordem - b.ordem) || a.nome.localeCompare(b.nome, "pt-BR"));
    desenharProdutos();
    fecharModais();

    // so agora que o produto esta salvo: some com o arquivo que ficou pra tras
    if (estado.fotoAnterior && estado.fotoAnterior !== dados.foto) {
      apagarFoto(estado.fotoAnterior);
    }
  } catch (e) {
    $("#erroProduto").hidden = false;
    $("#erroProduto").textContent = erroDe(e);
  } finally {
    bt.disabled = false;
    bt.textContent = "Salvar";
  }
});

/* ============================================================
   CATEGORIAS
   ============================================================ */
function desenharCategorias() {
  const alvo = $("#listaCategorias");
  if (!estado.categorias.length) {
    alvo.innerHTML = '<p class="vazio-adm">Nenhuma categoria cadastrada.</p>';
    return;
  }
  alvo.innerHTML = estado.categorias.map((c, i) => {
    const quantos = estado.produtos.filter((p) => p.categoria === c.nome).length;
    return '' +
      '<div class="fila" style="grid-template-columns:1fr auto">' +
        "<div>" +
          '<p class="fila__nome">' + escapar(c.nome) + "</p>" +
          '<p class="fila__meta">' + quantos + (quantos === 1 ? " produto" : " produtos") + "</p>" +
        "</div>" +
        '<div class="fila__acoes">' +
          '<button class="bt bt--mini" data-subir="' + escapar(c.id) + '"' + (i === 0 ? " disabled" : "") + ' aria-label="Subir">↑</button>' +
          '<button class="bt bt--mini" data-descer="' + escapar(c.id) + '"' + (i === estado.categorias.length - 1 ? " disabled" : "") + ' aria-label="Descer">↓</button>' +
          '<button class="bt bt--mini" data-renomear="' + escapar(c.id) + '">Renomear</button>' +
          '<button class="bt bt--mini bt--perigo" data-apagarcat="' + escapar(c.id) + '">Apagar</button>' +
        "</div>" +
      "</div>";
  }).join("");
}

$("#formCategoria").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const nome = $("#novaCategoria").value.trim();
  if (!nome) return;
  try {
    const nova = await criarCategoria(nome, proximaPosicao(estado.categorias));
    estado.categorias.push(nova);
    $("#novaCategoria").value = "";
    montarSelectCategorias();
    desenharCategorias();
    avisar("Categoria criada.");
  } catch (e) { avisar(erroDe(e), false); }
});

$("#listaCategorias").addEventListener("click", async (ev) => {
  const acharCat = (id) => estado.categorias.find((c) => String(c.id) === String(id));

  const subir = ev.target.closest("[data-subir]");
  const descer = ev.target.closest("[data-descer]");
  const renomear = ev.target.closest("[data-renomear]");
  const remover = ev.target.closest("[data-apagarcat]");

  if (subir || descer) {
    const id = (subir || descer).dataset.subir || (subir || descer).dataset.descer;
    const i = estado.categorias.findIndex((c) => String(c.id) === String(id));
    const j = subir ? i - 1 : i + 1;
    if (j < 0 || j >= estado.categorias.length) return;
    const copia = estado.categorias.slice();
    [copia[i], copia[j]] = [copia[j], copia[i]];
    try {
      await salvarOrdemCategorias(copia);
      estado.categorias = copia;
      desenharCategorias();
      montarSelectCategorias();
    } catch (e) { avisar(erroDe(e), false); }
  }

  if (renomear) {
    const c = acharCat(renomear.dataset.renomear);
    const novo = prompt("Novo nome para a categoria:", c.nome);
    if (!novo || novo.trim() === c.nome) return;
    try {
      await renomearCategoria(c.id, c.nome, novo.trim());
      estado.produtos.forEach((p) => { if (p.categoria === c.nome) p.categoria = novo.trim(); });
      c.nome = novo.trim();
      montarSelectCategorias();
      desenharCategorias();
      desenharProdutos();
      avisar("Categoria renomeada (os produtos dela também).");
    } catch (e) { avisar(erroDe(e), false); }
  }

  if (remover) {
    const c = acharCat(remover.dataset.apagarcat);
    const quantos = estado.produtos.filter((p) => p.categoria === c.nome).length;
    if (quantos) {
      alert('A categoria "' + c.nome + '" ainda tem ' + quantos +
            " produto(s). Mova ou apague esses produtos antes.");
      return;
    }
    if (!confirm('Apagar a categoria "' + c.nome + '"?')) return;
    try {
      await apagarCategoria(c.id);
      estado.categorias = estado.categorias.filter((x) => x.id !== c.id);
      montarSelectCategorias();
      desenharCategorias();
      avisar("Categoria apagada.");
    } catch (e) { avisar(erroDe(e), false); }
  }
});

/* ============================================================
   SERVIÇOS
   ============================================================ */
function desenharServicos() {
  const alvo = $("#listaServicos");
  if (!estado.servicos.length) {
    alvo.innerHTML = '<p class="vazio-adm">Nenhum serviço cadastrado.</p>';
    return;
  }
  alvo.innerHTML = estado.servicos.map((s) => '' +
    '<div class="fila" data-inativo="' + String(!s.ativo) + '">' +
      '<span class="fila__fig">' + (ICONES[s.ico] || ICONES.coracao) + "</span>" +
      "<div>" +
        '<p class="fila__nome">' + escapar(s.nome) + "</p>" +
        '<p class="fila__spec">' + escapar(s.texto) + "</p>" +
        '<p class="fila__meta">' + escapar(s.nota) + " · pos. " + s.ordem +
          (s.ativo ? "" : " · escondido") + "</p>" +
      "</div>" +
      '<div class="fila__acoes">' +
        '<button class="bt bt--mini" data-editarserv="' + escapar(s.id) + '">Editar</button>' +
        '<button class="bt bt--mini bt--perigo" data-apagarserv="' + escapar(s.id) + '">Apagar</button>' +
      "</div>" +
    "</div>").join("");
}

function abrirModalServico(s) {
  const f = $("#formServico");
  estado.editandoServico = s || null;
  $("#tituloServico").textContent = s ? "Editar serviço" : "Novo serviço";
  $("#erroServico").hidden = true;
  f.reset();
  f.nome.value = s?.nome || "";
  f.texto.value = s?.texto || "";
  f.nota.value = s?.nota || "";
  f.ico.value = s?.ico || "coracao";
  f.ordem.value = s?.ordem ?? proximaPosicao(estado.servicos);
  f.ativo.checked = s ? !!s.ativo : true;
  abrirModal("#modalServico");
  f.nome.focus();
}

$("#btNovoServico").addEventListener("click", () => abrirModalServico(null));

$("#listaServicos").addEventListener("click", async (ev) => {
  const editar = ev.target.closest("[data-editarserv]");
  const remover = ev.target.closest("[data-apagarserv]");
  const achar = (id) => estado.servicos.find((s) => String(s.id) === String(id));

  if (editar) return abrirModalServico(achar(editar.dataset.editarserv));

  if (remover) {
    const s = achar(remover.dataset.apagarserv);
    if (!confirm('Apagar o serviço "' + s.nome + '"?')) return;
    try {
      await apagarServico(s.id);
      estado.servicos = estado.servicos.filter((x) => x.id !== s.id);
      desenharServicos();
      avisar("Serviço apagado.");
    } catch (e) { avisar(erroDe(e), false); }
  }
});

$("#formServico").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  const dados = {
    nome: f.nome.value.trim(),
    texto: f.texto.value.trim(),
    nota: f.nota.value.trim(),
    ico: f.ico.value,
    ordem: Number(f.ordem.value) || 0,
    ativo: f.ativo.checked,
  };
  try {
    if (estado.editandoServico) {
      await atualizarServico(estado.editandoServico.id, dados);
      Object.assign(estado.editandoServico, dados);
      avisar("Serviço atualizado.");
    } else {
      estado.servicos.push(await criarServico(dados));
      avisar("Serviço cadastrado.");
    }
    estado.servicos.sort((a, b) => a.ordem - b.ordem);
    desenharServicos();
    fecharModais();
  } catch (e) {
    $("#erroServico").hidden = false;
    $("#erroServico").textContent = erroDe(e);
  }
});

/* ============================================================
   DADOS DA LOJA
   ============================================================ */
const CAMPOS_LOJA = ["nome", "nome_curto", "sobre", "whatsapp", "telefone",
                     "endereco", "cidade", "mapa", "abre", "fecha",
                     "instagram", "horario", "aviso",
                     // conformidade de farmacia + LGPD
                     "razao_social", "cnpj", "farmaceutico", "crf", "afe",
                     "licenca", "email_dados",
                     // medicao de anuncio
                     "meta_pixel", "google_tag"];

/* O que precisa estar preenchido pro site poder rodar anuncio pago e
   ficar dentro das normas de farmacia. Nenhum destes pode ser chutado:
   todos vem do cliente. */
const OBRIGATORIOS = [
  ["razao_social", "Razao social"],
  ["cnpj",         "CNPJ"],
  ["farmaceutico", "Farmaceutico(a) responsavel tecnico"],
  ["crf",          "CRF do farmaceutico"],
  ["afe",          "Autorizacao de Funcionamento (ANVISA)"],
  ["licenca",      "Licenca sanitaria municipal"],
  ["email_dados",  "E-mail para assuntos de dados (LGPD)"],
];

function preencherLoja() {
  const f = $("#formLoja");
  CAMPOS_LOJA.forEach((c) => { if (f[c]) f[c].value = estado.loja[c] ?? ""; });
  desenharChecklist();
}

function desenharChecklist() {
  const faltando = OBRIGATORIOS.filter(([campo]) => !estado.loja[campo]);
  const titulo = faltando.length === 0
    ? "Pronto para anunciar"
    : "Falta " + faltando.length + (faltando.length === 1 ? " dado" : " dados") + " para poder anunciar";
  const texto = faltando.length === 0
    ? "Todos os dados obrigatorios estao preenchidos e aparecem no rodape do site, na Politica de Privacidade e nos Termos."
    : "Enquanto faltar qualquer um destes, o site nao deve ir para anuncio no Meta ou no Google, e fica fora das normas da ANVISA e do CRF. Peca ao cliente e preencha acima — o site esconde a linha em vez de mostrar dado errado.";

  $("#checklist").innerHTML =
    "<h2>" + escapar(titulo) + "</h2>" +
    '<p class="olho-adm">' + escapar(texto) + "</p>" +
    '<ul class="checa">' +
    OBRIGATORIOS.map(([campo, rotulo]) => {
      const ok = !!estado.loja[campo];
      return '<li data-ok="' + ok + '"><span class="checa__marca">' +
        (ok ? "✓" : "!") + "</span>" + escapar(rotulo) + "</li>";
    }).join("") +
    "</ul>";
}

$("#formLoja").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  const dados = {};
  CAMPOS_LOJA.forEach((c) => { dados[c] = f[c] ? f[c].value.trim() : ""; });
  dados.whatsapp = dados.whatsapp.replace(/\D/g, "");
  dados.instagram = dados.instagram.replace(/^@/, "");
  dados.abre = Number(dados.abre) || 0;
  dados.fecha = Number(dados.fecha) || 0;
  dados.atualizado_em = new Date().toISOString();

  try {
    await salvarLoja(dados);
    Object.assign(estado.loja, dados);
    avisar("Dados da loja salvos.");
  } catch (e) { avisar(erroDe(e), false); }
});

/* ---------- início ---------- */
decidirTela();
