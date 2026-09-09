# Motor de estudo e progresso

O domínio em `src/domain` é TypeScript independente de React, HTML e canvas. Ele recebe o catálogo já mapeado, a configuração e horários em milissegundos. Não usa relógio global nem sorteio global: a interface fornece `Date.now()` nas ações temporizadas e um `crypto.randomUUID()` **novo** para cada sessão.

## Integração

```ts
const session = createSession(targets, {
  id: crypto.randomUUID(), seed: 'minha-seed', mode: 'practice', count: 12,
  kinds: ['locate', 'name', 'choice'], views: ['3d', 'axial'], startedAt: Date.now(),
});
const question = session.questions[session.cursor];
const next = submitAnswer(session, question.id, value, targets, Date.now());
```

`createSession` lança uma mensagem legível para configuração inválida, IDs duplicados ou filtros sem questões. A contagem solicitada fica em `requestedCount`, a disponibilidade real em `availableCount` e a quantidade criada em `questions.length`. O limite solicitado é 1–1000; nunca são inventados itens para completar a quantidade. Um par estrutura/vista aparece no máximo uma vez por sessão. `targetIds` permite um treino dedicado à fila de revisão.

Somente alvos elegíveis, com fonte, labels e vista utilizável entram na geração. Cortes precisam ter um índice inteiro no catálogo. Aliases normalizados compartilhados entre alvos elegíveis excluem os alvos ambíguos da avaliação. As quatro alternativas são IDs do mesmo módulo/categoria/vista, com nomes e aliases distintos; sem três distratores adequados a modalidade de escolha não é oferecida para aquele item/vista. A ordem é reproduzida pela seed. Não dependa da posição de uma alternativa para corrigir uma resposta.

As ações `submitAnswer`, `useHint`, `retryQuestion`, `skipQuestion`, `invalidateQuestion`, `advanceQuestion`, `finishSession`, `pauseSession` e `resumeSession` retornam uma nova sessão. Ação rejeitada mantém a referência original. Use o estado mais recente em uma atualização funcional de React; eventos devem carregar o ID da pergunta que os originou. Repetir uma questão muda seu ID, prevenindo a aceitação de um clique atrasado na tentativa seguinte. A criação de outra sessão precisa de outro ID, mesmo com a mesma seed.

Em localizar/escolha, `value` é o ID efetivamente selecionado. Em nomear, é o texto. A normalização altera caixa, acentos, espaços e hífens; não corrige ortografia por aproximação nem remove lateralidade. As equivalências aceitas vêm exclusivamente de nomes/aliases do catálogo.

A resposta não avança automaticamente: primeiro registre e apresente o feedback no treino, depois chame `advanceQuestion`. Para omitir, chame `skipQuestion` e então avance. Para falha de recurso, chame `invalidateQuestion` com uma explicação antes de avançar. Ajuda e repetição só funcionam no treino, com até 49 repetições por questão. Repetições após acerto não são permitidas.

`elapsedMs(session, now)` exclui pausas e fica congelado no encerramento; um limite opcional limita o tempo contabilizado. A interface deve finalizar ao atingir o prazo. O motor também rejeita a resposta tardia e encerra a sessão. Recarregar não cria outra sequência: restaure o objeto de sessão inteiro. Sessões pausadas permanecem pausadas até `resumeSession`.

## Correção e denominadores

`summarizeSession(session, targets, now?)` devolve `null` enquanto um simulado está ativo. A interface deve ainda ocultar gabarito, descrições, dicas, tooltips com respostas, classes/cores de correção e anúncios acessíveis que revelem o resultado. O objeto interno guarda respostas para restaurar a sessão; este produto estático não é um sistema de prova com proteção contra fraude.

