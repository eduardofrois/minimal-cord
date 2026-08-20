# minimal-cord — Design do MVP

Data: 2026-08-20

## Objetivo

Criar o `minimal-cord`, um site leve para chamadas temporárias entre amigos, com foco em voz, compartilhamento de tela e entrada por link. O produto não será Electron e não terá contas. Cada pessoa define apenas um nome local antes de entrar na sala.

O MVP deve permitir:

- criar uma sala temporária;
- compartilhar um link/código da sala;
- permitir múltiplos participantes, mirando 10+ pessoas;
- conversar por voz;
- ligar/desligar câmera opcionalmente;
- permitir múltiplos compartilhamentos de tela simultâneos;
- enviar mensagens de texto temporárias dentro da sala;
- remover a sala automaticamente quando ela ficar vazia.

## Fora do escopo do MVP

- aplicativo desktop/Electron;
- contas, login, senhas ou perfis persistentes;
- banco de dados;
- histórico de chat;
- gravação de áudio, vídeo, tela ou mensagens;
- cargos, dono da sala, moderação ou permissões avançadas;
- Docker Compose;
- TURN obrigatório na primeira versão;
- plataforma completa estilo Discord com servidores/canais persistentes.

## Abordagem escolhida

A abordagem escolhida é um MVP enxuto com SFU completo:

- frontend em React + Vite + TypeScript;
- backend em Node.js + Fastify + WebSocket;
- mediasoup como SFU para suportar melhor 10+ participantes;
- salas temporárias em memória;
- chat temporário em memória;
- deploy direto em VPS com PM2 ou systemd;
- STUN público no MVP, com documentação para adicionar TURN/Coturn depois.

Essa opção é mais complexa do que uma chamada mesh simples, mas evita que o MVP nasça limitado a poucos participantes. A opção de plataforma completa foi deixada para depois para manter o escopo controlado.

## Arquitetura

O projeto será um monorepo simples:

```text
minimal-cord/
  apps/
    web/
    server/
  packages/
    shared/
  docs/
    superpowers/
      specs/
```

### `apps/web`

Aplicação React/Vite/TypeScript responsável pela interface do usuário.

Principais telas:

- home com campo de nome local;
- botão para criar sala;
- campo para entrar por código/link;
- sala com lista de participantes;
- tiles de câmera e tela;
- controles de microfone, câmera e compartilhamento de tela;
- chat lateral ou painel simples de mensagens temporárias.

### `apps/server`

Servidor Node.js com Fastify, WebSocket e mediasoup.

Responsabilidades:

- criar salas temporárias;
- aceitar entrada de participantes por `roomId`;
- manter participantes em memória;
- transmitir eventos de presença;
- rotear mensagens de chat;
- coordenar signaling WebRTC;
- criar e gerenciar transports, producers e consumers do mediasoup;
- limpar recursos de mídia e sala quando participantes saírem.

### `packages/shared`

Pacote TypeScript compartilhado entre frontend e backend.

Responsabilidades:

- tipos de eventos WebSocket;
- modelos de sala e participante;
- payloads de signaling;
- tipos de mensagens de chat;
- constantes compartilhadas, como limite padrão de participantes.

## Fluxo de sala e link

O usuário cria uma sala e recebe um `roomId` curto e aleatório. O link terá formato parecido com:

```text
https://seu-dominio.com/r/<roomId>
```

Qualquer pessoa com o link pode entrar. Não existe dono, senha ou aprovação de entrada no MVP.

Fluxo principal:

1. Usuário abre o site.
2. Usuário define um nome local.
3. Usuário cria uma sala ou entra por link/código.
4. Frontend abre conexão WebSocket com o backend.
5. Backend adiciona o participante à sala em memória.
6. Backend notifica os outros participantes.
7. Cliente e servidor negociam mídia via mediasoup.
8. Chat usa a mesma conexão WebSocket da sala.
9. Quando o último participante sai, a sala é removida da memória.

## Fluxo de mídia

O cliente entra na sala e estabelece WebRTC por meio do mediasoup.

### Áudio

- Cada usuário pode publicar o áudio do microfone.
- Cada usuário recebe o áudio dos demais participantes.
- O usuário controla apenas o próprio microfone.

### Câmera

- A câmera é opcional.
- O usuário pode ligar/desligar quando quiser.
- Vídeos de câmera aparecem como tiles normais na sala.

