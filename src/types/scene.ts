export type Scene = {
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
};