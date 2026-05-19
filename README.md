# parse-args

[![ci](https://github.com/p-vbordei/parse-args/actions/workflows/ci.yml/badge.svg)](https://github.com/p-vbordei/parse-args/actions/workflows/ci.yml)

A tiny, zero-dependency argv parser. Long and short flags, `--no-foo` negation, combined short flags (`-abc`), aliases, typed flags (boolean/string/array). No subcommand framework — for that, plug this into your own CLI.

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

## License

Apache-2.0 © Vlad Bordei
