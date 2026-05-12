const fs = require('fs');
const path = require('path');
const { parse: parseIcu } = require('@formatjs/icu-messageformat-parser');

const rootDir = 'd:\\wenhuaEdu\\翻译工具\\ulearning-asia\\projects';

function escapeTolgeePlaceholders(value) {
    let index = 0;
    // Replace %s, %d, %f, %@, %.1f%%, %.1f, etc. with {0}, {1}, etc.
    let result = value.replace(/%(\.\d+f)?([sdf@]|%%)/g, (match) => {
        if (match === '%%') return '%'; // Handle literal % if any
        return `{${index++}}`;
    });
    
    // Some basic escape for Tolgee ICU. If there are single unescaped `{` or `}`, it might fail ICU parse.
    // However, the parser will catch it, and we can log it.
    return result;
}

function parseProperties(content, isIos) {
    const lines = content.split(/\r?\n/);
    const result = {};
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;
        if (line.startsWith('#') || line.startsWith('!') || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*') || line.startsWith('[')) {
            continue;
        }
        
        let delimiterIndex = -1;
        for (let j = 0; j < line.length; j++) {
            if (line[j] === '=' || (!isIos && line[j] === ':')) {
                delimiterIndex = j;
                break;
            }
        }
        
        if (delimiterIndex !== -1) {
            let key = line.substring(0, delimiterIndex).trim();
            let value = line.substring(delimiterIndex + 1).trim();
            
            // Clean up key
            if (key.startsWith('"') && key.endsWith('"')) {
                key = key.substring(1, key.length - 1);
            }
            
            // Clean up value
            if (isIos && value.endsWith(';')) {
                value = value.substring(0, value.length - 1).trim();
            } else if (isIos && value.endsWith(',')) {
                value = value.substring(0, value.length - 1).trim();
            }
            
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            }
            
            // Fix newlines if escaped
            value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
            
            // Replace placeholders
            value = escapeTolgeePlaceholders(value);
            
            result[key] = value;
        }
    }
    return result;
}

function processDirectory(dir) {
    let totalFiles = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            totalFiles += processDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.properties')) {
            processFile(fullPath);
            totalFiles++;
        }
    }
    return totalFiles;
}

function processFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const isIos = filePath.includes('ios.');
        const parsed = parseProperties(content, isIos);
        const keyCount = Object.keys(parsed).length;
        
        const jsonPath = filePath.replace(/\.properties$/, '.json');
        
        // ICU Validation
        let icuWarnings = 0;
        for (const [key, value] of Object.entries(parsed)) {
            try {
                // Tolgee uses ICU message format. Validate it using formatjs parser
                parseIcu(value);
            } catch (icuErr) {
                // If it fails, we might need to escape literal '{' or '}' with quotes '{' '}'
                let escapedValue = value.replace(/{/g, "'{'").replace(/}/g, "'}'");
                try {
                    parseIcu(escapedValue);
                    parsed[key] = escapedValue;
                } catch(e2) {
                    icuWarnings++;
                    // console.warn(`    [WARN] ICU validation failed for key: ${key} = ${value}`);
                }
            }
        }
        
        fs.writeFileSync(jsonPath, JSON.stringify(parsed, null, 2), 'utf8');
        
        // Final JSON Validation
        JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        
        let msg = `[SUCCESS] ${filePath} -> ${path.basename(jsonPath)} | Keys: ${keyCount}`;
        if (icuWarnings > 0) {
            msg += ` | ICU Warnings: ${icuWarnings}`;
        }
        console.log(msg);
    } catch (err) {
        console.error(`[FAILED] ${filePath} - ${err.message}`);
    }
}

console.log('Starting conversion...');
const count = processDirectory(rootDir);
console.log(`\nDone! Processed ${count} files.`);
