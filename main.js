import { trainModel, model } from './train.js';
import { dictionary, reverseDictionary, sequenceLength } from './preprocess.js';
import { handleNext } from './ui.js'; // Importiere die „Weiter“-Logik aus ui.js
import { preprocessText } from './preprocess.js';

let autoPredictInterval = null; // Speichert den Intervallprozess
let isAutoPredictRunning = false; // Status des Auto-Modus

// Globale Variable für das Chart-Objekt
let predictionChart = null;

let accuracyChart = null;

// Wahrscheinlichste Wörter darstellen basierend auf aktuellem Kontext
export function getTopPredictions(startText) {
    if (!model) {
        console.error(' Modell ist nicht trainiert.');
        return [];
    }

    // Tokenize Starttext
    let currentWords = startText
        .toLowerCase()
        .split(' ')
        .map((word) => dictionary[word] || 0);

    // Fülle die Sequenz bis zur vorgegebenen Länge auf
    while (currentWords.length < sequenceLength) {
        currentWords.unshift(0);
    }
    currentWords = currentWords.slice(-sequenceLength);

    // Tensor für Vorhersage vorbereiten
    const inputTensor = tf.tensor2d([currentWords], [1, sequenceLength]);
    const prediction = model.predict(inputTensor);
    const logits = prediction.squeeze();
    const probabilities = tf.softmax(logits).dataSync();

    // Top-5-Wahrscheinlichkeiten berechnen
    const sortedIndices = Array.from(probabilities.keys())
        .sort((a, b) => probabilities[b] - probabilities[a])
        .slice(0, 5);

    // Mapping von Indizes auf Wörter + Wahrscheinlichkeiten
    const topWords = sortedIndices.map((index) => ({
        word: reverseDictionary[index],
        probability: probabilities[index]
    }));

    // Tensor aufräumen
    inputTensor.dispose();
    prediction.dispose();

    return topWords;
}


function sampleFromPredictions(predictions) {
    const total = predictions.reduce((sum, p) => sum + p.probability, 0);
    let r = Math.random() * total;
    for (const p of predictions) {
        r -= p.probability;
        if (r <= 0) return p.word;
    }
    // Fallback, falls Rundungsfehler auftreten
    return predictions[0]?.word || '';
}

// Funktion zum automatischen Vorhersagen (Liste wächst nach und nach, Chart spiegelt 10 Wörter wider)
function startAutoPredict(inputTextArea, predictionOutput, maxPredictions = 10) {
    // Prüfe, ob der Auto-Modus bereits aktiv ist
    if (isAutoPredictRunning) {
        console.warn(' Automatischer Vorhersage-Modus läuft bereits. Neuer Start wird blockiert.');
        return; // Verhindere mehrfaches Starten
    }

    console.log("🔄 Starte den automatischen Vorhersagemodus...");
    isAutoPredictRunning = true; // Markiere den Modus als aktiv

    let predictionCount = 0;

    const predictionList = document.createElement('ol'); // Erstelle Liste für Vorhersagen
    predictionList.innerHTML = ''; // Leere alte Vorhersagen
    predictionOutput.innerHTML = '<strong>Automatische Vorhersagen:</strong>';
    predictionOutput.appendChild(predictionList);

    const collectedPredictions = []; // Für die Chart-Daten

    autoPredictInterval = setInterval(() => {
        console.log("⏳ Auto-Vorhersage läuft...");

        if (predictionCount >= maxPredictions) {
            clearInterval(autoPredictInterval); // Stoppe den Intervallprozess
            autoPredictInterval = null; // Zurücksetzen der Variable
            isAutoPredictRunning = false; // Auto-Modus deaktiviert
            console.log(`Automodus beendet nach ${predictionCount} Vorhersagen.`);
            return;
        }

        const currentText = inputTextArea.value.trim();
        if (!currentText) {
            console.warn(' Kein Text im Eingabefeld vorhanden. Stoppe den Vorgang.');
            clearInterval(autoPredictInterval);
            autoPredictInterval = null; // Zurücksetzen der Variable
            isAutoPredictRunning = false; // Auto-Modus deaktiviert
            return;
        }

        console.log(` Aktueller Text im Eingabefeld: "${currentText}"`);

        // Hole exakt 1 Vorhersage
        const predictions = getTopPredictionsWithFallback(currentText, 5);

        if (predictions.length === 0) {
            console.error(' Keine Vorhersagen generiert. Überprüfe das Modell.');
            clearInterval(autoPredictInterval);
            autoPredictInterval = null; // Zurücksetzen der Variable
            isAutoPredictRunning = false; // Auto-Modus deaktiviert
            return;
        }

        // Wähle ein Wort per gewichteter Zufallsauswahl
        const nextWord = sampleFromPredictions(predictions);

// Finde die Wahrscheinlichkeit für dieses Wort (zur Anzeige)
        const nextProbability = (predictions.find(p => p.word === nextWord)?.probability * 100 || 0).toFixed(2);
        console.log(` Vorhergesagtes Wort: "${nextWord}" mit Wahrscheinlichkeit: ${nextProbability}%`);

        // Eingabefeld aktualisieren
        inputTextArea.value = `${currentText} ${nextWord}`.trim();

        // Liste aktualisieren
        const listItem = document.createElement('li');
        listItem.innerText = `${nextWord} (${nextProbability}%)`;
        predictionList.appendChild(listItem);

        console.log(` Liste aktualisiert: Aktuelle Anzahl: ${predictionList.children.length} Wörter.`);

        // Daten für den Chart sammeln
        collectedPredictions.push(predictions[0]);

        // Chart-Daten erweitern und auf 10 fixieren
        const chartData = expandToChartData(collectedPredictions, 10);

        console.log(` Daten für den Chart:`, chartData);

        // Chart aktualisieren
        updatePredictionChart(chartData);

        predictionCount++;
        console.log(` Nächster Vorgang... (${predictionCount}/${maxPredictions})`);
    }, 1000); // Auto-Vorhersage alle 1 Sekunde
}

