/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
}

/** Version, commit and build date, set by vite.config.ts at build time. */
declare const __BUILD_INFO__: { version: string; commit: string; builtAt: string } | undefined;
