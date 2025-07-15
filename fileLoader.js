const MAX_WORDS = 1000; // Begrenzung auf 100 Wörter

// Teiltext aus einer Datei laden (für den Browser mit fetch)
export async function loadPartialText(filePath, maxWords = MAX_WORDS) {
    try {
        console.log(`[INFO] Datei "${filePath}" wird geladen...`);

        // Lade die Datei über fetch
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`[ERROR] Fehler beim Laden der Datei: ${response.statusText}`);
        }

        const rawText = await response.text(); // Dateiinhalt als Text abrufen
        console.log(`[INFO] Originale Dateigröße: ${rawText.length} Zeichen.`);

        // Aufteilen in Wörter
        const words = rawText.split(/\s+/);
        console.log(`[INFO] Originale Anzahl Wörter: ${words.length}`);

        // Begrenzen der Anzahl der Wörter
        const sampledWords = words.slice(0, maxWords);
        console.log(`[INFO] Teiltext erfolgreich extrahiert: ${sampledWords.length} Wörter.`);

        // Rückgabe als Array von Wörtern (nicht als String!)
        return sampledWords;
    } catch (error) {
        console.error('[ERROR] Fehler beim Laden der Datei:', error);
        throw error;
    }
}