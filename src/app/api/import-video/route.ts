
import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("videos");

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Selecione pelo menos um vídeo." },
        { status: 400 }
      );
    }

    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "imported-videos"
    );

    await mkdir(uploadDirectory, { recursive: true });

    const importedVideos = [];

    for (const item of files) {
      if (!(item instanceof File)) continue;

      if (!item.type.startsWith("video/")) {
        return NextResponse.json(
          { error: `O arquivo ${item.name} não é um vídeo.` },
          { status: 400 }
        );
      }

      if (item.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `${item.name} ultrapassa o limite de 500 MB.` },
          { status: 413 }
        );
      }

      const extension = path.extname(item.name).toLowerCase();

      if (![".mp4", ".webm", ".mov", ".m4v"].includes(extension)) {
        return NextResponse.json(
          { error: `Formato não permitido: ${item.name}` },
          { status: 400 }
        );
      }

      const fileName = `${randomUUID()}${extension}`;
      const filePath = path.join(uploadDirectory, fileName);
      const buffer = Buffer.from(await item.arrayBuffer());

      await writeFile(filePath, buffer);

      importedVideos.push({
        id: randomUUID(),
        title: item.name.replace(/\.[^.]+$/, ""),
        url: `/imported-videos/${fileName}`,
        importedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ videos: importedVideos });
  } catch (error) {
    console.error("Erro ao importar vídeos:", error);

    return NextResponse.json(
      { error: "Não foi possível importar os vídeos." },
      { status: 500 }
    );
  }
}
