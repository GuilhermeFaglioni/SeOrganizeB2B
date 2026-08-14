# Vinculação de colaboradores por código de workspace

## Problem Statement

O fluxo atual de convites tenta enviar um email para o colaborador. Isso depende
de um provedor SMTP, sofre com limites de entrega e pode criar gargalos, spam ou
falhas silenciosas. A equipe precisa de um fluxo manual, previsível e sem envio
de email nesta fase.

O modelo de domínio também possui um único `Profile.tenantId`, mas o cadastro
atual cria automaticamente um novo workspace antes de considerar um convite
pendente. Um colaborador convidado pode, portanto, acabar em uma empresa própria
em vez de ser vinculado à empresa correta.

## Solution

Substituir o envio de email por um convite pendente identificado pelo email e
confirmado por um código definido pelo admin do workspace.

O admin cadastra o email do colaborador. O sistema armazena um `Invite` pendente,
sem enviar mensagem. O colaborador cria ou autentica sua conta usando email e
senha ou Google. Antes de criar um `Profile`, o sistema procura convites válidos
para o email autenticado. Se houver algum, exibe uma etapa de vinculação que
aceita somente um código válido de workspace. O código seleciona o workspace
entre vários convites possíveis.

Sem convite válido, o comportamento atual permanece: o usuário recebe um novo
workspace e se torna seu admin. Com convite válido, o perfil é criado no
workspace convidado, recebe a role do convite e o convite é aceito.

## User Stories

1. Como admin de uma empresa, quero cadastrar o email de um colaborador sem disparar email, para registrar a intenção de vinculação sem depender de SMTP.
2. Como admin de uma empresa, quero configurar um código de vinculação da empresa, para compartilhar esse código manualmente com colaboradores convidados.
3. Como admin de uma empresa, quero substituir o código de vinculação, para invalidar o código anterior quando necessário.
4. Como admin de uma empresa, quero ser impedido de cadastrar novos colaboradores antes de configurar o código, para não criar convites impossíveis de aceitar.
5. Como usuário convidado, quero criar minha conta com email e senha sem aguardar confirmação por email, para acessar o fluxo de vinculação imediatamente.
6. Como usuário convidado, quero autenticar com Google, para usar um método de login alternativo e ainda poder concluir a vinculação.
7. Como usuário autenticado sem `Profile`, quero ser levado à etapa de vinculação quando houver convite pendente para meu email, para escolher a empresa correta antes do provisionamento.
8. Como usuário autenticado sem convite, quero continuar criando minha própria empresa automaticamente, para que o cadastro público não dependa de convite.
9. Como usuário com vários convites pendentes, quero informar o código da empresa desejada, para selecionar exatamente um workspace.
10. Como usuário convidado, quero que o código seja comparado ao email da minha conta autenticada, para que conhecer somente um código não seja suficiente sem um convite correspondente.
11. Como usuário convidado, quero receber uma mensagem genérica quando o código for inválido, para que o sistema não revele informações sobre outras empresas.
12. Como usuário convidado, quero poder tentar novamente após um código inválido, para corrigir erros de digitação.
13. Como usuário convidado, quero que o sistema bloqueie temporariamente tentativas excessivas, para reduzir ataques de adivinhação do código.
14. Como usuário convidado, quero que um código válido crie meu perfil com a permissão definida pelo admin, para começar com o acesso correto.
15. Como usuário já vinculado, quero continuar entrando normalmente sem informar o código novamente, para não transformar o código em uma senha de uso diário.
16. Como usuário com um convite expirado, quero saber que a vinculação precisa ser recriada, para não ser colocado acidentalmente em uma empresa própria.
17. Como usuário com um convite cancelado, quero seguir o cadastro normal se não houver outro convite válido, para que um convite revogado não bloqueie minha conta.
18. Como admin, quero cancelar um convite incorreto ou expirado, para desbloquear o email e permitir um novo cadastro.
19. Como admin, quero que convites aceitos desapareçam da lista de pendentes, para distinguir colaboradores ainda não vinculados dos membros da equipe.
20. Como admin, quero que os demais convites sejam superseded quando um usuário aceita um workspace, para evitar convites impossíveis em um modelo de um workspace por perfil.
21. Como admin, quero que o código nunca seja exibido novamente depois de salvo, para limitar a exposição de uma credencial de vinculação.
22. Como admin, quero que somente administradores alterem o código, para proteger a fronteira de entrada da empresa.
23. Como admin, quero que a troca do código invalide o código anterior para convites pendentes, para poder recuperar o controle sem editar cada convite.
24. Como usuário cuja conta Auth já existe mas ainda não tem `Profile`, quero usar o mesmo fluxo de convite, para concluir cadastros interrompidos.
25. Como sistema, quero rejeitar convites para emails que já possuem `Profile` em outro workspace, para não migrar contas nem fingir suporte a múltiplos workspaces.
26. Como sistema, quero rejeitar códigos que correspondam a mais de um convite do mesmo email, para não escolher uma empresa arbitrariamente.
27. Como admin, quero manter convites pendentes válidos durante a migração, para não perder intenções de vinculação já registradas.
28. Como mantenedor, quero manter o histórico de convites cancelados, expirados, aceitos e superseded, para preservar auditoria sem expor tokens.
29. Como usuário, quero que o fluxo de acesso somente leitura continue independente, para que a nova vinculação de colaboradores não altere outro produto de acesso.
30. Como operador, quero que a aplicação não precise de SMTP ou service role key para convites, para reduzir configuração e superfície de falha.

