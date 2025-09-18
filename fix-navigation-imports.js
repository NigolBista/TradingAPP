const fs = require('fs');
const path = require('path');

// Comprehensive import path fixes for navigation and cross-references
const fixPatterns = [
  // Fix shared services imports from deep feature components
  { from: /from ['"]\.\.\/\.\.\/\.\.\/shared\/services\//g, to: 'from "../../../../shared/services/' },
  { from: /from ['"]\.\.\/\.\.\/\.\.\/shared\/lib\//g, to: 'from "../../../../shared/lib/' },
  { from: /from ['"]\.\.\/\.\.\/\.\.\/shared\/hooks\//g, to: 'from "../../../../shared/hooks/' },
  { from: /from ['"]\.\.\/\.\.\/\.\.\/shared\/constants\//g, to: 'from "../../../../shared/constants/' },
  { from: /from ['"]\.\.\/\.\.\/\.\.\/shared\/utils\//g, to: 'from "../../../../shared/utils/' },

  // Fix store imports from deep components (4 levels deep)
  { from: /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/store\//g, to: 'from "../../../../store/' },

  // Fix provider imports from deep components
  { from: /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/providers\//g, to: 'from "../../../../providers/' },

  // Fix logic/types imports that should now point to trading feature
  { from: /from ['"]\.\.\/\.\.\/\.\.\/logic\/types['"]/g, to: 'from "../../trading/types"' },
  { from: /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/logic\/types['"]/g, to: 'from "../../../trading/types"' },

  // Fix any remaining ../../../logic paths
  { from: /from ['"]\.\.\/\.\.\/\.\.\/logic\//g, to: 'from "../../trading/services/' },
  { from: /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/logic\//g, to: 'from "../../../trading/services/' },

  // Fix navigation hooks from shared components
  { from: /from ['"]\.\.\/\.\.\/navigation\/hooks['"]/g, to: 'from "../../navigation/hooks"' },

  // Fix double shared paths
  { from: /from ['"]\.\.\/shared\/shared\//g, to: 'from "../shared/' },
  { from: /from ['"]\.\.\/\.\.\/shared\/shared\//g, to: 'from "../../shared/' },
];

function fixImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    fixPatterns.forEach(pattern => {
      const before = content;
      content = content.replace(pattern.from, pattern.to);
      if (content !== before) {
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed imports in: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  let totalFixed = 0;

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      totalFixed += walkDir(filePath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      if (fixImportsInFile(filePath)) {
        totalFixed++;
      }
    }
  });

  return totalFixed;
}

// Process all source files
console.log('Starting comprehensive import path fixes...');
const fixedCount = walkDir('./src');
console.log(`Import fixing complete! Fixed ${fixedCount} files.`);

// Also create a summary of remaining potential issues
console.log('\nChecking for remaining potential issues...');

function findPotentialIssues() {
  const issues = [];

  function checkFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Look for suspicious import patterns
        if (line.includes('from "') && line.includes('import')) {
          // Check for potentially wrong paths
          if (line.includes('../../../../../../') ||
              line.includes('../../../../../') ||
              line.includes('shared/shared/') ||
              line.includes('logic/') ||
              line.includes('providers/AuthProvider')) {
            issues.push({
              file: filePath,
              line: index + 1,
              content: line.trim()
            });
          }
        }
      });
    } catch (error) {
      // Skip files that can't be read
    }
  }

  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        scanDir(filePath);
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        checkFile(filePath);
      }
    });
  }

  scanDir('./src');
  return issues;
}

const issues = findPotentialIssues();
if (issues.length > 0) {
  console.log('\nPotential remaining issues found:');
  issues.forEach(issue => {
    console.log(`${issue.file}:${issue.line} - ${issue.content}`);
  });
} else {
  console.log('\nNo obvious import path issues detected!');
}