function stopAutoPredict() {
    if (autoPredictInterval) {
        clearInterval(autoPredictInterval);
        autoPredictInterval = null; // Intervall beenden und zurücksetzen
        isAutoPredictRunning = false; // Status zurücksetzen
        console.log(" Automatischer Vorhersage-Modus wurde gestoppt.");
    } else {
        console.log(" Kein aktiver Auto-Vorhersage-Modus zum Stoppen.");
    }
}

// Funktion: Generiert eine Liste mit genau 10 Einträgen für den Chart
function expandToChartData(predictions, desiredCount) {
    const chartData = [...predictions]; // Kopiere die bisherigen Vorhersagen

    // Fülle die Vorhersagen auf, falls weniger als desiredCount vorhanden ist
    while (chartData.length < desiredCount) {
        chartData.push({ word: "N/A", probability: 0 }); // Füge Platzhalter hinzu
    }

    // Schneide ab, falls mehr als desiredCount vorhanden ist (falls nötig)
    return chartData.slice(0, desiredCount);
}

// Funktion: Exakt 10 Vorhersagen inklusive Platzhalter generieren
function getTopPredictionsWithFallback(startText, desiredCount = 10) {
    if (!model) {
        console.error(' Modell ist nicht trainiert.');
        return [];
    }

    // Tokenize Starttext
    let currentWords = startText
        .toLowerCase()
        .split(' ')
        .map((word) => dictionary[word] || 0);

    // Fülle die Sequenz bis zur vorgegebenen Länge auf
    while (currentWords.length < sequenceLength) {
        currentWords.unshift(0);
    }
    currentWords = currentWords.slice(-sequenceLength);

    // Tensor für Vorhersage vorbereiten
    const inputTensor = tf.tensor2d([currentWords], [1, sequenceLength]);
    const prediction = model.predict(inputTensor);
    const logits = prediction.squeeze();
    const probabilities = tf.softmax(logits).dataSync();

    // Top-Wahrscheinlichkeiten berechnen
    const sortedIndices = Array.from(probabilities.keys())
        .sort((a, b) => probabilities[b] - probabilities[a])
        .slice(0, desiredCount);

    // Mapping von Indizes auf Wörter + Wahrscheinlichkeiten
    const topWords = sortedIndices.map((index) => ({
        word: reverseDictionary[index] || "N/A", // Fallback für unbekannte Wörter
        probability: probabilities[index] || 0
    }));

    // Fülle, falls nötig, mit Platzhaltern auf, um genau desiredCount zu erreichen
    while (topWords.length < desiredCount) {
        topWords.push({ word: "N/A", probability: 0 });
    }

    // Tensor aufräumen
    inputTensor.dispose();
    prediction.dispose();

    return topWords;
}

