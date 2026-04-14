export interface ShareServerConfig {
  server: {
    apiUrl: string;
    viewerUrl: string;
    publicBaseUrl: string | null;
    apiToken: string | null;
    provider: string;
    version: number;
  };
  defaults: {
    publishMode: "immutable";
    aliasStrategy: "none" | "slug-stem";
    openAfterPublish: boolean;
  };
}

export interface ShareRecord {
  id: string;
  slug: string;
  title: string | null;
  alias: string | null;
  artifactType: "html-file" | "static-site-zip";
  createdAt: string;
  sourceName: string;
}

export interface HealthResponse {
  ok: true;
  service: "agent-share-server";
  apiVersion: number;
  provider: string;
  viewerUrl: string;
  publicBaseUrl: string | null;
  supports: string[];
  runtime: {
    mode: string;
    platform: string;
  };
}
