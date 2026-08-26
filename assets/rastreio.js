/* ============================================================
   DROGARIA MUNHOZ — consentimento de cookies e rastreio

   Regra da LGPD que este arquivo cumpre: nenhum pixel dispara
   antes do visitante aceitar. Enquanto ele não decide, nada é
   carregado — e se ele recusar, nada é carregado nunca.

   Se a loja ainda não tem Pixel nem Google Tag cadastrados, o
   banner nem aparece: não há o que consentir. Assim o site não
   incomoda o visitante à toa antes da campanha existir.

   Os IDs ficam nos dados da loja (aba "Dados da loja" do painel),
   não no código.
   ============================================================ */

const CHAVE = "munhoz:cookies";   // "aceito" | "recusado"

function decisao() {
  try { return localStorage.getItem(CHAVE); } catch (e) { return null; }
}
function guardarDecisao(valor) {
  try { localStorage.setItem(CHAVE, valor); } catch (e) {}
}

/* ---------- pixels ---------- */
function carregarMetaPixel(id) {
  if (!id || window.fbq) return;
  const n = window.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  };
  window._fbq = n;
  n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];

  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);

  window.fbq("init", id);
  window.fbq("track", "PageView");
}

function carregarGoogleTag(id) {
  if (!id || window.gtag) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", id);
}

let ligado = false;
function ligarPixels(loja) {
  if (ligado) return;
  ligado = true;
  carregarMetaPixel(loja.meta_pixel);
  carregarGoogleTag(loja.google_tag);
}

/* ---------- conversão ----------
   O objetivo do site é o pedido no WhatsApp, então é o clique no
   WhatsApp que conta como conversão na campanha. Só dispara se o
   visitante tiver aceitado — senão fbq/gtag nem existem. */
function ligarConversao() {
  document.addEventListener("click", (ev) => {
    if (!ev.target.closest("[data-zap]")) return;
    if (window.fbq) window.fbq("track", "Contact");
    if (window.gtag) window.gtag("event", "contato_whatsapp", { metodo: "whatsapp" });
  });
}

/* ---------- banner ---------- */
function mostrarBanner(loja) {
  const caixa = document.createElement("div");
  caixa.className = "cookies";
  caixa.setAttribute("role", "dialog");
  caixa.setAttribute("aria-label", "Aviso de cookies");

  const texto = document.createElement("p");
  texto.className = "cookies__txt";
  texto.append(
    "Usamos cookies para medir o desempenho dos nossos anúncios e entender " +
    "como o site é usado. Você escolhe. "
  );
  const link = document.createElement("a");
  link.href = "privacidade.html";
  link.textContent = "Ver a Política de Privacidade";
  texto.append(link);
  texto.append(".");

  const acoes = document.createElement("div");
  acoes.className = "cookies__acoes";

  const recusar = document.createElement("button");
  recusar.type = "button";
  recusar.className = "btn btn--linha";
  recusar.textContent = "Recusar";

  const aceitar = document.createElement("button");
  aceitar.type = "button";
  aceitar.className = "btn btn--solido";
  aceitar.textContent = "Aceitar";

  const fechar = (valor) => {
    guardarDecisao(valor);
    caixa.remove();
    if (valor === "aceito") ligarPixels(loja);
  };
  recusar.addEventListener("click", () => fechar("recusado"));
  aceitar.addEventListener("click", () => fechar("aceito"));

  acoes.append(recusar, aceitar);
  caixa.append(texto, acoes);
  document.body.appendChild(caixa);
}

/* ---------- entrada ---------- */
export function iniciarRastreio(loja) {
  ligarConversao();

  const temFerramenta = !!(loja.meta_pixel || loja.google_tag);
  if (!temFerramenta) return;        // nada a rastrear, nada a consentir

  const escolha = decisao();
  if (escolha === "aceito") ligarPixels(loja);
  else if (escolha !== "recusado") mostrarBanner(loja);
}
