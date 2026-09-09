# NeuroGame Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development for bounded independent tasks; root integrates and reviews evidence.

**Goal:** Entregar laboratório funcional com ativos anatômicos reais, cobertura rastreável e GitHub Pages.

**Architecture:** Catálogo, pipeline, visualizadores e domínio separados. Malha e fatia compartilham o mesmo atlas/affine. Persistência local, sem backend.

**Tech Stack:** React 19.2, TypeScript, Vite 6 (compatível com Node 22.16), R3F 9, Drei 10, Three, Motion, Vitest e Playwright.

**Spec:** ../../arquitetura.md e briefing integral disponibilizado pelo usuário.

## Global Constraints

- Não publicar PDFs, extrações, imagens legadas com licença não comprovada ou volumes de origem desnecessários.
- Não inventar anatomia, aliases, lateralidade, registro espacial, revisão humana ou testes.
- Destino autorizado: ViniciusExtremXD/neurogame; preservar repositório original.
- Base /neurogame/; preferir hash para navegação estática.
- Cobertura documental, visual e avaliativa separadas; conteúdo beta com revisão humana pendente.

## Task 1: Inventário e ativos

- [x] Ler roteiro completo, registrar ocorrência/página/contexto em `src/content/curriculum.json`.
- [x] Fixar SPL/NAC por commit e hashes; registrar licença efetiva e transformações em `public/anatomy/manifest.json`.
- [x] Converter todos os modelos pertinentes em GLB sob demanda; gerar RM/labels PNG sem perda nos três planos.
- [x] Validar hashes, integridade, bounds, lateralidade e pontos de referência independentes. Documentar lacunas em `docs/cobertura-roteiro.md` e revisão em `docs/revisao-anatomica.md`.

## Task 2: Domínio e persistência

Files: `src/domain/{types,engine,storage}.ts` e testes adjacentes.

- [x] Testes primeiro: normalização preserva lado; aliases exatos; seed estável; alternativas únicas; limite real; duplicatas de evento e pergunta anterior ignoradas; ajuda/repetição não viram acerto independente; omissão e anulação com denominadores corretos.
- [x] Implementar funções puras com tipos e resultado discriminado. Avaliação sem fonte/alvo é inelegível.
- [x] Testar serialização/validação versão 1, importação malformada, storage indisponível e restauração de perguntas/seed/ordem.

## Task 3: Atlas e interface

Files: `src/atlas/{BrainScene,SliceViewer,spatial}.tsx`, `src/components`, `src/App.tsx`, `src/styles.css`.

- [x] Teste espacial com coordenadas conhecidas e ida/volta. Construir cena por grupos reais, seleção por raycast e cortes com pixel label sem interpolação.
- [x] Integrar árvore, busca/aliases, fichas/referências, seis presets, zoom, pan, isolamento, ocultação, labels e plano sincronizado.
- [x] Integrar treino e simulado sem nome/tooltip/estatística vazando resposta. Estados de carregamento/erro pausam ou anulam avaliação.
- [x] Integrar progresso real, revisão dos erros, exportar/importar/apagar, movimento reduzido e tutorial dispensável.

## Task 4: Verificação e release

- [x] Executar `npm run check`, `npm test`, `npm run build`, `npm run test:e2e`; investigar falhas antes de declarar sucesso.
- [x] Revisar screenshots desktop/mobile, WebGL real, clique 3D/corte, rede/console, fallback, teclado, importação e restore.
- [x] Validar público sem PDFs e todas as URLs sob /neurogame/; medir tamanho do shell/primeiro módulo e registrar limites não medidos.
- [ ] Criar repo autorizado, commits e PR; configurar Actions/Pages com permissões mínimas e refs verificadas. Verificar workflow e recursos na URL final.
- [ ] Atualizar `docs/execucao.md` com implementado, validado, publicado, bloqueado, commit, PR e evidências reais.
