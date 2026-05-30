# VoxMeet — App de Transcrição de Reuniões com IA

> Transcreva, resuma e analise reuniões automaticamente usando Groq Whisper + Gemini 2.5 Flash. Disponível como web app e APK Android nativo.

**Produção:** https://voxmeet.vercel.app  
**Repositório:** https://github.com/HABILMS/app-voxmeet  
**Admin:** https://voxmeet.vercel.app/admin (consultoriaetims@gmail.com)

---

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS |
| Animações | Motion/React (Framer Motion) |
| Backend | Express (local) + Vercel Serverless Functions (`/api/`) |
| Banco de dados | Firebase Firestore |
| Autenticação | Firebase Auth (Google + Email/senha) |
| Transcrição | Groq Whisper (`whisper-large-v3-turbo`) |
| IA Resumo/Chat | Gemini 2.5 Flash (`gemini-2.5-flash`) |
| Pagamentos | Asaas (Pix) |
| Mobile | Capacitor Android (APK instalável) |
| Deploy | Vercel (web) + Android Studio (APK) |
| Backup áudio | IndexedDB (browser) |

---

## Estrutura de Arquivos

```
src/
  App.tsx                     — rotas + ErrorBoundary
  types.ts                    — tipos, planos, retentionDays, calcExpiresAt
  pages/
    LandingPage.tsx            — landing + AuthModal
    Dashboard.tsx              — app principal
    AdminPanel.tsx             — painel admin
  components/
    AuthModal.tsx              — login email/senha + Google (web only)
    MeetingRecorder.tsx        — gravação + upload + pausa + tempo limite
    MeetingDetail.tsx          — detalhes + TTS + chat IA + resumo
    MeetingList.tsx            — lista com busca + editar + excluir
    PremiumOverlay.tsx         — planos + Pix Asaas + CPF
    AudioRecovery.tsx          — recuperação de áudio do IndexedDB
    FAQView.tsx                — perguntas frequentes
  hooks/
    useTranscription.ts        — gravação + IndexedDB backup + raw/clean
  services/
    groqService.ts             — Whisper + limpeza inteligente + Gemini
  lib/
    firebase.ts                — config Firebase
    utils.ts                   — cn()
api/
  checkout.ts                  — Vercel Function: gera cobrança Pix Asaas
  webhook.ts                   — Vercel Function: confirma pagamento
  check.ts                     — Vercel Function: verifica status pagamento
android/
  app/src/main/
    AndroidManifest.xml        — permissões RECORD_AUDIO, INTERNET etc.
    java/com/voxmeet/app/
      MainActivity.java        — BridgeActivity Capacitor
expireMeetings.ts              — Cloud Function Firebase (deploy pendente)
```

---

## Planos e Preços

| Plano | Preço | Minutos | Reuniões | Retenção |
|-------|-------|---------|----------|----------|
| Starter | Grátis | 60/mês | 5 | 7 dias |
| Pro | R$ 9,99/mês | 300/mês | 30 | 90 dias |
| Ultra | R$ 19,99/mês | Ilimitado | Ilimitado | 1 ano |
| Power | R$ 49,99/mês | Ilimitado | Ilimitado | Ilimitado |

Planos legados `pro_monthly` e `pro_annual` mantidos no `types.ts` para compatibilidade com Firestore.

---

## Funcionalidades Implementadas

### Gravação e Transcrição
- ✅ Gravação via microfone (mobile e desktop)
- ✅ Captura de áudio do sistema/meeting (desktop — modo Meeting)
- ✅ Upload de áudio (MP3, M4A, WAV, OGG, FLAC, WebM)
- ✅ Transcrição Groq Whisper com chunks de 24MB
- ✅ Transcrição dual: `transcript` (crua) + `transcriptClean` (otimizada ~40% menor)
- ✅ Limpeza inteligente: remove ruídos, hesitações e fragmentos curtos
- ✅ Pausa e retomada durante gravação
- ✅ Contador de tempo com barra de progresso
- ✅ Parada automática ao atingir limite do plano
- ✅ Aviso 5 minutos antes do limite
- ✅ Backup automático no IndexedDB antes de transcrever
- ✅ Recuperação de áudio após erro de transcrição

### IA
- ✅ Resumo executivo + Action Items (Gemini 2.5 Flash)
- ✅ Chat com a transcrição (perguntas livres)
- ✅ Prompt otimizado para atas formais com template completo
- ✅ TTS: botão "Ouvir" no resumo e no chat (Web Speech API)
- ✅ Sugestões rápidas de prompts no chat

### Gestão de Reuniões
- ✅ Salvar reunião no Firestore com expiresAt por plano
- ✅ Editar título inline
- ✅ Excluir com confirmação
- ✅ Exportar TXT completo (resumo + transcrição)
- ✅ Copiar transcrição para clipboard
- ✅ Identificação de fonte (WhatsApp, Meet, Zoom, Upload, Mic)

