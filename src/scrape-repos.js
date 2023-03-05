const { Octokit } = require("@octokit/core");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
const fs = require('fs');
const { MaxPages } = require("./max-pages");
require("dotenv").config();




class GitHubScraper extends MaxPages{
    constructor() {
      super()
      this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN }); // Replace YOUR-TOKEN with your GitHub personal access token
      this.searchQuery = "ai"; // Replace with your search query
      this.csvFilePath = "../inputs/repos.csv"
      this.searchParams = {
        q: this.searchQuery,
        "sort":"stars", 
        "order":"desc",
        "per_page":100    
     };
     this.runScraper()

    }
    async getHeader(){
      const res = await this.performRequest()
      const data = await res.data;
      var keys = Object.keys(data.items[0])
      keys.push("finished")
      return keys
    }
    async runScraper(){
        this.header = await this.getHeader()
        this.csvWriter = await this.makeCSVWriter(keys=this.header,append=true)
        this.maxPages = await this.getMaxPages()
        this.resArray = await this.fetchQuery()
        this.parseResponse()
     
    }
  
    async parseResponse(){
        this.resArray.map(res => this.write(res))
    }

    async write(res) {
        const data = await res.data;
        const records = data.items.map(item => {
          item["finished"] = false;
          return item;
        });
        await this.csvWriter.writeRecords(records);
    }
    
    async fetchQuery(){
        const requestPages = Array.from({length: this.maxPages}, (_, i) => i + 1)
        const resArray = await Promise.all(
            requestPages.map((page) => {
              return this.performRequest(page);
            })
          );
        return resArray
    }

    async performRequest(page=1){
        const params = this.searchParams
        params.page = page
        var res = this.octokit.request("GET /search/repositories", 
            params
            );

        return res
    }

}




new GitHubScraper()

