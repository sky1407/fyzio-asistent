import { randomBytes, scryptSync } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";

const envPath = process.argv[2] ?? new URL("../.env.local", import.meta.url);

function readHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    if (process.stdin.isTTY) {
      rl._writeToOutput = (text) => {
        if (text.includes(question)) process.stdout.write(text);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (process.stdin.isTTY) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

function upsert(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  return pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
}

try {
  const password = await readHidden("Nové heslo (min. 10 znakov): ");
  if (password.length < 10) throw new Error("heslo musí mať aspoň 10 znakov");
  const confirmation = process.stdin.isTTY ? await readHidden("Zopakuj heslo: ") : password;
  if (password !== confirmation) throw new Error("heslá sa nezhodujú");

  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  let content = await readFile(envPath, "utf8");
  content = upsert(content, "APP_PASSWORD_HASH", `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`);
  content = upsert(content, "SESSION_SECRET", randomBytes(48).toString("base64url"));
  await writeFile(envPath, content, { mode: 0o600 });
  console.log("Heslo uložené. Staré prihlásenia sú neplatné. Reštartuj `npm run dev`.");
} catch (error) {
  console.error("Chyba:", error instanceof Error ? error.message : error);
  process.exit(1);
}
