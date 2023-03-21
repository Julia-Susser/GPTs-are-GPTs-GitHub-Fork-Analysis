
const { Octokit } = require('@octokit/rest');
const { CSVHelper } = require('./csv-writing.js')

class MaxPages extends CSVHelper {
    async getMaxPages(){
        const res = await this.performRequest()
        return this.findMaxPages(res)
    }
    //maxPages performs dummy request to github api and uses header values to find the max number of pages that can be scraped for given request
    //since the api limits items per page to 100 so the code has to scrape multiple pages to recieve on data on forks/repos
    async findMaxPages(res) {
        const linkHeader = res.headers.link;
        const lastPageLink = linkHeader ? linkHeader.match(/<([^>]*)>; rel="last"/) : null;
        
        if (lastPageLink) {
            const lastPageUrl = new URL(lastPageLink[1]);
            const lastPageParams = Object.fromEntries(lastPageUrl.searchParams.entries());
            const lastPage = parseInt(lastPageParams.page);
        
            return lastPage;
        } else {
            return 1;
        }
    }
}

module.exports = { MaxPages };