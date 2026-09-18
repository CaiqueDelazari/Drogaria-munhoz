/**
 * Servidor da Drogaria Munhoz: entrega o site e responde a API que o
 * `assets/banco.js` consome.
 *
 * Existe porque o site saiu do Supabase. Antes o navegador falava direto com o
 * banco, com a chave pública à vista, e quem barrava escrita indevida eram 8
 * políticas de RLS. Aqui o navegador não alcança o Postgres: quem alcança é
 * este processo, e a regra virou uma só -- leitura é pública, escrita exige
 * sessão de administrador (`exigirAdmin`).
 *
 * Variáveis: DATABASE_URL (obrigatória), PORT, SITE_DIR, UPLOAD_DIR,
 * COOKIE_SEGURO.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import bcrypt from 'bcryptjs';
import express from 'express';
import pg from 'pg';

const PORTA = Number(process.env.PORT || 3000);
const RAIZ_SITE = process.env.SITE_DIR || path.resolve(import.meta.dirname, '..');
const PASTA_FOTOS = process.env.UPLOAD_DIR || '/app/uploads';
const COOKIE_SEGURO = process.env.COOKIE_SEGURO !== 'false';
const DIAS_DE_SESSAO = 30;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------- utilidades
const naoAchou = (res, o = 'Registro') => res.status(404).json({ erro: `${o} não encontrado` });
const erro = (res, e) => {
  console.error('[api]', e);
  // 23514 = check constraint. A mais importante aqui é a da tarja sem preço:
  // devolver 400 com a mensagem certa evita que o painel mostre "erro interno"
  // para uma regra que a farmácia precisa entender.
  if (e?.code === '23514' && String(e.constraint).includes('tarja_sem_preco')) {
    return res.status(400).json({ erro: 'Medicamento com selo de receita não pode ter preço público.' });
  }
  if (e?.code === '23514') return res.status(400).json({ erro: 'Valor fora do permitido para este campo.' });
  if (e?.code === '23505') return res.status(409).json({ erro: 'Já existe um registro com esse nome.' });
  return res.status(500).json({ erro: 'Erro interno' });
};

/** Lê um cookie do cabeçalho sem depender de biblioteca. */
function cookie(req, nome) {
  const bruto = req.headers.cookie;
  if (!bruto) return null;
  for (const parte of bruto.split(';')) {
    const [k, ...resto] = parte.trim().split('=');
    if (k === nome) return decodeURIComponent(resto.join('='));
  }
  return null;
}

const hashDoToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

async function adminDaSessao(req) {
  const token = cookie(req, 'sessao');
  if (!token) return null;
  const { rows } = await pool.query(
    `select a.id, a.email, a.nome
       from sessoes s
       join admins a on a.id = s.admin_id
      where s.token_hash = $1 and s.expira_em > now() and a.ativo`,
    [hashDoToken(token)]
  );
  return rows[0] ?? null;
}

/**
 * Leitura é pública, escrita exige administrador.
 *
 * É esta função que substitui as 8 políticas de RLS do Supabase. Vale para
 * TODA rota de escrita -- inclusive upload de foto, que lá era protegido por
 * política separada no bucket.
 */
function exigirAdmin(handler) {
  return async (req, res) => {
    try {
      const admin = await adminDaSessao(req);
      if (!admin) return res.status(401).json({ erro: 'Entre no painel para fazer isso' });
      req.admin = admin;
      await handler(req, res);
    } catch (e) {
      erro(res, e);
    }
  };
}

function publico(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      erro(res, e);
    }
  };
}

// -------------------------------------------------------------------- login
const HASH_DESCARTAVEL = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

app.post('/api/login', publico(async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const senha = String(req.body?.senha ?? '');
  const { rows } = await pool.query(
    'select id, email, nome, senha_hash from admins where lower(email) = $1 and ativo',
    [email]
  );
  const admin = rows[0];
  // Compara mesmo sem usuário: sem isso, o tempo de resposta diria quais
  // e-mails existem.
  const confere = await bcrypt.compare(senha, admin?.senha_hash ?? HASH_DESCARTAVEL);
  if (!admin || !confere) return res.status(401).json({ erro: 'E-mail ou senha incorretos' });

  const token = crypto.randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + DIAS_DE_SESSAO * 86_400_000);
  await pool.query(
    'insert into sessoes (token_hash, admin_id, expira_em) values ($1, $2, $3)',
    [hashDoToken(token), admin.id, expira]
  );
  res.setHeader('Set-Cookie', [
    `sessao=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${DIAS_DE_SESSAO * 86400}` +
      (COOKIE_SEGURO ? '; Secure' : ''),
  ]);
  res.json({ id: admin.id, email: admin.email, nome: admin.nome });
}));

app.post('/api/logout', publico(async (req, res) => {
  const token = cookie(req, 'sessao');
  if (token) await pool.query('delete from sessoes where token_hash = $1', [hashDoToken(token)]);
  res.setHeader('Set-Cookie', `sessao=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${COOKIE_SEGURO ? '; Secure' : ''}`);
  res.json({ ok: true });
}));

