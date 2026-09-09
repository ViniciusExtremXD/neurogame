# NeuroGame: laboratório de neuroanatomia

## Decisão e escopo

Reconstrução autorizada pelo briefing integral fornecido em pasted-text-1.txt (contém o texto de NeuroGame-Prompt-Codex.md). React, TypeScript, Vite; Three.js/React Three Fiber/Drei; Motion. Aplicação estática em português, sem conta ou backend, publicada em ViniciusExtremXD/neurogame após validação.

O diretório inicial tinha apenas os PDFs. O protótipo foi clonado e inspecionado no commit 49065022cfdf17681c1e471940cf2854069a31af. O original e seu histórico permanecem em área local privada e no repositório de origem. O novo repositório não redistribui suas imagens cuja licença não foi comprovada. A conta conectada tem READ no original; o usuário autorizou um repositório público próprio.

## Unidades

- `src/content`: inventário de todas as ocorrências do roteiro, conceitos, mapeamentos para ativos e explicações com fontes. Cobertura documental, visual e avaliativa têm denominadores separados.
- `scripts/assets`: aquisição por commit/hash, conversão reprodutível de modelos e RM/labels SPL/NAC registrados. Saída web em `public/atlas`; fontes pesadas ficam fora do repositório.
- `src/atlas`: visualizador de malhas e canvas de cortes; compartilham seleção por ID e plano/posição. Referencial e affine vêm do manifesto, nunca de alinhamento visual manual.
- `src/domain`: perguntas determinísticas por seed, respostas, tentativas, ajuda, omissões e pontuação. Sem dependência de React.
- `src/state`: persistência versionada e importação validada; armazenamento indisponível preserva uso em memória.
- `src/components`: navegação curricular, fichas, treino, simulado, estatísticas e referências.

## Experiência

Abertura direta no atlas. Navegação lateral curricular, viewport grande e ficha à direita; no celular a ficha segue abaixo do viewport. Paleta papel claro, tinta azul-petróleo e acentos anatômicos. Rotação manual, presets, zoom, transparência, isolamento, ocultação e labels. Câmera e interface respeitam movimento reduzido. Nenhuma deformação de anatomia.

Explorar revela nomes e referências. Treinar oferece localizar, nomear e alternativas. Simulado mistura modalidades/planos/módulos, mantém seed e sessão ao recarregar e só revela correção ao final. O progresso conta acertos independentes na primeira tentativa por questão válida, sem converter repetições/ajuda em domínio. Falha de ativo anula a questão.

## Dados e segurança pedagógica

Somente alvos com correspondência técnica e fonte entram em avaliação beta. Revisão anatômica humana permanece pendente até evidência documentada. Itens sem geometria são mostrados com lacuna, nunca como jogáveis. Correspondência seccional só usa RM/segmentação do mesmo conjunto espacial. TC depende de conjunto licenciado compatível; uma RM não é apresentada como TC.

PDFs e extrações ficam fora de `public`, `dist` e Git. Licenças de código e ativos são registradas separadamente. O aplicativo não usa material institucional como endosso e não serve a diagnóstico.

## Validação e publicação

Vitest para domínio, conteúdo e coordenadas; Playwright para interação real, ausência de vazamento, restauração, fallback, desktop e mobile emulado. Typecheck, lint, inventário/hash de assets e build em /neurogame/. CI publica exatamente o artefato verificado. O deploy só é declarado após workflow e smoke test da URL final. Performance em dispositivo físico é relatada apenas quando medida.
