# polygon-download

This script can be used to download all poly.google.com assets before the sevice shuts down on June 30th.

`npm install`
`node getAssets.js`

To run multiple download jobs in parallel you can run this script from multiple docker containers and set `PAGE_START` and `PAGE_END` environment variables to specify download range for each container (0-7657).

WARNING, there seems to be an [issue with the download script](https://www.reddit.com/r/DataHoarder/comments/nuxo3g/comment/h14awir)
