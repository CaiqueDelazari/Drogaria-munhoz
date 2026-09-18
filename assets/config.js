/* =====================================================================
   CONFIGURAÇÃO — Drogaria Munhoz

   Não há nada para configurar aqui. O site saiu do Supabase: o navegador
   não fala mais com banco nenhum — fala com a API deste próprio site
   (ver assets/banco.js). Quem guarda a credencial do Postgres é o
   servidor, que nunca a envia para a página; por isso não existe mais URL
   nem chave neste arquivo.
   ===================================================================== */

/* Dados de reserva: aparecem se o site não conseguir falar com a própria
   API (servidor reiniciando, banco fora do ar). Assim a farmácia nunca
   aparece "quebrada" pra quem visita. */
export const LOJA_PADRAO = {
  nome: "Drogaria Munhoz",
  nome_curto: "Munhoz",
  tagline: "Agudos — SP",
  sobre: "Produtos farmacêuticos, saúde e beleza. Monte sua lista pelo site e receba em casa no mesmo dia.",
  whatsapp: "551434431470",              // com DDI + DDD, só números
  telefone: "(14) 3443-1470",
  email: "",
  endereco: "Rua 13 de Maio, 807 — Centro",
  cidade: "Agudos — SP",
  mapa: "https://www.google.com/maps/search/?api=1&query=Rua+13+de+Maio,+807,+Centro,+Agudos,+SP",
  abre: 8,                                // hora de abertura (24h)
  fecha: 21,                              // hora de fechamento (24h)
  horario: "Todos os dias, das 08h às 21h",
  instagram: "drogaria_munhoz",           // só o @, sem a URL
  aviso: "Medicamentos sujeitos a receita só são entregues com a apresentação da prescrição. Preços e disponibilidade são confirmados no atendimento.",

  /* --------------------------------------------------------------
     Dados obrigatórios de farmácia. Precisam vir do cliente — sem
     eles o site não pode rodar anúncio pago e fica fora das normas
     da ANVISA e do CRF. Preencha pelo /admin.html, aba "Dados da
     loja". Enquanto estiverem vazios, o site esconde a linha em vez
     de mostrar um dado errado, e o painel avisa o que falta.
     -------------------------------------------------------------- */
  razao_social: "",     // razão social completa, como no CNPJ
  cnpj: "",             // 00.000.000/0001-00
  farmaceutico: "",     // nome do responsável técnico
  crf: "",              // ex.: CRF-SP 000000
  afe: "",              // Autorização de Funcionamento da ANVISA
  licenca: "",          // licença sanitária municipal
  email_dados: "",      // canal do titular de dados (LGPD)

  /* Só carregam depois que o visitante aceitar os cookies. Vazio = não carrega. */
  meta_pixel: "",       // ID do Pixel do Meta
  google_tag: "",       // ID do Google Tag (G-XXXXXXX)
};

/* Categorias e produtos de reserva: propositalmente VAZIOS.

   Estas listas só entram no ar se a API não responder. Preço de
   medicamento não pode ser chutado por um arquivo de reserva — melhor o
   catálogo aparecer vazio por alguns minutos do que mostrar valor que
   não é o da loja. Quem manda é sempre a tabela do banco, alimentada
   pelo /admin.html.

   Se um dia quiser uma reserva de verdade, copie aqui os produtos REAIS
   já cadastrados (e nunca um item de tarja com preço — o banco proíbe
   pela constraint farmacia_produtos_tarja_sem_preco). */
export const CATEGORIAS_PADRAO = [];
export const PRODUTOS_PADRAO = [];

/* Serviços de balcão de reserva. Depois quem manda é "farmacia_servicos". */
export const SERVICOS_PADRAO = [
  { id:"s1", nome:"Aferição de pressão",     texto:"Medição gratuita no balcão, sem precisar agendar.",       nota:"Todos os dias",    ico:"coracao", ordem:1, ativo:true },
  { id:"s2", nome:"Aplicação de injetáveis", texto:"Feita por profissional habilitado, mediante receita.",    nota:"Com receita",      ico:"seringa", ordem:2, ativo:true },
  { id:"s3", nome:"Teste de glicemia",       texto:"Resultado na hora, com material descartável.",            nota:"Consulte o valor", ico:"gota",    ordem:3, ativo:true },
  { id:"s4", nome:"Entrega em domicílio",    texto:"Pedidos pelo WhatsApp entregues no mesmo dia em Agudos.", nota:"08h às 21h",       ico:"moto",    ordem:4, ativo:true },
];
