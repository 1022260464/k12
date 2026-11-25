// 低年级语音输入：浏览器录音转成 16kHz 单声道 WAV，交给云端识别。
// 使用 ScriptProcessor 逐帧采集（各端浏览器兼容）；采样率不是 16k 时用
// OfflineAudioContext 重采样（浏览器原生抗混叠，手工线性插值会引入混叠噪声）。
const TARGET_SAMPLE_RATE = 16_000;
const MAX_SECONDS = 30;
const BUFFER_SIZE = 4096;

export function createVoiceRecorder({ onAutoStop, onReady, onLevel } = {}) {
  let audioContext = null;
  let mediaStream = null;
  let sourceNode = null;
  let processor = null;
  let samples = [];
  let startedAt = 0;
  let finished = true;
  let readyNotified = false;
  let autoStopFired = false;
  let peakLevel = 0;

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("这个浏览器不能录音，用电脑 Chrome 或手机自带的浏览器打开就能说话啦");
    }
    // 打开回声消除/降噪/自动增益，手机浏览器识别更稳
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const Context = window.AudioContext || window.webkitAudioContext;
    audioContext = new Context({ sampleRate: TARGET_SAMPLE_RATE });
    // 手机浏览器的自动播放策略会把音频上下文挂起，不 resume 就录不到任何声音
    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume();
      } catch {
        /* 部分 webview 不支持，靠下面的采样检查兜底 */
      }
    }
    if (audioContext.state !== "running") {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
      audioContext.close().catch(() => {});
      audioContext = null;
      throw new Error("麦克风没准备好，请再点一次试试");
    }
    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    processor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
    samples = [];
    finished = false;
    readyNotified = false;
    autoStopFired = false;
    peakLevel = 0;
    processor.onaudioprocess = (event) => {
      if (finished) return;
      const input = event.inputBuffer.getChannelData(0);
      samples.push(new Float32Array(input));
      // 第一帧到达才算真正开始收声：之前的空窗期开口会丢字
      if (!readyNotified) {
        readyNotified = true;
        onReady?.();
      }
      let framePeak = 0;
      for (let i = 0; i < input.length; i += 1) {
        const value = Math.abs(input[i]);
        if (value > framePeak) framePeak = value;
      }
      if (framePeak > peakLevel) peakLevel = framePeak;
      onLevel?.(framePeak);
      // 只触发一次，由组件回调 stop() 取走录音（samples 不能在这里消费）
      if (!autoStopFired && (Date.now() - startedAt) / 1000 >= MAX_SECONDS) {
        autoStopFired = true;
        onAutoStop?.();
      }
    };
    sourceNode.connect(processor);
    // ScriptProcessor 需要连到 destination 才会触发回调；静音增益避免回声。
    const mute = audioContext.createGain();
    mute.gain.value = 0;
    processor.connect(mute);
    mute.connect(audioContext.destination);
    startedAt = Date.now();
  }

  function collect() {
    const total = samples.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Float32Array(total);
    let offset = 0;
    for (const chunk of samples) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  }

  function teardown() {
    finished = true;
    processor?.disconnect();
    sourceNode?.disconnect();
    mediaStream?.getTracks().forEach((track) => track.stop());
    audioContext?.close().catch(() => {});
    processor = null;
    sourceNode = null;
    mediaStream = null;
    audioContext = null;
  }

  /** 浏览器原生重采样（带抗混叠滤波）；不支持时退回线性插值。 */
  function resampleToFallback(merged, sourceRate) {
    const rate = sourceRate || TARGET_SAMPLE_RATE;
    if (rate === TARGET_SAMPLE_RATE || !merged.length) {
      return Promise.resolve(merged);
    }
    try {
      const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const length = Math.max(1, Math.ceil((merged.length * TARGET_SAMPLE_RATE) / rate));
      const offline = new OfflineContext(1, length, TARGET_SAMPLE_RATE);
      const buffer = offline.createBuffer(1, merged.length, rate);
      buffer.copyToChannel(merged, 0);
      const source = offline.createBufferSource();
      source.buffer = buffer;
      source.connect(offline.destination);
      source.start();
      return offline
        .startRendering()
        .then((rendered) => rendered.getChannelData(0).slice());
    } catch {
      const ratio = rate / TARGET_SAMPLE_RATE;
      const length = Math.max(1, Math.floor(merged.length / ratio));
      const pcm = new Float32Array(length);
      for (let i = 0; i < length; i += 1) {
        const position = i * ratio;
        const left = Math.floor(position);
        const right = Math.min(left + 1, merged.length - 1);
        pcm[i] = merged[left] * (1 - (position - left)) + merged[right] * (position - left);
      }
      return Promise.resolve(pcm);
    }
  }

  async function stop() {
    const merged = collect();
    const rate = audioContext?.sampleRate || TARGET_SAMPLE_RATE;
    const seconds = (Date.now() - startedAt) / 1000;
    const peak = peakLevel;
    teardown();
    samples = [];
    const resampled = await resampleToFallback(merged, rate);
    return { blob: encodeWav(resampled), seconds, peak };
  }

  function abort() {
    teardown();
    samples = [];
  }

  return { start, stop, abort };
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("录音读取失败，请再试一次"));
    reader.readAsDataURL(blob);
  });
}

function encodeWav(samples) {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    pcm[i] = Math.round(Math.max(-1, Math.min(1, samples[i])) * 32_767);
  }
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  writeText(view, 0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeText(view, 8, "WAVE");
  writeText(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(view, 36, "data");
  view.setUint32(40, pcm.length * 2, true);
  new Int16Array(buffer, 44).set(pcm);
  return new Blob([buffer], { type: "audio/wav" });
}

function writeText(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
