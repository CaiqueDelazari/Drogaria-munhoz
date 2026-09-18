#!/usr/bin/env node
/**
 * Cria ou redefine o acesso ao painel da Drogaria Munhoz.
 *
 *   node scripts/criar-admin.mjs email@exemplo.com "Nome"
 *
 * A senha é lida da entrada padrão — no container, onde não há terminal:
 *
 *   printf '%s\n' 'a-senha' | docker exec -i <container> node servidor/scripts/criar-admin.mjs email "Nome"
 *
 * Se o e-mail já existir, a senha é trocada, a conta é reativada e todas as
 * sessões abertas dela caem — que é o comportamento certo para "esqueci a
 * senha": quem estava logado com a antiga perde o acesso.
 *
 * O hash é bcrypt, o MESMO formato que o Supabase Auth usava (`$2a$10$…`), o
 * que permitiu migrar sem obrigar a dona a trocar de senha.
 *
 * Precisa de DATABASE_URL.
 */
import process from 'node:process';

import bcrypt from 'bcryptjs';
import pg from 'pg';

const SENHA_MINIMA = 8;

function lerSenha() {
  return new Promise((resolve, reject) => {
    let dados = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (pedaco) => (dados += pedaco));
    process.stdin.on('end', () => resolve(dados.split('\n')[0].trim()));
    process.stdin.on('error', reject);
    if (process.stdin.isTTY) process.stdout.write('Senha: ');
  });
}

async function main() {
  const [email, nome = 'Administrador'] = process.argv.slice(2);
  if (!email) {
    console.error('uso: node scripts/criar-admin.mjs email@exemplo.com "Nome"');
    process.exit(2);
  }

  const senha = await lerSenha();
  if (senha.length < SENHA_MINIMA) {
    console.error(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(senha, 10);
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  const { rows } = await pool.query(
    `insert into admins (email, nome, senha_hash)
     values (lower($1), $2, $3)
     on conflict (email) do update
        set senha_hash = excluded.senha_hash, nome = excluded.nome, ativo = true
     returning id, (xmax = 0) as criado`,
    [email, nome, hash]
  );

  // Trocar a senha derruba o que estava aberto: sessão antiga com senha antiga
  // não deve continuar valendo.
  await pool.query('delete from sessoes where admin_id = $1', [rows[0].id]);
  await pool.end();

  console.log(
    rows[0].criado
      ? `Acesso criado para ${email}.`
      : `Senha redefinida para ${email}. Sessões antigas encerradas.`
  );
}

main().catch((erro) => {
  console.error('Falhou:', erro.message);
  process.exit(1);
});
