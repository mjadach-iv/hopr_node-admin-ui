type ParsedVersion = {
  core: [number, number, number];
  prerelease: string[];
};

const VERSION_REGEX = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

// X.Y.Z with an optional -pre.release part, as used for the image tags
export const parseVersion = (version: string): ParsedVersion | null => {
  const match = VERSION_REGEX.exec(version.trim());
  if (!match) return null;
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ? match[4].split('.') : [],
  };
};

const compareIdentifiers = (a: string, b: string): number => {
  const aNumeric = /^\d+$/.test(a);
  const bNumeric = /^\d+$/.test(b);
  if (aNumeric && bNumeric) return Number(a) - Number(b);
  if (aNumeric) return -1;
  if (bNumeric) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
};

// semver ordering: 5.0.0-alpha.2 < 5.0.0-alpha.10 < 5.0.0
const compareParsed = (a: ParsedVersion, b: ParsedVersion): number => {
  for (let i = 0; i < 3; i++) {
    if (a.core[i] !== b.core[i]) return a.core[i] - b.core[i];
  }
  if (!a.prerelease.length || !b.prerelease.length) return b.prerelease.length - a.prerelease.length;
  for (let i = 0; i < Math.min(a.prerelease.length, b.prerelease.length); i++) {
    const diff = compareIdentifiers(a.prerelease[i], b.prerelease[i]);
    if (diff) return diff;
  }
  return a.prerelease.length - b.prerelease.length;
};

export const compareVersions = (a: string, b: string): number => {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);
  if (!parsedA || !parsedB) throw new Error(`Cannot compare versions '${a}' and '${b}'`);
  return compareParsed(parsedA, parsedB);
};

/**
 * Highest candidate above current, or null. A stable current version is only
 * offered stable candidates, a pre-release one any newer version.
 */
export const findNewerVersion = (current: string, candidates: string[]): string | null => {
  const parsedCurrent = parseVersion(current);
  if (!parsedCurrent) return null;
  let newest: { version: string; parsed: ParsedVersion } | null = null;
  for (const candidate of candidates) {
    const parsed = parseVersion(candidate);
    if (!parsed) continue;
    if (!parsedCurrent.prerelease.length && parsed.prerelease.length) continue;
    if (compareParsed(parsed, parsedCurrent) <= 0) continue;
    if (!newest || compareParsed(parsed, newest.parsed) > 0) newest = { version: candidate.trim(), parsed };
  }
  return newest?.version ?? null;
};
