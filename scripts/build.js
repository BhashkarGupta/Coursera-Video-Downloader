const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const nodeModulesDir = path.join(rootDir, "node_modules");

const filesToCopy = [
  "manifest.json",
  "background.js",
  "content.js",
  "popup.html",
  "popup.js"
];

const dirsToCopy = ["icons"];

const html2pdfBundle = path.join(
  nodeModulesDir,
  "html2pdf.js",
  "dist",
  "html2pdf.bundle.min.js"
);

function log(message) {
  process.stdout.write(`${message}\n`);
}

async function ensureDist() {
  await fs.promises.mkdir(distDir, { recursive: true });
}

async function cleanDist() {
  await fs.promises.rm(distDir, { recursive: true, force: true });
}

async function copyFile(filePath) {
  const source = path.join(rootDir, filePath);
  const dest = path.join(distDir, filePath);
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.copyFile(source, dest);
}

async function copyDir(dirPath) {
  const source = path.join(rootDir, dirPath);
  const dest = path.join(distDir, dirPath);
  await fs.promises.cp(source, dest, { recursive: true });
}

async function copyHtml2PdfBundle() {
  try {
    await fs.promises.access(html2pdfBundle);
  } catch (error) {
    throw new Error(
      "html2pdf bundle not found. Run `pnpm install` before building."
    );
  }
  await fs.promises.copyFile(
    html2pdfBundle,
    path.join(distDir, "html2pdf.bundle.min.js")
  );
}

async function build() {
  await cleanDist();
  await ensureDist();

  for (const filePath of filesToCopy) {
    await copyFile(filePath);
  }

  for (const dirPath of dirsToCopy) {
    await copyDir(dirPath);
  }

  await copyHtml2PdfBundle();
  log("Build complete: dist/");
}

async function run() {
  if (process.argv.includes("--clean")) {
    await cleanDist();
    log("Cleaned: dist/");
    return;
  }

  await build();
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
