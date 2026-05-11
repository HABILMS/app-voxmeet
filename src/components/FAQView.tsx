import { HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

const faqs = [
  {
    topic: "Gravação e Transcrição",
    questions: [
      {
        q: "Por que algumas palavras não são transcritas corretamente?",
        a: "A precisão da transcrição depende da qualidade do microfone, ruído de fundo e sotaque. Certifique-se de falar claramente e use um microfone de qualidade sempre que possível."
      },
      {
        q: "Como configuro para capturar aba do Chrome?",
        a: "Ao iniciar a gravação e selecionar 'Aba/Sistema', o navegador pedirá para escolher o que compartilhar. Escolha 'Aba do Chrome' e marque 'Compartilhar áudio da aba' na caixa de diálogo."
      }
    ]
  },
  {
    topic: "Assistente IA",
    questions: [
      {
        q: "O que eu posso pedir para a Inteligência Artificial?",
        a: "Você pode pedir resumos com foco em tarefas, lista de participantes, atas formais, pontos principais discutidos ou tradução da reunião. Use os botões de atalho no chat da IA para respostas rápidas."
      },
      {
        q: "A IA pode modificar minha transcrição?",
        a: "A IA atua apenas como assistente que examina o texto transcrito. O texto original gravado sempre será mantido perfeitamente intacto nas abas de Transcrição e Resumo."
      }
    ]
  },
  {
    topic: "Dados e Arquivos",
    questions: [
      {
        q: "Por que não consigo exportar áudio como MP3 em reuniões antigas?",
        a: "Para economizar armazenamento, o áudio temporário é limpo ao recarregar a página e não é transportado para o banco de dados das reuniões. Certifique-se de exportar logo na tela de gravação se precisar do arquivo."
      },
      {
        q: "Onde ficam armazenados os dados das minhas reuniões?",
        a: "Se você estiver logado, seus textos e resumos ficam salvos em nuvem de forma segura usando o Firebase. Se não estiver logado, sua sessão atual pode ser perdida ao fechar a janela."
      }
    ]
  }
];

export function FAQView() {
  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8 pb-32">
      <div className="flex items-center gap-4 text-white/90">
        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
          <HelpCircle className="w-6 h-6 text-white text-blue-400" />
        </div>
        <div>
          <h1 className="text-3xl font-serif italic">Perguntas Frequentes</h1>
          <p className="text-white/50 text-sm">Tire suas dúvidas sobre o gravador de reuniões.</p>
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
            <h2 className="text-lg font-medium text-white/80 border-b border-white/10 pb-2">{group.topic}</h2>
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
