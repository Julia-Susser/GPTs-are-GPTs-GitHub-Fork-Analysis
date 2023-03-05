
const { Octokit } = require('@octokit/rest');
const { CSVHelper } = require('./csv-writing.js')

class MaxPages extends CSVHelper {
    async getMaxPages(){
        const res = await this.performRequest()
        return this.findMaxPages(res)
    }

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