import { readdir, access, copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
// Native Hostinger releases switch atomically. Keep the preceding release's
// hashed browser chunks so tabs opened before deployment can still navigate.
const previous = join(
  process.env.HOME || "/nonexistent",
  "domains/os.gwerosolutions.com/hbuilds/current/nodejs/public/assets",
);
const destination = "dist/public/assets";
try {
  await access(previous);
} catch {
  process.exit(0);
}
let inherited = [];
try {
  inherited = JSON.parse(await readFile(join(previous, "previous-release-assets.json"), "utf8"));
} catch {}
const copied = [];
for (const name of await readdir(previous)) {
  if (inherited.includes(name)) continue;
  if (!/^[\w.-]+-[\w-]+\.(js|css|woff2|svg)$/.test(name)) continue;
  try {
    await access(join(destination, name));
  } catch {
    await copyFile(join(previous, name), join(destination, name));
    copied.push(name);
  }
}
await writeFile(join(destination, "previous-release-assets.json"), JSON.stringify(copied));
console.log(`Preserved ${copied.length} previous-release browser assets.`);
