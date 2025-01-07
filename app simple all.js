const axios = require('axios');
const express = require('express');

// Function to search Polona API with given query and filter results
async function searchPolona(query, page = 0, sort = 'RELEVANCE') {
    const url = `https://polona.pl/api/search-service/search/simple?query=${query}&page=${page}&pageSize=24&sort=${sort}`;

    try {
        // Perform request to Polona API
        const response = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Log the raw data to check the pagination and response fields
        console.log("Full API Response:", JSON.stringify(response.data, null, 2));

        // Check the total number of hits and pages
        console.log("Total Elements:", response.data.totalElements);
        console.log("Total Pages:", response.data.totalPages);
        
        // Filter results based on stricter conditions
        const filteredHits = response.data.hits.filter(hit => {
            const rights = hit.expandedFields?.rights?.values?.[0];
            const keywords = hit.expandedFields?.keywords?.values || [];
            const documentTypes = hit.attributes?.documentTypes?.stringArrValues?.[0];

            console.log('Checking:', { rights, keywords, documentTypes });

            const isPublicDomain = rights === "Domena Publiczna...";
            const isBook = documentTypes === "Książki";
            const hasHistoriaKeyword = keywords.some(keyword => keyword === "Śląsk");

            console.log(`Filter result: rights: ${isPublicDomain}, documentTypes: ${isBook}, hasHistoriaKeyword: ${hasHistoriaKeyword}`);

            return isPublicDomain && isBook && hasHistoriaKeyword;
        });

        console.log(`Total hits: ${response.data.hits.length}`);
        console.log(`Filtered hits: ${filteredHits.length}`);

        return { ...response.data, hits: filteredHits };
    } catch (error) {
        throw new Error(`Błąd API Polona: ${error.message}`);
    }
}


const app = express();
const PORT = process.env.PORT || 3000;

// Search endpoint
app.get('/search', async (req, res) => {
    const { query = "", page = 0, sort = 'RELEVANCE' } = req.query;

    try {
        // Perform the search and filter results based on the provided query
        const data = await searchPolona(query, page, sort);

        // Send the filtered results to the browser
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(data);
    } catch (error) {
        console.error('Błąd podczas wyszukiwania:', error.message);

        // Send an error response
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT}`);
});
