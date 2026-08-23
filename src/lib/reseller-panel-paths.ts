export type ResellerNavPaths = {
  home: string;
  clients: string;
  password: string;
};

export function resellerNavPaths(atDedicatedHost: boolean): ResellerNavPaths {
  if (atDedicatedHost) {
    return { home: "/", clients: "/clients", password: "/password" };
  }
  return { home: "/reseller", clients: "/reseller/clients", password: "/reseller/password" };
}

export function isResellerAppPath(path: string): boolean {
  return path === "/reseller" || path.startsWith("/reseller/");
}

/** Map /reseller and /reseller/clients to dedicated-host paths / and /clients. */
export function dedicatedPathFromResellerAppPath(path: string): string {
  if (path === "/reseller" || path === "/reseller/") return "/";
  if (path.startsWith("/reseller/")) {
    const rest = path.slice("/reseller".length);
    return rest || "/";
  }
  return path;
}

export function resellerAppPathFromDedicated(path: string): string | null {
  if (path === "/" || path === "") return "/reseller";
  if (path === "/clients" || path.startsWith("/clients/")) return `/reseller${path}`;
  if (path === "/password" || path.startsWith("/password/")) return `/reseller${path}`;
  return null;
}
