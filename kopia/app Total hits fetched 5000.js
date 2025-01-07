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
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPage(query, page, pageSize, sort, headers) {
    const url = `https://polona.pl/api/search-service/search/simple?query=${query}&page=${page}&pageSize=${pageSize}&sort=${sort}`;
    const response = await axios.get(url, { headers });
    return response.data;
}

async function searchPolona(query, pageSize = 50, sort = 'RELEVANCE', maxConcurrent = 5) {
    const headers = { 'Content-Type': 'application/json' };

    try {
        console.log(`Fetching the first page to determine total pages...`);
        const firstPageData = await fetchPage(query, 0, pageSize, sort, headers);
        const totalPages = Math.min(100, firstPageData.totalPages); // Limit to 100 pages for this example
        console.log(`Total pages: ${totalPages}`);

        const allHits = [];
        const queue = Array.from({ length: totalPages }, (_, i) => i);

        while (queue.length > 0) {
            const batch = queue.splice(0, maxConcurrent);
            console.log(`Processing batch: ${batch}`);
            const results = await Promise.all(
                batch.map((page) => fetchPage(query, page, pageSize, sort, headers).catch((e) => null))
            );

            results.forEach((result) => {
                if (result) allHits.push(...result.hits);
            });

            // Add delay to avoid overwhelming the server
            await delay(1000);
        }

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
        const results = await searchPolona('historia', 50, 'RELEVANCE', 5); // Fetch with max 5 concurrent requests
        console.log(`Total hits fetched: ${results.length}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
})();
