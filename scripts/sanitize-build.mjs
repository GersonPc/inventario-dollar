import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

const outputDirectory = "dist";
const secretFile = /^(?:\.dev\.vars|\.env)(?:\..+)?$/;

async function removeCopiedSecrets(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await removeCopiedSecrets(path);
    } else if (secretFile.test(entry.name)) {
      await rm(path, { force: true });
    }
  }));
}

await removeCopiedSecrets(outputDirectory);
