// A script to fix export patterns in all JS files
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Directory to recursively process
const directoryToFix = path.join(__dirname, 'src');

// Process a file to fix duplicate exports
async function fixExportsInFile(filePath) {
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');

    // Check if file has both "export class/function X" and "export default X" patterns
    const className = getClassName(data);
    if (!className) return;

    const hasNamedExport =
      data.includes(`export class ${className}`) ||
      data.includes(`export function ${className}`);
    const hasDefaultExportAtEnd = data.match(
      new RegExp(`export\\s+default\\s+${className}\\s*;\\s*$`)
    );

    if (hasNamedExport && hasDefaultExportAtEnd) {
      console.log(`Fixing duplicate exports in ${filePath}`);

      // Replace "export class X" with "class X"
      let newContent = data
        .replace(`export class ${className}`, `class ${className}`)
        .replace(`export function ${className}`, `function ${className}`);

      await fs.promises.writeFile(filePath, newContent, 'utf8');
      console.log(`✓ Fixed exports in ${filePath}`);
    }
  } catch (err) {
    console.error(`Error processing file ${filePath}:`, err);
  }
}

// Extract class name from file content
function getClassName(content) {
  // Look for patterns like "export class ClassName" or "export default class ClassName"
  const classMatch = content.match(/export(?:\s+default)?\s+class\s+(\w+)/);
  if (classMatch) return classMatch[1];

  // Look for patterns like "export default ClassName"
  const defaultMatch = content.match(/export\s+default\s+(\w+)\s*;/);
  if (defaultMatch) return defaultMatch[1];

  return null;
}

// Recursively traverse directory and fix exports in all JS files
async function traverseDirectory(directory) {
  try {
    const files = await fs.promises.readdir(directory, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(directory, file.name);

      if (file.isDirectory()) {
        await traverseDirectory(fullPath);
      } else if (file.name.endsWith('.js')) {
        await fixExportsInFile(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${directory}:`, err);
  }
}

// Start fixing exports
console.log('Starting to fix export patterns...');
traverseDirectory(directoryToFix);
