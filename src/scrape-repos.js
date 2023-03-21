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
  }

  async runScraper(){
    this.header = await this.getHeader() //get header values for csv file
    this.csvWriter = await this.makeCSVWriter(this.header,true) //use header values to create CSV writer but don't overwrite current repos file
    this.maxPages = await this.getMaxPages() //get max pages to scrape based on search request (github api for search requests maxes at 10)
    this.resArray = await this.fetchQuery() //get array of github query data from all pages (1-maxPages)
    this.parseResponse() //write array of query data to csv file
    console.log("finished")
  }

  //parseResponse writes raw github data to csv file
  //resArray is an array of github requests for a bunch of pages
  //therefore, the code maps through each page and writes the data to the csv file
  async parseResponse(){
      this.resArray.map(res => this.write(res))
  }

  async write(res) {
      const records = await res.data;
      await this.csvWriter.writeRecords(records);
  }
  
  //fetchQuery requests all pages from 1 to maxPages
  async fetchQuery(){
      const requestPages = Array.from({length: this.maxPages}, (_, i) => i + 1)
      const resArray = await Promise.all(
          requestPages.map((page) => {
            return this.performRequest(page);
          })
        );
      return resArray
  }
  
  //performRequest requests the given page of repos data
  async performRequest(page=1){
      const params = this.searchParams
      params.page = page
      var res = this.octokit.request("GET /search/repositories", 
          params
          );

      return res
  }

}





module.exports = { GitHubScraper };
