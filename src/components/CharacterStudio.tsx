
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type CharacterImage = {
  id: string;
  url: string;
  position: number;
  mimeType?: string | null;
};

type Character = {
  id: string;
  name: string;
  summary: string;
  appearance: string;
  hair: string;
  outfit: string;
  personality: string;
  visualStyle: string;
  visualPrompt: string;
  updatedAt: string;
  images: CharacterImage[];
};

type CharacterForm = Omit<Character, "id" | "updatedAt" | "images">;

const EMPTY_FORM: CharacterForm = {
  name: "",
  summary: "",
  appearance: "",
  hair: "",
  outfit: "",
  personality: "",
  visualStyle: "Cinematográfico",
  visualPrompt: "",
};

const inputClass =
  "mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30";

const labelClass = "block text-sm font-medium text-zinc-300";

export default function CharacterStudio() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [form, setForm] = useState<CharacterForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [galleryCharacter, setGalleryCharacter] = useState<Character | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [settingCoverImageId, setSettingCoverImageId] = useState<string | null>(null);

  const loadCharacters = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/characters", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível carregar os personagens.");
      }

      setCharacters(Array.isArray(data.characters) ? data.characters : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar personagens.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCharacters();
  }, [loadCharacters]);

  function updateField<K extends keyof CharacterForm>(
    key: K,
    value: CharacterForm[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError("");
  }

  function startEditing(character: Character) {
    setForm({
      name: character.name ?? "",
      summary: character.summary ?? "",
      appearance: character.appearance ?? "",
      hair: character.hair ?? "",
      outfit: character.outfit ?? "",
      personality: character.personality ?? "",
      visualStyle: character.visualStyle ?? "Cinematográfico",
      visualPrompt: character.visualPrompt ?? "",
    });

    setEditingId(character.id);
    setNotice("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);

    try {
      const response = await fetch(
        editingId ? `/api/characters/${editingId}` : "/api/characters",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível salvar o personagem.");
      }

      setNotice(
        editingId
          ? "Personagem atualizado com sucesso."
          : "Personagem criado com sucesso."
      );

      resetForm();
      await loadCharacters();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar personagem.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadReferenceImage(
    character: Character,
    file: File | undefined
  ) {
    if (!file) return;

    setError("");
    setNotice("");
    setUploadingId(character.id);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch(
        `/api/characters/${character.id}/images`,
        {
          method: "POST",
          body,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível enviar a imagem.");
      }

      setNotice(`Imagem adicionada a ${character.name}.`);
      await loadCharacters();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar imagem.");
    } finally {
      setUploadingId(null);
    }
  }

  async function deleteReferenceImage(
    character: Character,
    image: CharacterImage
  ) {
    const confirmed = window.confirm(
      "Remover esta imagem de referência? Essa ação não pode ser desfeita."
    );

    if (!confirmed) return;

    setError("");
    setNotice("");
    setDeletingImageId(image.id);

    try {
      const response = await fetch(
        `/api/characters/${character.id}/images/${image.id}`,
        { method: "DELETE" }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível remover a imagem.");
      }

      setNotice("Imagem de referência removida.");
      await loadCharacters();

      setGalleryCharacter((current) =>
        current?.id === character.id
          ? {
              ...current,
              images: current.images.filter((item) => item.id !== image.id),
            }
          : current
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao remover imagem.");
    } finally {
      setDeletingImageId(null);
    }
  }

  async function setCharacterImageCover(
    character: Character,
    image: CharacterImage
  ) {
    setError("");
    setNotice("");
    setSettingCoverImageId(image.id);

    try {
      const response = await fetch(
        `/api/characters/${character.id}/images/${image.id}`,
        { method: "PATCH" }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível definir a capa.");
      }

      const updatedImages: CharacterImage[] = data.images ?? [];

      setCharacters((current) =>
        current.map((item) =>
          item.id === character.id
            ? { ...item, images: updatedImages }
            : item
        )
      );

      setGalleryCharacter((current) =>
        current?.id === character.id
          ? { ...current, images: updatedImages }
          : current
      );

      setNotice("Capa do personagem atualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao definir a capa.");
    } finally {
      setSettingCoverImageId(null);
    }
  }

  async function deleteCharacter(character: Character) {
    const confirmed = window.confirm(
      `Excluir o personagem “${character.name}”? Essa ação não pode ser desfeita.`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/characters/${character.id}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível excluir o personagem.");
      }

      if (editingId === character.id) resetForm();

      setCharacters((current) =>
        current.filter((item) => item.id !== character.id)
      );

      if (galleryCharacter?.id === character.id) {
        setGalleryCharacter(null);
      }

      setNotice("Personagem excluído.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir personagem.");
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
            SCENA.AI / ASSETS
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Character Studio
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Crie e organize personagens recorrentes para manter a identidade
            visual dos seus projetos. Os dados são salvos no PostgreSQL local.
            O envio de referências não usa créditos de IA.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setNotice("");
          }}
          className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white transition hover:bg-white/10"
        >
          + Novo personagem
        </button>
      </div>

      {(error || notice) && (
        <div
          role="status"
          className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
            error
              ? "border-red-400/30 bg-red-950/30 text-red-200"
              : "border-emerald-400/20 bg-emerald-950/20 text-emerald-200"
          }`}
        >
          {error || notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="h-fit rounded-2xl border border-white/10 bg-zinc-950/70 p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">
              {editingId ? "Editar personagem" : "Ficha do personagem"}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Preencha manualmente. A assistência por IA pode ser adicionada depois.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className={labelClass}>
              Nome *
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                maxLength={100}
                required
                placeholder="Ex.: Aurora Vale"
              />
            </label>

            <label className={labelClass}>
              Resumo
              <textarea
                className={inputClass}
                value={form.summary}
                onChange={(e) => updateField("summary", e.target.value)}
                rows={2}
                maxLength={10000}
                placeholder="Quem é esse personagem?"
              />
            </label>

            <label className={labelClass}>
              Aparência física
              <textarea
                className={inputClass}
                value={form.appearance}
                onChange={(e) => updateField("appearance", e.target.value)}
                rows={3}
                maxLength={10000}
                placeholder="Características visuais, idade adulta aproximada, expressão..."
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Cabelo
                <input
                  className={inputClass}
                  value={form.hair}
                  onChange={(e) => updateField("hair", e.target.value)}
                  maxLength={10000}
                  placeholder="Cor, corte, textura"
                />
              </label>

              <label className={labelClass}>
                Roupa
                <input
                  className={inputClass}
                  value={form.outfit}
                  onChange={(e) => updateField("outfit", e.target.value)}
                  maxLength={10000}
                  placeholder="Peças e cores"
                />
              </label>
            </div>

            <label className={labelClass}>
              Personalidade
              <textarea
                className={inputClass}
                value={form.personality}
                onChange={(e) => updateField("personality", e.target.value)}
                rows={2}
                maxLength={10000}
                placeholder="Motivações, comportamento, voz..."
              />
            </label>

            <label className={labelClass}>
              Estilo visual
              <select
                className={inputClass}
                value={form.visualStyle}
                onChange={(e) => updateField("visualStyle", e.target.value)}
              >
                <option>Cinematográfico</option>
                <option>Realista</option>
                <option>Animação 3D</option>
                <option>Anime</option>
                <option>Ilustração</option>
                <option>Fantasia sombria</option>
                <option>Ficção científica</option>
                <option>Personalizado</option>
              </select>
            </label>

            <label className={labelClass}>
              Prompt visual / notas de continuidade
              <textarea
                className={inputClass}
                value={form.visualPrompt}
                onChange={(e) => updateField("visualPrompt", e.target.value)}
                rows={3}
                maxLength={10000}
                placeholder="Detalhes que devem permanecer consistentes entre cenas..."
              />
            </label>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                disabled={saving}
                type="submit"
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Salvando..."
                  : editingId
                    ? "Salvar alterações"
                    : "Salvar personagem"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5"
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </form>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Sua galeria</h2>
              <p className="mt-1 text-xs text-zinc-500">
                {characters.length} personagem(ns) salvo(s)
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadCharacters()}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
            >
              Atualizar
            </button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 p-8 text-center text-sm text-zinc-400">
              Carregando personagens...
            </div>
          ) : characters.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xl">
                ✦
              </div>
              <h3 className="font-medium text-white">Sua galeria começa aqui</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                Crie seu primeiro personagem no formulário. Ele será salvo no banco local.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {characters.map((character) => (
                <article
                  key={character.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70 transition hover:border-white/20"
                >
                  <div className="relative flex aspect-[16/7] items-center justify-center border-b border-white/10 bg-gradient-to-br from-zinc-800 via-zinc-950 to-black">
                    {character.images?.[0]?.url ? (
                      <>
                        <img
                          src={character.images[0].url}
                          alt={character.name}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                          Capa
                        </span>
                      </>
                    ) : (
                      <div className="text-4xl text-zinc-700">✦</div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-white">
                          {character.name}
                        </h3>
                        <p className="mt-1 text-xs text-zinc-500">
                          {character.visualStyle || "Cinematográfico"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[10px] text-zinc-400">
                        {character.images?.length ?? 0} imagens
                      </span>
                    </div>

                    <p className="mt-3 line-clamp-3 min-h-12 text-sm leading-5 text-zinc-400">
                      {character.summary ||
                        character.appearance ||
                        "Sem descrição adicionada ainda."}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <button
                        type="button"
                        onClick={() => startEditing(character)}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white hover:bg-white/10"
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => setGalleryCharacter(character)}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-200 hover:bg-white/10"
                      >
                        Galeria
                      </button>

                      <label
                        className={`cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-center text-xs text-zinc-200 hover:bg-white/10 ${
                          uploadingId === character.id
                            ? "pointer-events-none opacity-50"
                            : ""
                        }`}
                      >
                        {uploadingId === character.id ? "Enviando…" : "+ Imagem"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          disabled={uploadingId === character.id}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            void uploadReferenceImage(character, file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => void deleteCharacter(character)}
                        className="rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-300 hover:bg-red-950/40"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {galleryCharacter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Galeria de ${galleryCharacter.name}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setGalleryCharacter(null);
          }}
        >
          <section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/15 bg-zinc-950 p-5 shadow-2xl sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  SCENA.AI / REFERÊNCIAS
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  {galleryCharacter.name}
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {galleryCharacter.images?.length ?? 0} imagem(ns) de referência
                </p>
              </div>

              <button
                type="button"
                onClick={() => setGalleryCharacter(null)}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10"
              >
                Fechar ✕
              </button>
            </div>

            {galleryCharacter.images?.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {galleryCharacter.images.map((image, index) => (
                  <article
                    key={image.id}
                    className="overflow-hidden rounded-xl border border-white/10 bg-black"
                  >
                    <a
                      href={image.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block bg-zinc-900"
                      title="Abrir imagem em tamanho original"
                    >
                      <img
                        src={image.url}
                        alt={`${galleryCharacter.name} — referência ${index + 1}`}
                        className="aspect-[4/3] w-full object-contain"
                      />
                    </a>

                    <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">
                          Referência {index + 1}
                        </span>

                        {index === 0 && (
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                            Capa atual
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {index !== 0 && (
                          <button
                            type="button"
                            disabled={settingCoverImageId !== null}
                            onClick={() =>
                              void setCharacterImageCover(galleryCharacter, image)
                            }
                            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {settingCoverImageId === image.id
                              ? "Definindo…"
                              : "Definir como capa"}
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={deletingImageId === image.id}
                          onClick={() =>
                            void deleteReferenceImage(galleryCharacter, image)
                          }
                          className="rounded-lg border border-red-400/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                        >
                          {deletingImageId === image.id ? "Removendo…" : "Remover"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 p-10 text-center">
                <p className="text-zinc-300">
                  Ainda não há imagens para este personagem.
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  Feche esta janela e use “+ Imagem” no card para enviar uma referência.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