### Autenticação e Usuários
- ✅ Login Google (web)
- ✅ Login email/senha (web + Android nativo)
- ✅ Criar conta + recuperar senha por email
- ✅ Perfil do usuário no Firestore
- ✅ Indicador de minutos usados no mês

### Pagamentos
- ✅ Integração Asaas (Pix)
- ✅ QR Code + Pix copia e cola
- ✅ CPF obrigatório no checkout
- ✅ Webhook recebe confirmação de pagamento
- ✅ Verificação de status a cada 5s

### Admin
- ✅ Painel `/admin` exclusivo (consultoriaetims@gmail.com)
- ✅ Lista todos os usuários com plano, minutos e reuniões
- ✅ Alterar plano manualmente
- ✅ Busca por email/nome

### Android (Capacitor)
- ✅ App instalável com ícone na tela inicial
- ✅ Login email/senha nativo (funciona em WebView)
- ✅ Gravação de microfone nativa
- ✅ Permissões: RECORD_AUDIO, INTERNET, FOREGROUND_SERVICE
- ✅ SHA1 debug: `46:BE:2E:78:17:C0:28:0E:BD:10:FA:66:4A:C8:06:1D:95:80:07:52`

---

## Variáveis de Ambiente

### `.env.local` (desenvolvimento)
```env
VITE_GROQ_API_KEY=gsk_...
VITE_GEMINI_API_KEY=AIza...
ASAAS_API_KEY=$aact_prod_...
ASAAS_WEBHOOK_TOKEN=...
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

### Vercel (produção)
Mesmas variáveis configuradas em:
https://vercel.com/vander-limas-projects/voxmeet/settings/environment-variables

---

## Configuração Firebase

- **Projeto:** `gen-lang-client-0396410617`
- **App ID Android:** `com.voxmeet.app`
- **Auth providers:** Google + Email/senha
- **Domínios autorizados:** `voxmeet.vercel.app`, `localhost`
- **Regras Firestore:** admin tem acesso total via `isAdmin()` com email `consultoriaetims@gmail.com`

### Regras Firestore atuais
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null && request.auth.token.email == 'consultoriaetims@gmail.com';
    }
    match /users/{userId} {
      allow read, write: if isAdmin() || (request.auth != null && request.auth.uid == userId);
      match /meetings/{meetingId} {
        allow read, write: if isAdmin() || (request.auth != null && request.auth.uid == userId);
      }
    }
    match /payments/{paymentId} {
      allow read: if isAdmin() || (request.auth != null && request.auth.uid == resource.data.userId);
      allow write: if false;
    }
  }
}
```

---

## Asaas (Pagamentos)

- **Ambiente:** Produção
- **Webhook URL:** `https://voxmeet.vercel.app/api/webhook`
- **Eventos configurados:** `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`
- **API Version:** v3
- **Fila de sincronização:** Ativada

---

## Fluxo de Dados

```
[Usuário grava/faz upload]
         ↓
[Blob salvo no IndexedDB como backup]
         ↓
[Groq Whisper — transcrição em chunks de 24MB]
         ↓
[Limpeza inteligente — remove ruídos/hesitações]
         ↓
[Firestore — salva transcript (crua) + transcriptClean + expiresAt]
         ↓
[Backup deletado do IndexedDB após sucesso]
         ↓
[Gemini 2.5 Flash — resumo + action items sob demanda]
         ↓
[Firestore — atualiza com summary + actionItems]
```

---

## Pendências / Próximos Passos

| Item | Status |
|------|--------|
| Deploy Cloud Function `expireMeetings.ts` | ⏳ Pendente |
| Configurar `FIREBASE_SERVICE_ACCOUNT` no Vercel | ⏳ Pendente |
| APK de release assinado para distribuição | ⏳ Pendente |
| Busca entre reuniões | ⏳ Planejado |
| Captura de áudio interno em chamadas (Android) | ⏳ Limitação do OS |

---

## Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Rodar localmente
npm run dev

# Build produção
npm run build

# Sincronizar com Android
npx cap sync android

# Abrir no Android Studio
npx cap open android
```

## Deploy

```bash
git add .
git commit -m "mensagem"
git push
vercel --prod
```

---

## Histórico de Decisões Técnicas

- **Groq → apenas transcrição:** Whisper é o melhor modelo de transcrição; limite de 12k tokens/min inviabiliza uso para resumo
- **Gemini 2.5 Flash → resumo/chat:** 1M tokens de contexto, free tier 1.500 req/dia, sem erros de limite
- **IndexedDB → backup local:** evita perda de gravações quando a transcrição falha (erro 400/timeout)
- **transcriptClean → Firestore:** reduz ~40% dos tokens enviados à IA sem perder conteúdo semântico
- **Email/senha → Android:** Google Sign-In não funciona em WebView; email/senha é nativo e confiável
- **Capacitor server.url removido:** app usa `dist` local para evitar problemas de redirect no Firebase Auth
- **WebM sem chunks:** formato WebM não pode ser dividido; MAX_CHUNK_SIZE = 24MB para evitar erro 400
