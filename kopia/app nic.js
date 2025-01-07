const axios = require('axios');
const express = require('express');

async function searchPolona(query, page = 0, pageSize = 10, sort = 'RELEVANCE') {
    const url = `https://polona.pl/api/search-service/search/simple?query=${query}&page=${page}&pageSize=${pageSize}&sort=${sort}`;

    try {
        let allHits = [];
        let currentPage = page;
        let totalPages = 1; // Początkowa wartość, zostanie nadpisana po pierwszym żądaniu

        while (currentPage < totalPages) {
            const response = await axios.get(url, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const hits = response.data.hits;
            totalPages = response.data.totalPages;

            // Dodajemy wyniki do lokalnej tablicy
            allHits = [...allHits, ...hits];

            // Przechodzimy przez wszystkie elementy hits i logujemy te, które mają "Domena" w rights
            hits.forEach(element => {
                if (element.rights?.values?.some(value => value.includes('Domena'))) {
                    console.log(element); // Wyświetl element w konsoli
                }
            });

            currentPage++;
        }

        // Zwróć wszystkie hity
        return allHits;
    } catch (error) {
        throw new Error(`Błąd podczas pobierania wyników: ${error.message}`);
    }
}


const app = express();
const PORT = 3000;

app.get('/search', async (req, res) => {
    const { query, page = 0, pageSize = 1, sort = 'RELEVANCE' } = req.query;

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
        // console.log("basicFields log");
        // console.log(wyniki.hits[1].basicFields); 
        // console.log(wyniki.hits[1].basicFields.dateDescriptive); 
        // console.log(wyniki.hits[1].basicFields.dateDescriptive.values);
        console.log(wyniki.hits.length);
        
    } catch (error) {
        console.error('Błąd:', error.message);
    }
})();
