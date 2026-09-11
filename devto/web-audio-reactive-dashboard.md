---
title: "Making a dashboard react to audio: checking RMS and frequency bins in real code"
published: false
tags: webaudio, javascript, react, testing
canonical_url: null
---

An audio-reactive dashboard needs different values depending on whether an element should respond to overall signal amplitude or to a particular frequency range. Treating RMS and frequency bytes as interchangeable "volume" makes those movements difficult to tune.

The analysis code from the personal project beautiful-dashboard-for-bga was tested with synthetic audio. Doubling the input amplitude doubled RMS, while the maximum frequency byte changed from 211 to 232. To change movements by the same ratio, keep the input values on the same scale.

## First distinguish mock animation from input audio

The target is a [fixed repository commit](https://github.com/takahiro-saeki/beautiful-dashboard-for-bga/tree/6f69cac1fe792436fced3a5215633e850262db59). Its lockfile resolves React 19.2.4, Vite 7.3.1, and TypeScript 5.9.3.

The [useAudioEngine hook](https://github.com/takahiro-saeki/beautiful-dashboard-for-bga/blob/6f69cac1fe792436fced3a5215633e850262db59/src/hooks/useAudioEngine.ts) starts with isMock set to true. It generates synthetic waveforms and changing frequency arrays, updating drawing data even without audio input. Starting the microphone or loading a file switches to actual input; stop returns to the mock.

Animation alone therefore does not establish that microphone capture succeeded. This verification did not use the microphone either. The analysis functions ran in Node.js, and the Web Audio portion used OfflineAudioContext on a local page in HeadlessChrome 152. The verification date was September 11, 2026.

## Read waveforms and frequencies through separate analysers

The inspected code has separate AnalyserNodes for time-domain and frequency data.

| Purpose | fftSize | Values used |
| --- | ---: | --- |
| Time domain | 4096 | Waveform read through getFloatTimeDomainData, RMS, peak |
| Frequency domain | 2048 | Array read through getByteFrequencyData, band values |

The frequency analyser has a frequencyBinCount of 1024. The [Web Audio specification](https://www.w3.org/TR/webaudio/#AnalyserNode) defines that count as half of fftSize. Frequency bytes map decibel values from the minDecibels to maxDecibels range into 0 through 255. They are not waveform amplitudes.

The following RMS function comes from [AudioAnalysis.ts](https://github.com/takahiro-saeki/beautiful-dashboard-for-bga/blob/6f69cac1fe792436fced3a5215633e850262db59/src/audio/AudioAnalysis.ts). Its calculation is unchanged apart from removing types.

```js
function computeAmplitude(timeDomain) {
  let sum = 0;
  for (let i = 0; i < timeDomain.length; i++) {
    const v = timeDomain[i];
    sum += v * v;
  }
  return Math.sqrt(sum / timeDomain.length);
}
```

It squares each sample, averages the results, and takes the square root. That differs from peak, which returns the largest instantaneous absolute value. The implementation has no special handling for an empty array, which produced NaN in a local check. The actual input path allocates an array of fftSize samples, so the browser experiment did not pass an empty array.

## Compare the scales using a synthetic tone

The browser experiment generated a 468.75 Hz sine wave. It requested suspension of an OfflineAudioContext at 0.5 seconds, read time-domain and frequency data after suspension, and passed them to the same analysis functions. Offline rendering did not send sound to the speakers.

The analysers matched the implementation's fftSize and smoothingTimeConstant settings: 4096 and 0.8 for the time-domain analyser, 2048 and 0.85 for the frequency analyser. The source was an experimental OscillatorNode, not the app's microphone or file input.

| sampleRate | Input amplitude | RMS | Peak frequency bin | Maximum byte |
| --- | ---: | ---: | ---: | ---: |
| 48000 | 0 | 0 | None | 0 |
| 48000 | 0.25 | 0.176777 | 20 | 211 |
| 48000 | 0.5 | 0.353553 | 20 | 232 |
| 44100 | 0.5 | 0.353600 | 22 | 232 |

RMS is rounded to 6 decimal places. The peak bin was selected from getFloatFrequencyData, avoiding reliance on byte values that could saturate at their upper limit.

For the two nonzero inputs at 48000, the input amplitude ratio matched the RMS ratio. The maximum byte did not change by the same ratio. Because these bytes are derived from decibels, their average should not be called the average waveform amplitude.

These values came from the first frequency read after suspension in this graph. Smoothing depends on previous analysis values, so this is not a claim that a UI with different settings or read counts will always produce 211 and 232.

## Fixed-bin "bass" depends on sampleRate

The implementation's extractBands function divides the frequency array into fixed index ranges, averages the bytes, and divides by 255. Its boundaries are not specified in hertz.

```js
function binHz(index, sampleRate, fftSize) {
  return index * sampleRate / fftSize;
}
console.log(binHz(20, 48000, 2048)); // 468.75
console.log(binHz(22, 44100, 2048)); // 473.73046875
```

The same 468.75 Hz input peaked at bin 20 with a sample rate of 48000 and bin 22 at 44100. The spacing between bins differs, and an input frequency does not always coincide with a bin center.

Converting the original fixed ranges into boundaries at a sample rate of 48000 gives the following table. The upper index is excluded. These are this code's array partitions, not strict acoustic band definitions.

| Name | Bin range | Converted boundaries in Hz |
| --- | --- | --- |
| subBass | 0 inclusive to 4 exclusive | 0 to 93.75 |
| bass | 4 inclusive to 12 exclusive | 93.75 to 281.25 |
| lowMid | 12 inclusive to 40 exclusive | 281.25 to 937.5 |
| mid | 40 inclusive to 100 exclusive | 937.5 to 2343.75 |
| highMid | 100 inclusive to 200 exclusive | 2343.75 to 4687.5 |
| high | 200 inclusive to 512 exclusive | 4687.5 to 12000 |

The frequency array has 1024 elements, but this band aggregation only uses indices below 512. In another local test, setting only bin 700 to 255 left all 6 bands at 0. That demonstrates that this aggregation does not read the second half of the array. It does not mean the entire frequency array was empty.

Responding to a specific hertz range would require deriving indices from sampleRate and fftSize. Such a change also needs rules for rounding boundaries and averaging when the number of bins changes. The original code was not changed here.

## Check the time unit in beat detection as well

BeatDetector keeps up to 60 recent amplitude values. It responds when the amplitude exceeds both 1.3 times the average and 0.05, then suppresses detection for 8 calls.

In the local test, 60 calls with 0.1 followed by 0.5 produced a detection, and the next 8 calls returned false. The test checks a history and cooldown measured in calls rather than milliseconds. It does not validate BPM estimation.

When the call frequency changes, the elapsed time represented by those 8 calls changes as well. Using the result as musical tempo would require a separate evaluation. This article did not measure drawing frame rate or detection accuracy across songs.

## Decide what a value means before passing it to drawing code

RMS can drive movement intended to follow overall signal amplitude, peak can drive responses to instantaneous strength, and frequency aggregation can drive band-specific movement. They should not all be treated as "volume" in the same unit.

The verified scope was the analysis functions and Web Audio values for synthetic input. It did not include starting the entire application, microphone permissions, file playback, input switching, or sustained rendering load. When connecting actual input, begin by checking that it is distinguishable from the mock.
