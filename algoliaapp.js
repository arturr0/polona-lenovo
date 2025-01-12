import { algoliasearch } from 'algoliasearch';

const client = algoliasearch('V4AAS4SVX8', 'a6f2e02ab224bf4f9a8cb77ff4acd205');

// Fetch and index objects in Algolia
const processRecords = async () => {
  const datasetRequest = await fetch('https://dashboard.algolia.com/sample_datasets/movie.json');
  const movies = await datasetRequest.json();
  return await client.saveObjects({ indexName: 'movies_index', objects: movies });
};

processRecords()
  .then(() => console.log('Successfully indexed objects!'))
  .catch((err) => console.error(err));