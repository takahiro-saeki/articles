// Served locally after research-batch13.mjs prepares the extracted analysis module.
import {computeAmplitude,computePeak,extractBands} from './analysis.js';
async function probe(sampleRate,amplitude){
 const ctx=new OfflineAudioContext(1,sampleRate,sampleRate);
 const osc=ctx.createOscillator();osc.frequency.value=468.75;
 const gain=ctx.createGain();gain.gain.value=amplitude;
 const time=ctx.createAnalyser();time.fftSize=4096;time.smoothingTimeConstant=0.8;
 const frequency=ctx.createAnalyser();frequency.fftSize=2048;frequency.smoothingTimeConstant=0.85;
 osc.connect(gain);gain.connect(time);gain.connect(frequency);gain.connect(ctx.destination);
 osc.start();
 const paused=ctx.suspend(0.5);const rendering=ctx.startRendering();await paused;
 const waveform=new Float32Array(time.fftSize);time.getFloatTimeDomainData(waveform);
 const db=new Float32Array(frequency.frequencyBinCount);frequency.getFloatFrequencyData(db);
 const bytes=new Uint8Array(frequency.frequencyBinCount);frequency.getByteFrequencyData(bytes);
 const peakBin=amplitude===0?null:db.indexOf(Math.max(...db));
 const result={sample_rate:ctx.sampleRate,input_frequency:468.75,input_amplitude:amplitude,time_fft:time.fftSize,frequency_fft:frequency.fftSize,frequency_bins:frequency.frequencyBinCount,rms:computeAmplitude(waveform),peak:computePeak(waveform),peak_bin:peakBin,peak_bin_hz:peakBin===null?null:peakBin*ctx.sampleRate/frequency.fftSize,maximum_byte:Math.max(...bytes),bands:extractBands(bytes)};
 await ctx.resume();await rendering;return result;
}
window.articleProbe=async()=>{
 const cases=[];for(const [rate,amplitude]of [[48000,0],[48000,0.25],[48000,0.5],[44100,0.5]])cases.push(await probe(rate,amplitude));
 return {user_agent:navigator.userAgent,method:'OfflineAudioContext, synthetic sine, no audible destination or microphone access',cases};
};
