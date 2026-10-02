#!/usr/bin/env node
// `npm create smithable [dir] [-- --starter booking]` is `smithable new [dir] …`.
import { run } from "smithable";

process.exitCode = await run(["new", ...process.argv.slice(2)]);
