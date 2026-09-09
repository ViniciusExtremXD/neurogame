# Integração do conteúdo

`curriculum.json` é o inventário completo. `asset-content.json` contém as fichas editoriais de 118 labels. O array de alvos está em `assetContent.assets`; a raiz também contém fontes e política de contagem. `types.ts` documenta o contrato.

Associe por `assetId`/`labelId`, nunca por cor visual, tradução aproximada ou centroide. `curriculumIds` é uma relação um-para-muitos e `conceptId` deduplica repetições curriculares. Não traduza IDs para gerar novos IDs.

Para criar questões, intersecte `assessmentCandidate`, `manifest.technicalReview === 'verified'`, ausência de exclusão runtime, arquivo íntegro e alvo válido na vista efetivamente apresentada. O construtor mantém as exclusões explícitas em `runtimeReviewExclusions`; `spl-3022` tem um componente isolado suspeito presente na malha e no volume e permanece fora do banco, mesmo com o teste geométrico original aprovado. O estado original fica em `sourceTechnicalReview`; a aplicação usa `technicalReview`, `explorationReview` e `runtimeReview` do catálogo gerado. Sulcos sem volume aceitam somente vista 3D. Recalcule o banco quando mudar a versão do manifesto. Um candidato incapaz de aparecer no corte atual deve ser excluído da pergunta, sem penalizar o aluno. Consulte [discrepâncias da fonte](source-discrepancies.md).

Aliases de alvos lateralizados incluem o lado. Não aceite genericamente o nome sem lado nem aliases de outro label por similaridade textual. Há um `distractorGroup` editorial para apoiar alternativas do mesmo nível. Se um grupo não fornecer alternativas suficientes e inequívocas, reduza as alternativas de maneira explícita ou não ofereça essa pergunta; não complete com termos arbitrários.

As descrições têm forma consistente: `summary`, `location`, `function`, `relations`, `clinical`, `tip`, `sourceRefs` e `status`. `null` significa dado não sustentado neste catálogo, não texto a inventar. O texto é próprio e breve; dados sensíveis a aplicação clínica foram omitidos quando não necessários à identificação.

Os booleanos de cobertura visual e avaliativa no inventário ficam falsos até integração/validação do aplicativo. Preserve o inventário como entrada e produza cobertura observada em relatório separado ou atualização comprovada. As contagens de fonte, de label e de conceito não são intercambiáveis.

`validate-content.py --content-dir CAMINHO --asset-dir PUBLIC_ROOT` verifica IDs, hierarquia, referências, lateralidade, colisões de aliases, exclusões, existência dos GLB e hashes. `asset-dir` aponta à pasta que contém `anatomy/manifest.json` e `anatomy/models/`. Não exige PDFs privados.

Os scripts de construção editorial (`build-curriculum.py`, `enrich-content.py`) são usados na área local de preparação. O primeiro depende da extração privada feita com pypdf/pdfplumber e das 10 páginas inspecionadas; não inclua essa extração no repositório. O segundo lê o manifesto licenciado e enriquece o inventário. Execute o construtor antes do enriquecimento para evitar fontes duplicadas.

O material documental não comprova deploy, desempenho, interação no navegador ou revisão humana. Esses resultados devem vir da aplicação integrada.
