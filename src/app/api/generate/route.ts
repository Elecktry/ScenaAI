
import { NextRequest, NextResponse } from "next/server";
import { config, higgsfield } from "@higgsfield/client/v2";

type GenerateRequest = {
  prompt?: string;
  duration?: number;
};

export async function POST(request: NextRequest) {
  try {
    const credentials = process.env.HF_CREDENTIALS;

    if (!credentials) {
      return NextResponse.json(
        { error: "HF_CREDENTIALS não está configurada no servidor." },
        { status: 500 }
      );
    }

    const separator = credentials.indexOf(":");

    if (separator <= 0 || separator === credentials.length - 1) {
      return NextResponse.json(
        {
          error:
            "HF_CREDENTIALS inválida. Verifique o formato KEY_ID:KEY_SECRET.",
        },
        { status: 500 }
      );
    }

    const keyId = credentials.slice(0, separator);
    const keySecret = credentials.slice(separator + 1);

    config({
      credentials: `${keyId}:${keySecret}`,
    });

    let body: GenerateRequest;

    try {
      body = (await request.json()) as GenerateRequest;
    } catch {
      return NextResponse.json(
        { error: "O corpo da requisição não contém JSON válido." },
        { status: 400 }
      );
    }

    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json(
        { error: "Escreva um prompt antes de gerar o vídeo." },
        { status: 400 }
      );
    }

    if (prompt.length > 10000) {
      return NextResponse.json(
        { error: "O prompt excede o limite de 10.000 caracteres." },
        { status: 400 }
      );
    }

    const duration = body.duration ?? 5;

    if (
      typeof duration !== "number" ||
      !Number.isFinite(duration) ||
      duration < 1 ||
      duration > 30
    ) {
      return NextResponse.json(
        { error: "A duração deve ser um número entre 1 e 30 segundos." },
        { status: 400 }
      );
    }

    const result = await higgsfield.subscribe(
      "bytedance/seedance-2.5/text-to-video",
      {
        input: {
          prompt,
          duration,
          resolution: "720p",
          aspect_ratio: "16:9",
          output_format: "mp4",
          generate_audio: true,
        },
        withPolling: false,
      }
    );

    if (!result.request_id) {
      console.error(
        "A Higgsfield não retornou request_id:",
        result.status
      );

      return NextResponse.json(
        {
          error:
            "A Higgsfield não retornou o identificador da geração. Tente novamente.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        requestId: result.request_id,
        status: result.status,
        message: "Geração enviada para processamento.",
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Erro ao iniciar geração de vídeo:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível iniciar a geração do vídeo.",
      },
      { status: 500 }
    );
  }
}
