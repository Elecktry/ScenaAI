import { Scene } from "./scene";

export type Character = {
  id: string;
  name: string;
  description: string;
};

export type Location = {
  id: string;
  name: string;
  description: string;
};

export type Project = {
  title: string;
  idea: string;

  visualStyle: string;

  characters: Character[];

  locations: Location[];

  scenes: Scene[];
};