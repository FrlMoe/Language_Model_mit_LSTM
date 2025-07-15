export let dictionary = {};
export let reverseDictionary = {};
export let sequenceLength = 5; // z.B. 5 Wörter Input → 1 Wort Vorhersage

export function preprocessText(text) {
    console.log('[1] Originaltext:', text.slice(0, 100) + '...');

    // 1. Text bereinigen
    const cleaned = text
        .toLowerCase()
        .replace(/<[^>]*>/g, '')              // HTML-Tags entfernen
        .replace(/&[a-z]+;/gi, '')            // HTML-Entities entfernen
        .replace(/[^a-zA-ZäöüßÄÖÜ\s]/g, '')   // Nur Buchstaben und Leerzeichen behalten
        .replace(/\s+/g, ' ')                 // Mehrere Leerzeichen zusammenfassen
        .trim();

    console.log('[2] Bereinigter Text:', cleaned.slice(0, 100) + '...');

    // 2. Tokenisierung
    let words = cleaned.split(' ');

    // Wörterhäufigkeit berechnen
    const wordCounts = {};
    words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
    });

// Schwellenwert für Seltenheit
    const minCount = 2;

// Wörterbuch mit <UNK>-Token
    let wordIndex = 1;
    dictionary = {};
    reverseDictionary = {};
    dictionary['<UNK>'] = 0;
    reverseDictionary[0] = '<UNK>';

    words.forEach(word => {
        if (wordCounts[word] >= minCount && !(word in dictionary)) {
            dictionary[word] = wordIndex;
            reverseDictionary[wordIndex] = word;
            wordIndex++;
        }
    });

// Beim Mapping: Seltene Wörter auf <UNK> setzen
    const mappedWords = words.map(w => dictionary[w] !== undefined ? w : '<UNK>');

  // 3. Stoppwörter entfernen
    const stopWords = ['und', 'der', 'die', 'das', 'ist', 'ein', 'eine', 'zu', 'mit', 'auf', 'für', 'von', 'im', 'an'];
    words = words.filter(word => !stopWords.includes(word));

    console.log('[3] Nach Stoppwörter-Filter:', words.slice(0, 10));

    // 4. Wörterbuch aufbauen

    words.forEach(word => {
        if (!(word in dictionary)) {
            dictionary[word] = wordIndex;
            reverseDictionary[wordIndex] = word;
            wordIndex++;
        }
    });

    console.log('[4] Wörterbuchgröße:', Object.keys(dictionary).length);

    // 5. Sequenzen & Ziele
    const inputSequences = [];
    const targetWords = [];

    for (let i = 0; i < words.length - sequenceLength; i++) {
        const input = words.slice(i, i + sequenceLength).map(w => dictionary[w]);
        const target = dictionary[words[i + sequenceLength]];
        inputSequences.push(input);
        targetWords.push(target);
    }

    console.log('[5] Anzahl Trainingssequenzen:', inputSequences.length);

    return { inputSequences, targetWords };
}