
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

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
    // 1. Verificar autenticação
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: "Você precisa estar autenticado." },
        { status: 401 }
      );
    }

    // 2. Verificar configuração da OpenAI
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "A chave da OpenAI não está configurada no servidor." },
        { status: 500 }
      );
    }

    // 3. Limitar tamanho do corpo da requisição
    const contentLength = Number(request.headers.get("content-length") || 0);

    if (contentLength > 16_000) {
      return NextResponse.json(
        { error: "A requisição é muito grande." },
        { status: 413 }
      );
    }

    // 4. Validar JSON
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "O corpo da requisição precisa ser um JSON válido." },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("idea" in body)
    ) {
      return NextResponse.json(
        { error: "Informe a ideia do personagem." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;

    const idea =
      typeof data.idea === "string" ? data.idea.trim() : "";

    const visualStyle =
      typeof data.visualStyle === "string" &&
      data.visualStyle.trim()
        ? data.visualStyle.trim()
        : "Cinematográfico";

    if (!idea) {
      return NextResponse.json(
        { error: "Descreva a ideia do personagem." },
        { status: 400 }
      );
    }

    if (idea.length > 5000) {
      return NextResponse.json(
        { error: "A descrição deve ter no máximo 5.000 caracteres." },
        { status: 400 }
      );
    }

    if (visualStyle.length > 100) {
      return NextResponse.json(
        { error: "O estilo visual deve ter no máximo 100 caracteres." },
        { status: 400 }
      );
    }

    // 5. Gerar ficha com IA
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      instructions: `
Você é o diretor criativo do SCENA.AI, especializado em criar
personagens originais para cinema, séries, animação e vídeos.

Crie uma ficha coerente e detalhada com base na ideia do usuário.
Use português do Brasil em todos os campos.
Transforme referências a personagens conhecidos em uma proposta
original, sem copiar exatamente o personagem existente.
Mantenha consistência entre aparência, cabelo, roupa e personalidade.
O visualPrompt deve ser um prompt visual detalhado, pronto para ser
usado futuramente em uma ferramenta de geração de imagens.
Não afirme que uma imagem já foi gerada.
`,
      input: `
IDEIA DO USUÁRIO:
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
      throw new Error("A IA não retornou uma ficha.");
    }

    const draft = JSON.parse(response.output_text);

    return NextResponse.json({
      success: true,
      mode: "openai",
      draft,
      message: "Ficha criada com IA! Revise os campos antes de salvar.",
    });
  } catch (error) {
    console.error("Erro ao gerar ficha:", error);

    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: "A chave da OpenAI é inválida. Confira o .env." },
          { status: 401 }
        );
      }

      if (error.status === 429) {
        return NextResponse.json(
          {
            error:
              "A API da OpenAI está sem cota disponível ou recebeu muitas solicitações. Confira o uso e o faturamento.",
          },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      {
        error:
          "Não foi possível gerar a ficha agora. Confira o terminal para ver o erro.",
      },
      { status: 500 }
    );
  }
}
