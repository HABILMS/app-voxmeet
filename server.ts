import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import fs from "fs";
import { fileURLToPath } from "url";
import os from "os";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer — salva áudio em arquivo temporário (sem limite de tamanho)
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Aumenta limite do JSON para 50MB (textos longos de transcrição)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ─────────────────────────────────────────────
  // POST /api/transcribe — Groq Whisper
  // ─────────────────────────────────────────────
  app.post("/api/transcribe", upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo de áudio enviado." });
    }

    const apiKey = req.headers["x-groq-api-key"] as string || process.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: "Chave Groq não configurada." });
    }

    try {
      const lang = (req.body.language || "pt").split("-")[0];
      const fileStream = fs.createReadStream(req.file.path);
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

      // Limpa arquivo temporário
      fs.unlinkSync(req.file.path);

      if (!groqRes.ok) {
        const err = await groqRes.json().catch(() => ({}));
        return res.status(groqRes.status).json({ error: err?.error?.message || "Erro Groq Whisper" });
      }

      const data = await groqRes.json();
      return res.json(data);

    } catch (err: any) {
      // Limpa arquivo temporário em caso de erro
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      console.error("Transcription error:", err);
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
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: `Você é um assistente especializado em reuniões. Responda em ${language}. Retorne APENAS JSON sem markdown.`,
            },
            {
              role: "user",
              content: `Analise esta transcrição e retorne JSON com: {"summary": "resumo executivo", "actionItems": ["tarefa1", "tarefa2"]}\n\n${text}`,
            },
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
      const content = data.choices?.[0]?.message?.content;
      const parsed = JSON.parse(content);
      return res.json(parsed);

    } catch (err: any) {
      console.error("Summarize error:", err);
      return res.status(500).json({ error: err.message || "Erro ao resumir." });
    }
  });

  // ─────────────────────────────────────────────
  // Vite middleware (desenvolvimento)
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
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Error handler global
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Global error:", err);
    res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
