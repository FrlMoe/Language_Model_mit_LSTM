export function createModel(sequenceLength, vocabSize) {
    const model = tf.sequential();

    model.add(tf.layers.embedding({
        inputDim: vocabSize,
        outputDim: 32,
        inputLength: sequenceLength
    }));

    // LSTM-Schicht 1 ohne inputShape!
    model.add(tf.layers.lstm({
        units: 100,
        returnSequences: true,
        kernelInitializer: 'glorotUniform',
        recurrentInitializer: 'glorotUniform',
        biasInitializer: 'zeros'
    }));

    // LSTM-Schicht 2
    model.add(tf.layers.lstm({
        units: 100,
        kernelInitializer: 'glorotUniform',
        recurrentInitializer: 'glorotUniform',
        biasInitializer: 'zeros'
    }));

    // Dense-Ausgabeschicht
    model.add(tf.layers.dense({
        units: vocabSize,
        activation: 'softmax'
    }));

    model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });

    model.summary();

    return model;
}
