export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: { name: string; url?: string };
  license?: string;
}

export interface Skill {
  name: string;
  description: string;
  sourceDir: string;
}

export interface Plugin {
  name: string;
  version: string;
  description: string;
  skills: Skill[];
  rootDir: string;
}

export interface Marketplace {
  name: string;
  owner: { name: string; url?: string };
  plugins: { name: string; source: string; description: string; version: string }[];
}

export interface TargetHandler {
  name: string;
  description: string;
  defaultRoot: string;
  write(outputRoot: string, plugin: Plugin): Promise<number>;
}
