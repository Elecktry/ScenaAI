
import { NextResponse } from "next/server";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { config, higgsfield } from "@higgsfield/client/v2";

export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _request: Request,
  context: RouteContext
) {
  let savedPath: string | null = null;

  try {
    const { id } = await context.params;
    const credentials = process.env.HF_CREDENTIALS;

    if (!credentials) {
      return NextResponse.json(
        { error: "Configure HF_CREDENTIALS no arquivo .env." },
        { status: 500 }
      );
    }

    const character = await prisma.character.findUnique({
      where: { id },
    });

    if (!character) {
      return NextResponse.json(
        { error: "Personagem não encontrado." },
        { status: 404 }
      );
    }

    const styleInstructions: Record<string, string> = {
      "Realista": [
        "Create a photorealistic live-action human character.",
        "Natural human anatomy, realistic facial proportions, natural skin texture and pores, individual hair strands, realistic fabric, physically accurate lighting.",
        "Professional live-action photography, lifelike materials and natural imperfections.",
        "Do not use cartoon, anime, 3D animation, CGI, plastic skin, exaggerated eyes, or stylized proportions."
      ].join(" "),

      "Cinematográfico": [
        "Create a cinematic character portrait with professional film lighting,",
        "carefully composed framing, realistic materials, atmospheric depth,",
        "and a polished movie-production aesthetic."
      ].join(" "),

      "Animação 3D": [
        "Create a high-quality stylized 3D animated character,",
        "expressive facial features, carefully crafted materials,",
        "appealing shapes and cinematic 3D lighting."
      ].join(" "),

      "Anime": [
        "Create a character in a polished Japanese anime illustration style,",
        "with clean linework, expressive anime features and intentional colors."
      ].join(" "),

      "Ilustração": [
        "Create a carefully crafted digital illustration,",
        "with intentional brushwork, clear shapes and a cohesive art direction."
      ].join(" "),

      "Fantasia sombria": [
        "Create a dark fantasy character portrait,",
        "with dramatic shadows, mysterious atmosphere and detailed fantasy design."
      ].join(" "),

      "Ficção científica": [
        "Create a science-fiction character portrait,",
        "with futuristic design details, coherent materials and cinematic lighting."
      ].join(" "),

      "Personalizado": [
        "Follow the user's custom visual direction while preserving the character's identity."
      ].join(" ")
    };

    const selectedStyle = character.visualStyle || "Cinematográfico";
    const styleInstruction =
      styleInstructions[selectedStyle] ??
      styleInstructions["Cinematográfico"];

    const prompt = [
      "CHARACTER IDENTITY — preserve these defining characteristics:",
      `Name: ${character.name}`,
      `Description: ${character.summary}`,
      `Physical appearance: ${character.appearance}`,
      `Hair: ${character.hair}`,
      `Clothing: ${character.outfit}`,
      `Personality: ${character.personality}`,
      "",
      "CONTINUITY NOTES:",
      character.visualPrompt,
      "",
      "MANDATORY VISUAL STYLE:",
      `The selected style is "${selectedStyle}".`,
      styleInstruction,
      "The selected visual style takes priority over any conflicting style instructions in the continuity notes.",
      "",
      "COMPOSITION:",
      "Create one full-body character portrait.",
      "Keep the character centered, fully visible from head to toe, against a simple background.",
      "Preserve the character's defining facial features, hairstyle, clothing design and color palette.",
      "Do not include text, captions, logos or watermarks."
    ]
      .filter(Boolean)
      .join("\n");

    if (prompt.trim().length < 20) {
      return NextResponse.json(
        {
          error:
            "A ficha está muito vazia. Preencha a descrição ou o prompt visual antes de gerar.",
        },
        { status: 400 }
      );
    }

    config({ credentials });

    const jobSet = await higgsfield.subscribe(
      "xai/grok-imagine-image-2.0",
      {
        input: {
          prompt,
          resolution: "1k",
          aspect_ratio: "3:4",
          quality: "medium",
        },
        withPolling: true,
      }
    );


    const result = jobSet as unknown as {
      status?: string;
      isCompleted?: boolean;
      images?: Array<{ url?: string }>;
      jobs?: Array<{
        results?: {
          raw?: { url?: string };
          images?: Array<{ url?: string }>;
        };
      }>;
    };

    console.log("Higgsfield status:", result.status);
    console.log(
      "Higgsfield resultado:",
      JSON.stringify({
        status: result.status,
        isCompleted: result.isCompleted,
        imageCount: result.images?.length ?? 0,
        hasJobs: Boolean(result.jobs?.length),
      })
    );

    const imageUrl =
      result.images?.[0]?.url ??
      result.jobs?.[0]?.results?.raw?.url ??
      result.jobs?.[0]?.results?.images?.[0]?.url;

    if (
      result.status === "failed" ||
      result.status === "nsfw" ||
      result.isCompleted === false ||
      !imageUrl
    ) {
      throw new Error(
        `Geração não concluída. Status: ${result.status ?? "desconhecido"}. Consulte o terminal para mais informações.`
      );
    }


    const parsedUrl = new URL(imageUrl);

    if (parsedUrl.protocol !== "https:") {
      throw new Error("A Higgsfield retornou uma URL de imagem inválida.");
    }

    const imageResponse = await fetch(parsedUrl.toString());

    if (!imageResponse.ok) {
      throw new Error("Não foi possível baixar a imagem gerada.");
    }

    const mimeType = (
      imageResponse.headers.get("content-type") ?? ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

    const extensions: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
    };

    const extension = extensions[mimeType];

    if (!extension) {
      throw new Error(
        `Formato de imagem retornado não suportado: ${mimeType || "desconhecido"}.`
      );
    }

    const bytes = Buffer.from(await imageResponse.arrayBuffer());

    if (bytes.length === 0 || bytes.length > 15 * 1024 * 1024) {
      throw new Error("A imagem retornada está vazia ou excede 15 MB.");
    }

    const filename = `${crypto.randomUUID()}${extension}`;
    const relativeDirectory = path.join("uploads", "characters", id);
    const absoluteDirectory = path.join(
      process.cwd(),
      "public",
      relativeDirectory
    );

    await mkdir(absoluteDirectory, { recursive: true });

    savedPath = path.join(absoluteDirectory, filename);
    await writeFile(savedPath, bytes, { flag: "wx" });

    const url = `/${relativeDirectory
      .split(path.sep)
      .join("/")}/${filename}`;

    // A nova imagem vira a capa (posição 0).
    // As referências existentes são preservadas e deslocadas.
    const image = await prisma.$transaction(async (tx) => {
      const existingImages = await tx.characterImage.findMany({
        where: { characterId: id },
        orderBy: { position: "asc" },
        select: { id: true },
      });

      // Usa posições temporárias para evitar colisões de posição.
      for (let index = 0; index < existingImages.length; index++) {
        await tx.characterImage.update({
          where: { id: existingImages[index].id },
          data: { position: -(index + 1) },
        });
      }

      for (let index = 0; index < existingImages.length; index++) {
        await tx.characterImage.update({
          where: { id: existingImages[index].id },
          data: { position: index + 1 },
        });
      }

      return tx.characterImage.create({
        data: {
          characterId: id,
          url,
          storageKey: `${relativeDirectory
            .split(path.sep)
            .join("/")}/${filename}`,
          mimeType,
          sizeBytes: bytes.length,
          position: 0,
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        image,
        message: "Imagem gerada e definida como capa!",
      },
      { status: 201 }
    );
  } catch (error) {
    if (savedPath) {
      await unlink(savedPath).catch(() => undefined);
    }

    console.error("Erro ao gerar imagem com Higgsfield:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar a imagem.",
      },
      { status: 500 }
    );
  }
}
