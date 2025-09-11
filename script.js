const textInput = document.getElementById('text-input');
const wobbleButton = document.getElementById('wobble-button');
const loader = document.getElementById('loader');
const errorMessage = document.getElementById('error-message');
const audioControls = document.getElementById('audio-controls');
const replayButton = document.getElementById('replay-button');

let audioContext;
let isWobbling = false;
let lastGeneratedAudio = [];

// Initialize AudioContext on user interaction
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

wobbleButton.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (text && !isWobbling) {
        initAudioContext();
        wobblifyText(text);
    }
});

replayButton.addEventListener('click', () => {
    if (!isWobbling && lastGeneratedAudio.length > 0) {
        playStoredAudio();
    }
});

function toggleUI(wobbling) {
    isWobbling = wobbling;
    wobbleButton.disabled = wobbling;
    loader.classList.toggle('hidden', !wobbling);
    errorMessage.classList.add('hidden');
    if (wobbling) {
        audioControls.classList.add('hidden');
    }
    wobbleButton.textContent = wobbling ? 'Wobbling...' : 'Wobble It!';
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

async function wobblifyText(text) {
    toggleUI(true);
    lastGeneratedAudio = []; // Clear previous audio

    try {
        const chunks = text
            .split(/\s+/)
            .map(word => {
                // Split word by vowels, keeping the vowels.
                // e.g., "hello" -> ["h", "e", "ll", "o"]
                const parts = word.split(/(?=[aeiouyAEIOUY])/);
                const result = [];
                parts.forEach(part => {
                    const vowelMatch = part.match(/[aeiouyAEIOUY]/);
                    if (vowelMatch) {
                        const vowelIndex = vowelMatch.index;
                        if (vowelIndex > 0) {
                            result.push(part.substring(0, vowelIndex));
                        }
                        result.push(part.substring(vowelIndex));
                    } else {
                        result.push(part);
                    }
                });
                return result.filter(p => p.length > 0);
            })
            .flat();

        if (chunks.length === 0) {
            throw new Error("No wobble-able text found!");
        }

        const audioGenPromises = chunks.map(chunk =>
            websim.textToSpeech({ text: chunk, voice: 'en-female' })
        );
        const ttsResults = await Promise.all(audioGenPromises);
        const audioUrls = ttsResults.map(r => r.url);
        
        const audioDataPromises = audioUrls.map(async (url) => {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch audio from ${url}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return audioContext.decodeAudioData(arrayBuffer);
        });

        const audioBuffers = await Promise.all(audioDataPromises);

        let isHighPitch = false;
        audioBuffers.forEach(buffer => {
            const playbackRate = isHighPitch ? 1.8 : 0.8;
            lastGeneratedAudio.push({ buffer, playbackRate });
            isHighPitch = !isHighPitch;
        });
        
        await playStoredAudio();
        audioControls.classList.remove('hidden');

    } catch (error) {
        console.error("Wobble error:", error);
        showError("Oops! Something went wrong while wobbling. Please try again.");
    } finally {
        toggleUI(false);
    }
}

async function playStoredAudio() {
    if (!audioContext || lastGeneratedAudio.length === 0) return;
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    let scheduledTime = audioContext.currentTime;

    for (const audio of lastGeneratedAudio) {
        try {
            const source = audioContext.createBufferSource();
            source.buffer = audio.buffer;
            source.playbackRate.value = audio.playbackRate;

            source.connect(audioContext.destination);
            source.start(scheduledTime);

            scheduledTime += audio.buffer.duration / audio.playbackRate;
        } catch (e) {
            console.error('Failed to play audio chunk:', e);
        }
    }
}