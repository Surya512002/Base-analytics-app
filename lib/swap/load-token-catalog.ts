/** Fetches the large token catalog once, only when a screen needs it. A failed load can be retried. */
export type TokenCatalog = typeof import("./token-catalog");

let loaded: TokenCatalog | undefined;
let pending: Promise<TokenCatalog> | null = null;

export function loadTokenCatalog(): Promise<TokenCatalog> {
  pending ??= import("./token-catalog").then(
    (m) => (loaded = m),
    (e) => {
      pending = null;
      throw e;
    }
  );
  return pending;
}

/** The catalog if it has already arrived. */
export function peekTokenCatalog(): TokenCatalog | undefined {
  return loaded;
}
