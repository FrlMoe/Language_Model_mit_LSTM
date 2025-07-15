// Importiere die notwendigen Abhängigkeiten
import { preprocessText, dictionary, sequenceLength } from './preprocess.js';
import { createModel } from './model.js';
import { loadPartialText } from './fileLoader.js'; // Importiere fileLoader

export let model;

// Daten laden und vorbereiten
export async function prepareData() {
    console.log('Lade TensorFlow.js und initialisiere Backend...');
    await tf.ready(); // Sicherstellen, dass das Backend initialisiert ist
    console.log('TensorFlow.js ist bereit!');

    console.log('Lade Trainingsdaten über fileLoader...');
    const filePath = 'data/trainingsdata.txt'; // Pfad zu den Trainingsdaten

    // Lade Teiltext als Array von Wörtern
    const wordsArray = await loadPartialText(filePath, 10000); // Lade maximal 100 Wörter
    console.log('Trainingsdaten erfolgreich geladen.');

    // Optional: Konvertiere das Array zurück zu einem String WENN nötig
    const textString = wordsArray.join(' '); // Konvertieren in einen String (nur wenn `preprocessText` zwingend Strings benötigt)

    console.log('Starte Preprocessing...');
    const { inputSequences, targetWords } = preprocessText(textString); // String an preprocessText übergeben

    // Debugging: Überprüfung von inputSequences
    console.log('Input Sequences:', inputSequences);

    // Prüfen, ob inputSequences korrekt ist
    if (!inputSequences || inputSequences.length === 0) {
        throw new Error('Input Sequences sind leer oder nicht definiert!');
    }

    console.log('Forme Input Sequences für 3D um...');
    const reshapedSequences = inputSequences.map(sequence =>
        sequence.map(value => [value]) // Jede Zahl wird in ein Array konvertiert
    );

    console.log('Erstelle Tensoren aus Sequenzen...');
    const xs = tf.tensor2d(inputSequences, [inputSequences.length, sequenceLength], 'int32');

    const ys = tf.oneHot(targetWords, Object.keys(dictionary).length); // Ziel-Tensor

    console.log('Tensoren erstellt.');
    return { xs, ys };
}

// Modell trainieren
export async function trainModel() {
    try {
        // Zeige im Textfenster an, dass das Training begonnen hat
        const predictionOutput = document.getElementById('predictionOutput');
        predictionOutput.textContent = 'Trainiere Modell, bitte warten...';

        console.log('Warte auf TensorFlow.js Backend...');
        await tf.ready(); // Sicherstellen, dass TensorFlow.js Backend vollständig initialisiert ist

        const { xs, ys } = await prepareData();

        console.log('Erstelle LSTM-Modell...');
        model = createModel(sequenceLength, Object.keys(dictionary).length);

        console.log('Beginne Training...');
        await model.fit(xs, ys, {
            epochs: 10, // Anzahl der Epochen
            batchSize: 32, // Batch-Größe
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    console.log(
                        `Epoche ${epoch + 1}: Verlust = ${logs.loss.toFixed(4)}, Genauigkeit = ${logs.acc?.toFixed(4)}`
                    );

                    // Status nach jeder Epoche aktualisieren
                    predictionOutput.textContent = `Epoche ${epoch + 1} abgeschlossen, trainiere weiter...`;
                },
            },
        });

        console.log('✅ Training abgeschlossen!');

        // Nach Abschluss: Status im Textfenster aktualisieren
        predictionOutput.textContent = 'Training abgeschlossen!';

        xs.dispose();
        ys.dispose();

        return model; // Gebe das trainierte Modell zurück
    } catch (error) {
        console.error('🔴 Fehler beim Training des Modells:', error);

        // Im Fehlerfall: Zeige Fehlerstatus im Textfenster an
        const predictionOutput = document.getElementById('predictionOutput');
        predictionOutput.textContent = 'Fehler beim Training, siehe Konsole.';

        throw error;
    }
}
