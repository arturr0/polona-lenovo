const axios = require('axios');
const express = require('express');

// Helper function to fetch a single page
async function fetchPage(query, page, pageSize, sort, headers) {
    const baseUrl = `https://polona.pl/api/search-service/search/simple`;
    const url = `${baseUrl}?query=${query}&page=${page}&pageSize=${pageSize}&sort=${sort}`;
    const response = await axios.get(url, { headers });
    return response.data;
}

// Main function to fetch data concurrently
async function searchPolona(query, pageSize = 10, sort = 'RELEVANCE', maxPages = 100) {
    const headers = { 'Content-Type': 'application/json' };

    try {
        console.log(`Fetching first page to determine total pages...`);
        const firstPageData = await fetchPage(query, 0, pageSize, sort, headers);
        const totalPages = Math.min(firstPageData.totalPages, maxPages);

        console.log(`Total pages: ${totalPages}. Fetching all pages concurrently...`);

        // Generate an array of promises for all pages
        const promises = Array.from({ length: totalPages }, (_, i) =>
            fetchPage(query, i, pageSize, sort, headers)
        );

        const results = await Promise.all(promises);

        // Flatten the hits from all pages
        const allHits = results.flatMap((result) => result.hits);

        // Optionally filter and log "Domena" results
        allHits.forEach((element) => {
            if (element.expandedFields?.rights) {
                console.log(element.basicFields?.title?.values?.[0]);
            }
        });

        return allHits;
    } catch (error) {
        throw new Error(`Error fetching results: ${error.message}`);
    }
}

const app = express();
const PORT = 3001;

app.get('/search', async (req, res) => {
    const { query, pageSize = 24, sort = 'RELEVANCE', maxPages = 100 } = req.query;

    try {
        const data = await searchPolona(query, pageSize, sort, maxPages);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// Example usage
(async () => {
    try {
        const results = await searchPolona('historia', 10, 'RELEVANCE', 5);
        console.log(`Total hits fetched: ${results.length}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
})();
