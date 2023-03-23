const fs = require('fs');
const csv = require('csv-parser');
const { GitHubScraper } = require("./scrape-repos");
const { GithubForksOverTime } = require('./count_forks');
const { GithubForksUpdate } = require('./update-forks.js');

class Run{
    constructor() {
        this.queriesFilename = "../inputs/queries.csv";
        this.reposFilename = "../inputs/repos.csv";
        this.forkDataFolder = "../outputs"
        //this.readQueries()
        this.readForks()
        //this.updateForks()
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
    //readQueries uses a list of queries in queries.csv and uses github api to scrape for query
    //each query has a maximum of 1000 repositories that are returned per query
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
    exists(repo){
        return fs.existsSync(this.forkDataFolder+repo.split("/").join("-"))
    }

    //readForks reads files of possible repos and then scrapes each individual repo for forks
    //once finished, it deletes the repo from the top of the file
    async readForks(){
        var lines = await this.readCSVFile(this.reposFilename)
        var count = 0
        while (count < lines.length){
            var repo = lines[count]["full_name"]
            count += 1
            console.log(repo)
            if (this.exists(repo)){ 
                console.log("already scraped")
                this.deleteFirstLine(this.reposFilename)
                continue;
            }
            var repoScrape = new GithubForksOverTime(repo)
            await repoScrape.runScraper()
            this.deleteFirstLine(this.reposFilename)
            if (count % 3==0){
                console.log("waiting")
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    }

    //reads all directors and then updates the forks in the directory
    async updateForks(){
        var repos = fs.readdirSync(this.forkDataFolder, { withFileTypes: true });
        repos = repos.filter((file) => file.isDirectory()).map((file) => file.name);
        var count = 0
        while (count < repos.length){
            var repo = repos[count]
            repo = repo.split("*").join("/")
            console.log(repo)
            var repoScrape = new GithubForksUpdate(repo)
            await repoScrape.runScraper()
            count += 1
            if (count % 1==0){
                console.log("waiting")
                await new Promise(resolve => setTimeout(resolve, 25000));
            }
        }
    }
}

new Run()
