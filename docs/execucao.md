# NeuroGame — execução e verificação

## Implementado

Reconstrução em React/TypeScript/Vite, com catálogo, motor de perguntas e visualizadores separados. Atlas com 258 GLBs reais (236 segmentações e 22 curvas de sulcos), seleção por raycast, buscas, lateral/medial dos dois lados, quatro vistas ortogonais, zoom, pan, isolamento, ocultação, transparência e rótulo selecionado. Cortes T1 axial/coronal/sagital, 256 posições por plano, e visualização combinada com plano 3D no mesmo referencial.

Treino por localização, resposta escrita e quatro alternativas; simulado sem feedback até o encerramento; pausa, restauração, ajuda e repetição discriminadas, anulação de recurso ausente, revisão de erros, histórico por módulo, exportação/importação validada e exclusão local. Interface responsiva, tutorial, teclado, animações e movimento reduzido. Fontes tipográficas locais. Sem backend.

O roteiro inteiro foi inventariado: 404 itens contextuais / 431 ocorrências / sete módulos curriculares. Há 109 alvos avaliáveis (61 conceitos), cobertura estrita de 70 itens com 3D, 54 com cortes e 70 no banco de avaliação. A contagem de representações não equivale a aprovação anatômica humana.

## Validado

- `npm ci`: instalação limpa no Windows com Node 22.16/npm 10.9.2; auditoria: zero vulnerabilidades informadas.
- `npm run check`: TypeScript, ESLint e validação integral de ativos passaram.
- `npm test`: 76 testes de domínio, catálogo, coordenadas, recursos e ausência de revelação no simulado passaram.
- `npm run build`: build estático com base `/neurogame/` passou.
- Treze testes Playwright no build de produção passaram: raycast e arrasto, aqueduto axial independente, localização/nome/alternativas, simulado e reload sem revelação, celular 390×844, recursos ausentes, ausência de WebGL, lateral/medial direita, recuperação da ocultação, importação/exportação, importação atrasada, hash/foco e axe WCAG A/AA nas telas de atlas/tutorial/configuração/progresso/cobertura. Essa varredura automatizada não certifica acessibilidade completa.
- Sete testes de integração do aplicativo no Edge passaram: restauração, exportação com falha, alvos por teclado, repetição/duplo clique, encerramento antecipado, pausa por carregamento e anulação de fatia.
- Revisão independente de código: nenhum P1/P2 pendente após corrigir pausa por histórico e importação atrasada. Reproduções no navegador confirmaram as correções.
- Licença e avisos: Slicer partes B/C e prefácio, atribuições acadêmicas/NIH/Google, e SIL OFL das fontes preservados. PDFs e suas imagens não estão no público nem no Git.

O validador confere hashes de 258 modelos, oito pacotes, 1536 PNGs e 50.331.648 pixels de máscaras. O pipeline original foi comparado integralmente ao NRRD. Referências espaciais independentes incluem aqueduto (label 19) e núcleos caudados esquerdo/direito. Não confundir essas checagens com validação humana da anatomia.

[Evidências visuais](evidence/) e [medidas do build](evidence/build-sizes.json). Shell, catálogo e WOFF2 somam cerca de 290 kB com gzip local; o primeiro hemisfério tem 35 modelos e 12,96 MB sem compressão (7,99 MB com gzip). Esses valores medem bytes locais, não velocidade da rede nem FPS. As metas de 60 FPS no desktop e 30 FPS em celular físico continuam sem medição.

## Publicação

Destino autorizado pelo usuário: [ViniciusExtremXD/neurogame](https://github.com/ViniciusExtremXD/neurogame), público; permissão ADMIN confirmada. GitHub Pages configurado por Actions para [a URL final](https://viniciusextremxd.github.io/neurogame/). Publicação ainda em verificação nesta revisão; não declarar concluída até confirmar workflow e recursos no endereço público.

O workflow `.github/workflows/pages.yml` executa instalação, verificações, testes e build, testa o artefato e publica esse mesmo `dist` somente em `main`. Actions fixadas por SHA, credenciais de checkout não persistidas e permissões de Pages/OIDC restritas ao job de deploy.

## Bloqueado / pendente de conteúdo

- Revisão anatômica e didática por docente: pendente; nenhum endosso acadêmico foi inferido.
- Oito ativos suspeitos permanecem fora das questões; [evidências de origem](source-discrepancies.md), incluindo o voxel isolado do colículo inferior direito. Nenhuma malha foi deformada nem voxel apagado para esconder divergência.
- Ampliação de meninges, medula, vascularização, nervos cranianos e demais itens ainda sem representação exige ativos licenciados e mapeamento. Há documentação curricular e descrições onde sustentadas pelas fontes; não há geometria fictícia para preencher lacunas.
- TC ausente deste conjunto; a aplicação identifica os cortes como RM T1. Novos mapas só poderão ser sincronizados depois de registro validado.
- Traduções e aliases adicionais só entram com revisão e fonte; termos não revisados preservam o inglês original.

## Inspeção e preservação

Briefing integral lido em `pasted-text-1.txt` (inclui o prompt mestre). Roteiro de 10 páginas e Atlas de 137 páginas lidos; restrição do Atlas p.4 confirmada. Pasta inicial sem Git ou AGENTS.md. Protótipo original inspecionado em `49065022cfdf17681c1e471940cf2854069a31af`; conta conectada possuía somente leitura naquele repositório. Clone e histórico original preservados fora deste novo repositório. Nenhum conteúdo privado acadêmico foi republicado.
