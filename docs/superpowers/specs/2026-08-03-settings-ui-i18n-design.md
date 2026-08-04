# Configurações: harmonização visual e i18n

## Objetivo

Corrigir a composição visual das telas autenticadas de Configurações e eliminar textos de tradução exibidos como chaves. A entrega mantém a identidade atual do SeOrganize+, sem alterar APIs, banco ou fluxo de permissões.

## Escopo

- `/settings`
- `/settings/profile`
- `/settings/team`
- `/settings/areas`
- `/settings/workspace`
- `/settings/roles`
- mensagens `pt-BR` e `en`
- componentes compartilhados de shell, seção e modal

## Direção visual aprovada

Produto SaaS administrativo, claro, calmo e denso o suficiente para trabalho diário. Manter fundo azul-cinza, texto navy, acento azul e bordas suaves existentes. Harmonizar por meio de uma largura central consistente, ritmo de espaçamento único, títulos alinhados, ações no mesmo eixo e cards com a mesma linguagem.

Não introduzir nova paleta, fontes, gradientes, animações decorativas ou redesign completo.

## Layout

Criar um shell compartilhado com:

- `min-h-full`, padding responsivo e conteúdo centralizado em `max-w-5xl`;
- cabeçalho com título, descrição e ação opcional;
- link de retorno consistente nas subpáginas;
- seções com borda, fundo e espaçamento padronizados;
- cards de configuração em duas colunas a partir de `sm`, com uma coluna no mobile.

O editor de role continuará modal, mas terá cabeçalho, corpo rolável e rodapé fixo dentro do viewport. A lista de permissões permanecerá funcional e acessível.

## Internacionalização

As traduções de permissões com IDs como `financial.overview` serão representadas como objetos aninhados nos dois locales. Isso preserva os IDs de autorização e permite que `next-intl` resolva `modules.financial.overview` e `special.financial.contracts.lifecycle`.

Adicionar cobertura de integridade para garantir:

- paridade entre locales;
- ausência de chaves de permissão achatadas como propriedades literais com pontos;
- labels de módulos e permissões especiais resolvíveis.

## Acessibilidade e estados

- links e botões continuam com foco visível e área mínima de toque existente;
- labels permanecem associados aos controles;
- modal mantém foco gerenciado pelo Radix Dialog;
- estados de loading, erro, vazio e sucesso permanecem traduzidos;
- nenhum texto visível novo será hard-coded.

## Critérios de aceite

1. Todas as telas de Configurações usam a mesma largura, header, retorno e ritmo vertical.
2. Cards e formulários não ocupam largura excessiva nem ficam desalinhados em desktop.
3. Editor de role mantém ações visíveis sem depender de rolagem até o fim da página.
4. Labels exibidos nos screenshots deixam de aparecer como chaves técnicas em `pt-BR` e `en`.
5. Testes, lint, typecheck e build passam.
