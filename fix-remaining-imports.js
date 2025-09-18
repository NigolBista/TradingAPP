const fs = require('fs');
const path = require('path');

const fixPatterns = [
  // Shared constants from feature directories should use ../../shared/
  { from: /from ['"]\.\.\/shared\/constants\//g, to: 'from "../../shared/constants/' },

  // Insights components moved to features/insights
  { from: /from ['"]\.\.\/components\/insights\//g, to: 'from "../../insights' },
  { from: /from ['"]\.\.\/\.\.\/components\/insights\//g, to: 'from "../../insights' },

  // Charts components in trading
  { from: /from ['"]\.\.\/\.\.\/\.\.\/logic\/chartBridge['"]/g, to: 'from "../services/chartBridge"' },

  // Services moved to shared/services
  { from: /from ['"]\.\.\/shared\/services\/alertsService['"]/g, to: 'from "../../shared/services/alertsService"' },

  // Auth provider from providers
  { from: /from ['"]\.\.\/\.\.\/\.\.\/providers\/AuthProvider['"]/g, to: 'from "../../../providers/AuthProvider"' },

  // Day and swing trade services
  { from: /from ['"]\.\.\/\.\.\/\.\.\/logic\/dayTrade['"]/g, to: 'from "../services/dayTrade"' },
  { from: /from ['"]\.\.\/\.\.\/\.\.\/logic\/swingTrade['"]/g, to: 'from "../services/swingTrade"' },

  // Shared hooks
  { from: /from ['"]\.\.\/shared\/hooks\//g, to: 'from "../../shared/hooks/' },
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
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fixImportsInFile(filePath);
    }
  });
}

// Process src directory
walkDir('./src');
console.log('Import fixing complete!');