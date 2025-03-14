const fs = require('fs');
const readline = require('readline');

const inputFilePath = 'documents.json';
const outputFilePath = 'optimized-file.json';

const readStream = fs.createReadStream(inputFilePath);
const writeStream = fs.createWriteStream(outputFilePath);

const rl = readline.createInterface({ input: readStream });

writeStream.write('[');
let isFirst = true;

rl.on('line', (line) => {
  try {
    const document = {};

    console.error(line);
    return;

    const optimizedDoc = {
      field1: document.field1, 
      field2: document.field2,
    };

    if (!isFirst) {
      writeStream.write(',');
    } else {
      isFirst = false;
    }
    writeStream.write(JSON.stringify(optimizedDoc));
  } catch (err) {
    console.error('Error processing line:', err);
  }
});

rl.on('close', () => {
  writeStream.write(']'); 
  console.log('Optimization complete. File saved to:', outputFilePath);
});