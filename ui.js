import { getTopPredictions } from './main.js'; // Importiere die Funktion für die Vorhersagen
import { updatePredictionChart } from './main.js'; // Importiere die Funktion für das Diagramm

// Zustand für den aktuellen Text
let currentText = ''; // Eingabetext im Textfeld

// Hilfsfunktion: Ausgabe aktualisieren
function updateOutput(output) {
    const outputElement = document.getElementById('predictionOutput');
    if (!outputElement) {
        console.error("❌ Element mit ID 'predictionOutput' wurde nicht gefunden!");
        return;
    }
    outputElement.innerHTML = output; // Inhalt aktualisieren
}

// „Weiter“-Funktion
export function handleNext() {
    const inputTextArea = document.getElementById('inputText');
    const predictionOutput = document.getElementById('predictionOutput');

    // Aktuellen Text abrufen
    const initialText = inputTextArea.value.trim();

    if (!initialText) {
        predictionOutput.innerHTML = '<strong>Das Eingabefeld ist leer. Bitte geben Sie Text ein.</strong>';
        return;
    }

    // Top-Vorhersagen abrufen
    const predictions = getTopPredictions(initialText);

    if (predictions.length > 0) {
        // Wahrscheinlichstes Wort (das erste) auswählen
        const nextWord = predictions[0]?.word || '';
        currentText = `${initialText} ${nextWord}`.trim(); // An den bestehenden Text anhängen
        inputTextArea.value = currentText; // Eingabefeld mit aktuellem Text aktualisieren

        // Alte Liste entfernen, bevor eine neue erstellt wird
        predictionOutput.innerHTML = ''; // Inhalt leeren

        // Neue Liste für Vorhersagen erstellen
        predictionOutput.innerHTML = '<strong>Die wahrscheinlichsten folgenden Wörter:</strong>';
        const predictionList = document.createElement('ol'); // Nummerierte Liste erstellen
        predictionOutput.appendChild(predictionList);

        // Vorhersagen in die Liste einfügen
        predictions.forEach((item) => {
            const listItem = document.createElement('li'); // Neues Listenelement erstellen
            listItem.innerHTML = `${item.word} (${(item.probability * 100).toFixed(2)}%)`; // Wort mit Wahrscheinlichkeit
            predictionList.appendChild(listItem); // Listenelement zur Liste hinzufügen
        });

        // Aktualisiere das Diagramm mit den neuen Vorhersagen
        updatePredictionChart(predictions);
    } else {
        // Keine Vorhersagen verfügbar
        predictionOutput.innerHTML = '<strong>Keine weiteren Vorhersagen möglich!</strong>';
    }
}