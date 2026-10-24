import type { Environment } from "../types/api";

export const VARIABLE_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

export type VariableMap = Map<string, string>;

export function variableMap(environment?: Environment | null): VariableMap {
  return new Map(environment?.variables.filter((row) => row.enabled && row.key.trim()).map((row) => [row.key.trim(), row.value]) ?? []);
}

/** Replaces {{NAME}} with its value. Unknown variables are left untouched so the problem stays visible. */
export function resolveVariables(input: string, variables: VariableMap) {
  if (!input.includes("{{")) return input;
  return input.replace(VARIABLE_PATTERN, (match, key: string) => variables.get(key) ?? match);
}

export function unresolvedVariables(inputs: string[], variables: VariableMap) {
  const missing = new Set<string>();
  for (const input of inputs) {
    for (const match of input.matchAll(VARIABLE_PATTERN)) {
      if (!variables.has(match[1])) missing.add(match[1]);
    }
  }
  return [...missing];
}
