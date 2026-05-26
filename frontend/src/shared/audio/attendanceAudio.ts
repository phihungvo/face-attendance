import type { Company } from "../api/companies";

export type AttendanceSoundKind = "success" | "failure";
export type AttendanceSoundSource = "default" | "sample" | "upload" | "url" | "tts";

export const ATTENDANCE_SOUND_SAMPLE_OPTIONS = [
  { id: "soft-chime", label: "Soft Chime" },
  { id: "double-ding", label: "Double Ding" },
  { id: "digital-pop", label: "Digital Pop" },
  { id: "warm-bell", label: "Warm Bell" },
  { id: "alert-buzz", label: "Alert Buzz" }
] as const;

type AttendanceSoundSampleId = (typeof ATTENDANCE_SOUND_SAMPLE_OPTIONS)[number]["id"];

type AttendanceSoundSetting = {
  source: AttendanceSoundSource;
  sampleId: string | null;
  url: string | null;
  text: string | null;
  dataUrl: string | null;
};

let activeAudio: HTMLAudioElement | null = null;

function getAudioContext() {
  const Ctor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  return new Ctor();
}

let sharedContext: AudioContext | null = null;

function ensureContext() {
  if (typeof window === "undefined") return null;
  if (!sharedContext) {
    sharedContext = getAudioContext();
  }
  return sharedContext;
}

function normalizeSetting(company: Company | null | undefined, kind: AttendanceSoundKind): AttendanceSoundSetting {
  if (kind === "success") {
    return {
      source: company?.attendance_success_sound_source ?? "default",
      sampleId: company?.attendance_success_sound_sample_id ?? null,
      url: company?.attendance_success_sound_url ?? null,
      text: company?.attendance_success_sound_text ?? null,
      dataUrl: company?.attendance_success_sound_data_url ?? null
    };
  }
  return {
    source: company?.attendance_failure_sound_source ?? "default",
    sampleId: company?.attendance_failure_sound_sample_id ?? null,
    url: company?.attendance_failure_sound_url ?? null,
    text: company?.attendance_failure_sound_text ?? null,
    dataUrl: company?.attendance_failure_sound_data_url ?? null
  };
}

function resolvePreset(setting: AttendanceSoundSetting, kind: AttendanceSoundKind): { mode: "preset"; preset: string } | { mode: "audio"; url: string } | { mode: "tts"; text: string } {
  if (setting.source === "upload" && setting.dataUrl) return { mode: "audio", url: setting.dataUrl };
  if (setting.source === "url" && setting.url) return { mode: "audio", url: setting.url };
  if (setting.source === "tts" && setting.text) return { mode: "tts", text: setting.text };
  if (setting.source === "sample" && setting.sampleId) return { mode: "preset", preset: setting.sampleId };
  return { mode: "preset", preset: kind === "success" ? "default-success" : "default-failure" };
}

function tone(ctx: AudioContext, at: number, frequency: number, duration: number, gain: number, type: OscillatorType = "sine") {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

function noiseBurst(ctx: AudioContext, at: number, duration: number, gain: number) {
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * 0.35;
  }
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const g = ctx.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(220, at);
  filter.Q.setValueAtTime(0.8, at);
  g.gain.setValueAtTime(Math.max(0.0001, gain), at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  source.start(at);
  source.stop(at + duration + 0.02);
}

function playPreset(ctx: AudioContext, preset: string) {
  const start = ctx.currentTime + 0.01;
  switch (preset as AttendanceSoundSampleId | "default-success" | "default-failure") {
    case "soft-chime":
      tone(ctx, start, 740, 0.2, 0.16, "sine");
      tone(ctx, start + 0.11, 988, 0.32, 0.13, "triangle");
      break;
    case "double-ding":
      tone(ctx, start, 880, 0.16, 0.18, "triangle");
      tone(ctx, start + 0.2, 1046, 0.18, 0.16, "triangle");
      break;
    case "digital-pop":
      tone(ctx, start, 660, 0.08, 0.2, "square");
      tone(ctx, start + 0.09, 990, 0.1, 0.14, "square");
      break;
    case "warm-bell":
      tone(ctx, start, 523.25, 0.22, 0.16, "sine");
      tone(ctx, start + 0.04, 659.25, 0.28, 0.12, "triangle");
      tone(ctx, start + 0.09, 783.99, 0.36, 0.1, "sine");
      break;
    case "alert-buzz":
      tone(ctx, start, 220, 0.14, 0.18, "sawtooth");
      tone(ctx, start + 0.16, 190, 0.16, 0.16, "sawtooth");
      noiseBurst(ctx, start, 0.08, 0.05);
      break;
    case "default-failure":
      tone(ctx, start, 240, 0.18, 0.18, "sawtooth");
      tone(ctx, start + 0.18, 180, 0.22, 0.14, "square");
      break;
    case "default-success":
    default:
      tone(ctx, start, 784, 0.16, 0.17, "sine");
      tone(ctx, start + 0.12, 1174, 0.26, 0.13, "triangle");
      break;
  }
}

function chunkTtsText(input: string, maxLength = 180) {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const parts: string[] = [];
  let current = "";
  for (const word of normalized.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }
    if (current) parts.push(current);
    current = word;
  }
  if (current) parts.push(current);
  return parts;
}

