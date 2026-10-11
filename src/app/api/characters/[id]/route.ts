import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const character = await prisma.character.findUnique({
      where: { id },
      include: { images: { orderBy: { position: "asc" } } },
    });
    if (!character) return NextResponse.json({ error: "Personagem não encontrado." }, { status: 404 });
    return NextResponse.json({ character });
  } catch (error) {
    console.error("Falha ao consultar personagem:", error);
    return NextResponse.json({ error: "Não foi possível consultar o personagem. Confira o PostgreSQL e as migrações." }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const body = await request.json();
    const data: Record<string, string> = {};
    const fields = ["name", "summary", "appearance", "hair", "outfit", "personality", "visualStyle", "visualPrompt"];

    for (const field of fields) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== "string") {
          return NextResponse.json({ error: `O campo ${field} deve ser texto.` }, { status: 400 });
        }
        data[field] = body[field].trim().slice(0, field === "name" ? 100 : 10000);
      }
    }
    if ("name" in data && !data.name) {
      return NextResponse.json({ error: "O nome não pode ficar vazio." }, { status: 400 });
    }

    const character = await prisma.character.update({
      where: { id }, data: data as Prisma.CharacterUpdateInput,
      include: { images: { orderBy: { position: "asc" } } },
    });
    return NextResponse.json({ character });
  } catch (error) {
    console.error("Falha ao atualizar personagem:", error);
    const code = (error as { code?: string } | null)?.code;
    if (code === "P2025") return NextResponse.json({ error: "Personagem não encontrado." }, { status: 404 });
    return NextResponse.json({ error: "Não foi possível atualizar o personagem. Confira a conexão com o PostgreSQL." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    await prisma.character.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "P2025") return NextResponse.json({ error: "Personagem não encontrado." }, { status: 404 });
    console.error("Falha ao excluir personagem:", error);
    return NextResponse.json({ error: "Não foi possível excluir o personagem." }, { status: 503 });
  }
}