## Implementation Decisions

- O convite deixa de chamar qualquer provedor de email. Criá-lo somente valida o email, workspace e role, grava o status `pending` e retorna dados seguros do convite.
- O email do convite e o email autenticado são normalizados com trim e lowercase. O email usado para vincular vem exclusivamente da sessão Supabase, nunca do cliente.
- A validade dos convites permanece em sete dias.
- Os estados de convite são `pending`, `accepted`, `cancelled`, `expired` e `superseded`. Convites expirados devem ser materializados como `expired` quando consultados ou listados.
- O campo de token existente permanece no banco para dados históricos e compatibilidade interna, mas deixa de ser mecanismo de email, callback ou vinculação e não é retornado pela API pública.
- O workspace recebe um hash opcional do código de vinculação e metadados mínimos de atualização. O texto do código não é persistido.
- O código é definido pelo admin na tela existente de configurações da empresa, exige confirmação e tem no mínimo oito caracteres. A comparação é case-sensitive depois de remover espaços externos.
- Todos os admins podem criar ou substituir o código sem informar o código anterior. A substituição invalida o código anterior para convites pendentes.
- A API de configurações retorna somente se existe código configurado, nunca o hash ou o valor original.
- Novos convites são rejeitados quando o workspace ainda não tem código configurado.
- Convites pendentes válidos existentes são preservados durante a migração e usam o código atual depois que o admin configurá-lo.
- O modelo atual de um `Profile` para um único workspace é mantido. Se o email já possuir perfil em qualquer workspace, um novo convite é rejeitado; não há migração automática nem associação múltipla.
- O convite pode ser criado para o mesmo email em vários workspaces diferentes. O código deve selecionar um deles. Se o mesmo código corresponder a mais de um convite, a tentativa é rejeitada como ambígua.
- Um `Profile` sem convite válido segue o fluxo existente de criação de workspace próprio e recebe a role de admin do novo workspace.
- Um usuário Auth já existente sem `Profile` é tratado como novo para fins de provisionamento e passa pelo mesmo estado de convite ou criação própria.
- Um usuário com `Profile` existente não passa novamente pela vinculação e não informa código em logins posteriores.
- A fronteira central de provisionamento passa a expor estados de onboarding: perfil pronto, vinculação necessária, configuração de vinculação pendente ou criação de workspace própria disponível.
- Um endpoint autenticado de status informa o estado sem criar perfil. Um endpoint autenticado de vinculação recebe somente o código e resolve email e `userId` pela sessão.
- O frontend usa uma rota dedicada de onboarding para a vinculação. A aplicação não libera áreas autenticadas enquanto uma vinculação obrigatória estiver pendente.
- Código ausente ou inválido não cria perfil, não cria workspace e não aceita convite. O usuário pode sair ou tentar novamente.
- Convite expirado bloqueia o onboarding até o admin cancelar ou recriar a intenção. Convite cancelado não bloqueia.
- A vinculação ocorre em uma transação: criação do perfil, aceitação do convite escolhido e marcação dos demais convites do email como `superseded`.
- O convite aceito conserva a role definida no convite, usando a role padrão do workspace quando aplicável. O usuário não escolhe sua própria role.
- O admin pode cancelar convites sem apagar o registro. A ação permite criar outro convite para o mesmo email.
- O limite de código é de cinco tentativas por usuário autenticado em quinze minutos. O contador é persistido no banco para funcionar após reinícios e entre instâncias.
- Registros de tentativa guardam somente identificadores, contador e janelas de tempo. O código informado nunca é armazenado. Registros antigos são removidos após 24 horas.
- O cadastro de email não exige confirmação global no Supabase Auth nesta fase. Email/senha retorna sessão imediatamente; Google continua disponível. O botão de magic link é removido da UI, mas a função isolada pode permanecer para uma alternativa futura.
- Recuperação de senha e alteração de email ficam fora da mudança e podem continuar usando os mecanismos atuais.
- A mensagem de sucesso existente “Convite enviado” permanece por decisão de produto. O botão muda para “Adicionar colaborador”, o carregamento para “Adicionando...” e a orientação informa que o colaborador deve criar conta e informar o código.
- A configuração do código usa a tela de Empresa existente, com label “Código de vinculação”, confirmação e aviso de que a troca invalida o código anterior.
- O fluxo de acesso somente leitura permanece separado.
- A implementação remove o envio de email de convite, a dependência de service role key para essa finalidade e a documentação de SMTP como caminho ativo.

