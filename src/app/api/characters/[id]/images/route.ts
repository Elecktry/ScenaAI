import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

// Não declarar `runtime = "nodejs"` aqui: este projeto usa cacheComponents.
type RouteContext = { params: Promise<{ id: string }> };

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const character = await prisma.character.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!character) {
      return NextResponse.json({ error: "Personagem não encontrado." }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Selecione uma imagem para enviar." }, { status: 400 });
    }
    const extension = ALLOWED_TYPES[file.type];
    if (!extension) {
      return NextResponse.json({ error: "Formato não suportado. Use JPG, PNG ou WEBP." }, { status: 415 });
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "A imagem deve ter até 5 MB." }, { status: 413 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    // Nome aleatório para evitar colisões e não confiar no nome enviado pelo usuário.
    const filename = `${crypto.randomUUID()}${extension}`;
    const relativeDirectory = path.join("uploads", "characters", id);
    const absoluteDirectory = path.join(process.cwd(), "public", relativeDirectory);
    await mkdir(absoluteDirectory, { recursive: true });
    await writeFile(path.join(absoluteDirectory, filename), bytes, { flag: "wx" });

    const maxPosition = await prisma.characterImage.aggregate({
      where: { characterId: id },
      _max: { position: true },
    });
    const image = await prisma.characterImage.create({
      data: {
        characterId: id,
        url: `/${relativeDirectory.replaceAll(path.sep, "/")}/${filename}`,
        storageKey: `${relativeDirectory.replaceAll(path.sep, "/")}/${filename}`,
        mimeType: file.type,
        sizeBytes: file.size,
        position: (maxPosition._max.position ?? -1) + 1,
      },
    });

    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    console.error("Falha ao enviar imagem de referência:", error);
    return NextResponse.json(
      { error: "Não foi possível salvar a imagem. Confira a conexão com o PostgreSQL e as permissões da pasta public/uploads." },
      { status: 500 },
    );
  }
}
