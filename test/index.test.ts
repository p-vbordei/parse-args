import { describe, it, expect } from "vitest";
import { parse } from "../src/index.js";

describe("positionals", () => {
  it("plain positionals", () => {
    expect(parse(["a", "b", "c"])._).toEqual(["a", "b", "c"]);
  });
  it("empty argv", () => {
    expect(parse([])._).toEqual([]);
  });
});

describe("long flags", () => {
  it("--foo bar consumes next", () => {
    expect(parse(["--foo", "bar"])).toMatchObject({ foo: "bar" });
  });
  it("--foo=bar", () => {
    expect(parse(["--foo=bar"])).toMatchObject({ foo: "bar" });
  });
  it("--flag (no value) → true", () => {
    expect(parse(["--flag"])).toMatchObject({ flag: true });
  });
  it("--flag followed by another flag → boolean", () => {
    const r = parse(["--a", "--b"]);
    expect(r.a).toBe(true);
    expect(r.b).toBe(true);
  });
  it("--no-flag → false", () => {
    expect(parse(["--no-debug"])).toMatchObject({ debug: false });
  });
});

describe("short flags", () => {
  it("-x value", () => {
    expect(parse(["-x", "1"])).toMatchObject({ x: "1" });
  });
  it("-x (alone) → true", () => {
    expect(parse(["-x"])).toMatchObject({ x: true });
  });
  it("combined -abc → all true", () => {
    expect(parse(["-abc"])).toMatchObject({ a: true, b: true, c: true });
  });
  it("-n5 (numeric short) is not parsed as flag", () => {
    expect(parse(["-5"])._).toEqual(["-5"]);
  });
});

describe("-- separator", () => {
  it("captures everything after into '--'", () => {
    expect(parse(["--foo", "bar", "--", "x", "-y"])).toMatchObject({
      foo: "bar",
      "--": ["x", "-y"],
    });
  });
});

describe("aliases", () => {
  it("short aliases long", () => {
    const r = parse(["-v"], { alias: { verbose: "v" } });
    expect(r.verbose).toBe(true);
    expect(r.v).toBe(true);
  });
  it("array alias", () => {
    const r = parse(["--quiet"], { alias: { silent: ["q", "quiet"] } });
    expect(r.silent).toBe(true);
    expect(r.quiet).toBe(true);
  });
});

describe("typed flags", () => {
  it("boolean: doesn't consume next", () => {
    const r = parse(["--debug", "foo"], { boolean: ["debug"] });
    expect(r.debug).toBe(true);
    expect(r._).toEqual(["foo"]);
  });
  it("string: consumes next even if it starts with -", () => {
    const r = parse(["--name", "-bob"], { string: ["name"] });
    expect(r.name).toBe("-bob");
  });
  it("array: collects multiple values", () => {
    const r = parse(["--tag", "a", "--tag", "b", "--tag=c"], { array: ["tag"] });
    expect(r.tag).toEqual(["a", "b", "c"]);
  });
});

describe("defaults", () => {
  it("applied when not specified", () => {
    expect(parse([], { default: { port: 3000 } })).toMatchObject({ port: 3000 });
  });
  it("overridden by argv", () => {
    expect(parse(["--port", "8080"], { default: { port: 3000 } })).toMatchObject({ port: "8080" });
  });
});

describe("unknown handling", () => {
  it("ignore by default when no known set", () => {
    expect(parse(["--whatever"])).toMatchObject({ whatever: true });
  });
  it("throw when unknown=throw", () => {
    expect(() => parse(["--mystery"], { boolean: ["known"], unknown: "throw" })).toThrow(/unknown/);
  });
  it("collect when unknown=collect", () => {
    const r = parse(["--mystery", "--also"], { boolean: ["known"], unknown: "collect" });
    expect(r.unknown).toEqual(["--mystery", "--also"]);
  });
});

describe("stopEarly", () => {
  it("treats everything after first positional as positional", () => {
    const r = parse(["--debug", "subcmd", "--inner"], { boolean: ["debug"], stopEarly: true });
    expect(r.debug).toBe(true);
    expect(r._).toEqual(["subcmd", "--inner"]);
  });
});

describe("short flag with attached value", () => {
  it("-nVALUE when n is a string flag", () => {
    const r = parse(["-n", "5"], { string: ["n"] });
    expect(r.n).toBe("5");
  });
  it("-n5 (attached)", () => {
    const r = parse(["-n5"], { string: ["n"] });
    expect(r.n).toBe("5");
  });
});
