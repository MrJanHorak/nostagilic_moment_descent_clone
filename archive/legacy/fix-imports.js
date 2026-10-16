// A script to fix import paths across the project
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Directory to recursively fix imports
const directoryToFix = path.join(__dirname, 'src');

// Function to fix imports in a file
async function fixImportsInFile(filePath) {
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');

    // Replace absolute paths with relative ones
    // Match patterns like import X from '/src/js/...'
    const newContent = data.replace(
      /from\s+['"]\/src\/js\/([^'"]+)['"]/g,
      (match, p1) => {
        // Calculate relative path
        const relativePath = path
          .relative(
            path.dirname(filePath),
            path.join(__dirname, 'src', 'js', p1)
          )
          .replace(/\\/g, '/');

        // Make sure we don't start with ../ for imports in the same directory
        const finalPath = relativePath.startsWith('.')
          ? relativePath
          : `./${relativePath}`;
        return `from '${finalPath}'`;
      }
    );

    if (data !== newContent) {
      await fs.promises.writeFile(filePath, newContent, 'utf8');
      console.log(`Fixed imports in ${filePath}`);
    }
  } catch (err) {
    console.error(`Error processing file ${filePath}:`, err);
  }
}

// Recursively traverse directory and fix imports in all JS files
async function traverseDirectory(directory) {
  try {
    const files = await fs.promises.readdir(directory, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(directory, file.name);

      if (file.isDirectory()) {
        await traverseDirectory(fullPath);
      } else if (file.name.endsWith('.js')) {
        await fixImportsInFile(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${directory}:`, err);
  }
}

// Start fixing imports
console.log('Starting to fix import paths...');
traverseDirectory(directoryToFix);
