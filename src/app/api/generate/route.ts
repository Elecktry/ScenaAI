
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { config, higgsfield } from "@higgsfield/client/v2";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type GenerateRequest = {
  prompt?: unknown;
  duration?: unknown;
};

const PROVIDER_MODEL = "bytedance/seedance-2.5/text-to-video";

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

    // 2. Verificar tamanho da requisição
    const contentLength = Number(
      request.headers.get("content-length") || 0
    );

    if (contentLength > 20_000) {
      return NextResponse.json(
        { error: "A requisição é muito grande." },
        { status: 413 }
      );
    }

    // 3. Validar JSON
    let body: GenerateRequest;

    try {
      const parsed: unknown = await request.json();

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return NextResponse.json(
          { error: "O corpo precisa ser um objeto JSON válido." },
          { status: 400 }
        );
      }

      body = parsed as GenerateRequest;
    } catch {
      return NextResponse.json(
        { error: "O corpo da requisição não contém JSON válido." },
        { status: 400 }
      );
    }

    // 4. Validar prompt
    const prompt =
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : "";

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

    // 5. Validar duração
    const duration = body.duration ?? 5;

    if (
      typeof duration !== "number" ||
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration > 30
    ) {
      return NextResponse.json(
        { error: "A duração deve ser um número inteiro entre 1 e 30 segundos." },
        { status: 400 }
      );
    }

    // 6. Verificar credenciais da Higgsfield
    const credentials = process.env.HF_CREDENTIALS;

    if (!credentials) {
      return NextResponse.json(
        { error: "A integração com a Higgsfield não está configurada." },
        { status: 500 }
      );
    }

    const separator = credentials.indexOf(":");

    if (separator <= 0 || separator === credentials.length - 1) {
      return NextResponse.json(
        { error: "As credenciais da Higgsfield estão inválidas." },
        { status: 500 }
      );
    }

    const keyId = credentials.slice(0, separator);
    const keySecret = credentials.slice(separator + 1);

    config({
      credentials: `${keyId}:${keySecret}`,
    });

    // 7. Iniciar geração na Higgsfield
    const result = await higgsfield.subscribe(
      PROVIDER_MODEL,
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

    // 8. Validar resposta do provedor
    if (!result.request_id) {
      console.error(
        "Higgsfield não retornou request_id:",
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

    // 9. Salvar geração vinculada ao usuário
    const generation = await prisma.generation.create({
      data: {
        userId: session.user.id,
        provider: "higgsfield",
        providerRequestId: result.request_id,
        providerModel: PROVIDER_MODEL,
        prompt,
        duration,
        status: String(result.status ?? "queued").toLowerCase(),
      },
      select: {
        id: true,
        providerRequestId: true,
        status: true,
        createdAt: true,
      },
    });

    // 10. Retornar dados ao frontend
    return NextResponse.json(
      {
        success: true,
        generationId: generation.id,
        requestId: generation.providerRequestId,
        status: generation.status,
        createdAt: generation.createdAt,
        message: "Geração enviada e registrada com sucesso.",
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Erro ao iniciar geração de vídeo:", error);

    return NextResponse.json(
      {
        error:
          "Não foi possível iniciar a geração do vídeo. Tente novamente mais tarde.",
      },
      { status: 502 }
    );
  }
}
