const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
const csv = require('csv-parser');
const fs = require('fs');

class CSVHelper {
    //makeCSVwriter is the function that the other code uses to get the csvwriter
    //if it is not append, then the function will have to rewrite the file first while making an append=true writer
    async makeCSVWriter(keys, append=false){
        var header = keys.map(key => {return {id:key, title:key}} )
        var headerrow = Object.values(keys.reduce((result, key, index) => {
            result[key] = keys[index];
            return result;
        }, []));
        
        return this.getCSVWriter(header,headerrow, append)
    }


    //create a csv writer with inputs of header
    //headerrow is an array of values to write to the csv file if you choose to restart the file
    //therefore, the csv writer will always be append and it can be written to multiple times during scraping without erasing
    async getCSVWriter(header, headerrow, append=false){
        const fileExists = await fs.existsSync(this.csvFilePath);
        if (!append | !fileExists){
          await fs.writeFileSync(this.csvFilePath, headerrow.join(",")+"\n")
        }
        var params = {
          path: this.csvFilePath,
          header: header,
          append: true,
        }
        var csvWriter = createCsvWriter(params);
        return csvWriter
    }
    //readCSVFiles returns data from csv in array of dictionaries
    async readCSVFile(filename) {
      return new Promise((resolve, reject) => {
        const lines = [];
        fs.createReadStream(filename)
          .pipe(csv())
          .on('data', (row) => {
            lines.push(row);
          })
          .on('end', () => {
            resolve(lines);
          })
      });
  }
}

module.exports = { CSVHelper };