
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user ?? null;
}

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const character = await prisma.character.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        images: {
          orderBy: { position: "asc" },
        },
      },
    });

    if (!character) {
      return NextResponse.json(
        { error: "Personagem não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ character });
  } catch (error) {
    console.error("Falha ao consultar personagem:", error);

    return NextResponse.json(
      { error: "Não foi possível consultar o personagem." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const body = await request.json();
    const data: Record<string, string> = {};

    const fields = [
      "name",
      "summary",
      "appearance",
      "hair",
      "outfit",
      "personality",
      "visualStyle",
      "visualPrompt",
    ];

    for (const field of fields) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== "string") {
          return NextResponse.json(
            { error: `O campo ${field} deve ser texto.` },
            { status: 400 }
          );
        }

        data[field] = body[field]
          .trim()
          .slice(0, field === "name" ? 100 : 10000);
      }
    }

    if ("name" in data && !data.name) {
      return NextResponse.json(
        { error: "O nome não pode ficar vazio." },
        { status: 400 }
      );
    }

    const result = await prisma.character.updateMany({
      where: {
        id,
        userId: user.id,
      },
      data: data as Prisma.CharacterUpdateManyMutationInput,
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Personagem não encontrado." },
        { status: 404 }
      );
    }

    const character = await prisma.character.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        images: {
          orderBy: { position: "asc" },
        },
      },
    });

    return NextResponse.json({ character });
  } catch (error) {
    console.error("Falha ao atualizar personagem:", error);

    return NextResponse.json(
      { error: "Não foi possível atualizar o personagem." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const result = await prisma.character.deleteMany({
      where: {
        id,
        userId: user.id,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Personagem não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Falha ao excluir personagem:", error);

    return NextResponse.json(
      { error: "Não foi possível excluir o personagem." },
      { status: 500 }
    );
  }
}
