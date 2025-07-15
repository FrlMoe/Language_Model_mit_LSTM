// countWords.js
const fs = require('fs');

// Datei lesen
const text = fs.readFileSync('evaluatedata/.txt', 'utf-8');

// Wortanzahl zählen (alles, was durch Leerzeichen oder Zeilen getrennt ist)
const words = text.split(/\s+/).filter(word => word.length > 0);

console.log(`🔢 Anzahl der Wörter in testdata.txt: ${words.length}`);