app.get('/api/eu', publico(async (req, res) => {
  res.json(await adminDaSessao(req));
}));

// --------------------------------------------------------------------- loja
const CAMPOS_LOJA = [
  'nome', 'nome_curto', 'tagline', 'sobre', 'whatsapp', 'telefone', 'email',
  'endereco', 'cidade', 'mapa', 'abre', 'fecha', 'horario', 'instagram', 'aviso',
  'razao_social', 'cnpj', 'farmaceutico', 'crf', 'afe', 'licenca', 'email_dados',
  'meta_pixel', 'google_tag',
];

app.get('/api/loja', publico(async (_req, res) => {
  const { rows } = await pool.query('select * from loja where id = 1');
  res.json(rows[0] ?? null);
}));

app.put('/api/loja', exigirAdmin(async (req, res) => {
  // Lista branca: campo que não está aqui não entra, venha o que vier no corpo.
  const campos = CAMPOS_LOJA.filter((c) => c in (req.body ?? {}));
  if (!campos.length) return res.json({ ok: true });
  const sets = campos.map((c, i) => `${c} = $${i + 1}`).join(', ');
  const valores = campos.map((c) => req.body[c]);
  await pool.query(
    `insert into loja (id) values (1) on conflict (id) do nothing`
  );
  await pool.query(
    `update loja set ${sets}, atualizado_em = now() where id = 1`,
    valores
  );
  res.json({ ok: true });
}));

// ----------------------------------------------------------------- produtos
const CAMPOS_PRODUTO = ['nome', 'spec', 'preco', 'categoria', 'arte', 'selo', 'foto', 'ativo', 'ordem'];

app.get('/api/produtos', publico(async (req, res) => {
  const todos = req.query.incluirInativos === '1';
  const { rows } = await pool.query(
    `select * from produtos ${todos ? '' : 'where ativo'} order by ordem asc, nome asc`
  );
  res.json(rows);
}));

app.post('/api/produtos', exigirAdmin(async (req, res) => {
  const campos = CAMPOS_PRODUTO.filter((c) => c in (req.body ?? {}));
  const marcas = campos.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await pool.query(
    `insert into produtos (${campos.join(', ')}) values (${marcas}) returning *`,
    campos.map((c) => req.body[c])
  );
  res.status(201).json(rows[0]);
}));

app.put('/api/produtos/:id', exigirAdmin(async (req, res) => {
  const campos = CAMPOS_PRODUTO.filter((c) => c in (req.body ?? {}));
  if (!campos.length) return res.json({ ok: true });
  const sets = campos.map((c, i) => `${c} = $${i + 1}`).join(', ');
  const { rowCount } = await pool.query(
    `update produtos set ${sets} where id = $${campos.length + 1}`,
    [...campos.map((c) => req.body[c]), req.params.id]
  );
  if (!rowCount) return naoAchou(res, 'Produto');
  res.json({ ok: true });
}));

app.delete('/api/produtos/:id', exigirAdmin(async (req, res) => {
  const { rowCount } = await pool.query('delete from produtos where id = $1', [req.params.id]);
  if (!rowCount) return naoAchou(res, 'Produto');
  res.json({ ok: true });
}));

// --------------------------------------------------------------- categorias
app.get('/api/categorias', publico(async (_req, res) => {
  const { rows } = await pool.query('select * from categorias order by ordem asc, nome asc');
  res.json(rows);
}));

app.post('/api/categorias', exigirAdmin(async (req, res) => {
  const { rows } = await pool.query(
    'insert into categorias (nome, ordem) values ($1, $2) returning *',
    [String(req.body?.nome ?? '').trim(), Number(req.body?.ordem) || 0]
  );
  res.status(201).json(rows[0]);
}));

/**
 * Renomear arrasta os produtos junto.
 *
 * `produtos.categoria` é TEXTO (era assim no Supabase): sem atualizar os
 * produtos na mesma transação, eles apontariam para um nome que não existe
 * mais e sumiriam do filtro do catálogo.
 */
app.put('/api/categorias/:id', exigirAdmin(async (req, res) => {
  const nomeNovo = String(req.body?.nome ?? '').trim();
  if (!nomeNovo) return res.status(400).json({ erro: 'Informe o nome' });
  const cliente = await pool.connect();
  let conflito = false;
  try {
    await cliente.query('begin');
    const atual = await cliente.query('select nome from categorias where id = $1', [req.params.id]);
    if (!atual.rowCount) {
      await cliente.query('rollback');
      return naoAchou(res, 'Categoria');
    }
    await cliente.query('update categorias set nome = $1 where id = $2', [nomeNovo, req.params.id]);
    await cliente.query('update produtos set categoria = $1 where categoria = $2', [nomeNovo, atual.rows[0].nome]);
    await cliente.query('commit');
  } catch (e) {
    await cliente.query('rollback');
    if (e?.code === '23505') conflito = true;
    else throw e;
  } finally {
    cliente.release();
  }
  if (conflito) return res.status(409).json({ erro: 'Já existe uma categoria com esse nome' });
  res.json({ ok: true });
}));

