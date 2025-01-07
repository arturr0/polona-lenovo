const axios = require('axios');
const express = require('express');

async function searchPolona(query, page = 0, pageSize = 10, sort = 'RELEVANCE') {
    const url = `https://polona.pl/api/search-service/search/simple?query=${query}&page=${page}&pageSize=${pageSize}&sort=${sort}`;

    try {
        const response = await axios.post(url, {}, { // Puste ciało, jeśli API tego wymaga
            headers: {
                'Content-Type': 'application/json', // W razie potrzeby ustaw Content-Type
            },
        });
        return response.data;
    } catch (error) {
        throw new Error(error.message);
    }
}

const app = express();
const PORT = 3000;

app.get('/search', async (req, res) => {
    const { query, page = 0, pageSize = 10, sort = 'RELEVANCE' } = req.query;

    try {
        const data = await searchPolona(query, page, pageSize, sort);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT}`);
});

// Przykład wyszukiwania
(async () => {
    try {
        const wyniki = await searchPolona('nic');
        console.log('Wyniki wyszukiwania:', wyniki);
        console.log("basicFields log");
        console.log(wyniki.hits[1].basicFields); 
        console.log(wyniki.hits[1].basicFields.dateDescriptive); 
        console.log(wyniki.hits[1].basicFields.dateDescriptive.values);
        
        
    } catch (error) {
        console.error('Błąd:', error.message);
    }
})();
