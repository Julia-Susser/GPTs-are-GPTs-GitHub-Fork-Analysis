const fs = require('fs');
const csv = require('csv-parser');
const { GitHubScraper } = require("./scrape-repos");
const { GithubForksOverTime } = require('./count_forks');
const { GithubForksUpdate } = require('./update.js');

class Run{
    constructor() {
        this.queriesFilename = "../inputs/queries.csv";
        this.reposFilename = "../inputs/repos.csv";
        //this.readQueries()
        //this.readForks()
        this.updateForks()
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
    
    deleteFirstLine(filename){
        const csv = fs.readFileSync(filename, 'utf-8');
        const lines = csv.split('\n');
        lines.splice(1, 1);
        const modifiedCsv = lines.join('\n');
        fs.writeFileSync(filename, modifiedCsv, 'utf-8');
    }

    async readQueries(){
        var lines = await this.readCSVFile(this.queriesFilename)
        var count = 0
        while (count < lines.length){
            var query = lines[count]["queries"]
            console.log(query)
            var queryScrape = new GitHubScraper(query)
            await queryScrape.runScraper()
            this.deleteFirstLine(this.queriesFilename)
            count += 1
            if (count % 3==0){
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    }

    async readForks(){
        var lines = await this.readCSVFile(this.reposFilename)
        var count = 0
        while (count < lines.length){
            var repo = lines[count]["full_name"]
            console.log(repo)
            var repoScrape = new GithubForksOverTime(repo)
            await repoScrape.runScraper()
            this.deleteFirstLine(this.reposFilename)
            count += 1
            if (count % 3==0){
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    }

    async updateForks(){
        var repos = fs.readdirSync("../inputs", { withFileTypes: true });
        repos = repos.filter((file) => file.isDirectory()).map((file) => file.name);
        var count = 0
        while (count < repos.length){
            var repo = repos[count]
            repo = repo.split("-").join("/")
            console.log(repo)
            var repoScrape = new GithubForksUpdate(repo)
            await repoScrape.runScraper()
            count += 1
            if (count % 3==0){
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    }
}

new Run()
