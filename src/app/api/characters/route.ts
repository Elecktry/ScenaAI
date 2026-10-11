import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


function isDatabaseUnavailable(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  return code === "P1001" || code === "P1002" || code === "P1017";
}

export async function GET() {
  try {
    const characters = await prisma.character.findMany({
      include: { images: { orderBy: { position: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ characters });
  } catch (error) {
    console.error("Falha ao listar personagens:", error);
    return NextResponse.json(
      {
        error: isDatabaseUnavailable(error)
          ? "Não foi possível conectar ao PostgreSQL. Confira DATABASE_URL e se o serviço está iniciado."
          : "Não foi possível carregar os personagens. Execute as migrações do Prisma e tente novamente.",
      },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Informe o nome do personagem." }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: "O nome deve ter até 100 caracteres." }, { status: 400 });
    }

    const stringFields = ["summary", "appearance", "hair", "outfit", "personality", "visualStyle", "visualPrompt"] as const;
    const values: Record<(typeof stringFields)[number], string> = {
      summary: "", appearance: "", hair: "", outfit: "", personality: "",
      visualStyle: "Cinematográfico", visualPrompt: "",
    };

    for (const field of stringFields) {
      if (typeof body[field] === "string") values[field] = body[field].slice(0, 10000);
    }

    const character = await prisma.character.create({
      data: { name, ...values },
      include: { images: true },
    });

    return NextResponse.json({ character }, { status: 201 });
  } catch (error) {
    console.error("Falha ao criar personagem:", error);
    return NextResponse.json(
      { error: "Não foi possível salvar o personagem. Confira a conexão e as migrações do PostgreSQL." },
      { status: 503 }
    );
  }
}
