import { TranscriptSegment } from "../types";

export async function summarizeMeeting(transcript: TranscriptSegment[]): Promise<string | undefined> {
  const text = transcript.map(s => s.text).join(' ');
  
  try {
    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: 'pt-BR' })
    });
    
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
       throw new Error("O servidor retornou HTML. Se estiver no Render, certifique-se de implantar como 'Web Service' (Node.js) e não 'Static Site'.");
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to summarize: ${res.statusText}`);
    }
    
    const data = await res.json();
    return data.summary;
  } catch (error: any) {
    console.error("Error summarizing meeting:", error);
    alert(error.message || 'Erro ao resumir.');
    return undefined;
  }
}
