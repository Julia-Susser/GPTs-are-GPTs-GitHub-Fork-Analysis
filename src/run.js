const fs = require('fs');
const csv = require('csv-parser');
const { GitHubScraper } = require("./scrape-repos");
const { GithubForksOverTime } = require('./count_forks');
const { GithubForksUpdate } = require('./update-forks.js');
const fast_csv = require('fast-csv');

class Run{
    constructor() {
        var data = "control-data"
        this.queriesFilename = "../inputs/queries.csv";
        this.reposFilename = "../inputs/repos.csv";
        this.forkDataFolder = "../outputs/"+data+"/"
        //this.readQueries()
        //this.removeDuplicates()
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
            var queryScrape = new GitHubScraper(query)
            await queryScrape.runScraper()
            this.deleteFirstLine(this.queriesFilename)
            count += 1
            if (count % 3==0){
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
        await this.removeDuplicates()
        await this.removeScrapedRepos()
    }
    async removeScrapedRepos(){ 
        const inputFile = this.reposFilename
        const outputFile = '../outputs/repos-already-scraped.csv';
        const rows = [];
        var rowCount = 0
        const stream = fs.createReadStream(inputFile)
            .pipe(fast_csv.parse({ headers: true }))
            .on('error', error => console.error(error))
            .on('data', row => {
            if (!this.exists(row.full_name)) {
                rows.push(row);
                
            }
            rowCount +=1
            });
        await new Promise(resolve => stream.on('end', resolve));
        const writeStream = fs.createWriteStream(outputFile);
        fast_csv.write(rows, { headers: true }).pipe(writeStream);
        await new Promise(resolve => writeStream.on('close', resolve));
        fs.unlinkSync('../inputs/repos.csv');
        fs.renameSync(outputFile, '../inputs/repos.csv'); 
        const file = fs.createWriteStream(inputFile, {flags: 'a'});
        file.write('\n');
        file.end();
        console.log(`Parsed ${rowCount} rows into ${rows.length}`);
    }

    async removeDuplicates(){
        const inputFile = this.reposFilename
        const outputFile = '../outputs/repos-no-duplicates.csv';
        const seen = new Set();
        const rows = [];
        var rowCount = 0
        const stream = fs.createReadStream(inputFile)
            .pipe(fast_csv.parse({ headers: true }))
            .on('error', error => console.error(error))
            .on('data', row => {
            if (!seen.has(row.full_name)) {
                rows.push(row);
                seen.add(row.full_name);
            }
            rowCount +=1
            });
        await new Promise(resolve => stream.on('end', resolve));
        const writeStream = fs.createWriteStream(outputFile);
        fast_csv.write(rows, { headers: true }).pipe(writeStream);
        await new Promise(resolve => writeStream.on('close', resolve));
        fs.unlinkSync('../inputs/repos.csv');
        fs.renameSync(outputFile, '../inputs/repos.csv'); 
        const file = fs.createWriteStream(inputFile, {flags: 'a'});
        file.write('\n');
        file.end();
        console.log(`Parsed ${rowCount} rows into ${rows.length}`);
    }

    exists(repo){
        //var repos = fs.readdirSync("outputs", { withFileTypes: true });
        //repos = repos.filter((file) => file.isDirectory()).map((file) => file.name);
        var repoFolder = this.forkDataFolder+"/"+repo.split("/").join("*")
        var forksExists = fs.existsSync(repoFolder+"/forks.csv")
        return forksExists
    }

    //readForks reads files of possible repos and then scrapes each individual repo for forks
    //once finished, it deletes the repo from the top of the file
    async readForks(){
        var lines = await this.readCSVFile(this.reposFilename)
        var count = 0
        while (count < lines.length){
            var repo = lines[count]["full_name"]
            console.log(repo)
            var forks_count = parseInt(lines[count]["forks_count"])
            console.log(forks_count)
            count += 1
            if (forks_count<1000){
                this.deleteFirstLine(this.reposFilename)
                continue;
            }
            // if (this.exists(repo)){ 
            //     console.log("already scraped")
            //     this.deleteFirstLine(this.reposFilename)
            //     continue;
            // }
            var repoScrape = new GithubForksOverTime(repo, this.forkDataFolder)
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
            count += 1
            if (!(this.exists(repo))){
                continue
            }
            var repoScrape = new GithubForksUpdate(repo, this.forkDataFolder)
            await repoScrape.runScraper()
            if (count % 2==0){
                console.log("waiting")
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
}

new Run()
