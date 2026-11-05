
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type RouteContext = {
  params: Promise<{
    id: string;
    imageId: string;
  }>;
};

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user ?? null;
}

export async function PATCH(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const { id, imageId } = await params;

    const character = await prisma.character.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!character) {
      return NextResponse.json(
        { error: "Personagem não encontrado." },
        { status: 404 }
      );
    }

    const selectedImage = await prisma.characterImage.findFirst({
      where: {
        id: imageId,
        characterId: id,
      },
    });

    if (!selectedImage) {
      return NextResponse.json(
        { error: "Imagem não encontrada para este personagem." },
        { status: 404 }
      );
    }

    const images = await prisma.$transaction(async (tx) => {
      const characterImages = await tx.characterImage.findMany({
        where: { characterId: id },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      });

      for (let index = 0; index < characterImages.length; index++) {
        await tx.characterImage.update({
          where: { id: characterImages[index].id },
          data: { position: -(index + 1) },
        });
      }

      await tx.characterImage.update({
        where: { id: imageId },
        data: { position: 0 },
      });

      let nextPosition = 1;

      for (const image of characterImages) {
        if (image.id === imageId) continue;

        await tx.characterImage.update({
          where: { id: image.id },
          data: { position: nextPosition++ },
        });
      }

      return tx.characterImage.findMany({
        where: { characterId: id },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      });
    });

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Erro ao definir imagem como capa:", error);

    return NextResponse.json(
      { error: "Não foi possível definir a imagem como capa." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const { id, imageId } = await params;

    const character = await prisma.character.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!character) {
      return NextResponse.json(
        { error: "Personagem não encontrado." },
        { status: 404 }
      );
    }

    const image = await prisma.characterImage.findFirst({
      where: {
        id: imageId,
        characterId: id,
      },
    });

    if (!image) {
      return NextResponse.json(
        { error: "Imagem não encontrada para este personagem." },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.characterImage.delete({
        where: { id: imageId },
      });

      const remainingImages = await tx.characterImage.findMany({
        where: { characterId: id },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      });

      for (let index = 0; index < remainingImages.length; index++) {
        await tx.characterImage.update({
          where: { id: remainingImages[index].id },
          data: { position: -(index + 1) },
        });
      }

      for (let index = 0; index < remainingImages.length; index++) {
        await tx.characterImage.update({
          where: { id: remainingImages[index].id },
          data: { position: index },
        });
      }
    });

    const images = await prisma.characterImage.findMany({
      where: { characterId: id },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    });

    return NextResponse.json({
      success: true,
      images,
    });
  } catch (error) {
    console.error("Erro ao remover imagem:", error);

    return NextResponse.json(
      { error: "Não foi possível remover a imagem." },
      { status: 500 }
    );
  }
}
