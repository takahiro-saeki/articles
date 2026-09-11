// This handles only the positive prefix rules used by the inspected legacy file.
// It is not Apple's AASA matcher and does not support components or exclusions.
export function matchesListedPrefix(url, paths) {
  const pathname = new URL(url).pathname;
  return paths.some(pattern => {
    if (!pattern.startsWith("/") || !pattern.endsWith("/*") ||
        pattern.slice(0, -1).includes("*") || pattern.includes("?")) {
      throw new Error("Unsupported rule in this limited checker");
    }
    return pathname.startsWith(pattern.slice(0, -1));
  });
}
