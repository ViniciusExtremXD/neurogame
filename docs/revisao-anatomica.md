# Fila de revisão anatômica

Estado global: **revisão anatômica humana pendente**. O inventário e os nomes dos labels foram conferidos por fonte; nenhum nome de revisor humano foi atribuído.

| ID | Página do roteiro | Termo/contexto | Pendência |
|---|---:|---|---|
| grafia-giro-dentetado | 9 | Giro dentetado | Grafia preservada. O Atlas emprega “Giro denteado”; confirmar a nomenclatura pretendida antes de aceitar equivalência no banco avaliativo. |
| giro-paracentral-parietal | 8 | giro paracentral anterior | O roteiro repete “anterior” sob Lobo parietal. Preservado; não trocar silenciosamente por posterior nem habilitar pergunta sem revisão. |
| sulco-do-hipocampal | 8 | Sulco do hipocampal | O roteiro também usa “Sulco hipocampal” na mesma página. Variante preservada sem equivalência automática. |
| culmen-partes | 5 | Parte posterior | A indentação posiciona “Parte posterior” depois de Fissura intraculminal. O contexto é o verme/cúlmen; a relação anatômica de pertencimento requer revisão humana. |
| substancia-negra-base | 4 | Substância negra | Preservada a indentação do roteiro sob Base. A hierarquia é curricular e não afirma pertencimento geométrico exato. |
| classificacoes-cerebelo | 5 | Classificação funcional / Divisão Filogenética | Conceitos distintos das divisões macroscópicas; não representar fronteiras geométricas exatas sem fundamentação. |
| aqueduto-duas-seccoes | 5 | Aqueduto do mesencéfalo | O roteiro exige identificação em cortes sagitais e transversais. Disponibilidade de malha isolada não cumpre esse requisito. |
| human-review | todas | catálogo | Revisão anatômica humana de nomes, descrições e correspondências permanece pendente para todo o catálogo; conferência documental não equivale a revisão humana. |

## Correspondência entre malha e volume

O pipeline detectou discrepâncias nas fontes dos ativos spl-2, spl-41, spl-506, spl-510, spl-1016, spl-3005 e spl-3007. Somente os quatro últimos da interseção editorial (506, 1016, 3005 e 3007) possuem descrições neste catálogo de alvos; estão excluídos da avaliação. Consultar o relatório geométrico do pipeline antes de liberar qualquer um.

## Procedimento de revisão humana

Há uma exclusão adicional de integração em `spl-3022`, colículo inferior direito: 1 voxel isolado em RAS `[47, −19, 45]` mm, também presente na malha. O componente principal tem 65 voxels. O manifesto permanece intacto; o catálogo runtime sinaliza a exploração e exclui esse label da avaliação. Evidência, política e impacto estão em [discrepâncias da fonte](source-discrepancies.md).

1. Abrir o item na visualização e comparar o nome original, lateralidade e contexto curricular.
2. Comparar a malha com o volume correspondente e com uma fonte acadêmica independente.
3. Conferir a descrição curta e a referência; apontar correções diretamente pelo ID estável.
4. Testar o alvo nos modos de identificação e verificar se o aluno consegue alcançá-lo sem pistas.
5. Registrar revisor, data, versão/commit, IDs examinados, evidência e resultado. Até esse registro existir, manter `human-review-pending`.

A hierarquia é a organização curricular observada no PDF. Relações pai/filho não representam automaticamente inclusão espacial nem fronteiras funcionais exatas.

Não converter somente uma diferença de grafia em equivalência anatômica. “Giro dentetado”, “giro paracentral anterior” sob lobo parietal e “Sulco do hipocampal” continuam preservados.
