const { Octokit } = require('@octokit/rest');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
const fs = require('fs');
const csv = require('csv-parser');
const { MaxPages } = require('./max-pages');
require("dotenv").config();
const fast_csv = require('fast-csv');

class GithubForksUpdate extends MaxPages{
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
            "Accept":"application/vnd.github.star+json",
            'X-GitHub-Api-Version': '2022-11-28'
          }
      }
    // this.runScraper()

  }

  async runScraper() {
    this.header = await this.getHeader() //get header values for csv file
    this.csvWriter = await this.makeCSVWriter(this.header, true) //use header values to create CSV writer but don't overwrite current repos file
    this.since = await this.getLatestFork() //get the latest fork queried because only need to add forks past this date
    console.log("Latest fork "+this.since)
    this.maxPages = await this.getMaxPages() //get maxPages of forks (only forks past date)
    console.log(this.maxPages)
    await this.performQueries() //get queries and write to csv (bottom of csv file so dates get mixed up)
    console.log("finished")
  }

  //getLatestFork returns the date of the newest fork in the csv file
  //since new forks from update write the end of file but original file also writes from newest to oldest the order gets messed up
  //therefore rather than focusing on keeping order correct by erasing file and rewriting, I grab all dates and sort for newest
  async getLatestFork(){
    var lines = await this.readCSVFile(this.csvFilePath)
    var dates = lines.map(line => line.created_at)
    dates = dates.map(dateStr => new Date(dateStr).getTime());
    dates = dates.filter(timestamp => typeof timestamp == 'number' && !isNaN(timestamp));
    var date = Math.max.apply(null,dates)
    date = new Date(date).toISOString().substring(0, 19) + 'Z';
    return date
  }

  //performQueries scrapes data about forks of repo since specified date
  //when parsing repsonse from github, the code checks if there are forks past given date
  //since the forks go from newest to oldest, the code spots querying forks when it reaches a fork past latest date
  //also, the github api works by allowing you to get a page of data on forks (a page can have up to 100 items)
  //in order to slow down the queries, the function segments page queries into lengths of 10 and then adds a time buffer in between batches
  //indeed, the scraping of pages 1-10, 11-20... are asynchronous and in between, there is a timeout to prevent hitting max request rate
  async performQueries() {
    var page_start = 1 //where to start batch of page requests
    var page_end = 10 
    var count = 1
    var resArrays = [] //write all new forks to csv at the end because it will start with newest
    while (page_start <= this.maxPages){
        var page_end = Math.min(this.maxPages-page_start+1,page_end)
        this.resArray = await this.fetchQuery(page_start, page_end)
        resArrays.push(this.resArray)
        var finished = this.parseResponse(this.resArray)
        if (finished){ break; } //if fork is older than latest date, then stop
        var page_start = page_start+page_end //find new page start
        if (count % 3==0){
          console.log("waiting")
          await new Promise(resolve => setTimeout(resolve, 50000));
          console.log("waiting")
        }
        count += 1
    }

    resArrays.map(resArray => {
      resArray.map(res => this.write(res))
    })
    this.reorderForks()
    
  }

  async reorderForks(){ 
    const inputFile = this.csvFilePath
    var rows = [];
    var rowCount = 0
    const stream = fs.createReadStream(inputFile)
        .pipe(fast_csv.parse({ headers: true }))
        .on('error', error => console.error(error))
        .on('data', row => {
          rows.push(row);
      });
    await new Promise(resolve => stream.on('end', resolve));
    rows = rows.sort(function (a, b) {
          return new Date(b.created_at) - new Date(a.created_at);
        });
    const writeStream = fs.createWriteStream(inputFile);
    fast_csv.write(rows, { headers: true }).pipe(writeStream);
    await new Promise(resolve => writeStream.on('close', resolve));
    const file = fs.createWriteStream(inputFile, {flags: 'a'});
    file.write('\n');
    file.end();
  }

    async parseResponse(){
        // this.resArray.map(res => this.write(res))
        var stop = this.resArray[this.resArray.length-1].data[0].created_at
        stop = stop <= this.since
        return stop
    }

    async write(res) {
        var data = await res.data;
        var records = data.filter(item => {
            return item.created_at > this.since
        });
        if (records.length>0){
            await this.csvWriter.writeRecords(records);
        }
    }


    async fetchQuery(page_start, page_end){
      const requestPages = Array.from({length: page_end}, (_, i) => i + page_start)
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

    async performRequest(page=1){
      try{
        const params = this.searchParams
        params.page = page
        const res = await this.octokit.request('GET /repos/{owner}/{repo}/forks', params)
        return res
      }catch(error){
        if (error.message == "Not Found"){ return false; }
        console.log(error.message)
        console.log("waiting")
        await new Promise(resolve => setTimeout(resolve, 50000));
        const res = this.performRequest(page)
        return res;
      }
    }

}

//new GithubForksUpdate("huggingface/transformers")
module.exports = { GithubForksUpdate } ;
