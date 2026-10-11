
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const characters = await prisma.character.findMany({
      include: {
        images: {
          orderBy: {
            position: "asc",
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json({ characters });
  } catch (error) {
    console.error("Erro ao carregar personagens:", error);

    return NextResponse.json(
      { error: "Não foi possível carregar os personagens." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "O nome do personagem é obrigatório." },
        { status: 400 }
      );
    }

    const character = await prisma.character.create({
      data: {
        name,
        summary:
          typeof body.summary === "string" ? body.summary : "",
        appearance:
          typeof body.appearance === "string" ? body.appearance : "",
        hair: typeof body.hair === "string" ? body.hair : "",
        outfit: typeof body.outfit === "string" ? body.outfit : "",
        personality:
          typeof body.personality === "string"
            ? body.personality
            : "",
        visualStyle:
          typeof body.visualStyle === "string"
            ? body.visualStyle
            : "Cinematográfico",
        visualPrompt:
          typeof body.visualPrompt === "string"
            ? body.visualPrompt
            : "",
      },
      include: {
        images: {
          orderBy: {
            position: "asc",
          },
        },
      },
    });

    return NextResponse.json(
      { success: true, character },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar personagem:", error);

    return NextResponse.json(
      { error: "Não foi possível criar o personagem." },
      { status: 500 }
    );
  }
}
