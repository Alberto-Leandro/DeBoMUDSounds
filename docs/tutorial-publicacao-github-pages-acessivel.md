# Tutorial acessivel: publicar no GitHub com GitHub Pages

Este guia foi pensado para navegacao por teclado e leitor de tela.
Objetivo: criar o repositorio no GitHub, enviar o projeto local e publicar o site pela pasta docs.

## Antes de comecar

Voce precisa ter:

- Conta no GitHub com login funcionando.
- Git instalado no computador.
- Node.js e npm instalados.
- Projeto aberto localmente nesta pasta.

## Etapa 1: validar o projeto local

1. Abra o terminal na raiz do projeto (onde fica o package.json).
2. Execute:

```bash
npm install
npm run build
npm test
```

3. Se algum comando falhar, resolva antes de publicar.

## Etapa 2: criar repositorio no GitHub (site)

1. Acesse https://github.com e faca login.
2. No topo da pagina, encontre o botao de criar novo item (menu com simbolo de mais) e escolha New repository.
3. Na tela Create a new repository, preencha:
   - Repository name: DeBoMUDSounds (ou outro nome que preferir).
   - Description: opcional.
   - Visibility: Public (recomendado para Pages).
4. Nao marque as opcoes de criar README, gitignore ou license (este projeto ja existe localmente).
5. Ative Create repository.

### Dicas de acessibilidade

- Use tecla H para navegar por titulos no leitor de tela.
- Use Tab para percorrer campos e botoes.
- Em seletores, use Enter para abrir e setas para escolher.

## Etapa 3: conectar o projeto local ao repositorio remoto

No terminal local, rode os comandos abaixo.
Troque SEU_OWNER e NOME_REPO pelos valores reais.

```bash
git init
git add .
git commit -m "chore: initial project setup"
git branch -M main
git remote add origin https://github.com/SEU_OWNER/NOME_REPO.git
git push -u origin main
```

Se o projeto ja estiver com git iniciado, pule o comando git init.

## Etapa 4: ativar GitHub Pages por GitHub Actions

1. Abra seu repositorio no GitHub.
2. Entre na aba Settings.
3. No menu lateral esquerdo, abra Pages.
4. Em Build and deployment:
   - Source: GitHub Actions
5. Ative Save.
6. Na aba Actions, acompanhe o workflow Build and Deploy Pages ate concluir com sucesso.
7. A URL publicada aparecera na mesma tela de Pages.

URL esperada:

- https://SEU_OWNER.github.io/NOME_REPO/

## Etapa 5: ajustar o link do loader no projeto (se necessario)

Este projeto ja esta configurado para o repositorio oficial abaixo:

- owner: Alberto-Leandro
- repo: DeBoMUDSounds

Se voce publicar em outro owner/repo, ajuste a URL do loader.

Arquivos para ajustar:

- scripts/build-runtime.mjs
- docs/bookmarklet.txt

Padrao correto:

- https://SEU_OWNER.github.io/NOME_REPO/assets/loader.js

Depois de ajustar, rode:

```bash
npm run build
git add .
git commit -m "chore: configure github pages owner"
git push
```

## Etapa 6: verificacao final

1. Abra a URL do Pages e confirme que a pagina abre.
2. Confira se o bookmarklet aponta para o owner e repo corretos.
3. Teste o carregamento no navegador alvo.

## Solucao de problemas comuns

1. Erro 404 no Pages:
   - Verifique Settings > Pages com Source em GitHub Actions.
   - Verifique se o workflow Build and Deploy Pages executou sem erro.
2. Loader nao carrega:
   - Confirme o owner/repo no link do loader.
3. Opcao Pages nao aparece:
   - Pode haver restricao da organizacao (admin precisa liberar).
4. Conteudo antigo no site:
   - Rode npm run build e faca novo push.

## Checklist rapido

- Repositorio criado no GitHub.
- Codigo enviado para branch main.
- Pages configurado com Source em GitHub Actions.
- URL do loader aponta para owner/repo corretos.
- Workflow Build and Deploy Pages concluido.
- URL publica funcionando.
