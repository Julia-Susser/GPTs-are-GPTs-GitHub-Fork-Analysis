const { Octokit } = require('@octokit/rest');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
const fs = require('fs');
const { MaxPages } = require('./max-pages');
require("dotenv").config();


class GithubForksOverTime extends MaxPages{
  constructor(repoName, folder="../outputs/") {
    super()
    this.repoName = repoName;
    [this.owner, this.repo] = this.repoName.split('/');
    this.repoName = this.owner+"*"+this.repo
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN }); // Replace YOUR-TOKEN with your GitHub personal access token
    this.folder = folder+this.repoName
    this.csvFilePath = this.folder+"/forks.csv"
    this.searchParams = {
        owner: this.owner,
        repo: this.repo,
        per_page: 100,
        headers: {
            "Accept":"application/vnd.github.star+json", //this parameter makes github api return the date that stars were created (not important for forks)
            'X-GitHub-Api-Version': '2022-11-28'
          }
      }
  }

  async runScraper() {
    var success = await this.performRequest() //submit dummy request to check if repo is found
    if (!success){
      console.log("FAILED")
      return false;
    }
    this.header = await this.getHeader() //get header values for csv file
    this.createFolder() //create folder for repo data
    this.csvWriter = await this.makeCSVWriter(this.header) //use header values to create CSV writer for forks
    this.maxPages = await this.getMaxPages() //get max pages of forks to scrape
    await this.writeInfo() //write general info about repo being scraper into folder (info and readme.md)
    await this.performQueries() //scrape the forks and write to csv file, use max pages parameter
  }

  //writeInfo writes general info about repository to file as well as readme in same folder
  async writeInfo(){
    try {
      var data = await this.octokit.request('GET /repos/{owner}/{repo}', {
        owner: this.owner,
        repo: this.repo,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      })    
      fs.writeFileSync(this.folder+"/info.json", JSON.stringify(data))
    }catch (error){
      if (error.message == "NOT FOUND"){ return false; }
      console.log(error.message)
      //github api max request limit, so set waiting buffer and restart
      console.log(error.name)
      await new Promise(resolve => setTimeout(resolve, 50000));
      this.writeInfo()
      return;
    }
    try {
      var data = await this.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner: this.owner,
        repo: this.repo,
        path: 'README.md',
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      data = data.data.content;
      const decodedBuffer = Buffer.from(data, 'base64');
      data = decodedBuffer.toString();
      fs.writeFileSync(this.folder+"/README.md", data);
    } catch (error) {
      //readme file not found, so write error and continue
      console.log("README ERROR")
      fs.writeFileSync(this.folder+"/README.md", "ERROR");
    }
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  //exists checks if folder with repo data already exists
  exists(){
    return fs.existsSync(this.folder)
  }
  async createFolder(){
    if (!fs.existsSync(this.folder)) {
      fs.mkdirSync(this.folder);
    } 
  }

  //performQueries scrapes data about forks over time of a given repository
  //the github api works by allowing you to get a page of data on forks (a page can have up to 100 items)
  //in order to slow down the queries, the function segments page queries into lengths of 10 and then adds a time buffer in between batches
  //indeed, the scraping of pages 1-10, 11-20... are asynchronous and in between, there is a timeout to prevent hitting max request rate
  async performQueries() {
    var page_start = 1 //where to start batch of page requests
    var numPages = 10 
    var count = 1
    console.log(this.maxPages) 
    while (page_start <= this.maxPages){
        var numPages = Math.min(this.maxPages-page_start+1,numPages)
        try{
          var resArray = await this.fetchQuery(page_start, numPages) //fetch pages from page_start to page_end
        }catch(error){
          return;
        }
        this.parseResponse(resArray) //write results to csv file
        var page_start = page_start+numPages //find new page start
        if (count % 3==0){ //after every three batches of 10 pages have mandatory wait
          console.log("waiting")
          await new Promise(resolve => setTimeout(resolve, 50000));
        }
        count += 1
    }
  }
  //parseResponse writes raw github data to csv file
  //resArray is an array of github requests for a bunch of pages
  //therefore, the code maps through each page and writes the data to the csv file
  async parseResponse(resArray){
      resArray.map(res => this.write(res))
  }

  async write(res) {
      const records = await res.data;
      await this.csvWriter.writeRecords(records);
  }

  //fetchQuery requests pages between page_start and numPages
  //returns an array of the data from each request
  async fetchQuery(page_start, numPages){
      const requestPages = Array.from({length: numPages}, (_, i) => i + page_start)
      console.log(requestPages)
      const resArray = await Promise.all(
          requestPages.map((page) => {
            return this.performRequest(page);
          })
        );
      return resArray
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

  //performRequest requests the given page of forks data
  //stops at page 299 ie. breaks down when reach page 300, so can't access forks past 29,900
  //page 1 shows most recent results
  async performRequest(page=1){
    try{
      const params = this.searchParams
      params.page = page
      const res = await this.octokit.request('GET /repos/{owner}/{repo}/forks', params)
      return res
    }catch(error){
      console.log(error.message)
      if (error.message == "Not Found"){ return false; }
      if (error.message == "Unexpected end of JSON input"){ throw error }
      console.log("waiting")
      await new Promise(resolve => setTimeout(resolve, 50000));
      const res = this.performRequest(page)
      return res;
    }
  }

}

//new GithubForksOverTime("huggingface/transformers")
module.exports = { GithubForksOverTime } ;
