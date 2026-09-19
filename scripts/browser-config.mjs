import { existsSync } from "node:fs";

// Os testes eram presos ao caminho do Chromium da máquina Linux em que foram
// escritos. O time também roda o projeto no Windows; escolhemos o navegador
// local quando ele existe e deixamos o Playwright usar o próprio Chromium nos
// demais ambientes.
export function opcoesDoNavegador() {
  const candidatos = [
    process.env.HDA_CHROME,
    process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : null,
    process.platform === "win32" ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : null,
    process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : null,
    process.platform === "linux" ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : null,
  ].filter(Boolean);
  const executablePath = candidatos.find((caminho) => existsSync(caminho));
  return executablePath
    ? { executablePath, args: ["--no-sandbox"] }
    : { args: ["--no-sandbox"] };
}
