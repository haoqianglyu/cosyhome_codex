const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const ignoredDirectories = new Set([
  ".git",
  "dist",
  "miniprogram_npm",
  "node_modules",
]);
let syncedCount = 0;

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        visit(filename);
      }
      continue;
    }
    if (!entry.name.endsWith(".wxss")) {
      continue;
    }

    const lessFilename = filename.replace(/\.wxss$/, ".less");
    if (!fs.existsSync(lessFilename)) {
      continue;
    }
    const wxss = fs.readFileSync(filename, "utf8");
    if (fs.readFileSync(lessFilename, "utf8") !== wxss) {
      fs.writeFileSync(lessFilename, wxss);
      syncedCount += 1;
    }
  }
}

visit(root);
console.log(`已同步 ${syncedCount} 个 Less 文件`);
