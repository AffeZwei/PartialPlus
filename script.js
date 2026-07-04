const fundamentalInput = document.getElementById("fundamental");
const multiplierInput = document.getElementById("multiplier");
const volumeSlider = document.getElementById("volume");

const noteInput = document.getElementById("note");
const referenceAInput = document.getElementById("referenceA");

const outputDisplay = document.getElementById("outputFrequency");

const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");

const fundMinus = document.getElementById("fundMinus");
const fundPlus = document.getElementById("fundPlus");

const multMinus = document.getElementById("multMinus");
const multPlus = document.getElementById("multPlus");

const aMinus = document.getElementById("aMinus");
const aPlus = document.getElementById("aPlus");

const NOTE_INDEX = {
    C: 0,
    "C#": 1,
    Db: 1,

    D: 2,
    "D#": 3,
    Eb: 3,

    E: 4,

    F: 5,
    "F#": 6,
    Gb: 6,

    G: 7,
    "G#": 8,
    Ab: 8,

    A: 9,
    "A#": 10,
    Bb: 10,

    B: 11
};

const NOTE_NAMES = [

    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B"

];

const nearestNote = document.getElementById("nearestNote");

let audioContext = null;
let oscillator = null;
let gainNode = null;
let holdTimeout;
let holdInterval;

function getVolume() {
    return Math.pow(Number(volumeSlider.value) / 100, 2);
}

let volume = getVolume();

// ------------------------------ press and hold 

function setupSpinner(button, input, direction, afterChange = updateDisplay) {

    const change = () => {
        changeValue(input, direction);
        afterChange();
    };

    button.addEventListener("click", (e) => {
        // Prevent the click after a long press from adding one more step
        if (button.dataset.held === "true") {
            button.dataset.held = "false";
            e.preventDefault();
            return;
        }

        change();
    });

    const startHold = () => {

        button.dataset.held = "false";

        holdTimeout = setTimeout(() => {

            button.dataset.held = "true";

            change();

            holdInterval = setInterval(change, 50); // 20 times/sec

        }, 400);

    };

    const stopHold = () => {

        clearTimeout(holdTimeout);
        clearInterval(holdInterval);

    };

    button.addEventListener("mousedown", startHold);
    button.addEventListener("touchstart", startHold);

    button.addEventListener("mouseup", stopHold);
    button.addEventListener("mouseleave", stopHold);

    button.addEventListener("touchend", stopHold);
    button.addEventListener("touchcancel", stopHold);

}

function getFrequency() {
    const fundamental = Number(fundamentalInput.value);
    const multiplier = Number(multiplierInput.value);

    if (!Number.isFinite(multiplier)) return 0;

    if (multiplier > 0) {
        return fundamental * multiplier;
    }

    if (multiplier < 0) {
        return fundamental / Math.abs(multiplier);
    }

    return fundamental; // multiplier is 0
}

function frequencyToMidi(freq, referenceA) {

    return 69 + 12 * Math.log2(freq / referenceA);

}

function frequencyToNote(freq, referenceA) {

    const midiFloat = frequencyToMidi(freq, referenceA);

    const midi = Math.round(midiFloat);

    const cents = (midiFloat - midi) * 100;

    const octave = Math.floor(midi / 12) - 1;

    const note = NOTE_NAMES[midi % 12];

    return {

        note: note + octave,

        cents: cents

    };

}

function updateDisplay() {

    const freq = getFrequency();
    const refA = Number(referenceAInput.value);
    const nearest = frequencyToNote(freq, refA)
    const sign = nearest.cents >= 0 ? "+" : "";

    nearestNote.textContent =
        `${nearest.note} (${sign}${nearest.cents.toFixed(2)}¢)`;  

    outputDisplay.textContent = freq.toFixed(2) + " Hz" ;  

    if (oscillator) {
        oscillator.frequency.setValueAtTime(
            freq,
            audioContext.currentTime
        );
    }
}

function updateFromFrequency() {

    updateDisplay();

    const freq = Number(fundamentalInput.value);
    const refA = Number(referenceAInput.value);

    const result = frequencyToNote(freq, refA);

    noteInput.value = result.note;

}

function parseNote(text) {

    const match = text.trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);

    if (!match)
        return null;

    return {

        note: (match[1].toUpperCase() + match[2]),

        octave: Number(match[3])

    };

}

function noteToMidi(noteString) {

    const parsed = parseNote(noteString);

    if (!parsed)
        return null;

    const index = NOTE_INDEX[parsed.note];

    if (index === undefined)
        return null;

    return (parsed.octave + 1) * 12 + index;

}

function midiToFrequency(midi, referenceA) {

    return referenceA * Math.pow(2, (midi - 69) / 12);

}

function updateFromNote() {

    const refA = Number(referenceAInput.value);

    const midi = noteToMidi(noteInput.value);

    if (midi === null)
        return;

    const freq = midiToFrequency(midi, refA);

    const roundedFreq = Number(freq.toFixed(3));
    fundamentalInput.value = roundedFreq.toFixed(3);

    //fundamentalInput.value = freq.toFixed(2);

    updateDisplay();

}

function updateVolume() {
    volume = getVolume();

    if (gainNode) {
        const currentGain = gainNode.gain.value;

        gainNode.gain.cancelScheduledValues(audioContext.currentTime);
        gainNode.gain.setValueAtTime(currentGain, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(
            volume,
            audioContext.currentTime + 0.05
        );
    }
}

function formatValue(input, value) {
    const decimals = (input.step.split(".")[1] || "").length;
    return value.toFixed(decimals);
}

function changeValue(input, amount) {

    const step = Number(input.step) || 1;
    const min = Number(input.min) || 0;

    let value = Number(input.value);

    value += amount * step;

    value = Math.max(min, value);

    input.value = formatValue(input, value);

}

function startTone() {

    if (oscillator) return;

    if (!audioContext) {
        audioContext = new AudioContext();
    }

    oscillator = audioContext.createOscillator();
    gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = getFrequency();
    volume = getVolume();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Start silent
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);

    oscillator.start();

    // Fade in
    gainNode.gain.linearRampToValueAtTime(
        volume,  
        audioContext.currentTime + 0.02
    );
}

function stopTone() {

    if (!oscillator) return;

    gainNode.gain.cancelScheduledValues(audioContext.currentTime);

    gainNode.gain.setValueAtTime(
        gainNode.gain.value,
        audioContext.currentTime
    );

    gainNode.gain.linearRampToValueAtTime(
        0,
        audioContext.currentTime + 0.22
    );

    oscillator.stop(audioContext.currentTime + 0.22);

    oscillator.onended = () => {
        oscillator.disconnect();
        gainNode.disconnect();

        oscillator = null;
        gainNode = null;
    };

}

fundamentalInput.addEventListener("input", updateFromFrequency);

noteInput.addEventListener("input", updateFromNote);

referenceAInput.addEventListener("input", updateFromNote);   

multiplierInput.addEventListener("input", updateDisplay);

volumeSlider.addEventListener("input", updateVolume);

startButton.addEventListener("click", startTone);

stopButton.addEventListener("click", stopTone);

setupSpinner(fundMinus, fundamentalInput, -1, updateFromFrequency);
setupSpinner(fundPlus, fundamentalInput, 1, updateFromFrequency);

setupSpinner(multMinus, multiplierInput, -1);
setupSpinner(multPlus, multiplierInput, 1);

setupSpinner(aMinus, referenceAInput, -1, updateFromNote);
setupSpinner(aPlus, referenceAInput, 1, updateFromNote);


updateDisplay();

