import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, "../../..", "server");

export async function resetE2ETestData(context = "setup") {
  const { stdout, stderr } = await execFileAsync("npm", ["run", "seed:e2e"], {
    cwd: serverDir,
    env: {
      ...process.env,
      ALLOW_E2E_SEED: "true",
    },
  });

  if (stdout) {
    console.log(`[${context}] seed:e2e output:\n${stdout}`);
  }

  if (stderr) {
    console.error(`[${context}] seed:e2e warnings:\n${stderr}`);
  }
}
