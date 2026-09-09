# Discrepâncias da fonte e exclusões de avaliação

Revisão anatômica humana pendente. Os arquivos licenciados permanecem íntegros, sem remoção de componentes ou alteração silenciosa das máscaras. A aplicação distingue a evidência do manifesto congelado da revisão adicional feita durante a integração.

Fonte: SPL/NAC, commit `bec24db25aad5f7600e2df3becfb1f883e61ff56`. SHA-256 do manifesto congelado: `228b19907a73d8d00c62a01f636d031ebfba07145eefaabfb64b3674d712d587`.

## Divergências entre malha e volume

O manifesto registra `technicalReview: source-discrepancy` para `spl-2`, `spl-41`, `spl-506`, `spl-510`, `spl-1016`, `spl-3005` e `spl-3007`. Há diferenças entre a superfície fornecida e o volume de labels. Esses ativos ficam fora das perguntas e da cobertura visual verificada. Permanecem disponíveis para exploração com a pendência indicada.

## Colículo inferior direito: componente isolado suspeito

Em 9 de setembro de 2026, a inspeção da cena identificou um componente distante do tronco encefálico em `spl-3022`, nome de origem `right inferior colliculus`. A verificação direta do NRRD, com componentes conectados por vizinhança de 26 voxels, encontrou:

- **66 voxels totais** no label 3022.
- Componente principal com **65 voxels**, limites RAS de `[2, −27, −24]` a `[6, −23, −20]` mm.
- **1 voxel isolado** em RAS `[47, −19, 45]` mm, também representado na malha. A localização é incompatível com a identificação esperada do colículo inferior e exige revisão anatômica.

A concordância entre malha e máscara não detecta esse problema porque ambas preservam o mesmo componente. O estado `verified` do manifesto continua documentando as verificações geométricas executadas; ele não equivale a revisão anatômica humana.

O construtor `scripts/build-catalog.mjs` aplica uma exclusão explícita para essa versão da fonte. No catálogo gerado, `sourceTechnicalReview` preserva `verified`, `technicalReview` é `source-discrepancy`, `explorationReview` é `flagged`, e `runtimeReview`/`reviewNote` registram a evidência. `eligible` fica falso, `assessmentViews` fica vazio e o label não conta como cobertura visual verificada. Não se alteram o manifesto, GLB, PNG ou inventário editorial congelado.

O GLB de origem distribuído possui SHA-256 `3b50018a060a0a7e2671b48ae834fd70c28c8e522bf46a2f91c272cfb098e5ec`. A evidência também pode ser localizada na máscara axial de índice 83, pixel `[81, 147]`. O validador confere o label nesse pixel, a vizinhança completa de 3×3×3 contendo apenas um voxel desse label e os 66 voxels totais nas fatias axiais.

## Impacto no banco

São **109 alvos avaliáveis, em 61 conceitos**, após excluir `spl-3022` dos 110 candidatos editoriais. Os 258 ativos distribuídos permanecem presentes. Há 70/404 itens com cobertura 3D verificada, 54/404 com cortes válidos e 70/404 com perguntas. Os totais curriculares permanecem iguais porque `spl-3023`, colículo inferior esquerdo, continua representando o mesmo item do roteiro. Isso não significa que o lado direito esteja validado.

Para reconsiderar qualquer exclusão, registrar uma revisão humana com evidência por ID, atualizar a política explicitamente e executar `node scripts/build-catalog.mjs`, `node scripts/validate-assets.mjs` e os testes. Uma nova versão da fonte exige revisar novamente as exclusões, sem reaproveitar a decisão automaticamente.
