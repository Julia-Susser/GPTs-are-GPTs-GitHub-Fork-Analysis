const csv = require('fast-csv');
const fs = require('fs');

const inputFile = '../inputs/repos.csv';
const outputFile = '../outputs/repos-no-duplicates.csv';

const rows = [];
const seen = new Set();

// Read input CSV file and remove duplicates
fs.createReadStream(inputFile)
  .pipe(csv.parse({ headers: true }))
  .on('error', error => console.error(error))
  .on('data', row => {
    if (!seen.has(row.full_name)) {
      rows.push(row);
      seen.add(row.full_name);
    }
  })
  .on('end', rowCount => {
    console.log(`Parsed ${rowCount} rows`);
    // Write output CSV file
    const writeStream = fs.createWriteStream(outputFile);
    csv.write(rows, { headers: true }).pipe(writeStream);
    console.log(`Output file saved to ${outputFile}`);
  });
