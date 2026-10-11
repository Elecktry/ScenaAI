
"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

type Status =
  | "idle"
  | "uploading"
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "nsfw"
  | "error";

type SavedVideo = {
  id: string;
  title: string;
  url: string;
  importedAt: string;
};

const LIBRARY_KEY = "scena-ai-imported-videos-v1";
const LIBRARY_EVENT = "scena-imported-videos-updated";
const POLL_MS = 4000;
const MAX_POLLS = 180;

function saveToLibrary(url: string): boolean {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const videos: SavedVideo[] = Array.isArray(parsed) ? parsed : [];

    if (videos.some((item) => item.url === url)) {
      return true;
    }

    const item: SavedVideo = {
      id: crypto.randomUUID(),
      title: `SCENA.AI — ${new Date().toLocaleString("pt-BR")}`,
      url,
      importedAt: new Date().toISOString(),
    };

    localStorage.setItem(
      LIBRARY_KEY,
      JSON.stringify([item, ...videos])
    );

    window.dispatchEvent(new Event(LIBRARY_EVENT));
    return true;
  } catch (err) {
    console.error("Falha ao salvar vídeo na biblioteca:", err);
    return false;
  }
}

export default function VideoTransform() {
  const videoInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const polling = useRef(false);

  const [video, setVideo] = useState<File | null>(null);
  const [references, setReferences] = useState<File[]>([]);
  const [prompt, setPrompt] = useState(
    "Replace the main person in the original video with the character shown in the reference images. Preserve the original movements, timing, camera movement and scene composition as closely as possible."
  );
  const [resolution, setResolution] = useState("480p");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [requestId, setRequestId] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading) return;

    const timer = window.setInterval(
      () => setElapsed((n) => n + 1),
      1000
    );

    return () => window.clearInterval(timer);
  }, [loading]);

  function formatTime(n: number) {
    return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(
      n % 60
    ).padStart(2, "0")}`;
  }

  async function pollGeneration(id: string) {
    if (polling.current) return;

    polling.current = true;
    setLoading(true);
    setError("");
    setRequestId(id);

    try {
      for (let i = 0; i < MAX_POLLS; i++) {
        const response = await fetch(
          `/api/status?requestId=${encodeURIComponent(id)}`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Não foi possível consultar a geração."
          );
        }

        const videoUrl = data.videoUrl ?? data.video?.url ?? data.video;

        if (data.status === "completed" && videoUrl) {
          setResultUrl(videoUrl);
          setStatus("completed");
          setRequestId("");
          setSaved(saveToLibrary(videoUrl));
          return;
        }

        if (data.status === "failed" || data.status === "nsfw") {
          setStatus(data.status);
          setError(
            data.error ||
            (data.status === "nsfw"
              ? "A geração foi bloqueada pelo filtro de conteúdo."
              : "A Higgsfield informou que a geração falhou.")
          );
          setRequestId("");
          return;
        }

        if (
          !["queued", "in_progress", "processing"].includes(data.status)
        ) {
          throw new Error(
            `Status inesperado: ${data.status || "desconhecido"}`
          );
        }

        setStatus(
          data.status === "queued" ? "queued" : "in_progress"
        );

        if (i < MAX_POLLS - 1) {
          await new Promise((resolve) =>
            window.setTimeout(resolve, POLL_MS)
          );
        }
      }

      setError(
        "A geração pode continuar em andamento. Continue acompanhando a mesma solicitação, sem reenviar os arquivos."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível acompanhar a geração."
      );
    } finally {
      polling.current = false;
      setLoading(false);
    }
  }

  async function transformVideo() {
    if (!video) {
      setError("Selecione o vídeo original primeiro.");
      return;
    }

    if (references.length === 0) {
      setError("Adicione pelo menos uma imagem do personagem.");
      return;
    }

    if (loading) return;

    setLoading(true);
    setStatus("uploading");
    setError("");
    setResultUrl("");
    setRequestId("");
    setSaved(false);
    setElapsed(0);

    try {
      const formData = new FormData();

      formData.append("video", video);
      formData.append("prompt", prompt);
      formData.append("resolution", resolution);

      references.forEach((file) => {
        formData.append("references", file);
      });

      const response = await fetch("/api/transform-video", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Não foi possível enviar a solicitação."
        );
      }

      if (data.videoUrl) {
        setResultUrl(data.videoUrl);
        setStatus("completed");
        setSaved(saveToLibrary(data.videoUrl));
        return;
      }

      if (!data.requestId) {
        throw new Error(
          data.error || "A Higgsfield não retornou o ID da geração."
        );
      }

      setRequestId(data.requestId);
      setStatus(data.status === "queued" ? "queued" : "in_progress");

      setLoading(false);
      await pollGeneration(data.requestId);
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Ocorreu um erro inesperado."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleVideoChange(event: ChangeEvent<HTMLInputElement>) {
    setVideo(event.target.files?.[0] ?? null);
    setResultUrl("");
    setError("");
    setStatus("idle");
    setSaved(false);
    event.target.value = "";
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const valid = files.filter((file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type)
    );

    setError(
      valid.length !== files.length
        ? "Use somente imagens JPG, PNG ou WEBP."
        : ""
    );

    setReferences((current) =>
      [...current, ...valid].slice(0, 8)
    );

    setResultUrl("");
    setSaved(false);
    event.target.value = "";
  }

  const processing = [
    "uploading",
    "queued",
    "in_progress",
  ].includes(status);

  return (
    <section
      id="transformar-video"
      className="mt-10 w-full max-w-5xl rounded-3xl border border-white/10 bg-zinc-950 p-5 sm:p-8"
    >
      <div className="mb-8">
        <p className="mb-3 text-xs tracking-[0.25em] text-zinc-500">
          LABORATÓRIO DE IA
        </p>

        <h2 className="text-2xl font-semibold sm:text-3xl">
          Transformar vídeo
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
          Envie um vídeo, escolha um personagem de referência e transforme
          a aparência do protagonista preservando os movimentos originais.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="mb-3 block text-sm font-medium">
            01 — Vídeo original
          </label>

          <button
            type="button"
            onClick={() => videoInput.current?.click()}
            disabled={processing}
            className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black p-5 text-center transition hover:border-white/50 disabled:opacity-50"
          >
            <span className="mb-3 text-3xl">▶</span>
            <span className="text-sm">
              {video ? "Trocar vídeo" : "Selecionar vídeo"}
            </span>
            <span className="mt-2 max-w-full break-all text-xs text-zinc-500">
              {video
                ? `${video.name} · ${(video.size / 1024 / 1024).toFixed(1)} MB`
                : "MP4, WEBM ou MOV · até 200 MB"}
            </span>
          </button>

          <input
            ref={videoInput}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            disabled={processing}
            onChange={handleVideoChange}
          />

          {video && (
            <video
              key={video.name + video.size}
              src={URL.createObjectURL(video)}
              controls
              playsInline
              className="mt-4 max-h-64 w-full rounded-xl bg-black"
            />
          )}
        </div>

        <div>
          <label className="mb-3 block text-sm font-medium">
            02 — Personagem de referência
          </label>

          <button
            type="button"
            onClick={() => imageInput.current?.click()}
            disabled={processing}
            className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black p-5 text-center transition hover:border-white/50 disabled:opacity-50"
          >
            <span className="mb-3 text-3xl">＋</span>
            <span className="text-sm">Adicionar imagens</span>
            <span className="mt-2 text-xs text-zinc-500">
              JPG, PNG ou WEBP · até 8 imagens
            </span>
          </button>

          <input
            ref={imageInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            disabled={processing}
            onChange={handleImageChange}
          />

          {references.length > 0 && (
            <div className="mt-4 space-y-2">
              {references.map((file, index) => (
                <div
                  key={`${file.name}-${file.size}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3"
                >
                  <span className="min-w-0 truncate text-xs text-zinc-300">
                    {file.name}
                  </span>

                  <button
                    type="button"
                    disabled={processing}
                    onClick={() =>
                      setReferences((current) =>
                        current.filter((_, i) => i !== index)
                      )
                    }
                    className="shrink-0 text-xs text-zinc-500 hover:text-red-300 disabled:opacity-40"
                  >
                    Remover
                  </button>
                </div>
              ))}

              <p className="text-xs text-zinc-500">
                {references.length} de 8 imagens selecionadas
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-5">
        <div>
          <label
            htmlFor="transform-prompt"
            className="mb-2 block text-sm font-medium"
          >
            03 — Como deve ser a transformação?
          </label>

          <textarea
            id="transform-prompt"
            value={prompt}
            disabled={processing}
            onChange={(event) => setPrompt(event.target.value)}
            rows={5}
            maxLength={10000}
            placeholder="Descreva como o personagem deve aparecer no vídeo..."
            className="w-full resize-y rounded-xl border border-white/10 bg-black p-4 text-sm leading-7 outline-none transition focus:border-white/30 disabled:opacity-60"
          />

          <p className="mt-2 text-xs text-zinc-600">
            {prompt.length}/10.000 caracteres
          </p>
        </div>

        <div>
          <label
            htmlFor="transform-resolution"
            className="mb-2 block text-sm font-medium"
          >
            Resolução
          </label>

          <select
            id="transform-resolution"
            value={resolution}
            disabled={processing}
            onChange={(event) => setResolution(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black p-3 text-sm outline-none focus:border-white/30 disabled:opacity-60 sm:w-56"
          >
            <option value="480p">480p — teste inicial</option>
            <option value="720p">720p — maior resolução</option>
          </select>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={transformVideo}
          disabled={processing || !video || references.length === 0}
          className="w-full rounded-xl bg-white px-6 py-4 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {processing
            ? "Produzindo seu vídeo..."
            : status === "completed"
              ? "Gerar nova versão"
              : "Transformar com IA"}
        </button>

        {processing && (
          <div
            role="status"
            aria-live="polite"
            className="overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/30 to-zinc-950 p-5 sm:p-6"
          >
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10">
                <span className="size-5 animate-spin rounded-full border-2 border-violet-300/30 border-t-violet-300" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">
                  {status === "uploading"
                    ? "Preparando seus arquivos..."
                    : status === "queued"
                      ? "Sua criação está na fila"
                      : "Sua transformação está acontecendo"}
                </p>

                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {status === "uploading"
                    ? "Estamos enviando o vídeo e as referências."
                    : status === "queued"
                      ? "A Higgsfield recebeu sua solicitação. Estamos aguardando o início da geração."
                      : "A IA está trabalhando no seu vídeo. Isso pode levar alguns minutos."}
                </p>

                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-violet-400" />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                  <span>Tempo decorrido: {formatTime(elapsed)}</span>
                  <span>Sem porcentagem falsa de progresso</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && requestId && !resultUrl && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4">
            <p className="text-sm text-amber-200">
              A geração ainda pode estar em andamento.
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Continue consultando a mesma solicitação, sem reenviar os arquivos.
            </p>
            <button
              type="button"
              onClick={() => {
                setElapsed(0);
                void pollGeneration(requestId);
              }}
              className="mt-4 rounded-lg border border-amber-400/30 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-400/10"
            >
              Continuar acompanhando
            </button>
          </div>
        )}
      </div>

      {(status === "failed" || status === "nsfw") && (
        <div className="mt-6 rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 text-sm text-amber-200">
          {status === "nsfw"
            ? "A solicitação foi bloqueada pelo filtro de conteúdo da Higgsfield."
            : "A geração falhou. Confira os detalhes antes de tentar novamente."}
        </div>
      )}

      {resultUrl && (
        <div className="mt-10 border-t border-white/10 pt-8">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              ✓
            </span>
            <div>
              <p className="font-medium text-white">Seu vídeo está pronto!</p>
              <p className="mt-1 text-sm text-zinc-400">
                {saved
                  ? "O resultado também foi salvo em Meus vídeos."
                  : "A transformação foi concluída com sucesso."}
              </p>
            </div>
          </div>

          <video
            key={resultUrl}
            src={resultUrl}
            controls
            playsInline
            preload="metadata"
            className="max-h-[600px] w-full rounded-2xl border border-white/10 bg-black"
          />

          <a
            href={resultUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex rounded-xl border border-white/15 px-4 py-3 text-sm transition hover:bg-white/5"
          >
            Abrir vídeo gerado ↗
          </a>
        </div>
      )}
    </section>
  );
}