| Métrica | Regra |
| --- | --- |
| `valid` | Todas as questões geradas menos as anuladas; inclui as omitidas. |
| `independentCorrect` | Primeira resposta correta, sem ajuda. |
| `assistedCorrect` | Primeira resposta correta após ajuda. |
| `retryCorrect` | Acerto em tentativa posterior, com ou sem ajuda. |
| `firstAttemptErrors` | Primeira resposta errada, mesmo quando depois corrigida. |
| `answered` | Questões válidas com ao menos uma resposta. |
| `omitted` | Questões explicitamente puladas/encerradas sem nenhuma resposta; futuras questões pendentes não são omissões. |
| `accuracy` | `independentCorrect / valid * 100`; `null` se não há questão válida. |
| `attempts`, `hints`, `retries` | Contagem de respostas, questões com ajuda e repetições; anulações não penalizam estes totais. |

O exemplo testado tem cinco perguntas: um acerto independente, um acerto após ajuda, um acerto após erro/repetição, uma falha de modelo e uma omissão. Resultado: quatro questões válidas, 25% independente, quatro respostas, um erro na primeira tentativa. O acerto repetido nunca apaga o erro inicial. A mesma regra produz os grupos `byModule` e `byView`. A fila `reviewTargetIds` inclui erros, omissões e acertos assistidos, sem duplicar estruturas e sem incluir falhas do sistema. Sequências contam acertos independentes; uma anulação não quebra a sequência.

## Persistência

`emptyProgress()` cria o envelope v1; `recordSession(data, session)` mantém uma sessão ativa e até 100 sessões encerradas recentes, sem duplicar um mesmo ID. `exportProgress(data)` produz JSON; `importProgress(text, targets)` retorna `{ok:true,data}` ou `{ok:false,error}`. Só substitua o estado atual quando a importação tiver sucesso.

`saveProgress(data, storage?)`, `loadProgress(targets, storage?)` e `clearProgress(storage?)` usam `neurogame:progress:v1`. O argumento opcional permite testar com armazenamento em memória. Exceções de acesso, bloqueio do navegador e cota são convertidas em mensagens. A interface mantém o estado em memória quando uma escrita falha e mostra a mensagem. Apagar remove somente a chave do NeuroGame.

O orçamento de arquivo é 2 MB em UTF-8, verificado antes de interpretar a importação. A exportação também recusa ultrapassar esse orçamento; o limite de 100 sessões não garante que qualquer combinação de 100 sessões caiba em 2 MB. Não descarte o estado em memória quando a cota ou o orçamento impedir uma gravação.

A validação recusa campos desconhecidos, versões futuras, timestamps inválidos, IDs repetidos, cursor fora do intervalo, sequências impossíveis, tentativas depois de acerto, ajuda em simulado, fontes/alvos inelegíveis, vistas/cortes incompatíveis, alternativas inconsistentes e correção diferente do catálogo. Todas as tentativas são verificadas. Mudanças incompatíveis no catálogo podem impedir a restauração de um backup; ele não é reinterpretado silenciosamente.

O formato de migração v0 é explicitamente definido como `{schemaVersion:0,sessions,activeSession}` com as mesmas regras internas de sessão; recebe preferências padrão no envelope v1. Isso é uma regra de compatibilidade deste domínio, não uma alegação sobre o formato histórico do protótipo. Não se tenta adivinhar ou converter dados não documentados de outro produto. Não existem campos de nome, e-mail, cadastro ou perfil pessoal; somente preferências locais e respostas de estudo.

## Evidência

Os testes foram escritos e observados falhando antes de implementar as regras correspondentes. A primeira rodada apresentou 12 falhas de geração/normalização, seguida por 12 acertos. A segunda apresentou 10 falhas de transições/pontuação/tempo e passou após implementação. O importador básico foi deliberadamente verificado com 15 falhas de validação de estado antes do validador completo. Regressões adicionais cobriram alternativa que perde elegibilidade, omissão durante treino, datas fora da faixa e sessão contraditória.

Comandos locais de verificação: `npx vitest run src/domain`, `npx eslint src/domain` e `npx tsc --noEmit`. A validação de interface e de anatomia pertence às camadas de integração e conteúdo; testes do motor não comprovam seleção 3D nem revisão anatômica humana.
