import axios from 'axios';
import { load } from 'cheerio';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import stream from 'stream';
import pdf from 'pdf-parse'; // For PDF parsing
import xlsx from 'xlsx'; // For XLS parsing
import { parse as csvParse } from 'csv-parse'; // Correct import for CSV parsing

const pdfBuffer = fs.readFileSync('UP_2014_2020.pdf');

pdf(pdfBuffer).then((data) => {
    console.log('Text Content:', data.text);
}).catch((err) => {
    console.error('Error:', err);
});
