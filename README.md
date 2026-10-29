# Fluxus (Barber Fluxus)

SaaS de agendamento para barbearias e negócios de beleza, feito a partir da spec "SaaS de Barbearia baseado no Fluxus" e do UI kit Fluxus (versão 2, com cores AA).

O dono cria a loja, publica a página de agendamento, recebe reservas pelo site, confirma e lembra os clientes pelo WhatsApp, fecha o atendimento no caixa e acompanha comissões, fidelidade e relatórios.

## Como rodar

Requisitos: Node 22 e PostgreSQL 16.

```bash
cp .env.example .env          # ajuste DATABASE_URL e os segredos
npm install
npx prisma migrate deploy     # cria as tabelas
npm run db:seed               # opcional: loja de demonstração
npm run dev                   # http://localhost:3000
npm run worker                # em outro terminal: fila de WhatsApp, lembretes e campanhas
```

Contas do seed (senha `senha12345`):

| Conta | Papel |
| --- | --- |
| `ze@fluxus.dev` | Dono da Barbearia do Zé |
| `rafa@fluxus.dev` | Barbeiro da equipe |
| `cliente@fluxus.dev` | Cliente final |

Página pública de exemplo: `http://localhost:3000/barbearia-do-ze`.

Em desenvolvimento, sem gateway de WhatsApp configurado, as mensagens saem no log do servidor (`[whatsapp:simulado]`) e os e-mails também (`[email:simulado]`).

### Testar pelo celular (Render, grátis)

