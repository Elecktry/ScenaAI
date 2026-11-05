
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getProviderError(data: any): string | null {
  const candidates = [
    data?.error?.message,
    data?.error,
    data?.message,
    data?.detail,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 1000);
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: "Você precisa estar autenticado." },
        { status: 401 }
      );
    }

    const requestId = request.nextUrl.searchParams.get("requestId");

    if (!requestId || requestId.length > 255) {
      return NextResponse.json(
        { error: "requestId inválido ou não informado." },
        { status: 400 }
      );
    }

    const generation = await prisma.generation.findFirst({
      where: {
        providerRequestId: requestId,
        userId: session.user.id,
        provider: "higgsfield",
      },
    });

    if (!generation) {
      return NextResponse.json(
        { error: "Geração não encontrada." },
        { status: 404 }
      );
    }

    const credentials = process.env.HF_CREDENTIALS;

    if (!credentials) {
      return NextResponse.json(
        { error: "Integração Higgsfield não configurada." },
        { status: 500 }
      );
    }

    const separator = credentials.indexOf(":");

    if (separator <= 0 || separator === credentials.length - 1) {
      return NextResponse.json(
        { error: "Credenciais Higgsfield inválidas." },
        { status: 500 }
      );
    }

    const keyId = credentials.slice(0, separator);
    const keySecret = credentials.slice(separator + 1);

    const response = await fetch(
      `https://api.higgsfield.ai/requests/${encodeURIComponent(requestId)}/status`,
      {
        headers: {
          Authorization: `Key ${keyId}:${keySecret}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("Erro Higgsfield:", {
        httpStatus: response.status,
        requestId,
        response: data,
      });

      return NextResponse.json(
        { error: "Falha ao consultar a Higgsfield." },
        { status: 502 }
      );
    }

    const status = String(data?.status ?? "")
      .toLowerCase()
      .slice(0, 40);

    if (!status) {
      console.error("Resposta sem status:", data);

      return NextResponse.json(
        { error: "Status inválido retornado pela Higgsfield." },
        { status: 502 }
      );
    }

    let videoUrl: string | null = null;

    if (typeof data?.video?.url === "string") {
      try {
        const parsedUrl = new URL(data.video.url);

        if (parsedUrl.protocol === "https:") {
          videoUrl = parsedUrl.toString();
        }
      } catch {
        console.error("URL de vídeo inválida.");
      }
    }

    const failed = ["failed", "nsfw"].includes(status);

    const providerError = failed
      ? getProviderError(data)
      : null;

    const errorMessage = failed
      ? providerError ||
        (status === "nsfw"
          ? "Geração bloqueada pela política de conteúdo."
          : "A Higgsfield não informou o motivo da falha.")
      : null;

    if (failed) {
      console.error("Falha na geração:", {
        requestId,
        status,
        providerError,
        response: data,
      });
    }

    const updatedGeneration = await prisma.generation.update({
      where: {
        id: generation.id,
      },
      data: {
        status,
        ...(videoUrl ? { videoUrl } : {}),
        ...(failed
          ? { errorMessage }
          : status === "completed"
            ? { errorMessage: null }
            : {}),
      },
      select: {
        id: true,
        providerRequestId: true,
        status: true,
        videoUrl: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      generationId: updatedGeneration.id,
      requestId: updatedGeneration.providerRequestId,
      status: updatedGeneration.status,
      video: updatedGeneration.videoUrl,
      error: updatedGeneration.errorMessage,
      createdAt: updatedGeneration.createdAt,
      updatedAt: updatedGeneration.updatedAt,
    });
  } catch (error) {
    console.error("Erro na rota /api/status:", error);

    return NextResponse.json(
      { error: "Erro interno ao consultar o status." },
      { status: 500 }
    );
  }
}
