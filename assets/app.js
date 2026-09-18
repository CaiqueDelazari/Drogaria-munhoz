/* ============================================================
   DROGARIA MUNHOZ — comportamento do catálogo

   Os produtos, categorias, serviços e dados de contato vêm do
   API deste próprio site (ver banco.js). Se ela não responder, o site
   cai nas listas de reserva do config.js e continua funcionando.
   ============================================================ */
import { ARTES, ICONES } from "./artes.js";
import {
  carregarLoja,
  carregarProdutos,
  carregarCategorias,
  carregarServicos,
} from "./banco.js";
import { iniciarRastreio } from "./rastreio.js";
import { aplicarDadosLoja } from "./dados-loja.js";

var $ = function (s) { return document.querySelector(s); };
var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

var estado = {
  loja: null,
  categorias: [],
  itens: [],
  categoria: "todos",
  termo: "",
  lista: carregarLista()
};

var moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
/* tira acento pra busca: "vitamina c" acha "Vitamína C" e vice-versa */
var semAcento = function (t) {
  return (t || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
};
var escapar = function (t) {
  return String(t == null ? "" : t)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
};
/* Medicamento de tarja (sujeito a receita) não pode ter preço exposto ao
   público — norma de publicidade de medicamento. O banco também barra isso
   (constraint farmacia_produtos_tarja_sem_preco), mas a tela não confia:
   se um preço aparecer por qualquer caminho, ele não é mostrado. */
var tarja = function (p) { return p.selo === "receita"; };
var temPreco = function (p) {
  if (tarja(p)) return false;
  return p.preco !== null && p.preco !== undefined && p.preco !== "";
};
var precoNum = function (p) { return temPreco(p) ? Number(p.preco) : 0; };

/* ---------- persistência da lista de compras ---------- */
function carregarLista() {
  try {
    var bruto = localStorage.getItem("munhoz:lista");
    return bruto ? JSON.parse(bruto) : {};
  } catch (e) { return {}; }
}
function salvarLista() {
  try { localStorage.setItem("munhoz:lista", JSON.stringify(estado.lista)); } catch (e) {}
}
/* produto apagado no admin não pode ficar preso na lista do visitante */
function limparOrfaos() {
  var vivos = {};
  estado.itens.forEach(function (p) { vivos[p.id] = true; });
  Object.keys(estado.lista).forEach(function (id) {
    if (!vivos[id]) delete estado.lista[id];
  });
  salvarLista();
}

/* ============================================================
   DADOS DA LOJA NA PÁGINA
   ============================================================ */
function aplicarLoja() {
  var loja = estado.loja;
  aplicarDadosLoja(loja);
  document.title = loja.nome + " — Catálogo | " + loja.cidade;
}

/* ============================================================
   CATÁLOGO
   ============================================================ */
function montarFiltros() {
  var lista = [{ id: "todos", nome: "Tudo" }].concat(estado.categorias);

  $("#filtros").innerHTML = lista.map(function (c) {
    var valor = c.id === "todos" ? "todos" : c.nome;
    return '<button class="filtro" type="button" data-cat="' + escapar(valor) + '" aria-pressed="' +
      (valor === estado.categoria) + '">' + escapar(c.nome) + "</button>";
  }).join("");

  // atalhos do hero: as 5 primeiras categorias
  $("#atalhos").innerHTML = estado.categorias.slice(0, 5).map(function (c) {
    return '<button class="atalho" type="button" data-cat="' + escapar(c.nome) + '">' +
      escapar(c.nome) + "</button>";
  }).join("");
}

function pintarFiltros() {
  $$(".filtro").forEach(function (b) {
    b.setAttribute("aria-pressed", String(b.dataset.cat === estado.categoria));
  });
}

function filtrar() {
  var t = semAcento(estado.termo).trim();
  return estado.itens.filter(function (p) {
    var okCat = estado.categoria === "todos" || p.categoria === estado.categoria;
    if (!okCat) return false;
    if (!t) return true;
    return semAcento(p.nome + " " + (p.spec || "") + " " + p.categoria).indexOf(t) > -1;
  });
}

function figura(p) {
  if (p.foto) {
    return '<img src="' + escapar(p.foto) + '" alt="' + escapar(p.nome) + '" loading="lazy">';
  }
  return ARTES[p.arte] || ARTES.caixa;
}

function cartao(p) {
  var selos = {
    promo: '<span class="selo selo--promo">Oferta</span>',
    top: '<span class="selo selo--top">Mais pedido</span>',
    receita: '<span class="selo selo--receita">Só com receita</span>'
  };
  var preco = tarja(p)
    ? 'Sob receita<small>consulte no balcão</small>'
    : temPreco(p)
      ? moeda.format(precoNum(p)) + "<small>à vista</small>"
      : 'Consultar<small>valor no WhatsApp</small>';

  return '' +
    '<article class="produto">' +
      '<div class="produto__fig">' + figura(p) + (selos[p.selo] || "") + "</div>" +
      '<div class="produto__corpo">' +
        '<p class="produto__cat">' + escapar(p.categoria) + "</p>" +
        '<h3 class="produto__nome">' + escapar(p.nome) + "</h3>" +
        '<p class="produto__spec">' + escapar(p.spec) + "</p>" +
        '<div class="produto__base">' +
          '<span class="preco">' + preco + "</span>" +
          '<button class="add" type="button" data-add="' + escapar(p.id) +
            '" aria-label="Adicionar ' + escapar(p.nome) + ' à minha lista">+ Lista</button>' +
        "</div>" +
      "</div>" +
    "</article>";
}

function desenharGrade() {
  var achados = filtrar();
  var grade = $("#grade");

  grade.innerHTML = achados.map(cartao).join("");
  $("#vazio").hidden = achados.length > 0;
  grade.hidden = achados.length === 0;

  var onde = estado.categoria === "todos" ? "no catálogo" : "em " + estado.categoria.toLowerCase();
  $("#resultado").textContent = achados.length === 0
    ? "Nenhum item encontrado"
    : achados.length + (achados.length === 1 ? " item " : " itens ") + onde;
}

/* ============================================================
   SERVIÇOS
   ============================================================ */
function montarServicos(servicos) {
  $("#servicos-lista").innerHTML = servicos.map(function (s) {
    return '' +
      '<article class="servico">' +
        '<span class="servico__ico">' + (ICONES[s.ico] || ICONES.coracao) + "</span>" +
        "<h3>" + escapar(s.nome) + "</h3>" +
        "<p>" + escapar(s.texto) + "</p>" +
        '<p class="servico__nota">' + escapar(s.nota) + "</p>" +
      "</article>";
  }).join("");
}

/* ============================================================
   LISTA / GAVETA
   ============================================================ */
function acharItem(id) {
  return estado.itens.filter(function (x) { return String(x.id) === String(id); })[0];
}
function totalItens() {
  return Object.keys(estado.lista).reduce(function (soma, id) { return soma + estado.lista[id]; }, 0);
}
function totalValor() {
  return Object.keys(estado.lista).reduce(function (soma, id) {
    var p = acharItem(id);
    return p ? soma + precoNum(p) * estado.lista[id] : soma;
  }, 0);
}
/* true quando tem algum item sem preço no banco — o total vira "a partir de" */
function temItemSemPreco() {
  return Object.keys(estado.lista).some(function (id) {
    var p = acharItem(id);
    return p && !temPreco(p);
  });
}

function adicionar(id) {
  estado.lista[id] = (estado.lista[id] || 0) + 1;
  salvarLista();
  atualizarLista();
}
function mudarQtd(id, delta) {
  estado.lista[id] = (estado.lista[id] || 0) + delta;
  if (estado.lista[id] <= 0) delete estado.lista[id];
  salvarLista();
  atualizarLista();
}

function atualizarLista() {
  var n = totalItens();

  $("#contador").textContent = n;
  $("#contador").dataset.vazio = String(n === 0);
  $("#flutuanteNum").textContent = n;
  $("#total").textContent = (temItemSemPreco() ? "a partir de " : "") + moeda.format(totalValor());

  var corpo = $("#gavetaCorpo");
  var ids = Object.keys(estado.lista);

  if (ids.length === 0) {
    corpo.innerHTML = '' +
      '<div class="lista-vazia">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4h10l1 3h3v2h-1.2l-1.3 11.1a2 2 0 0 1-2 1.9H7.5a2 2 0 0 1-2-1.9L4.2 9H3V7h3zm2 3h6l-.5-1h-5zM6.2 9l1.3 10.9h9l1.3-11z"/></svg>' +
        "<strong>Sua lista está vazia</strong>" +
        "<p>Toque em <b>+ Lista</b> nos produtos do catálogo para montar seu pedido.</p>" +
      "</div>";
  } else {
    corpo.innerHTML = ids.map(function (id) {
      var p = acharItem(id);
      if (!p) return "";
      var q = estado.lista[id];
      var valor = tarja(p) ? "Sob receita"
        : temPreco(p) ? moeda.format(precoNum(p)) : "Consultar valor";
      return '' +
        '<div class="item">' +
          '<span class="item__fig">' + figura(p) + "</span>" +
          '<div class="item__txt">' +
            '<p class="item__nome">' + escapar(p.nome) + "</p>" +
            '<p class="item__preco">' + valor + " · " + escapar(p.spec) + "</p>" +
          "</div>" +
          '<div class="qtd">' +
            '<button type="button" data-menos="' + escapar(id) + '" aria-label="Tirar uma unidade de ' + escapar(p.nome) + '">−</button>' +
            "<b>" + q + "</b>" +
            '<button type="button" data-mais="' + escapar(id) + '" aria-label="Somar uma unidade de ' + escapar(p.nome) + '">+</button>' +
          "</div>" +
        "</div>";
    }).join("");
  }

  $("#flutuante").hidden = false;
  $("#enviarZap").href = montarLinkZap();
}

function montarLinkZap() {
  var loja = estado.loja;
  var ids = Object.keys(estado.lista);
  var texto;

  if (ids.length === 0) {
    texto = "Olá! Vim pelo site da " + loja.nome + " e gostaria de tirar uma dúvida.";
  } else {
    var linhas = ids.map(function (id) {
      var p = acharItem(id);
      if (!p) return "";
      var q = estado.lista[id];
      var valor = tarja(p) ? "sob receita"
        : temPreco(p) ? moeda.format(precoNum(p) * q) : "consultar valor";
      return "• " + q + "x " + p.nome + " (" + p.spec + ") — " + valor;
    }).filter(Boolean);

    texto =
      "Olá! Fiz uma lista pelo site da " + loja.nome + ":\n\n" +
      linhas.join("\n") +
      "\n\nTotal estimado: " + (temItemSemPreco() ? "a partir de " : "") + moeda.format(totalValor()) +
      "\n\nMeu nome: \nEndereço para entrega: \nForma de pagamento: ";
  }

  return "https://wa.me/" + loja.whatsapp + "?text=" + encodeURIComponent(texto);
}

var ultimoFoco = null;

function abrirGaveta() {
  ultimoFoco = document.activeElement;
  $("#gaveta").hidden = false;
  $("#fundo").hidden = false;
  document.body.style.overflow = "hidden";
  $("#fecharLista").focus();
}
function fecharGaveta() {
  $("#gaveta").hidden = true;
  $("#fundo").hidden = true;
  document.body.style.overflow = "";
  if (ultimoFoco) ultimoFoco.focus();
}

/* ============================================================
   HORÁRIO DE FUNCIONAMENTO
   ============================================================ */
function atualizarStatus() {
  var abre = Number(estado.loja.abre);
  var fecha = Number(estado.loja.fecha);
  var h = new Date().getHours();
  var aberto = h >= abre && h < fecha;

  $("#statusLoja").textContent = aberto ? "Aberto agora" : "Fechado agora";
  $("#statusHora").textContent = aberto
    ? "Fecha às " + fecha + "h"
    : "Abre às " + String(abre).padStart(2, "0") + "h";
  $(".fixa--a").classList.toggle("fixa--fechada", !aberto);
}

/* ============================================================
   LIGAÇÕES
   ============================================================ */
function ligarEventos() {
  // busca (hero e catálogo espelham o mesmo estado)
  ["#buscaHero", "#buscaCatalogo"].forEach(function (sel) {
    $(sel).addEventListener("input", function (ev) {
      estado.termo = ev.target.value;
      var outro = sel === "#buscaHero" ? $("#buscaCatalogo") : $("#buscaHero");
      if (outro.value !== estado.termo) outro.value = estado.termo;
      if (estado.termo) estado.categoria = "todos";
      pintarFiltros();
      desenharGrade();
    });
  });

  $("#filtros").addEventListener("click", function (ev) {
    var b = ev.target.closest(".filtro");
    if (!b) return;
    estado.categoria = b.dataset.cat;
    pintarFiltros();
    desenharGrade();
  });

  $("#atalhos").addEventListener("click", function (ev) {
    var b = ev.target.closest(".atalho");
    if (!b) return;
    estado.categoria = b.dataset.cat;
    pintarFiltros();
    desenharGrade();
    $("#catalogo").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // adicionar à lista
  $("#grade").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-add]");
    if (!b) return;
    adicionar(b.dataset.add);
    b.dataset.ok = "true";
    b.textContent = "Na lista";
    setTimeout(function () {
      delete b.dataset.ok;
      b.textContent = "+ Lista";
    }, 1100);
  });

  // quantidade dentro da gaveta
  $("#gavetaCorpo").addEventListener("click", function (ev) {
    var mais = ev.target.closest("[data-mais]");
    var menos = ev.target.closest("[data-menos]");
    if (mais) mudarQtd(mais.dataset.mais, 1);
    if (menos) mudarQtd(menos.dataset.menos, -1);
  });

  $("#abrirLista").addEventListener("click", abrirGaveta);
  $("#flutuante").addEventListener("click", abrirGaveta);
  $("#fecharLista").addEventListener("click", fecharGaveta);
  $("#fundo").addEventListener("click", fecharGaveta);

  $("#limparLista").addEventListener("click", function () {
    estado.lista = {};
    salvarLista();
    atualizarLista();
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && !$("#gaveta").hidden) fecharGaveta();
  });

  // menu no celular
  var burguer = $("#hamburguer");
  burguer.addEventListener("click", function () {
    var aberto = burguer.getAttribute("aria-expanded") === "true";
    burguer.setAttribute("aria-expanded", String(!aberto));
    $("#nav").dataset.aberto = String(!aberto);
  });
  $("#nav").addEventListener("click", function (ev) {
    if (ev.target.tagName === "A") {
      burguer.setAttribute("aria-expanded", "false");
      $("#nav").dataset.aberto = "false";
    }
  });
}

