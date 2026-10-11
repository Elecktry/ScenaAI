"use client";

import { useEffect, useState } from "react";
import ImportedVideos from "@/components/ImportedVideos";
import VideoTransform from "@/components/VideoTransform";
import CharacterStudio from "@/components/CharacterStudio";

type Character = { id: string; name: string; description: string };
type Location = { id: string; name: string; description: string };
type Scene = {
  id: number;
  title: string;
  description: string;
  duration: number;
  camera: string;
  atmosphere: string;
  visualStyle: string;
  prompt: string;
  status: "pending" | "generating" | "completed" | "error";
  videoUrl?: string;
  requestId?: string;
};
type Project = {
  title: string;
  idea: string;
  visualStyle: string;
  characters: Character[];
  locations: Location[];
  scenes: Scene[];
};
type SavedProject = {
  id: string;
  createdAt: string;
  updatedAt: string;
  data: Project;
};
type AppView =
  | "home"
  | "projects"
  | "films"
  | "transform"
  | "library"
  | "characters";


const STORAGE_KEY = "scena-ai-projects-v1";

export default function Home() {
  const [recentVideos, setRecentVideos] = useState<
    Array<{ id: string; title: string; url: string; importedAt: string }>
  >([]);
  const [idea, setIdea] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingScene, setEditingScene] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [view, setView] = useState<AppView>("home");
  const [projectSearch, setProjectSearch] = useState("");
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SavedProject | null>(null);

  // Load saved projects without automatically opening the last edited project.
  useEffect(() => {
    const storageKey = "scena-ai-imported-videos-v1";
    const eventName = "scena-imported-videos-updated";

    function loadVideos() {
      try {
        const stored = localStorage.getItem(storageKey);
        const parsed: unknown = stored ? JSON.parse(stored) : [];

        setRecentVideos(Array.isArray(parsed) ? parsed : []);
      } catch (error) {
        console.error("Não foi possível carregar os vídeos recentes.", error);
        setRecentVideos([]);
      }
    }

    loadVideos();

    window.addEventListener(eventName, loadVideos);
    window.addEventListener("storage", loadVideos);

    return () => {
      window.removeEventListener(eventName, loadVideos);
      window.removeEventListener("storage", loadVideos);
    };
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.projects)) setSavedProjects(parsed.projects);
        setActiveProjectId(parsed.activeProjectId ?? null);
      }
    } catch (error) {
      console.error("Não foi possível carregar os projetos salvos.", error);
    } finally {
      setStorageLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!storageLoaded) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ projects: savedProjects, activeProjectId })
      );
    } catch (error) {
      console.error("Não foi possível salvar os projetos.", error);
    }
  }, [savedProjects, activeProjectId, storageLoaded]);

  // Keep edits synchronized with the selected saved project.
  useEffect(() => {
    if (!storageLoaded || !project || !activeProjectId) return;
    setSavedProjects((current) => {
      const existing = current.find((item) => item.id === activeProjectId);
      if (!existing || JSON.stringify(existing.data) === JSON.stringify(project)) return current;
      return current.map((item) =>
        item.id === activeProjectId
          ? { ...item, data: project, updatedAt: new Date().toISOString() }
          : item
      );
    });
  }, [project, activeProjectId, storageLoaded]);

  async function createProject() {
    if (!idea.trim() || loading) return;
    setLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.project) {
        throw new Error(data.error || "Não foi possível criar o projeto.");
      }
      const now = new Date().toISOString();
      const newSavedProject: SavedProject = {
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        data: data.project,
      };
      setSavedProjects((current) => [newSavedProject, ...current]);
      setActiveProjectId(newSavedProject.id);
      setProject(data.project);
      setView("films");
      setIdea("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Ocorreu um erro ao criar o projeto.");
    } finally {
      setLoading(false);
    }
  }

  function openSavedProject(item: SavedProject) {
    setActiveProjectId(item.id);
    setProject(item.data);
    setEditingScene(null);
    setErrorMessage("");
    setView("films");
  }

  function startNewFilm() {
    setProject(null);
    setActiveProjectId(null);
    setEditingScene(null);
    setErrorMessage("");
    setView("films");
  }

  function beginRename(item: SavedProject) {
    setRenamingProjectId(item.id);
    setRenameValue(item.data.title || "Projeto sem título");
  }

  function saveRename() {
    const title = renameValue.trim();
    if (!renamingProjectId || !title) return;
    setSavedProjects((current) => current.map((item) =>
      item.id === renamingProjectId
        ? { ...item, data: { ...item.data, title }, updatedAt: new Date().toISOString() }
        : item
    ));
    if (activeProjectId === renamingProjectId && project) {
      setProject({ ...project, title });
    }
    setRenamingProjectId(null);
    setRenameValue("");
  }

  function deleteProject() {
    if (!deleteTarget) return;
    const deletedId = deleteTarget.id;
    setSavedProjects((current) => current.filter((item) => item.id !== deletedId));
    if (activeProjectId === deletedId) {
      setActiveProjectId(null);
      setProject(null);
      setEditingScene(null);
      setView("projects");
    }
    setDeleteTarget(null);
  }

  const filteredProjects = savedProjects.filter((item) => {
    const query = projectSearch.trim().toLocaleLowerCase("pt-BR");
    return !query || item.data.title.toLocaleLowerCase("pt-BR").includes(query) ||
      item.data.idea.toLocaleLowerCase("pt-BR").includes(query);
  });

  function updateScene<K extends keyof Scene>(sceneId: number, field: K, value: Scene[K]) {
    setProject((current) => {
      if (!current) return current;
      return {
        ...current,
        scenes: current.scenes.map((scene) =>
          scene.id === sceneId ? { ...scene, [field]: value } : scene
        ),
      };
    });
  }

  function moveScene(sceneId: number, direction: -1 | 1) {
    setProject((current) => {
      if (!current) return current;
      const scenes = [...current.scenes];
      const index = scenes.findIndex((scene) => scene.id === sceneId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= scenes.length) return current;
      if (scenes[index].status === "generating" || scenes[targetIndex].status === "generating") return current;
      [scenes[index], scenes[targetIndex]] = [scenes[targetIndex], scenes[index]];
      return { ...current, scenes };
    });
  }

  function addScene() {
    if (!project) return;
    const nextId = project.scenes.reduce((maxId, scene) => Math.max(maxId, scene.id), 0) + 1;
    const newScene: Scene = {
      id: nextId,
      title: `Nova cena ${project.scenes.length + 1}`,
      description: "Descreva o que acontece nesta cena.",
      duration: 5,
      camera: "",
      atmosphere: "",
      visualStyle: project.visualStyle || "Cinematográfico",
      prompt: "",
      status: "pending",
    };
    setEditingScene(nextId);
    setProject((current) => current ? { ...current, scenes: [...current.scenes, newScene] } : current);
    setErrorMessage("");
  }

  function removeScene(sceneId: number) {
    const scene = project?.scenes.find((item) => item.id === sceneId);
    if (!scene || scene.status === "generating") return;
    if (!window.confirm(`Excluir a cena “${scene.title}”? Essa ação não pode ser desfeita.`)) return;
    setProject((current) => current ? {
      ...current,
      scenes: current.scenes.filter((item) => item.id !== sceneId),
    } : current);
    if (editingScene === sceneId) setEditingScene(null);
  }

  function saveGeneratedVideo(title: string, url: string) {
    const storageKey = "scena-ai-imported-videos-v1";
    const libraryEvent = "scena-imported-videos-updated";

    try {
      const stored = localStorage.getItem(storageKey);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      const videos: Array<{ id: string; title: string; url: string; importedAt: string }> =
        Array.isArray(parsed) ? parsed : [];

      // Não duplica um vídeo que já foi cadastrado na biblioteca.
      if (videos.some((video) => video.url === url)) return;

      const newVideo = {
        id: crypto.randomUUID(),
        title: title.trim() || "Vídeo gerado pela SCENA.AI",
        url,
        importedAt: new Date().toISOString(),
      };

      localStorage.setItem(storageKey, JSON.stringify([newVideo, ...videos]));
      window.dispatchEvent(new Event(libraryEvent));
    } catch (error) {
      console.error("Erro ao salvar vídeo na biblioteca:", error);
      throw new Error("O vídeo foi gerado, mas não foi possível salvá-lo na biblioteca.");
    }
  }


  async function generateVideo(sceneId: number) {
    if (!project) return;

    const selectedScene = project.scenes.find(
      (scene) => scene.id === sceneId
    );

    if (!selectedScene || selectedScene.status === "generating") return;

    if (!selectedScene.prompt.trim()) {
      setErrorMessage("Escreva um prompt antes de gerar o vídeo.");
      return;
    }

    setErrorMessage("");

    setProject((current) =>
      current
        ? {
          ...current,
          scenes: current.scenes.map((scene) =>
            scene.id === sceneId
              ? {
                ...scene,
                status: "generating",
                requestId: undefined,
              }
              : scene
          ),
        }
        : current
    );

    try {
      // 1. Inicia uma única geração na Higgsfield.
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: selectedScene.prompt,
          duration: selectedScene.duration,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.requestId) {
        throw new Error(
          data.error || "Não foi possível iniciar a geração."
        );
      }

      const requestId = String(data.requestId);

      setProject((current) =>
        current
          ? {
            ...current,
            scenes: current.scenes.map((scene) =>
              scene.id === sceneId
                ? { ...scene, requestId }
                : scene
            ),
          }
          : current
      );

      // 2. Consulta o status da mesma geração a cada 5 segundos.
      let videoUrl: string | null = null;

      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const statusResponse = await fetch(
          `/api/status?requestId=${encodeURIComponent(requestId)}`,
          { cache: "no-store" }
        );

        const statusData = await statusResponse.json();

        if (!statusResponse.ok) {
          throw new Error(
            statusData.error || "Não foi possível consultar a geração."
          );
        }

        const status = String(statusData.status).toLowerCase();

        if (status === "completed") {
          videoUrl = statusData.video;

          if (!videoUrl) {
            throw new Error(
              "A geração terminou, mas a API não retornou a URL do vídeo."
            );
          }

          break;
        }

        if (["failed", "nsfw", "error"].includes(status)) {
          throw new Error(
            statusData.error || `A geração terminou com status: ${status}.`
          );
        }
      }

      if (!videoUrl) {
        throw new Error(
          "A geração ainda não terminou. Aguarde um pouco antes de tentar novamente."
        );
      }

      // 3. Atualiza o storyboard com o vídeo finalizado.
      setProject((current) =>
        current
          ? {
            ...current,
            scenes: current.scenes.map((scene) =>
              scene.id === sceneId
                ? {
                  ...scene,
                  status: "completed",
                  videoUrl: videoUrl!,
                  requestId,
                }
                : scene
            ),
          }
          : current
      );

      // 4. Salva automaticamente na biblioteca existente.
      saveGeneratedVideo(selectedScene.title, videoUrl);

      setErrorMessage("");
    } catch (error) {
      console.error("Erro ao gerar cena:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a geração."
      );

      setProject((current) =>
        current
          ? {
            ...current,
            scenes: current.scenes.map((scene) =>
              scene.id === sceneId
                ? { ...scene, status: "error" }
                : scene
            ),
          }
          : current
      );
    }
  }


  const navItems: { id: AppView; label: string }[] = [
    { id: "home", label: "Início" },
    { id: "projects", label: "Meus filmes" },
    { id: "transform", label: "Transformar vídeo" },
    { id: "characters", label: "Personagens" },
    { id: "library", label: "Biblioteca" },
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <button
            onClick={() => { setView("home"); setErrorMessage(""); }}
            className="text-xl font-bold tracking-tight"
            aria-label="Ir para o início do SCENA.AI"
          >
            SCENA<span className="text-zinc-500">.AI</span>
          </button>
          <nav aria-label="Navegação principal" className="flex flex-wrap items-center gap-1 sm:gap-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setView(item.id); setErrorMessage(""); }}
                aria-current={view === item.id ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-xs transition sm:text-sm ${view === item.id ? "bg-white text-black" : "text-zinc-400 hover:bg-white/10 hover:text-white"}`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {view === "home" ? (
        <section className="mx-auto min-h-[80vh] max-w-7xl px-4 py-10 sm:px-6 lg:py-16">
          <div className="mb-10">
            <p className="mb-3 text-xs tracking-[0.25em] text-zinc-500">AI FILM STUDIO</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Seu próximo filme começa aqui.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
              Crie histórias, transforme vídeos e organize suas produções em um só lugar.
            </p>
          </div>

          <div className="mb-12 grid gap-4 md:grid-cols-3">
            <button onClick={startNewFilm} className="group rounded-2xl border border-white/15 bg-white p-6 text-left text-black transition hover:bg-zinc-200">
              <span className="mb-5 block text-2xl">＋</span>
              <span className="block text-lg font-semibold">Criar novo filme</span>
              <span className="mt-2 block text-sm text-zinc-600">Transforme uma ideia em roteiro e cenas.</span>
              <span className="mt-6 block text-sm font-medium">Começar projeto →</span>
            </button>
            <button onClick={() => setView("transform")} className="rounded-2xl border border-white/10 bg-zinc-950 p-6 text-left transition hover:border-white/30 hover:bg-zinc-900">
              <span className="mb-5 block text-2xl">✳</span>
              <span className="block text-lg font-semibold">Transformar vídeo</span>
              <span className="mt-2 block text-sm leading-6 text-zinc-400">Transforme a aparência dos personagens usando referências.</span>
              <span className="mt-6 block text-sm text-zinc-300">Abrir ferramenta →</span>
            </button>
            <button onClick={() => setView("library")} className="rounded-2xl border border-white/10 bg-zinc-950 p-6 text-left transition hover:border-white/30 hover:bg-zinc-900">
              <span className="mb-5 block text-2xl">▤</span>
              <span className="block text-lg font-semibold">Minha biblioteca</span>
              <span className="mt-2 block text-sm leading-6 text-zinc-400">Reproduza e organize os vídeos que você salvou.</span>
              <span className="mt-6 block text-sm text-zinc-300">Ver vídeos →</span>
            </button>
          </div>

          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Projetos recentes</h2>
              <p className="mt-1 text-sm text-zinc-500">Continue uma produção de onde você parou.</p>
            </div>
            {savedProjects.length > 0 && <button onClick={() => setView("projects")} className="text-sm text-zinc-300 transition hover:text-white">Ver todos os projetos →</button>}
          </div>

          {savedProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center">
              <p className="text-base font-medium">Seu estúdio está pronto.</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">Seus projetos aparecerão aqui assim que você criar seu primeiro filme.</p>
              <button onClick={startNewFilm} className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200">Criar meu primeiro filme</button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {savedProjects.slice(0, 6).map((item) => (
                <article key={item.id} className="rounded-2xl border border-white/10 bg-zinc-950 p-5 transition hover:border-white/25">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <span className="rounded-lg bg-white/5 px-3 py-2 text-xs text-zinc-400">PROJETO</span>
                    <span className="text-xs text-zinc-500">{item.data.scenes?.length ?? 0} cenas</span>
                  </div>
                  <h3 className="truncate text-lg font-medium">{item.data.title}</h3>
                  <p className="mt-2 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-zinc-500">{item.data.idea}</p>
                  <p className="mt-4 text-xs text-zinc-600">Atualizado em {new Date(item.updatedAt).toLocaleDateString("pt-BR")}</p>
                  <button onClick={() => openSavedProject(item)} className="mt-5 w-full rounded-lg border border-white/10 px-4 py-3 text-sm transition hover:bg-white/5">Abrir projeto →</button>
                </article>
              ))}
            </div>
          )}
          <section className="mt-12">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Vídeos recentes</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Seus vídeos gerados e importados.
                </p>
              </div>

              {recentVideos.length > 0 && (
                <button
                  onClick={() => setView("library")}
                  className="text-sm text-zinc-300 hover:text-white"
                >
                  Ver biblioteca →
                </button>
              )}
            </div>

            {recentVideos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
                <p className="text-sm text-zinc-400">
                  Seus vídeos aparecerão aqui quando forem salvos na biblioteca.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recentVideos.slice(0, 3).map((video) => (
                  <article
                    key={video.id}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950"
                  >
                    <video
                      src={video.url}
                      controls
                      preload="metadata"
                      playsInline
                      className="aspect-video w-full bg-black object-contain"
                    />

                    <div className="p-4">
                      <h3 className="truncate font-medium">{video.title}</h3>

                      <p className="mt-2 text-xs text-zinc-500">
                        {new Date(video.importedAt).toLocaleDateString("pt-BR")}
                      </p>

                      <button
                        onClick={() => setView("library")}
                        className="mt-4 text-sm text-zinc-300 hover:text-white"
                      >
                        Abrir biblioteca →
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      ) : view === "projects" ? (
        <section className="mx-auto min-h-[75vh] max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
          <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 text-xs tracking-[0.25em] text-zinc-500">SEU ESTÚDIO</p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Meus filmes</h1>
              <p className="mt-3 text-sm text-zinc-400">Gerencie seus projetos, retome uma produção ou organize suas ideias.</p>
            </div>
            <button onClick={startNewFilm} className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200">＋ Novo filme</button>
          </div>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <label htmlFor="project-search" className="sr-only">Pesquisar projetos</label>
              <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">⌕</span>
              <input id="project-search" value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder="Pesquisar por título ou ideia..." className="w-full rounded-xl border border-white/10 bg-zinc-950 py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-zinc-600 focus:border-white/30" />
              {projectSearch && <button onClick={() => setProjectSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-zinc-400 hover:text-white">Limpar</button>}
            </div>
            <div className="rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-400">{filteredProjects.length} {filteredProjects.length === 1 ? "projeto" : "projetos"}</div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 px-6 py-14 text-center">
              <div className="mb-4 text-3xl text-zinc-600">▱</div>
              <h2 className="text-lg font-medium">{savedProjects.length === 0 ? "Seu estúdio está começando" : "Nenhum projeto encontrado"}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">{savedProjects.length === 0 ? "Crie seu primeiro filme e ele ficará disponível aqui para você continuar quando quiser." : "Tente buscar por outro título ou palavra da ideia do projeto."}</p>
              {savedProjects.length === 0 ? <button onClick={startNewFilm} className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-medium text-black hover:bg-zinc-200">Criar primeiro filme</button> : <button onClick={() => setProjectSearch("")} className="mt-6 rounded-xl border border-white/15 px-5 py-3 text-sm hover:bg-white/5">Limpar pesquisa</button>}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProjects.map((item) => (
                <article key={item.id} className="flex min-w-0 flex-col rounded-2xl border border-white/10 bg-zinc-950 p-5 transition hover:border-white/25">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <span className="rounded-lg bg-white/5 px-3 py-2 text-xs tracking-wide text-zinc-400">PROJETO</span>
                    <span className="text-xs text-zinc-500">{item.data.scenes?.length ?? 0} cenas</span>
                  </div>
                  <h2 className="truncate text-lg font-semibold">{item.data.title || "Projeto sem título"}</h2>
                  <p className="mt-2 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-zinc-500">{item.data.idea}</p>
                  <p className="mt-4 text-xs text-zinc-600">Atualizado em {new Date(item.updatedAt).toLocaleDateString("pt-BR")}</p>
                  <div className="mt-5 grid grid-cols-[1fr_auto_auto] gap-2 border-t border-white/10 pt-4">
                    <button onClick={() => openSavedProject(item)} className="rounded-lg bg-white px-3 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200">Abrir projeto</button>
                    <button onClick={() => beginRename(item)} aria-label={`Renomear ${item.data.title}`} title="Renomear projeto" className="rounded-lg border border-white/10 px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5">✎</button>
                    <button onClick={() => setDeleteTarget(item)} aria-label={`Excluir ${item.data.title}`} title="Excluir projeto" className="rounded-lg border border-red-900/50 px-3 py-2.5 text-sm text-red-300 hover:bg-red-950/40">⌫</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : view === "characters" ? (
        <CharacterStudio />
      ) : view === "transform" ? (
        < section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <VideoTransform />
        </section>
      ) : view === "library" ? (
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="mb-8"><h1 className="text-3xl font-semibold">Minha biblioteca</h1><p className="mt-2 text-sm text-zinc-400">Seus vídeos gerados e importados.</p></div>
          <ImportedVideos />
        </section>
      ) : !project ? (
        <section className="mx-auto flex min-h-[75vh] max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
          <span className="mb-6 rounded-full border border-white/10 px-4 py-2 text-xs tracking-[0.2em] text-zinc-400">SEU DIRETOR DE CINEMA COM IA</span>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">Transforme uma ideia<br />em um <span className="text-zinc-500">filme.</span></h1>
          <p className="mt-6 max-w-xl text-sm leading-7 text-zinc-400 sm:text-base">Descreva sua ideia. O SCENA cria a história, define os personagens e transforma tudo em cenas cinematográficas.</p>
          <div className="mt-10 w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-3 text-left">
            <label htmlFor="film-idea" className="sr-only">Descreva sua ideia de filme</label>
            <textarea id="film-idea" value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Um astronauta chega a uma cidade abandonada em Marte..." rows={5} className="w-full resize-y bg-transparent p-4 text-sm leading-7 outline-none placeholder:text-zinc-600" />
            <div className="flex flex-col gap-3 border-t border-white/10 px-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-zinc-600">Sua ideia. Seu filme.</span>
              <button onClick={createProject} disabled={!idea.trim() || loading} className="rounded-xl bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40">{loading ? "Criando projeto..." : "Criar filme"}</button>
            </div>
          </div>
          {savedProjects.length > 0 && <div className="mt-8 w-full max-w-2xl text-left"><h2 className="mb-3 text-sm font-medium text-zinc-300">Ou continue um projeto existente</h2><div className="space-y-2">{savedProjects.slice(0, 4).map((item) => <button key={item.id} onClick={() => openSavedProject(item)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 p-4 text-left hover:bg-white/5"><span className="truncate text-sm">{item.data.title}</span><span className="shrink-0 text-xs text-zinc-500">Abrir →</span></button>)}</div></div>}
          {errorMessage && <p role="alert" className="mt-5 text-sm text-red-400">{errorMessage}</p>}
        </section>
      ) : (
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <button onClick={() => { setProject(null); setActiveProjectId(null); setErrorMessage(""); setView("home"); }} className="mb-8 text-sm text-zinc-500 hover:text-white">← Voltar ao início</button>
          <section className="mb-12">
            <p className="mb-3 text-xs tracking-[0.2em] text-zinc-500">SEU PROJETO</p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{project.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">{project.idea}</p>
            <div className="mt-6 inline-flex rounded-full border border-white/10 px-4 py-2 text-xs text-zinc-400">{project.visualStyle}</div>
          </section>
          <section className="mb-14">
            <h2 className="mb-5 text-xl font-medium">Personagens</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{project.characters.map((character) => <article key={character.id} className="rounded-2xl border border-white/10 bg-zinc-950 p-5"><h3 className="font-medium">{character.name}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{character.description}</p></article>)}</div>
          </section>
          <section className="mb-14">
            <h2 className="mb-5 text-xl font-medium">Locações</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{project.locations.map((location) => <article key={location.id} className="rounded-2xl border border-white/10 bg-zinc-950 p-5"><h3 className="font-medium">{location.name}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{location.description}</p></article>)}</div>
          </section>
          <section>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 text-xs tracking-[0.2em] text-zinc-500">PRODUÇÃO</p><h2 className="text-2xl font-semibold">Storyboard</h2><p className="mt-2 text-sm text-zinc-500">Edite os detalhes, reorganize as cenas e salve tudo automaticamente neste navegador.</p></div><button onClick={addScene} className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200">＋ Adicionar cena</button></div>
            <div className="space-y-6">
              {project.scenes.map((scene, index) => (
                <article key={scene.id} className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
                  <div className="space-y-5 p-5 sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row">
                      <div className="flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black sm:w-64">
                        {scene.videoUrl ? <video key={scene.videoUrl} src={scene.videoUrl} controls playsInline className="h-full w-full object-contain" /> : <div className="text-center"><div className="mb-3 text-3xl text-zinc-700">{scene.status === "generating" ? "◌" : scene.status === "error" ? "!" : "▶"}</div><p className="text-xs text-zinc-600">{scene.status === "generating" ? "Gerando vídeo..." : scene.status === "error" ? "Vídeo indisponível" : "Preview da cena"}</p></div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-4 flex flex-wrap items-center gap-2"><span className="mr-1 text-xs text-zinc-600">CENA {String(index + 1).padStart(2, "0")}</span><button onClick={() => moveScene(scene.id, -1)} disabled={index === 0 || scene.status === "generating" || project.scenes[index - 1]?.status === "generating"} title="Mover cena para cima" aria-label={`Mover ${scene.title} para cima`} className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-30">↑</button><button onClick={() => moveScene(scene.id, 1)} disabled={index === project.scenes.length - 1 || scene.status === "generating" || project.scenes[index + 1]?.status === "generating"} title="Mover cena para baixo" aria-label={`Mover ${scene.title} para baixo`} className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-30">↓</button><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">{scene.duration}s</span><span className={`rounded-full px-3 py-1 text-xs ${scene.status === "completed" ? "bg-emerald-950 text-emerald-300" : scene.status === "error" ? "bg-red-950 text-red-300" : scene.status === "generating" ? "bg-zinc-800 text-zinc-300" : "bg-white/5 text-zinc-500"}`}>{scene.status === "completed" ? "Concluída" : scene.status === "error" ? "Erro na geração" : scene.status === "generating" ? "Gerando" : "Pendente"}</span></div>
                        <h3 className="text-xl font-medium">{scene.title}</h3><p className="mt-3 text-sm leading-7 text-zinc-400">{scene.description}</p>
                      </div>
                    </div>
                    <div className="grid gap-5 border-t border-white/10 pt-5 sm:grid-cols-2">
                      <div><p className="mb-2 text-xs text-zinc-600">CÂMERA</p><p className="text-sm leading-6 text-zinc-400">{scene.camera}</p></div>
                      <div><p className="mb-2 text-xs text-zinc-600">ATMOSFERA</p><p className="text-sm leading-6 text-zinc-400">{scene.atmosphere}</p></div>
                      <div className="sm:col-span-2"><p className="mb-2 text-xs text-zinc-600">ESTILO VISUAL</p><p className="text-sm leading-6 text-zinc-400">{scene.visualStyle}</p></div>
                    </div>
                    {editingScene === scene.id && (
                      <div className="space-y-5 rounded-xl border border-white/10 bg-black p-4">
                        <div><label htmlFor={`title-${scene.id}`} className="mb-2 block text-xs text-zinc-500">TÍTULO</label><input id={`title-${scene.id}`} value={scene.title} onChange={(event) => updateScene(scene.id, "title", event.target.value)} className="w-full rounded-lg border border-white/10 bg-zinc-950 p-3 text-sm outline-none focus:border-white/30" /></div>
                        <div><label htmlFor={`description-${scene.id}`} className="mb-2 block text-xs text-zinc-500">DESCRIÇÃO</label><textarea id={`description-${scene.id}`} value={scene.description} onChange={(event) => updateScene(scene.id, "description", event.target.value)} rows={3} className="w-full resize-y rounded-lg border border-white/10 bg-zinc-950 p-3 text-sm leading-6 outline-none focus:border-white/30" /></div>
                        <div><label htmlFor={`prompt-${scene.id}`} className="mb-2 block text-sm font-medium text-white">PROMPT DE GERAÇÃO</label><p className="mb-2 text-xs leading-5 text-zinc-500">Este texto será enviado à Higgsfield para gerar o vídeo. Altere câmera, iluminação, movimentos, cenário e estilo como quiser.</p><textarea id={`prompt-${scene.id}`} value={scene.prompt} onChange={(event) => updateScene(scene.id, "prompt", event.target.value)} rows={8} placeholder="Descreva o vídeo que você quer gerar..." className="w-full resize-y rounded-lg border border-white/15 bg-zinc-950 p-4 text-sm leading-7 text-white outline-none focus:border-white/50" /><p className="mt-2 text-xs text-zinc-600">{scene.prompt.length} caracteres</p></div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div><label htmlFor={`camera-${scene.id}`} className="mb-2 block text-xs text-zinc-500">CÂMERA</label><textarea id={`camera-${scene.id}`} value={scene.camera} onChange={(event) => updateScene(scene.id, "camera", event.target.value)} rows={2} className="w-full resize-y rounded-lg border border-white/10 bg-zinc-950 p-3 text-sm outline-none focus:border-white/30" /></div>
                          <div><label htmlFor={`atmosphere-${scene.id}`} className="mb-2 block text-xs text-zinc-500">ATMOSFERA</label><textarea id={`atmosphere-${scene.id}`} value={scene.atmosphere} onChange={(event) => updateScene(scene.id, "atmosphere", event.target.value)} rows={2} className="w-full resize-y rounded-lg border border-white/10 bg-zinc-950 p-3 text-sm outline-none focus:border-white/30" /></div>
                          <div className="sm:col-span-2"><label htmlFor={`style-${scene.id}`} className="mb-2 block text-xs text-zinc-500">ESTILO VISUAL</label><textarea id={`style-${scene.id}`} value={scene.visualStyle} onChange={(event) => updateScene(scene.id, "visualStyle", event.target.value)} rows={2} className="w-full resize-y rounded-lg border border-white/10 bg-zinc-950 p-3 text-sm outline-none focus:border-white/30" /></div>
                        </div>
                        <div><label htmlFor={`duration-${scene.id}`} className="mb-2 block text-xs text-zinc-500">DURAÇÃO EM SEGUNDOS</label><input id={`duration-${scene.id}`} type="number" min={1} max={30} value={scene.duration} onChange={(event) => updateScene(scene.id, "duration", Math.min(30, Math.max(1, Number(event.target.value) || 1)))} className="w-full rounded-lg border border-white/10 bg-zinc-950 p-3 text-sm outline-none focus:border-white/30" /></div>
                        <button onClick={() => setEditingScene(null)} className="rounded-lg border border-white/15 px-4 py-2 text-sm transition hover:bg-white/5">Concluir edição</button>
                      </div>
                    )}
                    {scene.status === "generating" && <div role="status" className="rounded-xl border border-white/10 p-4"><p className="text-sm text-zinc-300">Gerando sua cena...</p><p className="mt-1 text-xs text-zinc-500">Aguarde a resposta da Higgsfield.</p></div>}
                    {scene.status === "error" && <div role="alert" className="rounded-xl border border-red-900/50 bg-red-950/20 p-4"><p className="text-sm font-medium text-red-300">Não foi possível gerar esta cena.</p><p className="mt-1 text-sm text-zinc-400">Verifique os créditos da conta de vídeo ou tente novamente mais tarde.</p></div>}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
                      <p className="text-xs text-zinc-600">{scene.status === "completed" ? "Vídeo disponível para reprodução." : scene.status === "error" ? "Revise o prompt antes de tentar novamente." : scene.status === "generating" ? "Aguardando o gerador..." : "Edite o prompt antes de gerar."}</p>
                      <div className="flex flex-wrap gap-2"><button onClick={() => setEditingScene(editingScene === scene.id ? null : scene.id)} disabled={scene.status === "generating"} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5 disabled:opacity-40">{editingScene === scene.id ? "Fechar edição" : "Editar cena"}</button><button onClick={() => removeScene(scene.id)} disabled={scene.status === "generating" || project.scenes.length <= 1} title={project.scenes.length <= 1 ? "O projeto precisa manter pelo menos uma cena" : "Excluir cena"} className="rounded-lg border border-red-900/50 px-3 py-2 text-sm text-red-300 transition hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-30">Excluir</button><button onClick={() => generateVideo(scene.id)} disabled={scene.status === "generating"} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40">{scene.status === "generating" ? "Gerando..." : scene.status === "error" ? "Tentar novamente" : scene.status === "completed" ? "Gerar nova versão" : "Gerar vídeo"}</button></div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
          {errorMessage && <p role="alert" className="mt-6 text-sm text-red-400">{errorMessage}</p>}
        </div>
      )
      }

      {
        renamingProjectId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRenamingProjectId(null); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="rename-title" className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
              <h2 id="rename-title" className="text-xl font-semibold">Renomear projeto</h2>
              <p className="mt-2 text-sm text-zinc-400">Escolha um nome fácil de reconhecer depois.</p>
              <form onSubmit={(event) => { event.preventDefault(); saveRename(); }}>
                <label htmlFor="rename-project" className="mb-2 mt-5 block text-sm text-zinc-300">Nome do projeto</label>
                <input autoFocus id="rename-project" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} maxLength={100} className="w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-sm outline-none focus:border-white/40" />
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setRenamingProjectId(null)} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5">Cancelar</button>
                  <button type="submit" disabled={!renameValue.trim()} className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40">Salvar nome</button>
                </div>
              </form>
            </section>
          </div>
        )
      }

      {
        deleteTarget && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}>
            <section role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description" className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-red-950/60 text-xl text-red-300">!</div>
              <h2 id="delete-title" className="text-xl font-semibold">Excluir este projeto?</h2>
              <p id="delete-description" className="mt-2 text-sm leading-6 text-zinc-400">O projeto <span className="font-medium text-white">{deleteTarget.data.title}</span> será removido deste navegador. Esta ação não pode ser desfeita. Os vídeos já gerados na biblioteca não serão apagados por esta ação.</p>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setDeleteTarget(null)} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5">Cancelar</button>
                <button onClick={deleteProject} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-500">Excluir projeto</button>
              </div>
            </section>
          </div>
        )
      }

      <footer className="border-t border-white/10 px-6 py-8 text-center">
        <p className="text-xs tracking-widest text-zinc-600">SCENA.AI — SUA IDEIA, NOSSO ESTÚDIO.</p>
      </footer>
    </main >
  );
}
