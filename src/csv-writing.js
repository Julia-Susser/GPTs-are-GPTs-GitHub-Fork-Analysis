const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
const fs = require('fs');

class CSVHelper {
    async makeCSVWriter(keys){
        var header = keys.map(key => {return {id:key, title:key}} )
        var headerrow = Object.values(keys.reduce((result, key, index) => {
            result[key] = keys[index];
            return result;
        }, []));
        
        return this.getCSVWriter(header,headerrow)
    }
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
}

module.exports = { CSVHelper };