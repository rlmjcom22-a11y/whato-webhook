import express from "express";
import fetch from "node-fetch";

const app = express();

/**
 * 1) Middleware para leer JSON (cuando venga application/json)
 */
app.use(express.json({ limit: "2mb" }));

/**
 * 2) Logger global: imprime TODO lo que llegue (método, ruta, headers y body raw)
 *    Esto es clave para comprobar si Whato realmente está pegándole a tu endpoint.
 */
app.use((req, res, next) => {
  const started = Date.now();

  console.log("===== INCOMING REQUEST =====");
  console.log("METHOD:", req.method);
  console.log("URL:", req.originalUrl || req.url);
  console.log("HEADERS:", JSON.stringify(req.headers));

  // Captura body raw (por si Whato manda algo que no entra como JSON)
  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk.toString("utf8");
  });

  req.on("end", () => {
    if (raw) console.log("RAW BODY:", raw);

    // También imprime el JSON parseado si existe
    if (req.body && Object.keys(req.body).length > 0) {
      console.log("JSON BODY:", JSON.stringify(req.body));
    }

    res.on("finish", () => {
      console.log("STATUS:", res.statusCode, "TIME_MS:", Date.now() - started);
      console.log("============================");
    });

    next();
  });

  // Si no hay body, igual seguimos
  req.on("error", () => next());
});

/**
 * Prompt base para tu asistente
 */
const PROMPT_BASE = `
Actúe como asistente de admisión de un despacho de Derecho Familiar en Guadalajara, Jalisco, México.

Responda SIEMPRE en trato formal, máximo 8 líneas.
Incluya:
1) Validación breve.
2) La frase “si es posible promover legalmente…”
3) Invitación a cita gratuita presencial.
4) Cierre obligatorio:
¿Su cita la desea por la mañana o por la tarde?

No prometa resultados.
No dé montos exactos.
No solicite datos sensibles por chat.
`.trim();

/**
 * Healthcheck simple (opcional)
 */
app.get("/", (req, res) => {
  return res.status(200).send("OK");
});

/**
 * Webhook test (Whato debe poder pegarle aquí y recibir 200)
 */
app.get("/webhook", (req, res) => {
  return res.status(200).json({ ok: true, message: "Webhook activo" });
});

/**
 * Webhook real: aquí llega el evento de Whato
 */
app.post("/webhook", async (req, res) => {
  try {
    // Whato a veces manda "message", a veces "message_content"
    const mensaje =
      req.body?.message_content ??
      req.body?.message ??
      req.body?.text ??
      "";

    if (!mensaje || typeof mensaje !== "string") {
      // Aun si no llega mensaje, regresamos 200 para no romper el flujo
      return res.status(200).json({
        ok: true,
        note: "No message content received (but webhook is reachable).",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.log("ERROR: OPENAI_API_KEY no está configurada en Railway.");
      return res.status(200).json({
        ok: false,
        error: "Missing OPENAI_API_KEY in environment variables.",
      });
    }

    // Llamada a OpenAI Responses API
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: `${PROMPT_BASE}\n\nMensaje del prospecto:\n${mensaje}`,
      }),
    });

    const data = await r.json();
    console.log("OPENAI STATUS:", r.status);
    console.log("OPENAI RAW:", JSON.stringify(data));

    // Extrae texto (según Responses API)
    const texto =
      data?.output?.[0]?.content?.[0]?.text ||
      "Buenas tardes. Gracias por su mensaje. ¿Su cita la desea por la mañana o por la tarde?";

    // Responde a Whato con el texto (Whato debe usar esto para enviar al chat)
    return res.status(200).json({
      ok: true,
      reply: texto,
    });
  } catch (err) {
    console.log("WEBHOOK ERROR:", err?.message || err);
    // IMPORTANTE: devolver 200 para que Whato no marque fallo permanente
    return res.status(200).json({
      ok: false,
      reply:
        "Buenas tardes. Gracias por su mensaje. ¿Su cita la desea por la mañana o por la tarde?",
    });
  }
});

/**
 * Arranque del servidor (Railway usa PORT)
 */
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Servidor activo en puerto", PORT);
});