### Compartilhamento de tela

- Cada usuário pode iniciar compartilhamento de tela.
- Vários usuários podem compartilhar a tela ao mesmo tempo.
- Compartilhamentos de tela aparecem em tiles destacados.
- O usuário controla apenas o próprio compartilhamento.

O backend não grava mídia. Ele apenas mantém o signaling, o roteamento via SFU e o estado temporário necessário para a sala funcionar.

## Chat temporário

O chat do MVP será simples e temporário.

- Mensagens são enviadas por WebSocket.
- Mensagens são distribuídas apenas para participantes da sala.
- O servidor pode manter mensagens apenas enquanto a sala existir, se isso for útil para novos participantes durante a sessão.
- Quando a sala é removida, as mensagens desaparecem.
- Não haverá histórico persistente nem banco de dados.

## Erros, limites e segurança

### Erros tratados

- Sala inexistente: exibir “sala não encontrada”.
- Permissão negada de microfone, câmera ou tela: exibir aviso e permitir tentar novamente.
- Queda de conexão: tentar reconectar WebSocket e limpar mídia antiga.
- Navegador sem suporte a WebRTC ou screen share: exibir aviso claro.
- Sala cheia: bloquear entrada e mostrar mensagem de limite atingido.

### Limites

- Limite padrão de participantes: 20 por sala.
- O limite deve ser configurável no backend.
- Como o estado é em memória, reiniciar o servidor encerra salas ativas.

### Segurança do MVP

- Links de sala usam IDs aleatórios difíceis de adivinhar.
- Sem login, senha ou autorização por papel.
- Quem tem o link pode entrar.
- O servidor não grava áudio, vídeo, tela nem chat.
- HTTPS/WSS é obrigatório no deploy real, porque WebRTC e screen share dependem de contexto seguro.

## Deploy

O deploy alvo é uma VPS rodando Node.js diretamente.

Estratégia inicial:

- build do frontend com Vite;
- servidor Fastify servindo API/WebSocket e, se conveniente, os arquivos estáticos do frontend;
- processo Node gerenciado por PM2 ou systemd;
- proxy reverso com Nginx/Caddy para HTTPS e WSS;
- configuração de portas UDP/TCP necessárias para mediasoup;
- STUN público configurado no cliente;
- documentação de TURN/Coturn como melhoria futura para redes restritivas.

## Testes e verificação

### Testes automatizados

- Testes de tipos e build TypeScript.
- Testes unitários para criação e remoção de salas.
- Testes unitários para entrada e saída de participantes.
- Testes unitários para limite de participantes.
- Testes de eventos WebSocket principais: criar sala, entrar, sair e enviar chat.
- Testes de componentes básicos do frontend: home, formulário de nome, entrada por sala, botões de mídia e chat.

### Verificação manual obrigatória

Antes de considerar o MVP funcional, testar manualmente:

1. abrir 2–3 abas, navegadores ou dispositivos;
2. entrar na mesma sala por link;
3. confirmar presença dos participantes;
4. testar áudio;
5. ligar/desligar câmera;
6. iniciar mais de um compartilhamento de tela simultâneo;
7. enviar mensagens no chat;
8. sair com todos os usuários e confirmar remoção da sala;
9. rodar build e iniciar servidor como seria feito na VPS.

Automação completa de mídia WebRTC multiusuário não faz parte do MVP inicial, porque adicionaria custo alto antes de validar o produto.

## Critérios de aceite do MVP

O MVP estará pronto quando:

- o usuário conseguir criar uma sala temporária;
- outro usuário conseguir entrar por link/código;
- múltiplos usuários conseguirem ficar na mesma sala;
- áudio funcionar entre participantes;
- câmera opcional funcionar;
- múltiplos compartilhamentos de tela simultâneos funcionarem;
- chat temporário funcionar dentro da sala;
- sala desaparecer quando ficar vazia;
- o projeto tiver build e execução local documentados;
- houver instruções de deploy direto em VPS com PM2 ou systemd;
- os testes automatizados básicos passarem;
- a verificação manual principal for executada com sucesso.

## Decisões adiadas

- Coturn/TURN obrigatório.
- Persistência de salas ou chat.
- Contas de usuário.
- Moderação, expulsar usuário ou sala com dono.
- Canais persistentes.
- Gravação.
- App desktop.
- Testes automatizados completos de WebRTC multiusuário.