## Testing Decisions

- Os testes devem verificar comportamento externo: estados de onboarding, respostas HTTP, transições de convite, autorização de admin, mensagens e efeitos persistidos. Não devem acoplar-se a helpers privados ou ao algoritmo específico de hash.
- Testar criação de convite sem qualquer chamada de email e rejeição quando o código do workspace não estiver configurado.
- Testar normalização de email, validade de sete dias e os estados `accepted`, `cancelled`, `expired` e `superseded`.
- Testar configuração do código por admin, rejeição por não-admin, confirmação divergente, tamanho mínimo e troca que invalida o código anterior.
- Testar `GET /api/onboarding/status` para perfil existente, convite válido, convite expirado, workspace sem código e ausência de convite.
- Testar vinculação por código usando somente o email da sessão, incluindo sucesso, email sem convite, código inválido, código ambíguo e código para workspace sem convite correspondente.
- Testar que uma tentativa inválida não cria perfil, workspace ou alteração de convite.
- Testar limite de cinco tentativas, bloqueio de quinze minutos, persistência do contador e limpeza lógica após a janela.
- Testar transação e comportamento idempotente em chamadas concorrentes de vinculação.
- Testar que o usuário sem convite continua recebendo um novo workspace e que usuário Auth sem perfil segue o mesmo caminho.
- Testar que usuário com perfil existente não é movido para outro workspace e que convite para email já vinculado é rejeitado.
- Testar que, após sucesso, o convite escolhido fica `accepted` e os demais ficam `superseded`.
- Testar o fluxo de callback Google e o cadastro com sessão imediata sem depender de confirmação de email.
- Testar a tela de vinculação, bloqueio do acesso antes do código, redirecionamento após sucesso e ausência do botão de magic link.
- Testar traduções pt-BR e inglês para os novos estados, labels e mensagens.
- Usar os testes existentes de rotas de perfil, callback de autenticação, convites, settings de workspace e AuthGate como padrão de mocks e comportamento.

## Out of Scope

- Configurar `docker-mailserver`, SMTP próprio, Coolify ou qualquer relay de email.
- Enviar emails de convite, confirmação de cadastro ou magic links nesta entrega.
- Criar um sistema definitivo de confirmação de posse de email.
- Suporte a um perfil pertencente a múltiplos workspaces.
- Permitir que o usuário escolha uma role.
- Alterar o fluxo de acesso somente leitura.
- Criar histórico visual de convites aceitos, cancelados, expirados ou superseded.
- Criar notificações in-app ou push para avisar o admin sobre a vinculação.
- Alterar recuperação de senha e alteração de email.
- Implementar CAPTCHA, MFA ou outra alternativa futura de confirmação.

## Further Notes

- A ausência de confirmação de email é uma decisão temporária e aceita um risco
  explícito: o email funciona como identificador, não como prova de posse. O
  código manual do workspace é a segunda parte do vínculo nesta fase.
- O código deve ser compartilhado fora da aplicação pelo admin. A aplicação não
  deve revelar nome de workspace ou quantidade de convites antes da validação.
- A configuração deve ser implantada em ordem: schema e serviços, API de
  onboarding, settings do código, convite sem email, AuthGate/tela de vínculo,
  traduções, migração de estados e testes finais.
