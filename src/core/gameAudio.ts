let context: AudioContext | null = null;

export async function unlockGameAudio() {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') await context.resume();
  } catch { /* Optional audio must never block play. */ }
}

export function playGameSound(kind: 'coin' | 'card' | 'turn' | 'challenge', volume: number) {
  if (!context || context.state !== 'running' || document.hidden) return;
  const notes = kind === 'coin' ? [880, 1320] : kind === 'turn' ? [440, 660] : kind === 'challenge' ? [330, 440] : [240];
  notes.forEach((frequency, index) => {
    const oscillator = context!.createOscillator();
    const gain = context!.createGain();
    const at = context!.currentTime + index * .075;
    oscillator.type = kind === 'card' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(Math.min(.12, Math.max(0, volume) * .12), at + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, at + .13);
    oscillator.connect(gain); gain.connect(context!.destination);
    oscillator.start(at); oscillator.stop(at + .14);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
}
