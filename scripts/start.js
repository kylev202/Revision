const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = process.cwd();

const candidates = [
  path.join(root, ".venv", "Scripts", "python.exe"),
  path.join(root, "venv", "Scripts", "python.exe"),
  process.env.PYTHON,
  "python",
  "py"
].filter(Boolean);

function findPython() {
  for (const candidate of candidates) {
    if (candidate.endsWith("python") || candidate === "py") {
      return candidate;
    }
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

const python = findPython();
if (!python) {
  console.error("No Python interpreter found. Create .venv or install Python first.");
  process.exit(1);
}

const args = ["-m", "uvicorn", "backend.main:app", ...process.argv.slice(2)];

const child = spawn(python, args, {
  stdio: "inherit",
  cwd: root,
  shell: false
});

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("Failed to launch server:", err.message);
  process.exit(1);
});
