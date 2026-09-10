# NeuroGame

[Abrir a beta publicada](https://viniciusextremxd.github.io/neurogame/) · [Verificação da publicação](docs/evidence/deployment.json)

Laboratório educacional de neuroanatomia em português: atlas 3D real, cortes de RM registrados, treino, simulado e revisão local. Aplicação estática React/TypeScript/Vite; sem backend ou conta.

## Rodar

Node 22.16 ou superior e npm:

```sh
npm ci
npm run dev
```

Abrir o endereço mostrado pelo Vite, com o caminho `/neurogame/`. Para build: `npm run build`; para inspecioná-lo: `npm run preview`.

```sh
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npx playwright test --config=src/components/study-ui.config.ts
node scripts/measure-build.mjs
```

Windows com Edge instalado: defina `PLAYWRIGHT_CHANNEL=msedge` para testes locais. O CI instala o Chromium da versão fixada do Playwright. `E2E_BASE_URL` aponta os testes ao site publicado; sem essa variável, usam o build local em `/neurogame/`.

## Fontes e cobertura

O roteiro fornecido contém 404 itens contextuais, não 404 estruturas anatômicas independentes. A interface separa documentação, representação visual e elegibilidade avaliativa. Esta beta inclui 109 alvos avaliáveis, equivalentes a 61 conceitos. Dos 404 itens contextuais, 70 têm representação 3D verificada, 54 aparecem em cortes e 70 são contemplados pela avaliação. A revisão anatômica humana permanece pendente. Consulte [cobertura](docs/cobertura-roteiro.md), [matriz por item](docs/cobertura-itens.csv) e [fila de revisão](docs/revisao-anatomica.md).

Os 258 modelos são derivados de dados SPL/NAC por commit fixo; 236 têm segmentação volumétrica e 22 são curvas de sulcos. 768 imagens T1 e suas máscaras vêm do mesmo volume, com registro explícito por affine. Oito ativos com discrepâncias de origem estão fora da avaliação; veja [evidências](docs/source-discrepancies.md). Não há TC neste pacote; a RM não é rotulada como TC. A licença dos ativos é distinta do código: [avisos](THIRD_PARTY_NOTICES.md).

PDFs acadêmicos e suas extrações não fazem parte deste repositório nem do site. Os arquivos originais do protótipo e seu histórico foram preservados separadamente no ambiente de trabalho e no repositório original; imagens sem licença comprovada não foram republicadas aqui.

## Manutenção

- [Arquitetura e decisões](docs/arquitetura.md)
- [Motor de perguntas e persistência](docs/domain.md)
- [Pipeline reprodutível dos ativos](scripts/assets/README.md)
- [Integração do conteúdo](docs/integracao-conteudo.md)
- [Estado da execução e evidências](docs/execucao.md)

Edite `src/content/asset-content.json` com fontes e aliases explícitos, mantendo o estado de revisão. Gere o catálogo com `node scripts/build-catalog.mjs` e rode `npm run check`. Nunca torne um item avaliável sem arquivo, label, mapeamento técnico e fonte. Não substitua a revisão anatômica por testes de software.

O workflow publica o artefato produzido e testado em `main`, sem reconstruí-lo no deploy. A base usa o nome do repositório. O progresso é versionado, exportável e pode ser apagado localmente; não há coleta de dados pessoais.
