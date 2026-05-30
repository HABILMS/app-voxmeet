// src/components/FAQView.tsx — VoxMeet
import { HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

const faqs = [
  {
    topic: "Gravação e Transcrição",
    questions: [
      {
        q: "Como gravar uma reunião no computador?",
        a: "Clique em 'Iniciar Gravação' e selecione o modo 'Meeting'. O navegador pedirá para escolher o que compartilhar — selecione a aba ou janela da reunião e marque 'Compartilhar áudio'. Funciona com Google Meet, Zoom, Teams e qualquer outra plataforma."
      },
      {
        q: "Como gravar uma chamada no celular?",
        a: "No celular, o VoxMeet capta o áudio pelo microfone. Para gravar todos os participantes, coloque a chamada no viva-voz e inicie a gravação. Outra opção é usar o gravador nativo do celular durante a chamada e depois fazer o upload do arquivo no VoxMeet."
      },
      {
        q: "Quais formatos de áudio posso fazer upload?",
        a: "MP3, M4A, WAV, OGG, FLAC e WebM. Basta clicar no ícone de upload na tela de gravação e selecionar o arquivo."
      },
      {
        q: "Por que algumas palavras não são transcritas corretamente?",
        a: "A precisão depende da qualidade do áudio, ruído de fundo e sotaque. Fale claramente e use um microfone de qualidade. O Groq Whisper tem excelente suporte ao português brasileiro."
      },
      {
        q: "Preciso selecionar o idioma antes de gravar?",
        a: "Não é obrigatório — o Whisper detecta o idioma automaticamente. Mas se quiser forçar um idioma específico, use o seletor na tela de gravação."
      }
    ]
  },
  {
    topic: "Tradução de Reuniões",
    questions: [
      {
        q: "O VoxMeet consegue traduzir reuniões em outros idiomas?",
        a: "Sim! Após gravar ou fazer upload de um áudio em qualquer idioma, abra a reunião salva, clique em 'Chat IA' e use o botão 'Traduzir' — ou escreva no chat: 'Traduza para o português'. O Gemini suporta mais de 100 idiomas."
      },
      {
        q: "Como pedir a tradução de uma reunião em inglês?",
        a: "Após a transcrição, vá em Chat IA e clique no botão 'Traduzir para Português' — ou escreva livremente: 'Faça uma ata formal em português desta reunião em inglês'. Você também pode pedir: 'Traduza apenas os pontos principais' ou 'Quais foram as decisões tomadas? Responda em português'."
      },
      {
        q: "Posso pedir tradução para outros idiomas além do português?",
        a: "Sim! No Chat IA escreva o idioma desejado: 'Traduza para o espanhol', 'Faça o resumo em inglês', 'Ata formal em francês'. O Gemini traduz com alta qualidade para qualquer idioma."
      },
      {
        q: "A tradução altera a transcrição original?",
        a: "Não. A tradução é gerada apenas na resposta do Chat IA e pode ser exportada como TXT. A transcrição original nunca é modificada."
      }
    ]
  },
  {
    topic: "Assistente IA",
    questions: [
      {
        q: "O que posso pedir para a IA?",
        a: "Resumos executivos, atas formais, lista de tarefas e responsáveis, pontos principais, decisões tomadas, tradução para qualquer idioma, análise de sentimento, perguntas específicas sobre o conteúdo da reunião. Use os atalhos rápidos no chat ou escreva livremente."
      },
      {
        q: "Como gerar uma ata formal automaticamente?",
        a: "Na reunião salva, clique em 'Chat IA' e depois no atalho 'Faça uma ata formal'. O Gemini gera uma ata completa com data, participantes identificados, assuntos tratados, decisões e próximos passos."
      },
      {
        q: "Posso ouvir o resumo em voz alta?",
        a: "Sim! Após gerar o resumo, clique no botão '🔊 Ouvir' ao lado do título 'Resumo Executivo'. O app lê o conteúdo em voz alta. No Chat IA, use o botão 'Ouvir resposta' após receber uma resposta."
      },
      {
        q: "A IA modifica minha transcrição original?",
        a: "Não. A IA atua apenas como assistente que analisa o texto. A transcrição original é sempre mantida intacta."
      }
    ]
  },
  {
    topic: "Planos e Armazenamento",
    questions: [
      {
        q: "Por quanto tempo minhas reuniões ficam salvas?",
        a: "Depende do seu plano: Starter (gratuito) mantém por 7 dias, Pro por 90 dias, Ultra por 1 ano, Power sem limite. Você receberá avisos antes das reuniões expirarem."
      },
      {
        q: "O que acontece se minha transcrição falhar?",
        a: "O VoxMeet salva automaticamente um backup do áudio no seu dispositivo antes de enviar para transcrição. Se houver falha, um banner amarelo aparecerá oferecendo recuperar e tentar novamente — sem perder a gravação."
      },
      {
        q: "Onde ficam armazenados meus dados?",
        a: "Textos e resumos ficam salvos com segurança no Firebase (Google Cloud). O áudio é processado pelo Groq Whisper e não é armazenado permanentemente. Backups temporários ficam apenas no seu dispositivo (IndexedDB)."
      },
      {
        q: "Como funciona o pagamento?",
        a: "Aceitamos Pix via Asaas. Vá em 'Premium', escolha seu plano, informe o CPF e escaneie o QR Code. O plano é ativado automaticamente após confirmação do pagamento."
      }
    ]
  },
  {
    topic: "App Android",
    questions: [
      {
        q: "Como instalar o VoxMeet no celular?",
        a: "Acesse voxmeet.vercel.app pelo navegador do celular, ou instale o APK diretamente. O app funciona offline para gravação — a transcrição e o resumo precisam de internet."
      },
      {
        q: "O login com Google funciona no app?",
        a: "No app Android, use login com email e senha. O login com Google está disponível apenas na versão web (voxmeet.vercel.app)."
      },
      {
        q: "Posso gravar com o app em segundo plano?",
        a: "Sim! O VoxMeet usa um serviço em primeiro plano que mantém a gravação ativa mesmo com o app minimizado. Ideal para gravar chamadas com o app aberto ao lado."
      }
    ]
  }
];

export function FAQView() {
  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8 pb-32">
      <div className="flex items-center gap-4 text-white/90">
        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
          <HelpCircle className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-3xl font-serif italic">Perguntas Frequentes</h1>
          <p className="text-white/50 text-sm">Tire suas dúvidas sobre o VoxMeet.</p>
        </div>
      </div>

      <div className="space-y-8">
        {faqs.map((group, i) => (
          <motion.div
            key={group.topic}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-medium text-white/80 border-b border-white/10 pb-2">
              {group.topic}
            </h2>
            <div className="space-y-4">
              {group.questions.map((faq, j) => (
                <div key={j} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors">
                  <h3 className="font-medium text-white/90 mb-2">{faq.q}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
