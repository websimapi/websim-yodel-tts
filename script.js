const textInput = document.getElementById('text-input');
const wobbleButton = document.getElementById('wobble-button');
const loader = document.getElementById('loader');
const errorMessage = document.getElementById('error-message');

let audioContext;
let isWobbling = false;

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

function toggleUI(wobbling) {
    isWobbling = wobbling;
    wobbleButton.disabled = wobbling;
    loader.classList.toggle('hidden', !wobbling);
    errorMessage.classList.add('hidden');
    wobbleButton.textContent = wobbling ? 'Wobbling...' : 'Wobble It!';
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

async function wobblifyText(text) {
    toggleUI(true);

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
        
        await playAudioSequentially(audioUrls);

    } catch (error) {
        console.error("Wobble error:", error);
        showError("Oops! Something went wrong while wobbling. Please try again.");
    } finally {
        toggleUI(false);
    }
}

async function playAudioSequentially(urls) {
    if (!audioContext) return;
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    let isHighPitch = false;
    let scheduledTime = audioContext.currentTime;

    for (const url of urls) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;

            // Alternate pitch using playbackRate
            const playbackRate = isHighPitch ? 1.8 : 0.8;
            source.playbackRate.value = playbackRate;
            isHighPitch = !isHighPitch;

            source.connect(audioContext.destination);
            source.start(scheduledTime);

            scheduledTime += audioBuffer.duration / playbackRate;
        } catch (e) {
            console.error('Failed to load or play audio chunk:', e);
        }
    }
}