function googleTranslateTtsUrl(text: string) {
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=vi&q=${encodeURIComponent(text)}`;
}

async function playAudioUrl(url: string) {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }
  const audio = new Audio(url);
  audio.preload = "auto";
  activeAudio = audio;
  await audio.play();
}

async function playAudioQueue(urls: string[]) {
  for (const url of urls) {
    // eslint-disable-next-line no-await-in-loop
    await playAudioUrl(url);
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve) => {
      if (!activeAudio) {
        resolve();
        return;
      }
      activeAudio.onended = () => resolve();
      activeAudio.onerror = () => resolve();
    });
  }
}

function pickVietnameseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  return (
    voices.find((voice) => /google/i.test(voice.name) && /^vi([-_]|$)/i.test(voice.lang)) ??
    voices.find((voice) => /^vi([-_]|$)/i.test(voice.lang)) ??
    null
  );
}

async function waitForVoices(timeoutMs = 500) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (window.speechSynthesis.getVoices().length > 0) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      resolve();
    };
    window.speechSynthesis.addEventListener("voiceschanged", done);
    window.setTimeout(done, timeoutMs);
  });
}

async function speakVietnamese(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    throw new Error("speech synthesis unavailable");
  }
  await waitForVoices();
  const voice = pickVietnameseVoice();
  if (!voice) throw new Error("no vi voice");
  window.speechSynthesis.cancel();
  await new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "vi-VN";
    utterance.voice = voice;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error("tts failed"));
    window.speechSynthesis.speak(utterance);
  });
}

async function playTtsText(text: string) {
  try {
    await speakVietnamese(text);
    return;
  } catch {
    const urls = chunkTtsText(text).map(googleTranslateTtsUrl);
    if (!urls.length) throw new Error("empty tts");
    await playAudioQueue(urls);
  }
}

export async function primeAttendanceAudioPlayback() {
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

export async function playAttendanceFeedback(kind: AttendanceSoundKind, company?: Company | null) {
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  const resolved = resolvePreset(normalizeSetting(company, kind), kind);
  if (resolved.mode === "audio") {
    try {
      await playAudioUrl(resolved.url);
      return;
    } catch {
      playPreset(ctx, kind === "success" ? "default-success" : "default-failure");
      return;
    }
  }
  if (resolved.mode === "tts") {
    try {
      await playTtsText(resolved.text);
      return;
    } catch {
      playPreset(ctx, kind === "success" ? "default-success" : "default-failure");
      return;
    }
  }
  playPreset(ctx, resolved.preset);
}

export async function previewAttendanceFeedback(setting: {
  source: AttendanceSoundSource;
  sampleId?: string | null;
  url?: string | null;
  text?: string | null;
  dataUrl?: string | null;
}, kind: AttendanceSoundKind) {
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  const resolved = resolvePreset(
    {
      source: setting.source,
      sampleId: setting.sampleId ?? null,
      url: setting.url ?? null,
      text: setting.text ?? null,
      dataUrl: setting.dataUrl ?? null
    },
    kind
  );
  if (resolved.mode === "audio") {
    try {
      await playAudioUrl(resolved.url);
      return;
    } catch {
      playPreset(ctx, kind === "success" ? "default-success" : "default-failure");
      return;
    }
  }
  if (resolved.mode === "tts") {
    try {
      await playTtsText(resolved.text);
      return;
    } catch {
      playPreset(ctx, kind === "success" ? "default-success" : "default-failure");
      return;
    }
  }
  playPreset(ctx, resolved.preset);
}
