const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
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
    
    //getHeader returns the header values for the csv file that counts forks
    //to get values the function uses a dummy request to the api to see what data the api returns when retrieving forks over time
    async getHeader(){
      const res = await this.performRequest()
      if (res.data.length==0){return []}
      const data = await res.data[0];
      var keys = Object.keys(data)
      return keys
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
}

module.exports = { CSVHelper };