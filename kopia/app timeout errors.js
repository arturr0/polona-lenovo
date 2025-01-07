const axios = require('axios');
const express = require('express');

// Helper function to fetch a single page
async function fetchPage(query, page, pageSize, sort) {
    const url = `https://polona.pl/api/search-service/search/simple?query=${query}&page=${page}&pageSize=${pageSize}&sort=${sort}`;
    const response = await axios.get(url, { timeout: 10000 }); // 10-second timeout
    return response.data;
}

// Function to search for items with specific keywords
async function searchPolonaForKeyword(keyword, pageSize = 50, sort = 'RELEVANCE', maxConcurrent = 50) {
    console.log(`Fetching the first page to determine total pages...`);
    const firstPageData = await fetchPage(keyword, 0, pageSize, sort);
    const totalPages = firstPageData.totalPages;
    console.log(`Total pages: ${totalPages}`);

    const allHits = [];
    const pages = Array.from({ length: totalPages }, (_, i) => i); // List of all page numbers

    // Function to process a batch of requests
    const processBatch = async (batch) => {
        const results = await Promise.all(
            batch.map((page) =>
                fetchPage(keyword, page, pageSize, sort)
                    .then((data) => data.hits)
                    .catch((err) => {
                        console.error(`Error fetching page ${page}:`, err.message);
                        return [];
                    })
            )
        );
        results.forEach((hits) => {
            hits.forEach((hit) => {
                const keywords = hit.expandedFields?.keywords?.values || [];
                // Check if the keyword is present in the keywords array
                if (keywords.includes(keyword)) {
                    allHits.push(hit);
                }
            });
        });
    };

    // Process pages in batches to control concurrency
    while (pages.length > 0) {
        const batch = pages.splice(0, maxConcurrent); // Take the next batch of pages
        console.log(`Processing batch: ${batch}`);
        await processBatch(batch);
    }

    return allHits;
}

// Example usage
(async () => {
    try {
        const results = await searchPolonaForKeyword('historia', 50, 'RELEVANCE', 50); // Replace 'example_keyword' with your keyword
        console.log(`Total hits containing the keyword: ${results.length}`);
        console.log(`Filtered results:`, results);
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
})();
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

