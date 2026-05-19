# parse-args

[![ci](https://github.com/p-vbordei/parse-args/actions/workflows/ci.yml/badge.svg)](https://github.com/p-vbordei/parse-args/actions/workflows/ci.yml)

[![npm](https://img.shields.io/npm/v/%40p-vbordei%2Fparse-args.svg)](https://www.npmjs.com/package/@p-vbordei/parse-args)
[![downloads](https://img.shields.io/npm/dm/%40p-vbordei%2Fparse-args.svg)](https://www.npmjs.com/package/@p-vbordei/parse-args)
[![bundle](https://img.shields.io/bundlejs/size/%40p-vbordei%2Fparse-args)](https://bundlejs.com/?q=%40p-vbordei%2Fparse-args)

> A tiny, zero-dependency argv parser. Long and short flags, `--no-foo` negation, combined short flags (`-abc`), aliases, typed flags (boolean/string/array). No subcommand framework — for that, plug this into your own CLI.

```ts
import { parse } from "@p-vbordei/parse-args";

const args = parse(process.argv.slice(2), {
  boolean: ["verbose", "dry-run"],
  string: ["config"],
  array: ["tag"],
  alias: { verbose: "v", config: "c" },
  default: { port: 3000 },
});

// $ tool deploy --verbose -c app.json --tag foo --tag bar -- --inner-arg
// →
// {
//   _: ["deploy"],
//   "--": ["--inner-arg"],
//   verbose: true, v: true,
//   config: "app.json", c: "app.json",
//   tag: ["foo", "bar"],
//   port: 3000,
// }
```

## Install

```sh
npm install @p-vbordei/parse-args
```

Works with Node 20+, browsers, Bun, Deno. ESM + CJS.

## Why

For 90% of CLIs you just need to parse argv. You don't need help generation, subcommand routing, validation, prompts, color tables, or progress bars — that's what `commander`, `yargs`, and `cac` are for, and they're 10-100x bigger.

`parse-args` does just the parsing, correctly. Then you build the CLI ergonomics you actually need on top.

## Recipes

### Minimal CLI

```ts
#!/usr/bin/env node
import { parse } from "@p-vbordei/parse-args";

const args = parse(process.argv.slice(2), {
  boolean: ["help", "version"],
  alias: { help: "h", version: "v" },
});

if (args.help) {
  console.log("usage: tool [--verbose] [--config FILE] FILES...");
  process.exit(0);
}
if (args.version) {
  console.log("1.2.3");
  process.exit(0);
}

const files = args._;
runCommand(files, args);
```

### Subcommand router

```ts
import { parse } from "@p-vbordei/parse-args";

const args = parse(process.argv.slice(2), { stopEarly: true });
const [subcommand, ...rest] = args._;

const handlers = {
  build: () => parse(rest, { boolean: ["watch"] }),
  test:  () => parse(rest, { string: ["pattern"] }),
  publish: () => parse(rest, { boolean: ["dry-run"] }),
};

const handler = handlers[subcommand as keyof typeof handlers];
if (!handler) {
  console.error(`unknown command: ${subcommand}`);
  process.exit(1);
}
runSubcommand(subcommand, handler());
```

### Reject unknown flags

```ts
import { parse } from "@p-vbordei/parse-args";

try {
  const args = parse(process.argv.slice(2), {
    boolean: ["verbose"],
    string: ["config"],
    unknown: "throw",
  });
} catch (err) {
  console.error(err.message);   // "unknown argument: --mystery"
  process.exit(1);
}
```

### Boolean negation

```ts
import { parse } from "@p-vbordei/parse-args";

const args = parse(["--no-color", "--no-cache"], {
  boolean: ["color", "cache"],
  default: { color: true, cache: true },
});
// args.color → false
// args.cache → false
```

### Forward arguments to a subprocess

```ts
import { parse } from "@p-vbordei/parse-args";
import { spawn } from "node:child_process";

const args = parse(process.argv.slice(2));
const passthroughArgs = args["--"] ?? [];
spawn("npm", ["test", ...passthroughArgs], { stdio: "inherit" });
```

### Array flags (multiple values)

```ts
import { parse } from "@p-vbordei/parse-args";

const args = parse(["--tag", "a", "--tag", "b", "--tag=c"], { array: ["tag"] });
// args.tag → ["a", "b", "c"]
```

## API

### `parse(argv, opts?): ParseResult`

| Option | Type | Meaning |
|---|---|---|
| `boolean` | `string[]` | Flags that never consume their next arg |
| `string` | `string[]` | Flags that must consume their next arg |
| `array` | `string[]` | Flags that may appear multiple times |
| `alias` | `Record<string, string \| string[]>` | Short↔long aliases (mirrored on the result) |
| `default` | `Record<string, unknown>` | Defaults applied first |
| `stopEarly` | `boolean` | Stop parsing flags after first positional |
| `unknown` | `"ignore" \| "throw" \| "collect"` | What to do with flags not in `boolean`/`string`/`array`/`alias`/`default` |

```ts
type ParseResult = {
  _: string[];           // positional args
  "--"?: string[];       // args after the `--` separator
  unknown?: string[];    // collected when unknown="collect"
  [flag: string]: unknown;
};
```

## Supported forms

| Form | Example |
|---|---|
| Long with value | `--name value`, `--name=value` |
| Long boolean | `--verbose` |
| Long negation | `--no-color` → `color: false` |
| Short with value | `-c file`, `-cfile` |
| Combined short booleans | `-abc` → `a: true, b: true, c: true` |
| `--` separator | rest goes into `result["--"]` |

## Caveats

- **No type inference for flags.** `args.config` is typed as `unknown` — you have to validate (e.g. with [tiny-validator](https://github.com/p-vbordei/tiny-validator)).
- **No help generation.** Print your own.
- **No subcommand routing.** Compose with `stopEarly`.
- **No prompts / colors / spinners.** Use [@inquirer/prompts](https://www.npmjs.com/package/@inquirer/prompts), `picocolors`, etc.

## License

Apache-2.0 © Vlad Bordei
