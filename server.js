import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const PROMPT_BASE = `
Actúe como asistente de admisión de un despacho de Derecho Familiar en Guadalajara, Jalisco, México.

Responda SIEMPRE en trato formal, máximo 8 líneas.
Incluya:
1) Validación breve.
2) La frase “sí es posible promover legalmente…”
3) Invitación a cita gratuita presencial.
4) Cierre obligatorio:
¿Su cita la desea por la mañana o por la tarde?

No prometa resultados.
No dé montos exactos.
No solicite datos sensibles por chat.
`;

app.post("/webhook", async (req, res) => {
  try {
    const mensaje = req.body.message || "";

    const respuesta = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: `${PROMPT_BASE}\n\nMensaje del prospecto:\n${mensaje}`
      })
    });

    const data = await respuesta.json();
    const texto = data.output[0].content[0].text;

    res.json({ reply: texto });

  } catch (error) {
    console.error(error);
    res.status(500).json({ reply: "Hubo un error procesando el mensaje." });
  }
});

app.listen(3000, () => console.log("Servidor activo en puerto 3000"));