1. Entre em [render.com](https://render.com) com sua conta do GitHub.
2. Toque em **New** > **Blueprint** e escolha o repositório `barber-fluxus` (branch `main`).
3. Confirme em **Apply**. O Render cria o banco e o app sozinho; o primeiro deploy leva uns 5 a 10 minutos.
4. Abra o endereço `https://fluxus-xxxx.onrender.com` que aparece no serviço `fluxus`.

A loja de exemplo já vem criada (`/barbearia-do-ze`, login `ze@fluxus.dev` / `senha12345`). No plano grátis o app "dorme" depois de 15 minutos sem uso e leva uns 50 segundos para acordar, e o banco grátis expira depois de 30 dias. Sem WhatsApp configurado, as mensagens não são enviadas (aparecem como "não enviada" na tela de WhatsApp).

### Com Docker

```bash
cp .env.example .env   # preencha APP_SECRET, CRON_SECRET e WHATSAPP_GATEWAY_SECRET
docker compose up -d --build
```

Sobe o Postgres, o app (aplica as migrações ao iniciar), o worker e o gateway do WhatsApp.

### Testes

```bash
npm run typecheck
npm test                    # regras de negócio (48 testes)
npm run test:integration    # com banco: reservas simultâneas, caixa, mensagens, robô (13 testes)
cd services/whatsapp-gateway && npm test
```

Os testes de integração usam `TEST_DATABASE_URL` (padrão `postgresql://fluxus:fluxus@localhost:5432/fluxus_test`). Eles só aplicam migrações e criam uma loja nova por teste; nada é apagado. O CI (`.github/workflows/ci.yml`) roda tudo isso e o build a cada push.

## Stack

A spec deixava a stack em aberto (pergunta 23). A escolha foi um monolito em TypeScript, porque é um desenvolvedor só e o UI kit já é React:

| Parte | Tecnologia |
| --- | --- |
| App (painel, página da loja, API) | Next.js 16 (App Router, server actions), React 19, TypeScript |
| Banco | PostgreSQL + Prisma 6 |
| Worker | `scripts/worker.mjs`, chama `/api/cron/tick` a cada minuto |
| WhatsApp por QR Code | `services/whatsapp-gateway` (Node + Baileys), uma sessão por loja |
| WhatsApp oficial | API Cloud da Meta (envio + webhook) |
| Pagamentos do SaaS | Stripe por HTTP (checkout, portal, webhook) |
| E-mail | Resend |
| PWA | manifest, service worker, notificação push (web-push) |

## Organização

```
prisma/schema.prisma        modelo de dados (Shop é o tenant)
src/lib/domain/             regras puras e testadas: disponibilidade, fuso, status, planos,
                            permissões, comissão, fidelidade, lembretes, robô, telefone, CPF
src/server/                 serviços com banco: reserva, ciclo do agendamento, mensagens (fila),
                            caixa, estatísticas, Stripe, WhatsApp
src/components/ui/          componentes do UI kit portados para TSX (Button, Modal, TimeSlots...)
src/styles/                 tokens.css e fluxus.css copiados do UI kit + app.css (layout)
src/app/painel/             painel do dono e da equipe
src/app/[slug]/             página pública da loja com o fluxo de reserva
src/app/a/[token]/          link do cliente: ver, cancelar e avaliar
services/whatsapp-gateway/  conexão por QR Code
```

## O que a spec pedia para corrigir na base

| Ponto fraco do Fluxus | Como ficou |
| --- | --- |
| Loja = usuário dono | Tabela `Shop` (tenant); usuários entram por `Membership` com papel. O modelo já comporta várias lojas por dono (multiunidade) no futuro. |
| Cliente em 3 lugares | Um `Client` por loja, identificado pelo telefone, ligado ao agendamento e à conta quando existe. |
| Lembretes procuram o WhatsApp do barbeiro | Sessão, mensagens e configurações pertencem à loja e atendem a equipe toda. |
| Lembretes dependem de cron que o deploy não cria | Fila de saída (`ScheduledMessage`) + worker no `docker-compose`. Mensagens com retentativa e sem duplicata. |
| Estado do robô só na memória | `BotConversation` no banco. |
| Código do telefone não enviado | Removido: o cliente agenda só com nome e WhatsApp (decisão 6). |
| Convite lista qualquer usuário | Convite por link/e-mail com token de 7 dias. |
| Agendamento público não valida expediente | Tudo validado no servidor, com trava (advisory lock) por profissional e dia contra reserva dupla. |
| Flags de plano não aplicadas | Planos e recursos num só lugar (`src/lib/domain/plans.ts`), checados nas ações e nas telas. |
| Senha padrão do serviço de WhatsApp | O gateway não sobe sem `WHATSAPP_GATEWAY_SECRET`. |
| Grade fixa de 30 min, 1 turno, fuso fixo | Grade de 10/15/20/30 min, vários turnos por dia, intervalo entre clientes e fuso por loja. |
| Sem Docker, sem CI, < 20 linhas de teste | Dockerfiles, compose, GitHub Actions e 64 testes. |

## Cobertura da spec e do MVP (pergunta 25)

Feito:

- Cadastro de dono (CPF, antifraude do teste por CPF e IP) e de cliente, login com e-mail ou Google, verificação de e-mail e nova senha.
- Configurações da loja: dados, endereço com cidades do IBGE, fotos (até 5 MB), pagamentos, comodidades, redes, horários com turnos, regras da agenda, confirmação automática, exclusão de conta.
- Serviços com tipo, preço, duração (mín. 10, múltiplos de 5), quem faz, ordem e preço médio da região (cidade → estado → Brasil).
- Agenda do dia em grade com mini calendário, "Hoje", seletor de profissional, agendar manual com encaixe, remarcar, bloquear e resumo.
- Agendamentos com filtros (período do dia, status, datas, profissional), ordenação e ações; concluir e falta só depois do término.
- Bloqueios, fila de espera ativa (avisa os 3 primeiros quando vaga), avaliações (mostrar/ocultar).
- Clientes (CRM): busca, filtros (e-mail, aniversariantes, sumidos), histórico, observações, selos e indicação.
- Página pública: serviços somados, profissional ou "sem preferência", calendário, horários por período, confirmação sem precisar de conta, fila de espera, avaliações, link para Google Agenda.
- Área do cliente: Explorar (estado, cidade, nome; até 50 lojas com endereço e serviços), Meus agendamentos, link do agendamento para cancelar e avaliar.
- WhatsApp: QR Code (gateway) ou API oficial, robô com menu (agendar por link, confirmar, cancelar, atendente com pausa de 30 min), SIM/CANCELAR nos lembretes, anti-spam, histórico e fila.
- Mensagens automáticas editáveis: reserva recebida, confirmação, cancelamento, lembrete X horas antes, véspera, pedido de avaliação, aniversário, cliente sumido, fila de espera.
- Financeiro: caixa do dia (abrir/fechar com conferência, despesas, sangria, suprimento), vendas por forma de pagamento, produtos sem estoque, estorno, comissão por % , valor fixo ou aluguel de cadeira.
- Fidelidade: cartão de selos com prêmio no caixa, cupons (% ou R$, validade, limite) e indicação com bônus.
- Equipe (até 5 profissionais; recepcionista não conta), permissões por papel, comissão por pessoa.
- Relatórios por semana, mês ou ano comparando com o período anterior, top 5 serviços, horários de pico e ranking por profissional.
- Assinatura com teste de 7 dias, Stripe Checkout, portal e webhook; vencida bloqueia novas reservas e serviços.
- PWA instalável com notificação push de reserva nova e cancelamento.
- Tema claro e escuro, layout para celular (gaveta + navegação inferior, botão fixo na reserva).

Decisões em pontos que a spec deixou abertos (fáceis de mudar):

- **Cobrança (3):** valor fixo por loja em dois planos, Essencial R$ 39,90 (1 profissional) e Equipe R$ 119,90 (até 5). Sem plano grátis; teste de 7 dias com tudo liberado. Tudo em `src/lib/domain/plans.ts`.
- **IA atendente (17):** fora desta versão. Há o robô de menu.

Ainda não feito:

- Clube de assinatura do cliente e sinal por PIX (marcados para o lançamento, mas fora da lista do MVP: confirmar).
- Painel administrativo do SaaS (staff) e agente de IA de vendas (decisão 24: produto separado).
- Nota fiscal e marca branca (depois do lançamento).
- Agendamento passo a passo dentro do WhatsApp: o robô manda o link da página, que já faz o fluxo completo.

## Variáveis de ambiente

Veja `.env.example`. Em produção, `APP_SECRET` e `CRON_SECRET` são obrigatórios; o gateway exige `WHATSAPP_GATEWAY_SECRET` (mínimo 16 caracteres) igual nos dois serviços.
