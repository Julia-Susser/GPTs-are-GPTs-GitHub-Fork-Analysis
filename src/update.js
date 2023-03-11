const { Octokit } = require('@octokit/rest');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
const fs = require('fs');
const csv = require('csv-parser');
const { MaxPages } = require('./max-pages');
require("dotenv").config();


class GithubForksUpdate extends MaxPages{
  constructor(repoName) {
    super()
    this.repoName = repoName;
    [this.owner, this.repo] = this.repoName.split('/');
    this.repoName = this.owner+"-"+this.repo
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN }); // Replace YOUR-TOKEN with your GitHub personal access token
    this.folder = "../inputs/"+this.repoName
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

  async getHeader(){
    const res = await this.performRequest()
    const data = await res.data[0];
    var keys = Object.keys(data)
    return keys
  }
  async runScraper() {
    this.header = await this.getHeader()
    this.csvWriter = await this.makeCSVWriter(this.header, true)
    this.since = await this.getLatestFork()
    console.log(this.since)
    this.searchParams["since"]=this.since
    this.maxPages = await this.getMaxPages()
    await this.performQueries()
  }

  async getLatestFork(){
    var lines = await this.readCSVFile(this.csvFilePath)
    var dates = lines.map(line => line.created_at)
    dates = dates.map(dateStr => new Date(dateStr).getTime());
    dates = dates.filter(timestamp => typeof timestamp == 'number' && !isNaN(timestamp));
    var date = Math.max.apply(null,dates)
    date = new Date(date).toISOString();
    return date
  }

  async performQueries() {
    var start = 1
    var length = 10
    var count = 1
    console.log(this.maxPages)
    while (start <= this.maxPages){
        var length = Math.min(this.maxPages-start+1,length)
        this.resArray = await this.fetchQuery(start, length)
        var finished = this.parseResponse()
        if (finished){ break; }
        var start = start+length
        if (count % 3==0){
          console.log("waiting")
          await new Promise(resolve => setTimeout(resolve, 50000));
          console.log("waiting")
        }
        count += 1
    }
  }

    async parseResponse(){
        this.resArray.map(res => this.write(res))
        var stop = this.resArray[this.resArray.length-1].data[0].created_at
        stop = stop < this.since
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


    async fetchQuery(start, length){
        const requestPages = Array.from({length: length}, (_, i) => i + start)
        console.log(requestPages)
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
        const res = await this.octokit.request('GET /repos/{owner}/{repo}/forks', params)
        return res
    }

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

//new GithubForksUpdate("huggingface/transformers")
module.exports = { GithubForksUpdate } ;
