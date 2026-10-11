/// <reference types="vite/client" />

/** Build-time configuration the site reads through `import.meta.env`. */
declare global {
  interface ImportMetaEnv {
    /** `hosting-portability`: the hosted service's address; the built-in default when unset. */
    readonly VITE_DBC_LAB_API_URL?: string
  }
}

export {}
