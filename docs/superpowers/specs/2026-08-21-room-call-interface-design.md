# minimal-cord - Design da interface de call

Data: 2026-08-21

## Objetivo

Refinar a tela da sala para ficar mais próxima de uma call minimalista estilo Discord, com foco em mídia ativa. A tela deve destacar quem estiver compartilhando tela ou com câmera aberta, reduzir o peso visual do chat e oferecer controles claros para microfone, câmera, compartilhamento de tela, tela cheia e desconexão.

## Escopo

- Adicionar controle de mutar/desmutar microfone.
- Adicionar controle de desconectar da call.
- Adicionar controle para parar compartilhamento de tela local.
- Adicionar controle para colocar compartilhamento de tela em tela cheia.
- Reduzir largura, padding e peso visual do chat.
- Reorganizar mídia para ter um destaque principal e tiles menores de participantes.
- Manter a arquitetura atual em React, sem alterar backend ou protocolo WebSocket.

## Fora do escopo

- Criar canais, servidores ou estrutura persistente estilo Discord.
- Adicionar permissões, dono da sala ou moderação.
- Adicionar chat recolhível em drawer.
- Persistir preferências de layout.
- Implementar tela cheia remota por controle de outro usuário.

## Abordagem escolhida

A interface da sala será reorganizada em três regiões:

- área principal de call, ocupando a maior parte da tela;
- coluna lateral compacta com participantes e chat;
- barra de controles fixa dentro da área da call.

A área principal terá um tile destacado. A prioridade do destaque será:

1. compartilhamento de tela local;
2. compartilhamento de tela remoto;
3. câmera local;
4. câmera remota;
5. estado vazio quando não houver vídeo ou tela.

Os demais vídeos ficam em tiles menores, preservando a sensação de quadradinhos dos usuários na call. Essa abordagem reaproveita os streams e remote tracks já existentes em `MediaGrid`, adicionando apenas uma seleção de layout no frontend.

## Componentes

### `RoomPage`

Continua coordenando conexão, mídia local e mídia remota. Passa para os controles:

- estado do microfone;
- estado da câmera;
- quantidade de telas locais;
- ação de alternar microfone;
- ação de alternar câmera;
- ação de iniciar compartilhamento;
- ação de parar compartilhamentos locais;
- ação de desconectar.

Desconectar significa enviar a saída natural da página navegando para `/`. O unmount dos hooks atuais já encerra streams locais e fecha a conexão da sala.

### `MediaGrid`

Passa a renderizar um palco principal e uma fileira/grid de tiles menores. O componente deve:

- transformar câmera local, telas locais e vídeos remotos em uma lista normalizada de tiles;
- escolher o tile destacado pela prioridade definida;
- renderizar os outros tiles como participantes menores;
- expor botões de tile apenas onde fazem sentido, como tela cheia para o tile destacado de screen share.

Para tela cheia, será usado `requestFullscreen()` no elemento de vídeo do compartilhamento de tela. Se o navegador bloquear ou não suportar o recurso, a ação falha silenciosamente sem quebrar a call.

### `MediaControls`

Os controles ficam mais compactos e explícitos:

- microfone: `Mutar` quando ligado e `Desmutar` quando desligado;
- câmera: `Desligar câmera` ou `Ligar câmera`;
- tela: `Compartilhar tela`;
- parar tela: visível quando houver compartilhamento local ativo;
- desconectar: botão vermelho.

O botão de parar tela encerra todos os compartilhamentos locais ativos para manter a primeira versão simples e previsível.

### `ChatPanel` e `ParticipantList`

Os painéis laterais ficam menores e mais discretos:

- chat com largura menor;
- mensagens com fonte e espaçamento reduzidos;
- input compacto;
- participantes em painel menor, acima do chat.

Em telas estreitas, a sala volta para uma coluna única, com área de mídia primeiro e painéis abaixo.

## Erros e estados vazios

- Se não houver câmera nem tela ativa, o palco mostra uma mensagem compacta de estado vazio.
- Erros de permissão de microfone, câmera ou tela continuam usando o `mediaError` atual.
- Se tela cheia não for suportada, nenhum erro visual novo será exibido.
- Se o usuário desconectar, ele retorna para a home.

## Testes e verificação

Verificação automatizada:

- build do frontend;
- testes existentes, se disponíveis sem dependências extras.

Verificação manual recomendada:

1. entrar em uma sala;
2. ligar e desligar microfone;
3. ligar câmera e confirmar destaque;
4. iniciar compartilhamento e confirmar destaque;
5. parar compartilhamento pela UI;
6. usar tela cheia no compartilhamento;
7. enviar mensagens e confirmar chat compacto;
8. desconectar e confirmar retorno para a home.
