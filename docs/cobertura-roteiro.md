# Cobertura documental do roteiro

Leitura completa das 10 páginas do Roteiro de Neuroanatomia (Medicina), incluindo a capa e a continuação de fibras de associação na página 10. Inventário com 404 itens em contexto e 431 ocorrências de linha; 27 ocorrências são títulos organizacionais ou notas.

A [matriz por item](cobertura-itens.csv) contém nomenclatura original, contexto, páginas, descrição, candidatos visuais e pendências. O catálogo mantém 404 entradas curriculares, incluindo títulos anatômicos. Não são 404 estruturas únicas nem 404 alvos jogáveis. Repetições em faces, módulos e morfologias distintas conservam IDs diferentes; os vínculos a um mesmo conceito visual ficam em campo próprio.

| Módulo | Páginas do PDF | Itens | Com descrição | Itens com correspondência exata | Labels candidatos |
|---|---|---:|---:|---:|---:|
| Termos gerais | 2 | 17 | 2 | 0 | 0 |
| Meninges | 2 | 28 | 6 | 0 | 0 |
| Medula espinal | 3 | 32 | 22 | 0 | 0 |
| Tronco encefálico | 3, 4, 5 | 81 | 12 | 9 | 15 |
| Cerebelo | 5, 6 | 57 | 9 | 1 | 2 |
| Diencéfalo | 6 | 34 | 13 | 10 | 15 |
| Telencéfalo | 6, 7, 8, 9, 10 | 155 | 63 | 51 | 78 |

Explicações próprias breves: 127/404 entradas. Correspondências exatas de nomenclatura: 71 entradas curriculares; duas entradas têm somente representação parcial. O conjunto editorial possui 118 labels descritos, dos quais 110 são candidatos de avaliação em 61 conceitos anatômicos. Lateralidade gera labels distintos, mas não duplica conceitos na contagem.

## Como interpretar cobertura

Após integração e revisão adicional dos componentes, o catálogo distribuído oferece **109 alvos em 61 conceitos**. A exclusão runtime de `spl-3022` preserva os 110 candidatos do inventário editorial original; ver [discrepâncias da fonte](source-discrepancies.md). A cobertura observada é de **70/404 itens em 3D, 54/404 em cortes e 70/404 em perguntas**. Contagens por item não garantem ambos os lados: o colículo inferior esquerdo mantém o item coberto, enquanto o direito permanece excluído.

- **Documental:** termo original e contexto localizados no roteiro. A contagem é 404/404 entradas, com a hierarquia e as ocorrências preservadas.
- **Descrição:** explicação própria sustentada por referência; campos sem fonte permanecem `null`.
- **Visual:** somente deve ser marcado após integrar e verificar o ativo na cena ou no corte. `representationCandidates` não equivale a `representation3d`/`representation2d` validados.
- **Avaliativa:** exige nome inequívoco, descrição, referência, ativo íntegro, seleção real testada, ausência de pistas e alvo acessível. `assessmentCandidate` é um filtro editorial, não uma alegação de teste de navegador.
- **Revisão humana:** pendente em todas as entradas. Conferência por ferramenta e fonte acadêmica não assina revisão em nome de professor ou médico.

## Lacunas reais

Meninges e medula espinal estão documentadas e possuem material conceitual, mas não têm geometria deste conjunto correspondente ao roteiro. A subdivisão cerebelar por siglas do atlas SPL/NAC não foi traduzida por aproximação para a nomenclatura brasileira. Núcleos profundos cerebelares agrupados como FaGE não substituem os núcleos do fastígio, globoso e emboliforme isolados.

Pontes, mesencéfalo e ínsulas com rótulo “unsegmented region” são regiões residuais do conjunto, não o órgão inteiro. Os labels dos ventrículos laterais 4/43 excluem os cornos temporais 5/44; por isso os primeiros não entram como equivalência integral. A substância branca hemisférica cerebelar 7/46 é parte do corpo medular, não a estrutura completa.

Os sulcos selecionados são alvos de superfície 3D, sem label volumétrico neste conjunto. Não há correspondência seccional pelo ID de sulco. A falta de uma máscara volumétrica não é resolvida desenhando núcleos ou fronteiras fictícias.

O roteiro não possui módulos independentes de vascularização ou nervos cranianos: essas expansões devem ser marcadas como complementares. Ventrículos aparecem em contexto meníngeo, tronco, diencéfalo e telencéfalo; o catálogo preserva essa organização curricular.

## Referências e direitos

O Roteiro define o escopo. O Atlas de Neuroanatomia Humana (Gabriel Henrique Lombardi e Leonardo Augusto Lombardi, 2024) é referência privada; sua página 4 restringe reprodução e distribuição. Nenhuma página, screenshot, ilustração extraída ou desenho traçado do Atlas integra estes artefatos públicos.

A seção de anatomia seccional ocupa as páginas 88–109 do PDF, correspondentes às páginas impressas 74–95. O aqueduto requer identificação sagital e transversal no roteiro, página 5. Os campos `pagePdf` e `pagePrinted` conservam a distinção.

As explicações referenciam páginas/figuras específicas do Atlas ou fontes acadêmicas complementares da UTHealth Houston e OpenStax. A geometria é do SPL/NAC, com origem e licença no manifesto de ativos; a fonte acadêmica da descrição não é a licença da malha.
