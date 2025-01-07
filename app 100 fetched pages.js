const axios = require('axios');
const express = require('express');

async function searchPolona(query, totalPages = 100, pageSize = 100, sort = 'RELEVANCE') {
    const results = [];

    for (let currentPage = 0; currentPage < totalPages; currentPage++) {
        const url = `https://polona.pl/api/search-service/search/simple?query=${encodeURIComponent(query)}&page=${currentPage}&pageSize=${pageSize}&sort=${sort}`;

        try {
            console.log(`Fetching page ${currentPage}...`);
            const response = await axios.get(url, {
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.data.hits || response.data.hits.length === 0) {
                console.log('No more results. Stopping...');
                break;
            }

            const filteredHits = response.data.hits.filter((hit) => {
                const rights = hit.expandedFields?.rights?.values?.[0];
                return rights === "Domena Publiczna. Wolno zwielokrotniać, zmieniać i rozpowszechniać oraz wykonywać utwór, nawet w celach komercyjnych, bez konieczności pytania o zgodę. Wykorzystując utwór należy pamiętać o poszanowaniu autorskich praw osobistych Twórcy.";
            });

            results.push(...filteredHits);
            console.log(`Page ${currentPage}: ${filteredHits.length} filtered hits added.`);

            // Stop if fewer results are returned than pageSize
            if (response.data.hits.length < pageSize) break;
        } catch (error) {
            console.error(`Error fetching page ${currentPage}:`, error.message);
            break; // Stop further processing on error
        }
    }

    return results;
}

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/search', async (req, res) => {
    const { query, totalPages = 1000, pageSize = 100, sort = 'RELEVANCE' } = req.query;

    if (!query) {
        return res.status(400).json({ error: "Missing 'query' parameter." });
    }

    try {
        const data = await searchPolona(query, totalPages, pageSize, sort);
        res.status(200).json(data);
    } catch (error) {
        console.error('Error during search:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// Example usage
(async () => {
    const query = "historia";
    const data = await searchPolona(query, 1000, 100);

    console.log(`Total results found: ${data.length}`);
})();