// Funktion, um das Chart zu erstellen oder zu aktualisieren
export function updatePredictionChart(predictions) {
    const ctx = document.getElementById('predictionChart').getContext('2d');

    // Extrahiere Wörter und Wahrscheinlichkeiten aus den Vorhersagen
    const labels = predictions.map((p) => p.word); // Alle Wörter
    const data = predictions.map((p) => (p.probability * 100).toFixed(2)); // Wahrscheinlichkeiten

    if (predictionChart) {
        // Aktualisierung bestehender Chart-Daten
        predictionChart.data.labels = labels;
        predictionChart.data.datasets[0].data = data;
        predictionChart.update();
    } else {
        // Erstelle ein neues Chart, falls noch nicht vorhanden
        predictionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Wahrscheinlichkeit (%)',
                    data: data,
                    backgroundColor: 'rgba(171,131,217,0.5)',
                    borderColor: 'rgba(171,131,217,0.5)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Wahrscheinlichkeit (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Vorhergesagte Wörter'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Top-k-Vorhersagen'
                    }
                }
            }
        });
    }
}

// Modell beim Seitenstart trainieren
window.addEventListener('load', async () => {
    try {
        await trainModel(); // Training starten
        console.log(' Modell wurde erfolgreich beim Seitenstart trainiert.');
    } catch (error) {
        console.error(' Fehler beim Training des Modells:', error);
        document.getElementById('predictionOutput').innerText =
            'Fehler beim Training des Modells. Siehe Konsole für Details.';
    }
});

// Button-Handler (bestehende Logik bleibt unverändert)
document.addEventListener('DOMContentLoaded', () => {
    const predictBtn = document.getElementById('predictBtn');
    const inputTextArea = document.getElementById('inputText');
    const predictionOutput = document.getElementById('predictionOutput');
    const nextBtn = document.getElementById('nextBtn'); // "Weiter"-Button
    const autoBtn = document.getElementById('autoBtn'); // "Auto"-Button
    const stopBtn = document.getElementById('stopBtn'); // "Stopp"-Button
    const resetBtn = document.getElementById('resetBtn'); // "Reset"-Button
    const evaluateBtn = document.getElementById('evaluateBtn'); // Neuer Button "Evaluate"

    // Vorhersage-Button
    if (predictBtn) {
        predictBtn.addEventListener('click', () => {
            const initialText = inputTextArea.value.trim();

            if (initialText.length === 0 || !/\b\w+\b/.test(initialText)) {
                predictionOutput.innerHTML = `<strong>Das Eingabefeld enthält keinen gültigen Text. Bitte geben Sie mindestens ein Wort ein.</strong>`;
                return;
            }

            const predictions = getTopPredictions(initialText);

            // Früheren Inhalt löschen
            predictionOutput.innerHTML = '<strong>Die wahrscheinlichsten folgenden Wörter:</strong><br>';

            predictions.forEach((item) => {
                const predictionButton = document.createElement('button');
                predictionButton.className = 'word-button';
                predictionButton.style.margin = '5px';
                predictionButton.innerText = `${item.word} (${(item.probability * 100).toFixed(2)}%)`;
                predictionButton.addEventListener('click', () => {
                    inputTextArea.value = `${inputTextArea.value} ${item.word}`.trim();
                    predictBtn.click();
                });
                predictionOutput.appendChild(predictionButton);
            });

            // Aktualisiere das Diagramm
            updatePredictionChart(predictions);
        });
    } else {
        console.error(" Element mit ID 'predictBtn' wurde nicht gefunden.");
    }

    // "Weiter"-Button
    if (nextBtn) {
        nextBtn.addEventListener('click', handleNext);
    } else {
        console.error(" Der 'Weiter'-Button (nextBtn) wurde nicht gefunden.");
    }

    // "Auto"-Button
    if (autoBtn) {
        autoBtn.addEventListener('click', () => {
            if (autoPredictInterval) {
                console.log('️ Automatischer Vorhersage-Modus läuft bereits.');
                return;
            }
            startAutoPredict(inputTextArea, predictionOutput);
            console.log(' Automatische Vorhersagen gestartet.');
        });
    } else {
        console.error(" Der 'Auto'-Button (autoBtn) wurde nicht gefunden.");
    }

    // "Stopp"-Button
    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            clearInterval(autoPredictInterval);
            autoPredictInterval = null;
            console.log(' Automatische Vorhersagen gestoppt.');
        });
    } else {
        console.error(" Der 'Stopp'-Button (stopBtn) wurde nicht gefunden.");
    }

    // "Reset"-Button
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            inputTextArea.value = '';
            predictionOutput.innerHTML = '';

            // Falls das Prediction-Chart existiert, zerstöre es
            if (predictionChart) {
                predictionChart.destroy();
                predictionChart = null;
                console.log('🔄 Prediction-Chart wurde zurückgesetzt.');
            }

            // Falls das Accuracy-Chart existiert, zerstöre es
            if (accuracyChart) {
                accuracyChart.destroy();
                accuracyChart = null;
                console.log(' Accuracy-Chart wurde zurückgesetzt.');
            }

            // Modell zurücksetzen (neu trainieren)

            try {
                await trainModel();
                console.log(' Modell zurückgesetzt und neu trainiert.');
            } catch (error) {
                console.error(' Fehler beim Zurücksetzen des Modells:', error);
            }
        });
    } else {
        console.error(" Der 'Reset'-Button (resetBtn) wurde nicht gefunden.");
    }

    // "Evaluate"-Button (neuer Button)
    if (evaluateBtn) {
        evaluateBtn.addEventListener('click', () => {
            console.log(' Evaluierungsprozess gestartet...');
            evaluateModel();
        });
    } else {
        console.error(" Der \"Evaluate\"-Button (evaluateBtn) wurde nicht gefunden.");
    }
});

