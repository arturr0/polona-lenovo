// import Audic from 'audic';
// import { fileURLToPath } from 'url';
// import { dirname } from 'path';

// // Get the current directory using import.meta.url
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// // Resolve the absolute path of the MP3 file
// const mp3FilePath = new URL('./error.mp3', import.meta.url).pathname; // Use URL to resolve file path

// console.log(`MP3 file path: ${mp3FilePath}`);  // Log the path to verify it

// const audic = new Audic(mp3FilePath);

// try {
//     await audic.play();
//     console.log('Playing sound...');
    
//     audic.addEventListener('ended', () => {
//         console.log('Sound playback ended.');
//         audic.destroy();  // Clean up after the playback ends
//     });
// } catch (err) {
//     console.error('Error playing sound:', err);
// }

// import { fileURLToPath } from 'url';
// import { dirname } from 'path';
// import Audic from 'audic';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);
// const mp3FilePath = `${__dirname}/error.mp3`; // Absolute path

// console.log('MP3 file path:', mp3FilePath);

// const audic = new Audic(mp3FilePath); // Ensure this is the correct path

// audic.play();

// audic.addEventListener('ended', () => {
//     console.log('Sound playback finished.');
//     audic.destroy();
// });

// import player from 'play-sound';

// const soundPlayer = player();

// const mp3FilePath = 'C:/POLONA/google/polona-google2/error.mp3'; // Absolute path

// soundPlayer.play(mp3FilePath, (err) => {
//     if (err) {
//         console.log('Error playing sound:', err);
//     } else {
//         console.log('Sound playback finished.');
//     }
// });

// import audioPlay from 'audio-play';
// import audioLoader from 'audio-loader';
// import fs from 'fs';

// // Ensure the file path is correct
// const mp3FilePath = 'C:/POLONA/google/polona-google2/error.mp3';

// // Load the audio file
// audioLoader(mp3FilePath, (err, buffer) => {
//     if (err) {
//         console.error('Error loading audio:', err);
//         return;
//     }

//     // Play the audio
//     audioPlay(buffer);
//     console.log('Sound playback started.');
// });

// import audioPlay from 'audio-play';
// import audioLoader from 'audio-loader';
// import path from 'path';

// // Dynamically get the path to the audio file
// const mp3FilePath = path.join(__dirname, 'error.mp3'); // This will dynamically resolve the file path

// console.log('MP3 file path:', mp3FilePath);

// // Load the audio file
// audioLoader(mp3FilePath, (err, buffer) => {
//     if (err) {
//         console.error('Error loading audio:', err);
//         return;
//     }

//     // Play the audio
//     audioPlay(buffer);
//     console.log('Sound playback started.');
// });
//3timespath
// import { fileURLToPath } from 'url';
// import { dirname, join } from 'path'; // Import 'join' from 'path' module
// import audioPlay from 'audio-play';
// import audioLoader from 'audio-loader';

// // Get the current directory path
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// // Resolve the file path for the MP3 file
// const mp3FilePath = join(__dirname, 'error.mp3');
// console.log('MP3 file path:', mp3FilePath);

// // Load and play the audio
// audioLoader(mp3FilePath, (err, buffer) => {
//     if (err) {
//         console.error('Error loading audio:', err);
//         return;
//     }

//     // Play the audio
//     audioPlay(buffer);
//     console.log('Sound playback started.');
// });

// import { fileURLToPath } from 'url';
// import { dirname, join } from 'path'; // Import 'join' from 'path' module
// import audioPlay from 'audio-play';
// import audioLoader from 'audio-loader';

// // Get the current directory path
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// // Resolve the file path for the MP3 file
// const mp3FilePath = join(__dirname, 'error2.mp3');
// //console.log('MP3 file path:', mp3FilePath);

// // Ensure the audio is only loaded and played once
// let isAudioPlayed = false;

// audioLoader(mp3FilePath, (err, buffer) => {
//     // if (isAudioPlayed) {
//     //     console.log("Audio already played, skipping...");
//     //     return; // Skip if already played
//     // }

//     if (err) {
//         console.error('Error loading audio:', err);
//         return;
//     }

//     // Mark audio as played
//     isAudioPlayed = true;

//     // Play the audio
//     audioPlay(buffer);
//     //console.log('Sound playback started.');
// });
//import moduleAlias from 'module-alias';
//import punycode from 'punyCode/';
//export NODE_OPTIONS="--no-deprecation";
// import { fileURLToPath } from 'url';
// import { dirname, join } from 'path'; // Import 'join' from 'path' module
// import audioPlay from 'audio-play';
// import audioLoader from 'audio-loader';


// //process.env.NODE_NO_DEPRECATION = 'true';

// // Get the current directory path
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// // Resolve the file path for the MP3 file
// const mp3FilePath = join(__dirname, 'error2.mp3');  // Ensure this path is correct

// // Ensure the audio is only loaded and played once
// let isAudioPlayed = false;

// audioLoader(mp3FilePath, (err, buffer) => {
//     if (err) {
//         console.error('Error loading audio:', err);
//         return;
//     }

//     // Mark audio as played
//     isAudioPlayed = true;

//     // Play the audio
//     audioPlay(buffer);
// });

import { fileURLToPath } from 'url';
import { dirname, join } from 'path'; // Import 'join' from 'path' module
import audioPlay from 'audio-play';
import audioLoader from 'audio-loader';

// Get the current directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve the file path for the MP3 file
const mp3FilePath = join(__dirname, 'error2.mp3');  // Ensure this path is correct

// Ensure the audio is only loaded and played
let audioBuffer;

const playAudio = () => {
    // Reload and play the audio every time
    audioLoader(mp3FilePath, (err, buffer) => {
        if (err) {
            console.error('Error loading audio:', err);
            return;
        }

        // Store the audio buffer for future use
        audioBuffer = buffer;

        // Play the audio
        audioPlay(audioBuffer);
    });
};

// Listen for "Enter" key presses and handle "Ctrl+C" to exit
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', (key) => {
    if (key.toString() === '\r') { 
        // '\r' represents the Enter key
        playAudio();
    } else if (key.toString() === '\u0003') { 
        // '\u0003' is the ASCII code for Ctrl+C
        console.log('Exiting...');
        process.exit();
    }
});

// To play again, call the function again:

