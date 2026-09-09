import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const directory = "dist/assets";
const files = readdirSync(directory);
const bytes = (name) => readFileSync(join(directory, name));
const measure = (names) =>
  names.reduce(
    (result, name) => {
      const content = bytes(name);
      return {
        raw: result.raw + content.length,
        gzip: result.gzip + gzipSync(content).length,
      };
    },
    { raw: 0, gzip: 0 },
  );
const catalog = readFileSync("dist/content/catalog.json");
const manifest = JSON.parse(readFileSync("dist/anatomy/manifest.json", "utf8"));
const content = JSON.parse(catalog);
const initial = content.assets.filter(
  (a) =>
    a.moduleId === "telencefalo" &&
    a.hemisphere === "left" &&
    a.surface &&
    a.labelId < 5000,
);
const anatomy = initial.reduce(
  (r, a) => {
    const buffer = readFileSync(join("dist", a.path));
    return {
      models: r.models + 1,
      raw: r.raw + buffer.length,
      gzip: r.gzip + gzipSync(buffer).length,
    };
  },
  { models: 0, raw: 0, gzip: 0 },
);
const shell = measure(
  files.filter((name) => name.startsWith("index-") && /\.(css|js)$/.test(name)),
);
const fontBytes = files
  .filter((name) => name.endsWith(".woff2"))
  .reduce((n, name) => n + statSync(join(directory, name)).size, 0);
const report = {
  measuredAt: new Date().toISOString(),
  method:
    "Local release build file sizes; gzip at Node default compression. Not a network timing or physical-device FPS measurement.",
  shell,
  catalog: { raw: catalog.length, gzip: gzipSync(catalog).length },
  fontWoff2Bytes: fontBytes,
  initialShellAndCatalogAndFontsBytes:
    shell.gzip + gzipSync(catalog).length + fontBytes,
  lazyGraphics: measure(
    files.filter(
      (name) => name.startsWith("BrainScene-") && name.endsWith(".js"),
    ),
  ),
  firstAnatomyModule: anatomy,
  totalModels: manifest.assets.length,
  targets: {
    shellCompressedBytes: 1500000,
    firstAnatomyTransferBytes: 15000000,
  },
  limitations: [
    "Actual CDN transfer encoding and load times depend on network/cache.",
    "60 desktop FPS and 30 FPS on a named physical phone have not been measured.",
    "Software-rendered headless browser verifies behavior, not GPU performance.",
  ],
};
if (
  report.initialShellAndCatalogAndFontsBytes >
    report.targets.shellCompressedBytes ||
  anatomy.raw > report.targets.firstAnatomyTransferBytes
)
  throw Error("Initial size budget exceeded");
writeFileSync(
  "docs/evidence/build-sizes.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