// Testdatensatz generieren mit Preprocessing
function generateTestDataset(text, sequenceLength = 5, sampleSize = 100) {
    // Bereinige den Text wie beim Training
    const cleaned = preprocessText(text).inputSequences
        ? preprocessText(text).inputSequences.flat().map(idx => reverseDictionary[idx])
        : text.toLowerCase().replace(/[^a-zA-ZäöüßÄÖÜ\s]/g, '').replace(/\s+/g, ' ').trim().split(' ');

    const words = Array.isArray(cleaned) ? cleaned : cleaned.split(/\s+/).filter(Boolean);
    const testData = [];

    for (let i = sequenceLength; i < words.length - 1; i++) {
        const input = words.slice(i - sequenceLength, i).join(' ');
        const expectedWord = words[i];
        testData.push({ input, expectedWord });
    }

    // Mischen & Begrenzen auf sampleSize
    return testData.sort(() => 0.5 - Math.random()).slice(0, sampleSize);
}
let testDataset = [];

fetch('data/evaluatedata.txt') // Pfad zur Textdatei
    .then(res => res.text())
    .then(text => {
        testDataset = generateTestDataset(text, 5, 100); // z. B. 100 zufällige 5-Wort-Kontexte
        console.log(' Testdaten vorbereitet:', testDataset.length);

        // Überprüfe, ob alle erwarteten Wörter im Wörterbuch sind
        const fehlendeWoerter = testDataset
            .filter(test => !(test.expectedWord in dictionary))
            .map(test => test.expectedWord);

        if (fehlendeWoerter.length > 0) {
            console.warn('Fehlende Wörter im Wörterbuch:', fehlendeWoerter);
        } else {
            console.log('Alle erwarteten Wörter sind im Wörterbuch enthalten.');
        }


    })
    .catch(err => console.error(' Fehler beim Laden der Testdaten:', err));




