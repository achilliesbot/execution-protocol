#!/usr/bin/env node

/**
 * Fix ESM imports to use .js extensions
 * Required for Node.js ESM compatibility
 * 
 * Processes compiled .js files and adds .js extensions to relative imports
 */

const fs = require('fs');
const path = require('path');

function fixEsmImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Replace imports/exports from relative paths without .js extension
  // Pattern: from './' or '../' that doesn't already end with .js or .json
  const patterns = [
    // export { ... } from './path'
    /export\s*\{\s*[^}]+\}\s*from\s+['"](\.[^'"]+)(['"];)/g,
    // import { ... } from './path'
    /import\s*\{\s*[^}]+\}\s*from\s+['"](\.[^'"]+)(['"];)/g,
    // import './path'
    /import\s+['"](\.[^'"]+)['"];/g,
  ];
  
  let modified = false;
  
  for (const pattern of patterns) {
    content = content.replace(pattern, (match, importPath, quote) => {
      // Don't add .js if already present or if it's a .json file
      if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
        return match;
      }
      
      modified = true;
      
      // Handle the three patterns differently
      if (match.includes('export')) {
        return `export ${match.substring(match.indexOf('{'))}from '${importPath}.js'${quote || ';'}`;
      } else if (match.includes('import') && match.includes('{')) {
        return `import ${match.substring(match.indexOf('{'))}from '${importPath}.js'${quote || ';'}`;
      } else {
        // Plain import
        return `import '${importPath}.js';`;
      }
    });
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ Fixed: ${filePath}`);
  }
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (file.endsWith('.js') && !file.endsWith('.d.ts')) {
      fixEsmImports(filePath);
    }
  }
}

// Main
const distDir = path.join(__dirname, '..', 'dist');
console.log(`Fixing ESM imports in ${distDir}...`);
processDirectory(distDir);
console.log('Done.');
