# cc-telegram

[![npm version](https://badge.fury.io/js/cc-telegram.svg)](https://www.npmjs.com/package/cc-telegram)
[![GitHub](https://img.shields.io/github/license/hada0127/cc-telegram)](https://github.com/hada0127/cc-telegram)

🌍 **Language / 언어 / 语言**:
[English](README.md) | [한국어](README.ko.md) | [中文](README.zh.md) | [Español](README.es.md) | [हिन्दी](README.hi.md) | [العربية](README.ar.md) | [Português](README.pt.md) | [Русский](README.ru.md) | [日本語](README.ja.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

**GitHub**: [https://github.com/hada0127/cc-telegram](https://github.com/hada0127/cc-telegram)

---

Execução remota do Claude Code via bot do Telegram.

Controle o Claude Code de qualquer lugar usando seu aplicativo Telegram. Crie tarefas, monitore o progresso e receba notificações de conclusão - tudo do seu telefone.

## Recursos

- **Execução Remota de Tarefas**: Envie tarefas de codificação para o Claude Code via Telegram
- **Execução Paralela**: Execute múltiplas tarefas simultaneamente (configurável)
- **Sistema de Prioridades**: Níveis de prioridade Urgente, Alta, Normal, Baixa
- **Tentativa Automática**: Tentativa automática em caso de falha com tentativas configuráveis
- **Status em Tempo Real**: Monitore o progresso das tarefas e a saída do Claude
- **Rotação de Logs**: Limpeza automática de logs antigos e tarefas concluídas

## Requisitos

- Node.js 18.0.0 ou superior
- [Claude Code CLI](https://claude.ai/claude-code) instalado e autenticado
- Conta do Telegram

## Instalação

```bash
npx cc-telegram
```

Ou instalar globalmente:

```bash
npm install -g cc-telegram
cc-telegram
```

## Configuração Inicial

Na primeira execução, o cc-telegram irá guiá-lo através do processo de configuração:

1. **Criar um Bot do Telegram**
   - Abra o Telegram e procure por [@BotFather](https://t.me/BotFather)
   - Envie `/newbot` e siga as instruções
   - Copie o token do bot fornecido

2. **Inserir Token do Bot**
   - Cole seu token do bot quando solicitado
   - A ferramenta verificará se o token é válido

3. **Vincular Sua Conta**
   - Abra seu novo bot no Telegram
   - Envie `/start` para o bot
   - O CLI detectará sua mensagem e exibirá seu chat ID
   - Insira o chat ID para confirmar

4. **Configurar Definições**
   - Defina a contagem padrão de tentativas (recomendado: 15)
   - Habilite/desabilite a execução paralela
   - Defina o máximo de tarefas concorrentes (se paralela habilitada)

Sua configuração é armazenada localmente em `.cc-telegram/config.json` (criptografado).

## Uso

Após a configuração, simplesmente execute:

```bash
npx cc-telegram
```

O bot iniciará e aguardará comandos da sua conta do Telegram.

## Comandos do Telegram

| Comando | Descrição |
|---------|-----------|
| `/new` | Criar uma nova tarefa |
| `/list` | Ver tarefas pendentes e em progresso |
| `/completed` | Ver tarefas concluídas |
| `/failed` | Ver tarefas falhadas |
| `/status` | Verificar status de execução atual e cancelar tarefas em execução |
| `/debug` | Ver informações do sistema |
| `/cancel` | Cancelar fluxo de criação de tarefa |
| `/reset` | Redefinir todos os dados (com confirmação) |

## Criando Tarefas

### Tarefas Simples
Para execução única sem critérios de conclusão:

1. Envie `/new`
2. Selecione "Simples (sem critérios de conclusão, sem tentativa)"
3. Insira seu requisito
4. A tarefa é enfileirada imediatamente

### Tarefas Complexas
Para tarefas com critérios de conclusão e tentativa automática:

1. Envie `/new`
2. Selecione "Complexa (com critérios de conclusão e tentativa)"
3. Insira seu requisito
4. Insira os critérios de conclusão (ex: "Todos os testes passam")
5. Selecione o nível de prioridade
6. Escolha a contagem de tentativas (10 ou personalizado)

**Modo Plan**: Tarefas complexas executam automaticamente o Claude em modo plan (opção `--permission-mode plan`). Isso permite que o Claude projete uma abordagem de implementação antes de executar, resultando em melhores resultados para requisitos complexos.

### Anexos de Arquivos

Você pode anexar arquivos ao inserir requisitos ou critérios de conclusão:

1. Quando solicitado para requisitos/critérios, primeiro envie seus arquivos (imagens, documentos, etc.)
2. Uma mensagem de confirmação aparecerá para cada arquivo anexado
3. Em seguida, insira seus requisitos/critérios como texto
4. Os arquivos anexados serão passados ao Claude junto com a tarefa

**Nota**: Os arquivos anexados são automaticamente excluídos quando a tarefa é concluída, falha ou é cancelada.

## Prioridade de Tarefas

Tarefas são executadas em ordem de prioridade:

| Prioridade | Ícone | Descrição |
|------------|-------|-----------|
| Urgente | 🔴 | Executar primeiro |
| Alta | 🟠 | Alta prioridade |
| Normal | 🟢 | Prioridade padrão |
| Baixa | 🔵 | Executar quando ocioso |

## Execução Paralela

Quando habilitada durante a configuração, múltiplas tarefas podem ser executadas simultaneamente:

- Configure o máximo de tarefas concorrentes (1-10)
- Cada tarefa mostra seu prefixo de ID na saída do console
- `/status` mostra todas as tarefas em execução com botões de parar para cancelá-las
- Tarefas de maior prioridade ainda obtêm slots primeiro

### Cancelar Tarefas em Execução

Você pode cancelar tarefas que estão atualmente em execução:

1. Envie `/status` para ver as tarefas em execução
2. Cada tarefa em execução exibe um botão "Parar"
3. Clique no botão para encerrar a tarefa imediatamente
4. A tarefa cancelada será marcada como falhada

### Saída do Console (Modo Paralelo)

```
[a1b2c3d4] Iniciando tarefa...
[e5f6g7h8] Compilando projeto...
[a1b2c3d4] Testes aprovados!
```

## Configuração

A configuração é armazenada em `.cc-telegram/config.json`:

| Definição | Descrição | Padrão |
|-----------|-----------|--------|
| `botToken` | Token do bot do Telegram (criptografado) | - |
| `chatId` | Seu chat ID do Telegram (criptografado) | - |
| `debugMode` | Habilitar log de depuração | `false` |
| `claudeCommand` | Comando CLI do Claude personalizado | `null` (auto-detectar) |
| `logRetentionDays` | Dias para manter arquivos de log | `7` |
| `defaultMaxRetries` | Contagem padrão de tentativas | `15` |
| `parallelExecution` | Habilitar execução paralela | `false` |
| `maxParallel` | Máximo de tarefas concorrentes | `3` |

### Comando Claude Personalizado

Se o Claude CLI estiver instalado em um local não padrão:

```json
{
  "claudeCommand": "npx @anthropic-ai/claude-code"
}
```

## Estrutura de Diretórios

```
.cc-telegram/
├── config.json      # Configuração criptografada
├── tasks.json       # Índice de tarefas pendentes
├── completed.json   # Índice de tarefas concluídas
├── failed.json      # Índice de tarefas falhadas
├── tasks/           # Arquivos de tarefas individuais
├── completed/       # Detalhes de tarefas concluídas
├── failed/          # Detalhes de tarefas falhadas
└── logs/            # Arquivos de log diários
```

## Detecção de Conclusão

O Claude Code sinaliza a conclusão de tarefas usando marcadores especiais:

- `<promise>COMPLETE</promise>` - Tarefa concluída com sucesso
- `<promise>FAILED</promise>` - Tarefa falhou com motivo

Se nenhum sinal for detectado, o sistema usa correspondência de padrões para determinar sucesso ou falha baseado no conteúdo de saída.

## Gerenciamento de Logs

- Arquivos de log são criados diariamente: `YYYY-MM-DD.log`
- Logs antigos são automaticamente excluídos após `logRetentionDays`
- Arquivos de tarefas concluídas/falhadas são limpos após 30 dias

## Segurança

- Token do bot e chat ID são criptografados usando AES-256-GCM
- Apenas mensagens do seu chat ID registrado são processadas
- Todos os dados são armazenados localmente no diretório do seu projeto

## Solução de Problemas

### Bot não responde
- Certifique-se de que o bot está em execução (`npx cc-telegram`)
- Verifique se seu chat ID corresponde ao configurado
- Verifique a conexão com a internet

### Claude Code não encontrado
- Certifique-se de que o Claude CLI está instalado: `npm install -g @anthropic-ai/claude-code`
- Ou defina um comando personalizado na config: `"claudeCommand": "npx @anthropic-ai/claude-code"`

### Tarefas presas em progresso
- Ao reiniciar, tarefas órfãs são automaticamente redefinidas para status "ready"
- Use `/reset` para limpar todos os dados se necessário

## Licença

MIT
