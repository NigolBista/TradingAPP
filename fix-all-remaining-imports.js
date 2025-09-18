const fs = require('fs');
const path = require('path');

// Map correct paths from different source locations
const pathMappings = {
  // From features/authentication/components/ to shared/
  'src/features/authentication/components': {
    'shared': '../../../shared'
  },
  // From features/*/components/*/ to shared/
  'src/features/.*/components/.*': {
    'shared': '../../../../shared'
  },
  // From features/*/services/ to shared/
  'src/features/.*/services': {
    'shared': '../../../shared'
  },
  // From features/*/screens/ to shared/
  'src/features/.*/screens': {
    'shared': '../../../shared'
  },
  // From shared/components/ to shared/
  'src/shared/components': {
    'shared': '..'
  },
  // From shared/hooks/ to shared/
  'src/shared/hooks': {
    'shared': '..'
  },
  // From shared/services/ to shared/
  'src/shared/services': {
    'shared': '..'
  }
};

function getCorrectPath(filePath, importType) {
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Match against patterns
  for (const [pattern, mapping] of Object.entries(pathMappings)) {
    const regex = new RegExp(pattern);
    if (regex.test(normalizedPath)) {
      return mapping[importType];
    }
  }

  return null;
}

function fixImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const originalContent = content;

    // Fix various import patterns based on file location
    const fixes = [
      // Fix shared services from authentication components
      {
        pattern: /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/shared\/services\//g,
        replacement: 'from "../../../shared/services/',
        condition: (fp) => fp.includes('features/authentication/components')
      },

      // Fix shared lib from authentication components
      {
        pattern: /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/shared\/lib\//g,
        replacement: 'from "../../../shared/lib/',
        condition: (fp) => fp.includes('features/authentication/components')
      },

      // Fix any remaining ../../../../shared/ in features to ../../../shared/
      {
        pattern: /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/shared\//g,
        replacement: 'from "../../../shared/',
        condition: (fp) => fp.includes('features/') && !fp.includes('components/') && !fp.includes('screens/')
      },

      // Fix double shared paths anywhere
      {
        pattern: /from ['"](.*)\/shared\/shared\//g,
        replacement: 'from "$1/shared/',
        condition: () => true
      },

      // Fix providers/AuthProvider to features/authentication
      {
        pattern: /from ['"](.*)\/providers\/AuthProvider['"]/g,
        replacement: (match, prefix) => {
          if (prefix.includes('../../..')) return 'from "../../features/authentication"';
          if (prefix.includes('../..')) return 'from "../features/authentication"';
          return 'from "./src/features/authentication"';
        },
        condition: () => true
      },

      // Fix ../../logic/ to ../../trading/services/ or ../trading/services/
      {
        pattern: /from ['"]\.\.\/\.\.\/logic\//g,
        replacement: 'from "../trading/services/',
        condition: (fp) => fp.includes('features/')
      },

      // Fix ../../../logic/ to ../../trading/services/
      {
        pattern: /from ['"]\.\.\/\.\.\/\.\.\/logic\//g,
        replacement: 'from "../../trading/services/',
        condition: (fp) => fp.includes('features/')
      }
    ];

    fixes.forEach(fix => {
      if (fix.condition(filePath)) {
        if (typeof fix.replacement === 'function') {
          content = content.replace(fix.pattern, fix.replacement);
        } else {
          content = content.replace(fix.pattern, fix.replacement);
        }
        if (content !== originalContent) {
          modified = true;
        }
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

console.log('Starting final comprehensive import fixes...');
const fixedCount = walkDir('./src');
console.log(`Final import fixing complete! Fixed ${fixedCount} files.`);