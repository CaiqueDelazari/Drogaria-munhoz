/* ============================================================
   DROGARIA MUNHOZ — desenhos (SVG inline, sem imagem externa)

   ARTES  → usados no card do produto quando ele não tem foto.
            O nome da chave é o valor do campo "arte" no banco.
   ICONES → usados nos cards de serviço do balcão.
   ============================================================ */

/* --- desenhos dos produtos (SVG inline, sem imagem externa) --- */
export const ARTES = {
  caixa: `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="24" y="20" width="52" height="62" rx="5" fill="#fff" stroke="#D8121B" stroke-width="2.5"/><rect x="24" y="34" width="52" height="7" fill="#D8121B"/><rect x="33" y="52" width="34" height="3.2" rx="1.6" fill="#E3E5E9"/><rect x="33" y="61" width="24" height="3.2" rx="1.6" fill="#E3E5E9"/><path d="M46 22h8v5h5v8h-5v5h-8v-5h-5v-8h5z" fill="#D8121B" opacity=".2"/></svg>`,
  frasco: `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="40" y="15" width="20" height="10" rx="2.5" fill="#D8121B"/><rect x="30" y="25" width="40" height="60" rx="7" fill="#fff" stroke="#D8121B" stroke-width="2.5"/><rect x="30" y="44" width="40" height="20" fill="#D8121B" opacity=".12"/><rect x="38" y="51" width="24" height="3.2" rx="1.6" fill="#D8121B" opacity=".55"/><circle cx="50" cy="35" r="4" fill="#D8121B" opacity=".25"/></svg>`,
  bisnaga: `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="43" y="12" width="14" height="9" rx="2" fill="#D8121B"/><path d="M36 21h28v58a5 5 0 0 1-5 5H41a5 5 0 0 1-5-5z" fill="#fff" stroke="#D8121B" stroke-width="2.5"/><rect x="36" y="40" width="28" height="14" fill="#D8121B" opacity=".14"/><rect x="43" y="61" width="14" height="3" rx="1.5" fill="#E3E5E9"/><rect x="43" y="69" width="10" height="3" rx="1.5" fill="#E3E5E9"/></svg>`,
  garrafa: `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="42" y="11" width="16" height="12" rx="3" fill="#D8121B"/><path d="M38 23h24c3 0 5 3 5 6v50a6 6 0 0 1-6 6H39a6 6 0 0 1-6-6V29c0-3 2-6 5-6z" fill="#fff" stroke="#D8121B" stroke-width="2.5"/><rect x="33" y="45" width="34" height="22" fill="#D8121B" opacity=".12"/><rect x="41" y="53" width="18" height="3.2" rx="1.6" fill="#D8121B" opacity=".5"/></svg>`,
  bebe: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M22 38h56c0 22-11 34-28 34S22 60 22 38z" fill="#fff" stroke="#D8121B" stroke-width="2.5"/><path d="M22 38c9-6 18-9 28-9s19 3 28 9" fill="none" stroke="#D8121B" stroke-width="2.5"/><circle cx="38" cy="50" r="3.4" fill="#D8121B" opacity=".5"/><circle cx="62" cy="50" r="3.4" fill="#D8121B" opacity=".5"/><circle cx="50" cy="60" r="3.4" fill="#D8121B" opacity=".5"/><path d="M46 20h8v5h5v7h-5v5h-8v-5h-5v-7h5z" fill="#D8121B" opacity=".25"/></svg>`,
  aparelho: `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="22" y="28" width="56" height="44" rx="8" fill="#fff" stroke="#D8121B" stroke-width="2.5"/><rect x="30" y="37" width="40" height="20" rx="3" fill="#D8121B" opacity=".12"/><path d="M32 47h8l4-7 5 13 4-6h13" fill="none" stroke="#D8121B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="38" cy="65" r="3" fill="#D8121B" opacity=".45"/><circle cx="50" cy="65" r="3" fill="#D8121B" opacity=".45"/><circle cx="62" cy="65" r="3" fill="#D8121B" opacity=".45"/></svg>`,
  beleza: `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="38" y="48" width="24" height="36" rx="4" fill="#fff" stroke="#D8121B" stroke-width="2.5"/><rect x="38" y="48" width="24" height="8" fill="#D8121B" opacity=".16"/><path d="M42 48V26c0-5 4-9 8-9s8 4 8 9v22z" fill="#D8121B"/><path d="M42 30c5 3 11 3 16 0" fill="none" stroke="#fff" stroke-width="2" opacity=".5"/></svg>`
};

/* --- ícones dos serviços --- */
export const ICONES = {
  coracao: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-8-5-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 3.5C20 16 12 21 12 21"/></svg>`,
  seringa: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m18.7 2.3 3 3-1.4 1.4-.9-.9-2.1 2.1 1.4 1.4-1.4 1.4-1.4-1.4-6.4 6.4-.4 2.4-2.4.4L4 20.6l-1.4-1.4 1.1-2.8.4-2.4 2.4-.4 6.4-6.4-1.4-1.4L13 4.4l1.4 1.4 2.1-2.1-.9-.9z"/></svg>`,
  gota: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11"/></svg>`,
  moto: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 14a4 4 0 1 0 0 8 4 4 0 0 0 0-8m14 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8M14 5h4l1 3h-3l2 4h-2l-3-5H8V5z"/></svg>`
};
