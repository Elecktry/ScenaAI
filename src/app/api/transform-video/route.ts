
import { NextResponse } from "next/server";
import { HiggsfieldClient } from "@higgsfield/client";
import { config, higgsfield } from "@higgsfield/client/v2";
import path from "node:path";

export const maxDuration = 300;

const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function getExtension(file: File): string {
  const ext = path.extname(file.name).toLowerCase().replace(".", "");

  const allowed = [
    "mp4",
    "webm",
    "mov",
    "jpg",
    "jpeg",
    "png",
    "webp",
  ];

  if (!allowed.includes(ext)) {
    throw new Error(`Formato não permitido: ${file.name}`);
  }

  return ext === "jpeg" ? "jpg" : ext;
}

async function uploadMedia(
  file: File,
  client: HiggsfieldClient
): Promise<string> {
  getExtension(file);

  const bytes = Buffer.from(await file.arrayBuffer());
  return client.upload(bytes, file.type);
}

export async function POST(request: Request) {
  try {
    const credentials = process.env.HF_CREDENTIALS;

    if (!credentials) {
      return NextResponse.json(
        { error: "HF_CREDENTIALS não está configurada no servidor." },
        { status: 500 }
      );
    }

    const [apiKey, apiSecret] = credentials.split(":");

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Formato inválido em HF_CREDENTIALS." },
        { status: 500 }
      );
    }

    config({ credentials });

    const uploadClient = new HiggsfieldClient({
      apiKey,
      apiSecret,
    });

    const form = await request.formData();

    const video = form.get("video");
    const references = form.getAll("references");
    const prompt = String(form.get("prompt") || "").trim();
    const resolution = String(form.get("resolution") || "480p");

    if (!(video instanceof File)) {
      return NextResponse.json(
        { error: "Selecione o vídeo original." },
        { status: 400 }
      );
    }

    if (!VIDEO_TYPES.includes(video.type)) {
      return NextResponse.json(
        { error: "Use um vídeo MP4, WEBM ou MOV." },
        { status: 400 }
      );
    }

    if (video.size === 0 || video.size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        { error: "O vídeo deve ter mais de 0 bytes e no máximo 200 MB." },
        { status: 413 }
      );
    }

    if (references.length < 1 || references.length > 8) {
      return NextResponse.json(
        { error: "Envie de 1 a 8 imagens de referência." },
        { status: 400 }
      );
    }

    for (const item of references) {
      if (
        !(item instanceof File) ||
        !IMAGE_TYPES.includes(item.type)
      ) {
        return NextResponse.json(
          { error: "As referências devem ser imagens JPG, PNG ou WEBP." },
          { status: 400 }
        );
      }

      if (item.size === 0 || item.size > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          {
            error:
              "Cada imagem deve ter mais de 0 bytes e no máximo 10 MB.",
          },
          { status: 413 }
        );
      }
    }

    if (prompt.length > 10000) {
      return NextResponse.json(
        { error: "A instrução pode ter no máximo 10.000 caracteres." },
        { status: 400 }
      );
    }

    if (!["480p", "720p"].includes(resolution)) {
      return NextResponse.json(
        { error: "Selecione 480p ou 720p." },
        { status: 400 }
      );
    }

    console.log("Iniciando upload dos arquivos...");

    const videoUrl = await uploadMedia(video, uploadClient);

    const imageUrls = await Promise.all(
      references.map((item) => uploadMedia(item as File, uploadClient))
    );

    console.log("Uploads concluídos. Enviando geração à Higgsfield...");

    // Envia a solicitação sem bloquear a rota até a geração terminar.
    const result = await higgsfield.subscribe(
      "higgsfield/genjutsu/motion-transfer/v1.0",
      {
        input: {
          video_url: videoUrl,
          image_urls: imageUrls,
          prompt:
            prompt ||
            "Replace the main character in the source video with the provided character references. Preserve the original movement, timing and camera motion as closely as possible.",
          resolution,
        },
        withPolling: false,
      }
    );

    console.log("Resposta inicial da Higgsfield:", {
      status: result.status,
      requestId: result.request_id,
    });

    if (!result.request_id) {
      return NextResponse.json(
        {
          error: "A Higgsfield não retornou o ID da geração.",
          status: result.status,
        },
        { status: 502 }
      );
    }

    // A geração pode continuar em segundo plano.
    // O frontend deverá consultar o status usando este ID.
    return NextResponse.json(
      {
        requestId: result.request_id,
        status: result.status,
        message: "Geração enviada. Aguardando processamento.",
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Erro na transformação:", error);

    if (error instanceof Error) {
      console.error("Mensagem:", error.message);
      console.error("Causa:", error.cause);
    }

    const message =
      error instanceof Error ? error.message : "Erro desconhecido.";

    if (message.toLowerCase().includes("credit")) {
      return NextResponse.json(
        { error: "Saldo insuficiente na Higgsfield." },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: "Falha ao enviar a geração para a Higgsfield." },
      { status: 502 }
    );
  }
}
