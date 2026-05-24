import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import fs from "fs";
import { fileURLToPath } from "url";
import os from "os";
import dotenv from "dotenv";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase Admin — para webhook atualizar Firestore com segurança
let adminDb: any = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount) });
    }
    adminDb = getFirestore();
    console.log("Firebase Admin inicializado");
  }
} catch (e) {
  console.warn("Firebase Admin não configurado — webhook não atualizará Firestore automaticamente");
}

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const ASAAS_API = "https://api.asaas.com/v3";
const ASAAS_KEY = process.env.ASAAS_API_KEY || "";

const PLAN_PRICES: Record<string, number> = {
  pro: 9.99,
  ultra: 19.99,
  power: 49.99,
};

const PLAN_MINUTES: Record<string, number | null> = {
  pro: 300,
  ultra: null,
  power: null,
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ─────────────────────────────────────────────
  // POST /api/asaas/checkout — Gera cobrança Pix no Asaas
  // ─────────────────────────────────────────────
  app.post("/api/asaas/checkout", async (req, res) => {
    const { plan, userId, userEmail, userName } = req.body;

    if (!plan || !userId || !userEmail) {
      return res.status(400).json({ error: "Dados incompletos." });
    }

    if (!ASAAS_KEY) {
      return res.status(500).json({ error: "Chave Asaas não configurada." });
    }

    const price = PLAN_PRICES[plan];
    if (!price) {
      return res.status(400).json({ error: "Plano inválido." });
    }

    try {
      // 1. Busca ou cria cliente no Asaas
      let customerId: string;

      const searchRes = await fetch(`${ASAAS_API}/customers?email=${encodeURIComponent(userEmail)}`, {
        headers: { access_token: ASAAS_KEY },
      });
      const searchData = await searchRes.json();

      if (searchData.data?.length > 0) {
        customerId = searchData.data[0].id;
      } else {
        const createRes = await fetch(`${ASAAS_API}/customers`, {
          method: "POST",
          headers: { access_token: ASAAS_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: userName || userEmail,
            email: userEmail,
            externalReference: userId,
          }),
        });
        const customer = await createRes.json();
        if (!customer.id) throw new Error("Erro ao criar cliente no Asaas");
        customerId = customer.id;
      }

      // 2. Cria cobrança Pix
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);
      const dueDateStr = dueDate.toISOString().split("T")[0];

      const chargeRes = await fetch(`${ASAAS_API}/payments`, {
        method: "POST",
        headers: { access_token: ASAAS_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: customerId,
          billingType: "PIX",
          value: price,
          dueDate: dueDateStr,
          description: `VoxMeet — Plano ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
          externalReference: `${userId}:${plan}`,
        }),
      });

      const charge = await chargeRes.json();
      if (!charge.id) throw new Error(charge.errors?.[0]?.description || "Erro ao criar cobrança");

      // 3. Busca QR Code Pix
      const pixRes = await fetch(`${ASAAS_API}/payments/${charge.id}/pixQrCode`, {
        headers: { access_token: ASAAS_KEY },
      });
      const pixData = await pixRes.json();

      return res.json({
        paymentId: charge.id,
        pixCode: pixData.payload,
        pixQrCode: pixData.encodedImage,
        value: price,
        plan,
        expiresAt: new Date(dueDate).getTime(),
      });

    } catch (err: any) {
      console.error("Asaas checkout error:", err);
      return res.status(500).json({ error: err.message || "Erro ao gerar cobrança." });
    }
  });

  // ─────────────────────────────────────────────
  // POST /api/asaas/webhook — Recebe confirmação de pagamento
  // ─────────────────────────────────────────────
  app.post("/api/asaas/webhook", async (req, res) => {
    const event = req.body;
    console.log("Asaas webhook:", event.event, event.payment?.id);

    // Só processa pagamentos confirmados
    if (event.event !== "PAYMENT_RECEIVED" && event.event !== "PAYMENT_CONFIRMED") {
      return res.json({ received: true });
    }

    const payment = event.payment;
    if (!payment?.externalReference) return res.json({ received: true });

    const [userId, plan] = payment.externalReference.split(":");
    if (!userId || !plan) return res.json({ received: true });

    // Atualiza Firestore se Firebase Admin estiver configurado
    if (adminDb) {
      try {
        const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 dias
        await adminDb.collection("users").doc(userId).update({
          plan,
          minutesLimit: PLAN_MINUTES[plan],
          minutesUsed: 0,
          planExpiresAt: expiresAt,
        });

        // Salva registro do pagamento
        await adminDb.collection("payments").add({
          userId,
          plan,
          amount: payment.value,
          currency: "BRL",
          method: "pix",
          status: "confirmed",
          asaasPaymentId: payment.id,
          createdAt: Date.now(),
          paidAt: Date.now(),
        });

        console.log(`Plano ${plan} ativado para usuário ${userId}`);
      } catch (e) {
        console.error("Erro ao atualizar Firestore:", e);
      }
    }

    return res.json({ received: true });
  });

  // ─────────────────────────────────────────────
  // POST /api/asaas/check — Verifica status do pagamento
  // ─────────────────────────────────────────────
  app.get("/api/asaas/check/:paymentId", async (req, res) => {
    const { paymentId } = req.params;
    if (!ASAAS_KEY) return res.status(500).json({ error: "Asaas não configurado." });

    try {
      const r = await fetch(`${ASAAS_API}/payments/${paymentId}`, {
        headers: { access_token: ASAAS_KEY },
      });
      const data = await r.json();
      return res.json({ status: data.status, value: data.value });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ─────────────────────────────────────────────
  // POST /api/transcribe — Groq Whisper
  // ─────────────────────────────────────────────
  app.post("/api/transcribe", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo de áudio enviado." });

    const apiKey = req.headers["x-groq-api-key"] as string || process.env.VITE_GROQ_API_KEY;
    if (!apiKey) return res.status(401).json({ error: "Chave Groq não configurada." });

    try {
      const lang = (req.body.language || "pt").split("-")[0];
      const mimeType = req.file.mimetype || "audio/webm";
      const ext = mimeType.includes("mp4") ? "mp4"
        : mimeType.includes("mpeg") ? "mp3"
        : mimeType.includes("ogg") ? "ogg"
        : mimeType.includes("wav") ? "wav"
        : mimeType.includes("flac") ? "flac"
        : mimeType.includes("m4a") ? "m4a"
        : "webm";

      const formData = new FormData();
      const blob = new Blob([fs.readFileSync(req.file.path)], { type: mimeType });
      formData.append("file", blob, `audio.${ext}`);
      formData.append("model", "whisper-large-v3-turbo");
      formData.append("language", lang);
      formData.append("response_format", "verbose_json");
      formData.append("timestamp_granularities[]", "segment");

      const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });

      fs.unlinkSync(req.file.path);
      if (!groqRes.ok) {
        const err = await groqRes.json().catch(() => ({}));
        return res.status(groqRes.status).json({ error: err?.error?.message || "Erro Groq Whisper" });
      }

      return res.json(await groqRes.json());
    } catch (err: any) {
      if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(500).json({ error: err.message || "Erro ao transcrever áudio." });
    }
  });

  // ─────────────────────────────────────────────
  // POST /api/summarize — Groq LLaMA
  // ─────────────────────────────────────────────
  app.post("/api/summarize", async (req, res) => {
    const { text, lang } = req.body;
    if (!text) return res.status(400).json({ error: "Texto não fornecido." });

    const apiKey = req.headers["x-groq-api-key"] as string || process.env.VITE_GROQ_API_KEY;
    if (!apiKey) return res.status(401).json({ error: "Chave Groq não configurada." });

    const language = lang === "pt-BR" ? "português do Brasil" : "English";

    try {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: `Você é um assistente especializado em reuniões. Responda em ${language}. Retorne APENAS JSON sem markdown.` },
            { role: "user", content: `Analise esta transcrição e retorne JSON com: {"summary": "resumo executivo", "actionItems": ["tarefa1", "tarefa2"]}\n\n${text}` },
          ],
          temperature: 0.3,
          max_tokens: 1024,
          response_format: { type: "json_object" },
        }),
      });

      if (!groqRes.ok) {
        const err = await groqRes.json().catch(() => ({}));
        return res.status(groqRes.status).json({ error: err?.error?.message || "Erro Groq LLaMA" });
      }

      const data = await groqRes.json();
      return res.json(JSON.parse(data.choices?.[0]?.message?.content));
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Erro ao resumir." });
    }
  });

  // ─────────────────────────────────────────────
  // Vite middleware
  // ─────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
  });

  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer();
