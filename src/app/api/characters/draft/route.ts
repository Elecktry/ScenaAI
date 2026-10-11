import OpenAI from "openai";
import { NextResponse } from "next/server";

export const maxDuration = 30;

const characterSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    summary: { type: "string" },
    appearance: { type: "string" },
    hair: { type: "string" },
    outfit: { type: "string" },
    personality: { type: "string" },
    visualStyle: { type: "string" },
    visualPrompt: { type: "string" },
  },
  required: [
    "name",
    "summary",
    "appearance",
    "hair",
    "outfit",
    "personality",
    "visualStyle",
    "visualPrompt",
  ],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "A chave da OpenAI nÃ£o estÃ¡ configurada no servidor. Confira o arquivo .env.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const idea =
      typeof body.idea === "string" ? body.idea.trim() : "";

    const visualStyle =
      typeof body.visualStyle === "string" &&
      body.visualStyle.trim()
        ? body.visualStyle.trim()
        : "CinematogrÃ¡fico";

    if (!idea) {
      return NextResponse.json(
        { error: "Descreva a ideia do personagem." },
        { status: 400 }
      );
    }

    if (idea.length > 5000) {
      return NextResponse.json(
        { error: "A descriÃ§Ã£o deve ter no mÃ¡ximo 5.000 caracteres." },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      instructions: `
VocÃª Ã© o diretor criativo do SCENA.AI, especializado em criar
personagens originais para cinema, sÃ©ries, animaÃ§Ã£o e vÃdeos.

Crie uma ficha coerente e detalhada com base na ideia do usuÃ¡rio.
Use portuguÃªs do Brasil em todos os campos.
Transforme referÃªncias a personagens conhecidos em uma proposta
original, sem copiar exatamente o personagem existente.
Mantenha consistÃªncia entre aparÃªncia, cabelo, roupa e personalidade.
O visualPrompt deve ser um prompt visual detalhado, pronto para ser
usado futuramente em uma ferramenta de geraÃ§Ã£o de imagens.
NÃ£o afirme que uma imagem jÃ¡ foi gerada.
`,
      input: `
IDEIA DO USUÃRIO:
${idea}

ESTILO VISUAL ESCOLHIDO:
${visualStyle}

Gere uma ficha completa para esse personagem.
`,
      text: {
        format: {
          type: "json_schema",
          name: "character_draft",
          strict: true,
          schema: characterSchema,
        },
      },
    });

    if (!response.output_text) {
      throw new Error("A IA nÃ£o retornou uma ficha.");
    }

    const draft = JSON.parse(response.output_text);

    return NextResponse.json({
      success: true,
      mode: "openai",
      draft,
      message:
        "Ficha criada com IA! Revise os campos antes de salvar.",
    });
  } catch (error) {
    console.error("Erro ao gerar ficha:", error);

    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          {
            error:
              "A chave da OpenAI Ã© invÃ¡lida. Confira a configuraÃ§Ã£o no .env.",
          },
          { status: 401 }
        );
      }

      if (error.status === 429) {
        return NextResponse.json(
          {
            error:
              "A API da OpenAI estÃ¡ sem cota disponÃvel ou recebeu muitas solicitaÃ§Ãµes. Confira o uso e o faturamento da API.",
          },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      {
        error:
          "NÃ£o foi possÃvel gerar a ficha agora. Confira o terminal para ver o erro.",
      },
      { status: 500 }
    );
  }
}