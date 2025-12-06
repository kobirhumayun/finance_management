import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authDir = path.join(__dirname, ".auth");
const storagePath = path.join(authDir, "user.json");

export default async function globalSetup() {
  await fs.mkdir(authDir, { recursive: true });

  const oneWeekFromNow = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const storageState = {
    cookies: [
      {
        name: "next-auth.session-token",
        value: "playwright-session-token",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        expires: oneWeekFromNow,
      },
    ],
    origins: [],
  };

  await fs.writeFile(storagePath, JSON.stringify(storageState, null, 2));
}
