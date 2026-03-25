const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = process.cwd();

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: root, shell: false });
  if (result.status !== 0) process.exit(result.status || 1);
}

const venvPython = path.join(root, ".venv", "Scripts", "python.exe");
if (!fs.existsSync(venvPython)) {
  console.log("Creating virtual environment in .venv ...");
  run("python", ["-m", "venv", ".venv"]);
}

console.log("Installing backend dependencies ...");
run(venvPython, ["-m", "pip", "install", "-r", "backend/requirements.txt"]);

console.log("Python setup complete.");