/* ============================================================
   LOGO COM VOLUME — ela inclina acompanhando o mouse

   O JS só escreve as variáveis (--rx, --ry, --mx, --my…); quem
   desenha o giro, o brilho e a sombra é o styles.css.
   ============================================================ */
function inclinar(el, opcoes) {
  if (!el) return;
  var zona = opcoes.zona || el;     // onde o mouse precisa passar
  var giro = opcoes.giro || 14;
  var quadro = null;

  function mover(ev) {
    if (quadro) return;             // no máximo um ajuste por quadro de vídeo
    quadro = requestAnimationFrame(function () {
      quadro = null;
      var r = el.getBoundingClientRect();
      if (!r.width) return;
      // -1 (esquerda/topo) a 1 (direita/base), medido do centro da logo
      var x = Math.max(-1, Math.min(1, (ev.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      var y = Math.max(-1, Math.min(1, (ev.clientY - (r.top + r.height / 2)) / (r.height / 2)));

      el.dataset.mexe = "true";
      el.style.setProperty("--ry", (x * giro).toFixed(2) + "deg");
      el.style.setProperty("--rx", (-y * giro).toFixed(2) + "deg");
      el.style.setProperty("--mx", (50 + x * 40).toFixed(1) + "%");
      el.style.setProperty("--my", (50 + y * 40).toFixed(1) + "%");

      if (opcoes.sombra) {
        el.style.setProperty("--sx", (-x * opcoes.sombra).toFixed(1) + "px");
        el.style.setProperty("--sy", (-y * opcoes.sombra).toFixed(1) + "px");
      }
      // as caixinhas flutuantes andam ao contrário, o que dá a sensação de profundidade
      if (opcoes.flutuantes) {
        opcoes.flutuantes.dataset.mexe = "true";
        opcoes.flutuantes.style.setProperty("--fx", (-x * 12).toFixed(1) + "px");
        opcoes.flutuantes.style.setProperty("--fy", (-y * 12).toFixed(1) + "px");
      }
    });
  }

  function soltar() {
    if (quadro) { cancelAnimationFrame(quadro); quadro = null; }
    delete el.dataset.mexe;
    ["--rx", "--ry", "--mx", "--my", "--sx", "--sy"].forEach(function (v) {
      el.style.removeProperty(v);
    });
    if (opcoes.flutuantes) {
      delete opcoes.flutuantes.dataset.mexe;
      opcoes.flutuantes.style.removeProperty("--fx");
      opcoes.flutuantes.style.removeProperty("--fy");
    }
  }

  zona.addEventListener("pointermove", mover);
  zona.addEventListener("pointerleave", soltar);
  zona.addEventListener("blur", soltar, true);
}

function ligarLogo3d() {
  // quem pediu menos movimento não ganha giro; no celular também não,
  // porque lá não existe "passar o mouse por cima"
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  var selo = $(".hero__selo");
  inclinar($(".anel"), { zona: selo, giro: 16, sombra: 16, flutuantes: selo });
  inclinar($(".topo .marca__selo"), { zona: $(".topo .marca"), giro: 22 });
}

/* entrada suave das seções */
function ligarRevelacao() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) return;

  var alvos = $$(".secao > .wrap, .hero__texto, .hero__selo");
  alvos.forEach(function (el) { el.classList.add("revela"); });

  var obs = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add("visivel");
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });

  alvos.forEach(function (el) { obs.observe(el); });
}

/* ---------- início ---------- */
async function iniciar() {
  var [loja, cat, prod, serv] = await Promise.all([
    carregarLoja(),
    carregarCategorias(),
    carregarProdutos(),
    carregarServicos()
  ]);

  estado.loja = loja;
  estado.categorias = cat.categorias;
  estado.itens = prod.produtos;

  limparOrfaos();
  aplicarLoja();
  montarFiltros();
  montarServicos(serv.servicos);
  desenharGrade();
  atualizarLista();
  atualizarStatus();
  ligarEventos();
  ligarRevelacao();
  ligarLogo3d();
  iniciarRastreio(loja);   // banner de cookies + pixel, nessa ordem

  if (prod.offline) {
    console.warn("Catálogo em modo reserva (sem banco):", prod.erro || "a API do site não respondeu");
  }
}

iniciar();
