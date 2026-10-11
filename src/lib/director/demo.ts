
import type { Project } from "@/types/project";

function createTitle(idea: string): string {
  const cleaned = idea
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "")
    .trim();

  if (!cleaned) return "Novo projeto cinematográfico";

  if (cleaned.length <= 55) {
    return cleaned.charAt(0).toLocaleUpperCase("pt-BR") + cleaned.slice(1);
  }

  return cleaned.slice(0, 52).trimEnd() + "...";
}

export function createDemoProject(idea: string): Project {
  const normalizedIdea = idea.trim();

  const concept =
    normalizedIdea ||
    "Uma história cinematográfica sobre uma descoberta inesperada";

  const visualStyle =
    "Cinematográfico, iluminação cuidadosamente planejada, composição visual consistente e movimentos de câmera suaves.";

  const storyBeats = [
    {
      title: "A apresentação",
      description:
        "A história apresenta o conceito principal, o ambiente e o elemento mais importante da ideia.",
      camera:
        "Plano geral de abertura, movimento lento de câmera e composição que apresenta o cenário.",
      atmosphere:
        "Introdução envolvente, estabelecendo o clima e despertando curiosidade.",
      promptBeat:
        "Establishing shot introducing the main subject and its environment. Slowly reveal the setting with cinematic composition.",
    },
    {
      title: "O desenvolvimento",
      description:
        "O elemento central ganha destaque e a narrativa começa a se desenvolver visualmente.",
      camera:
        "Travelling suave em direção ao elemento principal, alternando com planos médios e detalhes.",
      atmosphere:
        "Sensação de descoberta e progressão narrativa.",
      promptBeat:
        "Move closer to the main subject and reveal meaningful visual details. Use smooth tracking movement and deliberate framing.",
    },
    {
      title: "O momento decisivo",
      description:
        "A ideia chega ao seu momento visual mais marcante, revelando o principal acontecimento ou característica.",
      camera:
        "Movimento de câmera controlado, enquadramento expressivo e destaque para o momento central.",
      atmosphere:
        "Intensidade visual, expectativa e impacto.",
      promptBeat:
        "Show the central visual moment of the concept with expressive framing, controlled camera movement and dramatic lighting.",
    },
    {
      title: "O encerramento",
      description:
        "A sequência termina com uma imagem marcante que conclui a apresentação da ideia.",
      camera:
        "Plano final cuidadosamente composto, com movimento suave e encerramento visual limpo.",
      atmosphere:
        "Conclusão satisfatória, imagem memorável e sensação de fechamento.",
      promptBeat:
        "End on a memorable cinematic composition that resolves the sequence and leaves a strong final visual impression.",
    },
  ];

  const scenes = storyBeats.map((beat, index) => ({
    id: index + 1,
    title: beat.title,
    description: `${beat.description} Conceito do projeto: ${concept}`,
    duration: index === 3 ? 6 : 5,
    camera: beat.camera,
    atmosphere: beat.atmosphere,
    visualStyle,
    prompt: [
      `Create a cinematic video based on this concept: ${concept}.`,
      `Sequence ${index + 1} of 4. ${beat.promptBeat}`,
      `Keep the main subject, setting, color palette and visual identity consistent with the concept.`,
      `Visual style: ${visualStyle}`,
      "Professional cinematography, natural motion, detailed environment, coherent lighting, 16:9 widescreen composition.",
      "Avoid unrelated subjects, random scene changes, visual distortions and unnecessary text.",
    ].join(" "),
    status: "pending" as const,
  }));

  return {
    title: createTitle(normalizedIdea),
    idea: normalizedIdea,
    visualStyle,
    characters: [
      {
        id: "main-subject",
        name: "Elemento principal",
        description: `Elemento central definido pela ideia do projeto: ${concept}`,
      },
    ],
    locations: [
      {
        id: "main-setting",
        name: "Cenário principal",
        description: `O ambiente visual será desenvolvido a partir do conceito: ${concept}`,
      },
    ],
    scenes,
  };
}
