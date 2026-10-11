"use client";

import { useEffect, useState, type ChangeEvent } from "react";

type ImportedVideo = {
  id: string;
  title: string;
  url: string;
  importedAt: string;
};

const STORAGE_KEY = "scena-ai-imported-videos-v1";
const LIBRARY_EVENT = "scena-imported-videos-updated";

export default function ImportedVideos() {
  const [videos, setVideos] = useState<ImportedVideo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  function readLibrary() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) setVideos(parsed as ImportedVideo[]);
    } catch {
      setError("Não foi possível carregar a biblioteca.");
    }
  }

  useEffect(() => {
    readLibrary();
    setLoaded(true);
    const refresh = () => readLibrary();
    window.addEventListener(LIBRARY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LIBRARY_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
    } catch {
      setError("Não foi possível salvar a biblioteca.");
    }
  }, [videos, loaded]);

  async function importVideos(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = input.files;
    if (!files?.length) return;

    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("videos", file));
      const response = await fetch("/api/import-video", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao importar vídeos.");
      setVideos((current) => [...data.videos, ...current]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao importar.");
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  function startEditing(video: ImportedVideo) {
    setEditingId(video.id);
    setEditingTitle(video.title);
  }

  function saveTitle(id: string) {
    const title = editingTitle.trim();
    if (!title) {
      setError("O nome do vídeo não pode ficar vazio.");
      return;
    }
    setVideos((current) => current.map((video) => video.id === id ? { ...video, title } : video));
    setEditingId(null);
    setEditingTitle("");
    setError("");
  }

  function removeVideo(id: string) {
    if (!window.confirm("Remover este vídeo da biblioteca? O arquivo original não será apagado.")) return;
    setVideos((current) => current.filter((video) => video.id !== id));
  }

  return (
    <section className="mt-20 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-neutral-500">Sua biblioteca pessoal</p>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Meus vídeos <span className="ml-3 text-base font-normal text-neutral-500">{videos.length}</span></h2>
          <p className="text-sm text-neutral-400">Todas as suas criações em um só lugar.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200">
          <span className="text-lg">＋</span>{uploading ? "Importando..." : "Importar vídeos"}
          <input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v" multiple className="hidden" disabled={uploading} onChange={importVideos} />
        </label>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-300">{error}</p>}

      {videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-neutral-900 text-2xl">🎬</div>
          <h3 className="font-medium">Sua biblioteca começa aqui</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-500">Importe vídeos que você já criou ou transforme um vídeo no laboratório. Os resultados gerados serão adicionados aqui automaticamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {videos.map((video) => (
            <article key={video.id} className="group overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 transition duration-300 hover:-translate-y-1 hover:border-neutral-600 hover:shadow-xl hover:shadow-black/30">
              <div className="relative overflow-hidden bg-black">
                <video src={video.url} controls preload="metadata" playsInline className="aspect-video w-full object-contain" />
                <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-[10px] uppercase tracking-wider text-neutral-300">SCENA · VÍDEO</div>
              </div>
              <div className="space-y-4 p-5">
                {editingId === video.id ? (
                  <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); saveTitle(video.id); }}>
                    <label className="block text-xs text-neutral-400">Nome do vídeo</label>
                    <input autoFocus value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} maxLength={100} className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-400" placeholder="Ex.: A cidade perdida" />
                    <div className="flex gap-2">
                      <button type="submit" className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-neutral-200">Salvar nome</button>
                      <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-900">Cancelar</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-semibold leading-snug">{video.title}</h3>
                      {video.importedAt && <p className="mt-1 text-xs text-neutral-600">{new Date(video.importedAt).toLocaleDateString("pt-BR")}</p>}
                    </div>
                    <button type="button" onClick={() => startEditing(video)} title="Renomear vídeo" aria-label={`Renomear ${video.title}`} className="shrink-0 rounded-lg border border-neutral-800 px-3 py-2 text-xs text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-900">Editar</button>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 pt-4">
                  <a href={video.url} target="_blank" rel="noreferrer" className="text-sm text-neutral-300 underline decoration-neutral-700 underline-offset-4 hover:text-white">Abrir vídeo ↗</a>
                  <button type="button" onClick={() => removeVideo(video.id)} className="text-xs text-red-400 transition hover:text-red-300">Remover da lista</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="text-xs text-neutral-600">Os nomes e a lista são salvos neste navegador. Os vídeos gerados são adicionados automaticamente à biblioteca. Remover da lista não apaga o arquivo de vídeo.</p>
    </section>
  );
}
