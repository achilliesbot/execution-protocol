#!/usr/bin/env node

/**
 * Fix ESM imports to use .js extensions
 * Required for Node.js ESM compatibility
 * 
 * Processes compiled .js files and ensures proper import paths:
 * 1. Adds .js extensions to file imports
 * 2. Expands directory imports to directory/index.js
 */

const fs = require('fs');
const path = require('path');

function isDirectoryImport(importPath, distDir) {
  const fullPath = path.resolve(distDir, importPath);
  
  // Check if directory exists and has index.js
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    return fs.existsSync(path.join(fullPath, 'index.js'));
  }
  
  return false;
}

function fixEsmImports(filePath, distDir) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  
  // Find all import/export statements with relative paths
  const importRegex = /(import|export)\s*(?:\{[^}]+\})?\s*(?:from\s+)?['"](\.[^'"]+)['"]/g;
  
  let match;
  let fixes = [];
  
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[2];
    
    // Skip if already has .js or .json or is a node_modules import
    if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
      continue;
    }
    
    // Determine the correct path
    let correctedPath = importPath;
    const fullImportPath = path.resolve(path.dirname(filePath), importPath);
    
    if (isDirectoryImport(fullImportPath, distDir)) {
      // Directory import - expand to index.js
      correctedPath = importPath + '/index.js';
    } else {
      // File import - add .js
      correctedPath = importPath + '.js';
    }
    
    if (correctedPath !== importPath) {
      const oldImport = `'${importPath}'`;
      const newImport = `'${correctedPath}'`;
      content = content.replace(oldImport, newImport);
      fixes.push(`  ${importPath} → ${correctedPath}`);
    }
  }
  
  if (fixes.length > 0) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ ${path.relative(distDir, filePath)}`);
    fixes.forEach(f => console.log(f));
    return true;
  }
  
  return false;
}

function processDirectory(dir, distDir) {
  const files = fs.readdirSync(dir);
  let count = 0;
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      count += processDirectory(filePath, distDir);
    } else if (file.endsWith('.js') && !file.endsWith('.d.ts')) {
      if (fixEsmImports(filePath, distDir)) count++;
    }
  }
  
  return count;
}

// Main
const distDir = path.resolve(path.join(__dirname, '..', 'dist'));
console.log(`\nFixing ESM imports in ${distDir}...\n`);
const fixed = processDirectory(distDir, distDir);
console.log(`\nFixed ${fixed} files.\n`);
