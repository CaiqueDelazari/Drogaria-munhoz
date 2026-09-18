# Site da Drogaria Munhoz: HTML estático + a API que substituiu o Supabase.
#
# O site não tem build: os HTML, o CSS e os scripts vão como estão. O que
# precisa de dependência é o servidor (`servidor/`), então só a pasta dele
# recebe npm.
FROM node:22-alpine

WORKDIR /app

# Dependências primeiro: muda pouco e aproveita cache entre builds.
COPY servidor/package.json servidor/package-lock.json ./servidor/
RUN cd servidor && npm ci --omit=dev

# O site e o servidor.
COPY servidor ./servidor
COPY assets ./assets
COPY index.html admin.html privacidade.html termos.html og-imagem.html robots.txt sitemap.xml ./

# banco/: scripts de manutenção e o schema. Vão DENTRO de servidor/ de
# propósito: são ESM, e módulo ESM resolve dependência pela pasta do próprio
# arquivo, não pelo diretório de trabalho -- em /app/banco eles não achariam o
# `pg`, que vive em /app/servidor/node_modules.
COPY banco ./servidor/banco

ENV NODE_ENV=production \
    SITE_DIR=/app \
    UPLOAD_DIR=/app/uploads \
    PORT=3000

# As fotos ficam num volume (declarado no compose). A pasta existe na imagem só
# para o primeiro start não falhar quando o volume ainda está vazio.
RUN mkdir -p /app/uploads/produtos

EXPOSE 3000
CMD ["node", "servidor/servidor.mjs"]
