#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const requiredCssAssets = [
  "components/action-menu/ActionMenu.module.css",
  "components/collection-viewport/CollectionViewport.module.css",
  "components/confirmation-dialog/ConfirmationDialog.module.css",
  "components/constrained-rich-text-editor/ConstrainedRichTextEditor.module.css",
  "components/context-menu/contextMenu.module.css",
  "components/footer/Footer.module.css",
  "components/header/Header.module.css",
  "components/review-sheet/ReviewSheet.module.css",
  "components/star-rating/StarRating.module.css",
  "components/status-panel/StatusPanel.module.css",
  "components/user-profile/UserProfile.module.css"
];

function cssAssets(root = process.cwd()) {
  const source = path.join(root, "src");
  for (const file of requiredCssAssets) {
    if (!fs.lstatSync(path.join(source, file)).isFile()) {
      throw new Error(`Required source ${file} must be a regular file.`);
    }
  }
  const files = [];
  function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error("CSS source tree must not contain symbolic links.");
      }
      if (entry.isDirectory()) collect(file);
      else if (entry.isFile() && entry.name.endsWith(".module.css")) files.push(file);
    }
  }
  collect(source);
  return files.map((file) => path.relative(source, file));
}

function copyCssAssets(output, root = process.cwd()) {
  if (output !== "dist" && output !== "dist-cjs") {
    throw new Error("CSS output must be dist or dist-cjs.");
  }
  for (const file of cssAssets(root)) {
    const destination = path.join(root, output, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, "src", file), destination);
  }
}

module.exports = { copyCssAssets, cssAssets };
if (require.main === module) copyCssAssets(process.argv[2]);
