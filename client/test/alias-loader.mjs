import { pathToFileURL } from "node:url";
import { resolve as resolvePath, extname } from "node:path";
import { existsSync } from "node:fs";

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith("next/") && !specifier.endsWith(".js")) {
    const relative = specifier.slice("next/".length);
    const mapped = resolvePath(process.cwd(), "node_modules", "next", `${relative}.js`);
    if (existsSync(mapped)) {
      return { url: pathToFileURL(mapped).href, shortCircuit: true };
    }
  }

  if (specifier.startsWith("@/")) {
    const relative = specifier.slice(2);
    let mappedPath = resolvePath(process.cwd(), "src", relative);

    if (!extname(relative)) {
      if (existsSync(`${mappedPath}.js`)) {
        mappedPath = `${mappedPath}.js`;
      } else if (existsSync(`${mappedPath}.mjs`)) {
        mappedPath = `${mappedPath}.mjs`;
      }
    }

    return { url: pathToFileURL(mappedPath).href, shortCircuit: true };
  }

  return defaultResolve(specifier, context, defaultResolve);
}
