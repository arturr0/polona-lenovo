const axios = require('axios');
const express = require('express');

// Helper function to add a delay
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper function to safely fetch data with retries
async function safeFetch(url, headers, maxRetries = 3) {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            return await axios.get(url, { headers });
        } catch (error) {
            attempts++;
            console.log(`Retry ${attempts}/${maxRetries} for URL: ${url}`);
            if (attempts >= maxRetries) {
                throw error;
            }
            await delay(1000); // Wait 1 second before retrying
        }
    }
}

// Main function to fetch data
async function searchPolona(query, page = 0, pageSize = 10, sort = 'RELEVANCE', maxPages = 100) {
    const baseUrl = `https://polona.pl/api/search-service/search/simple`;
    const headers = { 'Content-Type': 'application/json' };

    try {
        let allHits = [];
        let currentPage = page;
        let totalPages = 1; // Initial value, updated after the first request

        while (currentPage < totalPages) {
            console.log(`Fetching page: ${currentPage}`);
            const url = `${baseUrl}?query=${query}&page=${currentPage}&pageSize=${pageSize}&sort=${sort}`;
            const response = await safeFetch(url, headers);

            const hits = response.data.hits;
            totalPages = response.data.totalPages;
            console.log(`Total pages: ${totalPages}`);

            allHits = [...allHits, ...hits];

            // Log elements with "Domena" in rights
            hits.forEach((element) => {
                // if (element.expandedFields.rights && element.expandedFields.rights.values[0] == "Domena Publiczna. Wolno zwielokrotniać, zmieniać i rozpowszechniać oraz wykonywać utwór, nawet w celach komercyjnych, bez konieczności pytania o zgodę. Wykorzystując utwór należy pamiętać o poszanowaniu autorskich praw osobistych Twórcy.") {
                //     console.log(element);
                // }
                //console.log("info1", element.expandedFields.rights.values[0]);
                //console.log(element);
                 if (element.expandedFields.rights) {
                    //console.log(element.expandedFields.rights.values[0]);
                    console.log(element.basicFields.title.values[0]);
                }
            });

            currentPage++;
            await delay(500); // Add a 500ms delay between requests
        }

        return allHits;
    } catch (error) {
        throw new Error(`Error fetching results: ${error.message}`);
    }
}

const app = express();
const PORT = 3000;

app.get('/search', async (req, res) => {
    const { query, page = 0, pageSize = 24, sort = 'RELEVANCE', maxPages = 100 } = req.query;

    try {
        const data = await searchPolona(query, page, pageSize, sort, maxPages);
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
        const results = await searchPolona('historia', 0, 10, 'RELEVANCE', 100);
        //console.log(`Total hits fetched: ${results}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
})();