app.delete('/api/categorias/:id', exigirAdmin(async (req, res) => {
  const { rowCount } = await pool.query('delete from categorias where id = $1', [req.params.id]);
  if (!rowCount) return naoAchou(res, 'Categoria');
  res.json({ ok: true });
}));

app.put('/api/categorias/ordem', exigirAdmin(async (req, res) => {
  const lista = Array.isArray(req.body?.categorias) ? req.body.categorias : [];
  const cliente = await pool.connect();
  try {
    await cliente.query('begin');
    for (const [i, c] of lista.entries()) {
      await cliente.query('update categorias set ordem = $1 where id = $2', [i + 1, c.id]);
    }
    await cliente.query('commit');
  } catch (e) {
    await cliente.query('rollback');
    throw e;
  } finally {
    cliente.release();
  }
  res.json({ ok: true });
}));

// ----------------------------------------------------------------- serviços
const CAMPOS_SERVICO = ['nome', 'texto', 'nota', 'ico', 'ordem', 'ativo'];

app.get('/api/servicos', publico(async (req, res) => {
  const todos = req.query.incluirInativos === '1';
  const { rows } = await pool.query(
    `select * from servicos ${todos ? '' : 'where ativo'} order by ordem asc`
  );
  res.json(rows);
}));

app.post('/api/servicos', exigirAdmin(async (req, res) => {
  const campos = CAMPOS_SERVICO.filter((c) => c in (req.body ?? {}));
  const marcas = campos.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await pool.query(
    `insert into servicos (${campos.join(', ')}) values (${marcas}) returning *`,
    campos.map((c) => req.body[c])
  );
  res.status(201).json(rows[0]);
}));

app.put('/api/servicos/:id', exigirAdmin(async (req, res) => {
  const campos = CAMPOS_SERVICO.filter((c) => c in (req.body ?? {}));
  if (!campos.length) return res.json({ ok: true });
  const sets = campos.map((c, i) => `${c} = $${i + 1}`).join(', ');
  const { rowCount } = await pool.query(
    `update servicos set ${sets} where id = $${campos.length + 1}`,
    [...campos.map((c) => req.body[c]), req.params.id]
  );
  if (!rowCount) return naoAchou(res, 'Serviço');
  res.json({ ok: true });
}));

app.delete('/api/servicos/:id', exigirAdmin(async (req, res) => {
  const { rowCount } = await pool.query('delete from servicos where id = $1', [req.params.id]);
  if (!rowCount) return naoAchou(res, 'Serviço');
  res.json({ ok: true });
}));

// -------------------------------------------------------------------- fotos
/**
 * Assinatura dos bytes, não a extensão do nome.
 *
 * Nome de arquivo é escolhido por quem envia: `foto.png` pode ser qualquer
 * coisa. O tipo sai daqui, e é o servidor quem batiza o arquivo.
 */
function tipoDaImagem(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  if (buf.length > 6 && buf.subarray(0, 6).toString() === 'GIF89a') return 'gif';
  if (buf.length > 12 && buf.subarray(4, 12).toString() === 'ftypavif') return 'avif';
  return null;
}

const TIPOS = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };

app.post(
  '/api/upload',
  express.raw({ type: '*/*', limit: '8mb' }),
  exigirAdmin(async (req, res) => {
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) return res.status(400).json({ erro: 'Envie o arquivo' });
    const ext = tipoDaImagem(buf);
    if (!ext) return res.status(400).json({ erro: 'Arquivo não é uma imagem' });

    const nome = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}.${ext}`;
    await fs.mkdir(path.join(PASTA_FOTOS, 'produtos'), { recursive: true });
    await fs.writeFile(path.join(PASTA_FOTOS, 'produtos', nome), buf);
    res.status(201).json({ url: `/uploads/produtos/${nome}` });
  })
);

app.delete('/api/foto', exigirAdmin(async (req, res) => {
  const url = String(req.query.url ?? '');
  const marca = '/uploads/produtos/';
  const i = url.indexOf(marca);
  // Foto que não é nossa (URL antiga do Supabase, por exemplo) é ignorada:
  // foto órfã é chateação, produto que não salva é prejuízo.
  if (i === -1) return res.json({ ok: true });
  const nome = path.basename(decodeURIComponent(url.slice(i + marca.length).split('?')[0]));
  if (!nome || nome.includes('..')) return res.json({ ok: true });
  await fs.rm(path.join(PASTA_FOTOS, 'produtos', nome), { force: true });
  res.json({ ok: true });
}));

app.use('/uploads', express.static(PASTA_FOTOS, {
  maxAge: '30d',
  immutable: true,
  setHeaders: (res, arquivo) => {
    const ext = path.extname(arquivo).slice(1).toLowerCase();
    if (TIPOS[ext]) res.setHeader('Content-Type', TIPOS[ext]);
  },
}));

// --------------------------------------------------------------------- site
app.get('/saude', (_req, res) => res.json({ ok: true }));
app.use(express.static(RAIZ_SITE, { extensions: ['html'] }));

app.listen(PORTA, () => {
  console.log(`Drogaria Munhoz no ar na porta ${PORTA} (site em ${RAIZ_SITE}, fotos em ${PASTA_FOTOS})`);
});
