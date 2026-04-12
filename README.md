# DeBoMUDSounds

Projeto para reproduzir no navegador os sons baseados nos triggers do VIPMUD, sem editar os arquivos .set de origem.

## Escopo

- Leitura somente dos arquivos em VipMUDTriggers.
- Conversao automatica para JSON consumido no browser.
- BGM com loop continuo, sem reiniciar faixa identica.
- Sons de vida separados em categoria dedicada (barraDeVida).
- Matching de trigger com wildcard e tolerancia para texto com/sem acentos.
- Loader remoto via GitHub Pages + bookmarklet minimo.

## Comandos

```bash
npm install
npm run build
npm test
npm run verify:sounds
```

## Saidas

- docs/data/\*.json: dados de trigger gerados automaticamente.
- docs/assets/loader.js: runtime browser bundle.
- docs/bookmarklet.txt: bookmarklet para injetar o loader remoto.

## Publicacao automatizada

- Workflow de GitHub Pages em [.github/workflows/pages.yml](.github/workflows/pages.yml).
- O pipeline roda build, testes e validacao de sons/artefatos antes do deploy.

## Observacao de seguranca

Os arquivos .set nao devem ser alterados por este projeto. O build valida essa regra durante a geracao dos dados.
