import lamejs from 'lamejs';

export async function convertBlobUrlToMp3(audioUrl: string): Promise<Blob> {
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;

  // Lame supports standard sample rates. Usually AudioContext will resample to 44100 or 48000 depending on the device.
  // @ts-ignore - lamejs typings might be missing depending on the setup
  const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128); // 128kbps

  const left = audioBuffer.getChannelData(0);
  const right = channels > 1 ? audioBuffer.getChannelData(1) : left;

  const sampleBlockSize = 1152;
  const mp3Data: Int8Array[] = [];

  // Convert Float32Array to Int16Array
  const floatToInt16 = (f32Arr: Float32Array) => {
    const len = f32Arr.length;
    const i16Arr = new Int16Array(len);
    for (let i = 0; i < len; i++) {
        let val = Math.floor(f32Arr[i] * 32767);
        val = Math.max(-32768, Math.min(32767, val));
        i16Arr[i] = val;
    }
    return i16Arr;
  };

  const leftInt16 = floatToInt16(left);
  const rightInt16 = floatToInt16(right);

  for (let i = 0; i < leftInt16.length; i += sampleBlockSize) {
    const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
    let rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
    
    // lamejs expects the chunk length to be identical, we might have slightly smaller chunk at the end, but lamejs handles subarray.
    let mp3buf;
    if (channels === 1) {
      mp3buf = mp3encoder.encodeBuffer(leftChunk);
    } else {
      mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    }
    
    if (mp3buf.length > 0) {
      mp3Data.push(new Int8Array(mp3buf));
    }
  }

  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(new Int8Array(mp3buf));
  }

  return new Blob(mp3Data, { type: 'audio/mp3' });
}