// Hauptfunktion für die Evaluierung
function evaluateModel() {
    console.log('🔍 Beginne Modell-Evaluierung...');

    const kValues = [1, 5, 10, 20, 100]; // Verschiedene k-Werte
    const results = { accuracy: [], perplexity: 0 };

    // Zähler für die Treffer bei verschiedenen k-Werten
    const accuracyAtK = { 1: 0, 5: 0, 10: 0, 20: 0, 100: 0 };
    let totalPerplexity = 0; // Perplexity-Akkumulator

    // Testdaten iterieren
    testDataset.forEach((test, index) => {
        const predictions = getTopPredictionsWithFallback(test.input, 100); // Hole die Top-100-Wörter
        const topProbabilities = predictions.map(p => p.probability); // Wahrscheinlichkeiten
        const predictedWords = predictions.map(p => p.word); // Vorhergesagte Wörter

        console.log(` Satz #${index + 1}: "${test.input}", Erwartetes Wort: "${test.expectedWord}"`);

        // Prüfen, ob das erwartete Wort in den Top-k-Wörtern liegt
        kValues.forEach(k => {
            const topKPredictedWords = predictedWords.slice(0, k);
            if (topKPredictedWords.includes(test.expectedWord)) {
                accuracyAtK[k]++; // Treffer für diesen k-Wert
                console.log(` Treffer bei k=${k}! Wort "${test.expectedWord}" gefunden.`);
            }
        });


        // Berechne die Wahrscheinlichkeiten für das gesamte Vokabular
        let currentWords = test.input
            .toLowerCase()
            .split(' ')
            .map((word) => dictionary[word] || 0);

        while (currentWords.length < sequenceLength) {
            currentWords.unshift(0);
        }
        currentWords = currentWords.slice(-sequenceLength);

        const inputTensor = tf.tensor2d([currentWords], [1, sequenceLength]);
        const prediction = model.predict(inputTensor);
        const logits = prediction.squeeze();
        const probabilities = tf.softmax(logits).dataSync();

        const expectedIndex = dictionary[test.expectedWord] || -1;
        if (expectedIndex !== -1 && probabilities[expectedIndex] !== undefined) {
            console.log('Wahrscheinlichkeit für erwartetes Wort:', probabilities[expectedIndex]);
        } else {
            console.warn('Erwartetes Wort nicht im Wörterbuch oder Wahrscheinlichkeit nicht gefunden:', test.expectedWord);
        }

        if (expectedIndex !== -1) {
            totalPerplexity += -Math.log2(probabilities[expectedIndex]);
        } else {
            totalPerplexity += -Math.log2(1e-10);
        }

        inputTensor.dispose();
        prediction.dispose();


    });

    // Normalisieren der Ergebnisse
    kValues.forEach(k => {
        const accuracy = (accuracyAtK[k] / testDataset.length) * 100;
        results.accuracy.push({ k, value: accuracy }); // Trefferquote in %
    });
    results.perplexity = Math.pow(2, totalPerplexity / testDataset.length);

    console.log(' Evaluation abgeschlossen!', results);

    // Chart aktualisieren
    updateAccuracyChart(results);
}

// Chart aktualisieren oder erstellen
function updateAccuracyChart(results) {
    const canvas = document.getElementById('accuracyChart');
    if (!canvas) {
        console.error('️ Canvas mit ID "accuracyChart" nicht gefunden!');
        return;
    }
    const ctx = canvas.getContext('2d');

    const labels = results.accuracy.map(result => `k=${result.k}`);
    const accuracyData = results.accuracy.map(result => result.value);
    const perplexityData = new Array(labels.length).fill(results.perplexity);

    if (accuracyChart) {
        accuracyChart.data.labels = labels;
        accuracyChart.data.datasets[0].data = accuracyData;
        accuracyChart.data.datasets[1].data = perplexityData;
        accuracyChart.update();
    } else {
        accuracyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Accuracy (%)',
                        data: accuracyData,
                        backgroundColor: 'rgba(75, 192, 192, 0.5)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Perplexity',
                        data: perplexityData,
                        type: 'line',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 2,
                        fill: false,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Accuracy (%)'
                        }
                    },
                    y1: {
                        beginAtZero: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Perplexity'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'k-Werte'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Genauigkeit (Accuracy) und Perplexity'
                    }
                }
            }
        });
    }
}
