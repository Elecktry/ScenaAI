
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createDemoProject } from "@/lib/director/demo";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const projectSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    visualStyle: { type: "string" },
    characters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["id", "name", "description"],
        additionalProperties: false,
      },
    },
    locations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["id", "name", "description"],
        additionalProperties: false,
      },
    },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          title: { type: "string" },
          description: { type: "string" },
          duration: { type: "integer" },
          camera: { type: "string" },
          atmosphere: { type: "string" },
          visualStyle: { type: "string" },
          prompt: { type: "string" },
          status: {
            type: "string",
            enum: ["pending", "generating", "completed", "error"],
          },
        },
        required: [
          "id",
          "title",
          "description",
          "duration",
          "camera",
          "atmosphere",
          "visualStyle",
          "prompt",
          "status",
        ],
        additionalProperties: false,
      },
    },
  },
  required: [
    "title",
    "visualStyle",
    "characters",
    "locations",
    "scenes",
  ],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  let idea = "";

  try {
    const body = await request.json();

    if (typeof body.idea !== "string" || !body.idea.trim()) {
      return NextResponse.json(
        { success: false, error: "Descreva a ideia do seu filme." },
        { status: 400 }
      );
    }

    idea = body.idea.trim();

    if (idea.length > 5000) {
      return NextResponse.json(
        {
          success: false,
          error: "Sua ideia deve ter no máximo 5.000 caracteres.",
        },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-5.4-mini",

      instructions: `
Você é o diretor cinematográfico e roteirista principal da SCENA AI.

Sua tarefa é transformar a ideia do usuário em um projeto cinematográfico
coerente, criativo e pronto para ser produzido com geração de vídeo por IA.

REGRA FUNDAMENTAL:
A ideia original do usuário é a fonte principal do projeto.
Não reutilize personagens, cenários, objetos ou histórias de exemplos anteriores.
Não transforme toda ideia em ficção científica.
Não invente um astronauta, uma cidade em Marte ou qualquer outro tema
que não combine com a ideia recebida.

INTERPRETE A INTENÇÃO:
- Comercial: crie cenas que apresentem o produto, seus detalhes e seu apelo visual.
- Terror: construa tensão, atmosfera e revelações graduais.
- Ação: desenvolva movimento, progressão e momentos de impacto.
- Romance: priorize personagens, emoções e linguagem visual apropriada.
- Fantasia ou ficção científica: crie um universo visual consistente.
- Clipe musical: priorize ritmo visual, composição e identidade estética.
- Documentário: use uma abordagem visual coerente com o assunto.
- Ideia abstrata: transforme o conceito em imagens que comuniquem seu significado.
- Outros temas: escolha a abordagem que melhor corresponda ao pedido.

PLANEJAMENTO:
1. Escolha um título específico para a ideia.
2. Defina um estilo visual adequado ao gênero e à intenção.
3. Identifique os personagens ou elementos principais.
4. Defina as locações realmente necessárias.
5. Crie de 3 a 6 cenas em uma sequência lógica.
6. Cada cena deve durar entre 4 e 8 segundos.
7. Cada cena deve contribuir para o objetivo ou narrativa do projeto.

CONSISTÊNCIA:
- Preserve a identidade dos personagens e elementos principais entre as cenas.
- Mantenha locações, cores, iluminação e estilo visual consistentes.
- Evite mudanças de assunto sem justificativa narrativa.
- Os prompts devem descrever o que a câmera deve mostrar, não apenas explicar a história.
- Cada prompt deve funcionar individualmente no gerador de vídeo.
- Inclua no prompt os detalhes visuais essenciais para manter a continuidade.

PROMPTS:
- Escreva os prompts de geração em inglês para facilitar o uso em modelos de vídeo.
- Descreva assunto, ação, ambiente, enquadramento, movimento de câmera,
  iluminação, atmosfera e estilo quando forem relevantes.
- Não inclua instruções contraditórias.
- Não acrescente elementos importantes que contrariem a ideia original.
- Não escreva explicações fora do JSON solicitado.

RETORNO:
Entregue somente o projeto no formato estruturado solicitado.
Todas as cenas devem começar com status "pending".
`,

      input: `
Crie um projeto cinematográfico baseado exclusivamente nesta ideia do usuário:

<IDEIA_DO_USUARIO>
${idea}
</IDEIA_DO_USUARIO>

Desenvolva o projeto de acordo com a intenção, o gênero e os elementos
específicos dessa ideia. Não substitua o tema por um exemplo genérico.
`,

      text: {
        format: {
          type: "json_schema",
          name: "scena_project",
          strict: true,
          schema: projectSchema,
        },
      },
    });

    if (!response.output_text) {
      throw new Error("O Diretor não retornou um projeto válido.");
    }

    const project = JSON.parse(response.output_text);

    if (
      !Array.isArray(project.scenes) ||
      project.scenes.length < 3 ||
      project.scenes.length > 6
    ) {
      throw new Error("O Diretor retornou uma quantidade inválida de cenas.");
    }

    return NextResponse.json({
      success: true,
      mode: "openai",
      project: {
        ...project,
        idea,
      },
    });
  } catch (error) {
    console.error("Erro no Diretor SCENA:", error);

    const errorInfo = error as {
      message?: string;
      code?: string;
      status?: number;
      error?: { code?: string; type?: string };
    };

    const message = errorInfo.message ?? "";
    const code = errorInfo.code ?? errorInfo.error?.code ?? "";
    const type = errorInfo.error?.type ?? "";

    const noCredits =
      code === "credit_balance_exhausted" ||
      code === "insufficient_quota" ||
      type === "insufficient_quota" ||
      message.includes("You have no credits remaining") ||
      message.includes("credit_balance_exhausted");

    if (noCredits && idea) {
      console.log("OpenAI sem créditos. Usando Diretor Demo.");

      return NextResponse.json({
        success: true,
        mode: "demo",
        project: createDemoProject(idea),
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: noCredits
          ? "A API da OpenAI está sem créditos. Verifique o saldo ou use o modo Demo."
          : message || "Não foi possível criar o projeto.",
      },
      { status: 500 }
    );
  }
}
