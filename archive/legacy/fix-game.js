// This script will fix the primary issues in the codebase to get the game running
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Fix the main.js root file to properly load the game
async function fixRootMainJS() {
  const filePath = path.join(__dirname, 'main.js');
  const content = `// Main entry point for the game
import Game from './src/js/main.js';

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
  // Create error display for debugging
  const debugDisplay = document.createElement('pre');
  debugDisplay.style.position = 'fixed';
  debugDisplay.style.top = '10px';
  debugDisplay.style.left = '10px';
  debugDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  debugDisplay.style.color = 'white';
  debugDisplay.style.padding = '10px';
  debugDisplay.style.fontFamily = 'monospace';
  debugDisplay.style.zIndex = '9999';
  debugDisplay.style.maxHeight = '80%';
  debugDisplay.style.overflow = 'auto';
  debugDisplay.style.fontSize = '12px';
  debugDisplay.style.visibility = 'hidden';
  document.body.appendChild(debugDisplay);
  
  // Override console to capture logs
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn
  };
  
  function logToDisplay(msg, type) {
    debugDisplay.style.visibility = 'visible';
    const line = document.createElement('div');
    line.style.color = type === 'error' ? '#ff6666' : 
                      type === 'warn' ? '#ffff66' : '#aaffaa';
    line.textContent = \`[\${new Date().toLocaleTimeString()}] [\${type}] \${msg}\`;
    debugDisplay.appendChild(line);
    debugDisplay.scrollTop = debugDisplay.scrollHeight;
  }
  
  console.log = function(...args) {
    logToDisplay(args.join(' '), 'log');
    originalConsole.log.apply(console, args);
  };
  
  console.error = function(...args) {
    logToDisplay(args.join(' '), 'error');
    originalConsole.error.apply(console, args);
  };
  
  console.warn = function(...args) {
    logToDisplay(args.join(' '), 'warn');
    originalConsole.warn.apply(console, args);
  };
  
  // Setup error handlers
  window.addEventListener('error', function(event) {
    logToDisplay(\`\${event.message} at \${event.filename}:\${event.lineno}:\${event.colno}\`, 'error');
  });
  
  window.addEventListener('unhandledrejection', function(event) {
    logToDisplay(\`Unhandled Promise: \${event.reason}\`, 'error');
  });
  
  console.log("Initializing game...");
  
  try {
    console.log("Creating Game instance");
    const game = new Game();
    console.log("Game instance created, calling init()");
    game.init()
      .then(() => {
        console.log("Game initialization successful!");
      })
      .catch(error => {
        console.error("Game initialization failed:", error);
      });
  } catch (error) {
    console.error("Error during game creation:", error);
  }
});`;

  await fs.promises.writeFile(filePath, content, 'utf8');
  console.log('✓ Fixed root main.js');
}

// 2. Ensure all modules use consistent export patterns
async function fixModuleExports(directory) {
  const files = await fs.promises.readdir(directory, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(directory, file.name);

    if (file.isDirectory()) {
      await fixModuleExports(fullPath);
    } else if (file.name.endsWith('.js')) {
      await fixSingleModuleExports(fullPath);
    }
  }
}

async function fixSingleModuleExports(filePath) {
  const data = await fs.promises.readFile(filePath, 'utf8');

  // Skip files that aren't modules with classes
  if (!data.includes('export')) return;

  // Find the class/function name
  const classMatch = data.match(/export\s+(default\s+)?class\s+(\w+)/);
  if (!classMatch) return;

  const className = classMatch[2];
  const hasNamedExport =
    data.includes(`export class ${className}`) ||
    data.includes(`export function ${className}`);
  const hasDefaultExportAtEnd = data.match(
    new RegExp(`export\\s+default\\s+${className};?\\s*$`, 'm')
  );

  if (hasNamedExport && hasDefaultExportAtEnd) {
    // Fix duplicate exports
    let newContent = data
      .replace(`export class ${className}`, `class ${className}`)
      .replace(`export function ${className}`, `function ${className}`);

    await fs.promises.writeFile(filePath, newContent, 'utf8');
    console.log(`✓ Fixed exports in ${filePath}`);
  }
}

// 3. Fix import paths to use relative paths consistently
async function fixImportPaths(directory) {
  const files = await fs.promises.readdir(directory, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(directory, file.name);

    if (file.isDirectory()) {
      await fixImportPaths(fullPath);
    } else if (file.name.endsWith('.js')) {
      await fixSingleFileImports(fullPath);
    }
  }
}

async function fixSingleFileImports(filePath) {
  const data = await fs.promises.readFile(filePath, 'utf8');

  // Check for absolute imports
  if (!data.includes("from '/src/")) return;

  // Replace absolute paths with relative ones
  const newContent = data.replace(
    /from\s+['"]\/src\/js\/([^'"]+)['"]/g,
    (match, p1) => {
      // Calculate relative path
      const relativePath = path
        .relative(path.dirname(filePath), path.join(__dirname, 'src', 'js', p1))
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
    console.log(`✓ Fixed imports in ${filePath}`);
  }
}

// Run all fixes
async function runFixes() {
  // 1. Fix main.js
  await fixRootMainJS();

  // 2. Fix export patterns
  await fixModuleExports(path.join(__dirname, 'src'));

  // 3. Fix import paths
  await fixImportPaths(path.join(__dirname, 'src'));

  console.log('All fixes applied! Try running the game now.');
}

runFixes().catch(console.error);
