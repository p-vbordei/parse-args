export interface ParseOptions {
  /** Flags that don't consume a value (always boolean). */
  boolean?: readonly string[];
  /** Flags that must consume their next arg as a string value. */
  string?: readonly string[];
  /** Flags that may appear multiple times; collected into an array. */
  array?: readonly string[];
  /** Short ↔ long aliases, e.g. `{ verbose: ["v"] }`. */
  alias?: Record<string, string | readonly string[]>;
  /** Defaults applied before parsing. */
  default?: Record<string, unknown>;
  /** Stop parsing flags at the first positional argument. */
  stopEarly?: boolean;
  /** Throw on unknown flags. Default false. */
  unknown?: "ignore" | "throw" | "collect";
}

export interface ParseResult {
  /** Positional arguments. */
  _: string[];
  /** Anything after `--`. */
  "--"?: string[];
  /** Unknown flags if `unknown: "collect"`. */
  unknown?: string[];
  [key: string]: unknown;
}

function buildAliasMap(opts: ParseOptions): { canonOf: (k: string) => string; allAliases: Map<string, string[]> } {
  const canon = new Map<string, string>();
  const all = new Map<string, string[]>();
  for (const [main, sub] of Object.entries(opts.alias ?? {})) {
    const subs = Array.isArray(sub) ? [...sub] : [sub as string];
    all.set(main, subs);
    for (const s of subs) canon.set(s, main);
  }
  return { canonOf: (k) => canon.get(k) ?? k, allAliases: all };
}

function makeSetter(
  result: ParseResult,
  canonOf: (k: string) => string,
  allAliases: Map<string, string[]>,
  arrayKeys: Set<string>,
): (key: string, value: unknown) => void {
  return (key, value) => {
    const main = canonOf(key);
    if (arrayKeys.has(main)) {
      const existing = result[main];
      if (Array.isArray(existing)) existing.push(value);
      else result[main] = [value];
    } else {
      result[main] = value;
    }
    // Mirror the value on every alias for ergonomic access.
    for (const a of allAliases.get(main) ?? []) {
      result[a] = result[main];
    }
  };
}

/**
 * Parse `process.argv.slice(2)` (or any string array) into positionals + flags.
 *
 * Supports:
 *  - `--foo`, `--foo=bar`, `--foo bar`
 *  - `-f`, `-fbar`, `-abc` (combined booleans)
 *  - `--no-foo` (boolean negation)
 *  - `--` separator (rest goes into `result["--"]`)
 *  - aliases (short ↔ long)
 *  - typed flags (boolean / string / array)
 */
export function parse(argv: readonly string[], opts: ParseOptions = {}): ParseResult {
  const { canonOf, allAliases } = buildAliasMap(opts);
  const arrayKeys = new Set<string>((opts.array ?? []).map(canonOf));
  const booleanKeys = new Set<string>((opts.boolean ?? []).map(canonOf));
  const stringKeys = new Set<string>((opts.string ?? []).map(canonOf));
  const knownKeys = new Set<string>([
    ...arrayKeys,
    ...booleanKeys,
    ...stringKeys,
    ...Object.keys(opts.default ?? {}),
    ...Object.keys(opts.alias ?? {}),
  ]);
  for (const subs of allAliases.values()) for (const s of subs) knownKeys.add(s);

  const result: ParseResult = { _: [] };
  Object.assign(result, opts.default ?? {});

  const set = makeSetter(result, canonOf, allAliases, arrayKeys);

  const handleUnknown = (rawArg: string, key: string): boolean => {
    if (knownKeys.size === 0) return true; // no known set = accept all
    if (knownKeys.has(canonOf(key))) return true;
    if (opts.unknown === "throw") throw new Error(`unknown argument: ${rawArg}`);
    if (opts.unknown === "collect") {
      (result.unknown ??= []).push(rawArg);
    }
    return opts.unknown !== "ignore" && opts.unknown !== "collect";
  };

  let i = 0;
  let stopped = false;
  while (i < argv.length) {
    const arg = argv[i]!;

    if (arg === "--") {
      result["--"] = [...argv.slice(i + 1)];
      break;
    }

    if (arg.startsWith("--no-") && arg.length > 5) {
      const key = arg.slice(5);
      if (handleUnknown(arg, key)) set(key, false);
      i += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      const body = arg.slice(2);
      const eq = body.indexOf("=");
      if (eq >= 0) {
        const key = body.slice(0, eq);
        if (handleUnknown(arg, key)) set(key, body.slice(eq + 1));
      } else {
        const key = body;
        if (!handleUnknown(arg, key)) { i += 1; continue; }
        const main = canonOf(key);
        if (booleanKeys.has(main)) {
          set(key, true);
        } else if (stringKeys.has(main) || arrayKeys.has(main)) {
          const next = argv[i + 1];
          if (next === undefined) set(key, "");
          else { set(key, next); i += 1; }
        } else {
          const next = argv[i + 1];
          if (next === undefined || next.startsWith("-")) set(key, true);
          else { set(key, next); i += 1; }
        }
      }
      i += 1;
      continue;
    }

    // Short flags: -x, -xvalue, -abc (combined booleans), -n5 (numeric)
    if (arg.startsWith("-") && arg.length > 1 && !/^-\d/.test(arg)) {
      const body = arg.slice(1);
      const first = body[0]!;
      const firstMain = canonOf(first);
      if (stringKeys.has(firstMain) || arrayKeys.has(firstMain)) {
        if (handleUnknown(arg, first)) {
          if (body.length > 1) set(first, body.slice(1));
          else if (argv[i + 1] !== undefined) { set(first, argv[i + 1]!); i += 1; }
          else set(first, "");
        }
      } else if (body.length === 1) {
        if (handleUnknown(arg, first)) {
          if (booleanKeys.has(firstMain)) set(first, true);
          else {
            const next = argv[i + 1];
            if (next === undefined || next.startsWith("-")) set(first, true);
            else { set(first, next); i += 1; }
          }
        }
      } else {
        // Combined: -abc → -a -b -c (all booleans)
        for (const ch of body) {
          if (handleUnknown(`-${ch}`, ch)) set(ch, true);
        }
      }
      i += 1;
      continue;
    }

    // Positional
    result._.push(arg);
    if (opts.stopEarly) {
      result._.push(...argv.slice(i + 1));
      stopped = true;
      break;
    }
    i += 1;
  }

  return result;
}
