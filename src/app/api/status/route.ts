import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const requestId = request.nextUrl.searchParams.get("requestId");
    const credentials = process.env.HF_CREDENTIALS;

    if (!requestId) {
      return NextResponse.json(
        { error: "requestId não informado." },
        { status: 400 }
      );
    }

    if (!credentials) {
      return NextResponse.json(
        { error: "HF_CREDENTIALS não configurada." },
        { status: 500 }
      );
    }

    const separator = credentials.indexOf(":");

    if (separator <= 0 || separator === credentials.length - 1) {
      return NextResponse.json(
        { error: "Formato de HF_CREDENTIALS inválido." },
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
      console.error("Erro da Higgsfield:", response.status, data);

      return NextResponse.json(
        { error: "Falha ao consultar a geração na Higgsfield." },
        { status: response.status === 404 ? 404 : 502 }
      );
    }

    const status = String(data?.status ?? "").toLowerCase();

    return NextResponse.json({
      requestId,
      status,
      video: typeof data?.video?.url === "string" ? data.video.url : null,
      error: ["failed", "nsfw"].includes(status)
        ? "A geração não foi concluída."
        : null,
    });
  } catch (error) {
    console.error("Erro na rota /api/status:", error);

    return NextResponse.json(
      { error: "Erro interno ao consultar o status." },
      { status: 500 }
    );
  }
}
