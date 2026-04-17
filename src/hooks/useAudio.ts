'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

type SoundEvent =
  | { type: 'land' }
  | { type: 'clear'; cells: number; chainNum: number }
  | { type: 'chain'; chainNum: number };

// MIDI note → frequency
function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// A minor pentatonic 16-step melody
const MELODY = [69, 72, 74, 76, 79, 76, 74, 72, 69, 71, 72, 74, 76, 74, 72, 71];
const NOTE_DUR  = 0.18;
const STEP_DUR  = 0.25;
const LOOKAHEAD = 0.2;   // seconds
const SCHED_INT = 150;   // ms

export function useAudio() {
  const ctxRef        = useRef<AudioContext | null>(null);
  const masterRef     = useRef<GainNode | null>(null);
  const droneRef      = useRef<OscillatorNode | null>(null);
  const nextNoteRef    = useRef(0);
  const stepRef        = useRef(0);
  const schedTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgmRunRef      = useRef(false);

  const [muted, setMuted] = useState(false);

  const getCtx = useCallback((): AudioContext => {
    if (!ctxRef.current) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      masterRef.current = master;
    }
    return ctxRef.current;
  }, []);

  const playSound = useCallback((event: SoundEvent) => {
    if (muted) return;
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const master = masterRef.current!;
    const now = ctx.currentTime;

    if (event.type === 'land') {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 400;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(filt).connect(gain).connect(master);
      osc.start(now);
      osc.stop(now + 0.1);
    }

    if (event.type === 'clear') {
      const burst = Math.min(event.cells, 8);
      for (let i = 0; i < burst; i++) {
        const t    = now + i * 0.012;
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800 + event.chainNum * 60, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);
        osc.detune.value = (Math.random() - 0.5) * 100;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.25, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        osc.connect(gain).connect(master);
        osc.start(t);
        osc.stop(t + 0.17);
      }
    }

    if (event.type === 'chain') {
      const freq = 220 * Math.pow(2, (event.chainNum - 1) / 4);
      ([
        { type: 'triangle' as OscillatorType, mult: 1, vol: 0.3 },
        { type: 'sine'     as OscillatorType, mult: 2, vol: 0.12 },
      ] as const).forEach(({ type, mult, vol }) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq * mult;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.02);
        gain.gain.setValueAtTime(vol, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(gain).connect(master);
        osc.start(now);
        osc.stop(now + 0.52);
      });
    }
  }, [muted, getCtx]);

  const scheduleNote = useCallback((step: number, time: number) => {
    const ctx    = ctxRef.current!;
    const master = masterRef.current!;
    const freq   = midiToHz(MELODY[step]);
    const osc    = ctx.createOscillator();
    const gain   = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.08, time + 0.02);
    gain.gain.setValueAtTime(0.08, time + NOTE_DUR - 0.02);
    gain.gain.linearRampToValueAtTime(0, time + NOTE_DUR);
    osc.connect(gain).connect(master);
    osc.start(time);
    osc.stop(time + NOTE_DUR);
  }, []);

  const startBGM = useCallback(() => {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();
    if (bgmRunRef.current) return;
    bgmRunRef.current = true;

    // Bass drone
    if (!droneRef.current) {
      const master = masterRef.current!;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.value = 55;
      filt.type = 'lowpass';
      filt.frequency.value = 120;
      gain.gain.value = 0.04;
      osc.connect(filt).connect(gain).connect(master);
      osc.start();
      droneRef.current = osc;
    }

    nextNoteRef.current = ctx.currentTime;
    stepRef.current = 0;

    const tick = () => {
      if (!bgmRunRef.current) return;
      const c = ctxRef.current!;
      while (nextNoteRef.current < c.currentTime + LOOKAHEAD) {
        scheduleNote(stepRef.current, nextNoteRef.current);
        stepRef.current = (stepRef.current + 1) % MELODY.length;
        nextNoteRef.current += STEP_DUR;
      }
      schedTimerRef.current = setTimeout(tick, SCHED_INT);
    };
    tick();
  }, [getCtx, scheduleNote]);

  const stopBGM = useCallback(() => {
    bgmRunRef.current = false;
    if (schedTimerRef.current) clearTimeout(schedTimerRef.current);
    if (droneRef.current) {
      try { droneRef.current.stop(); } catch { /* already stopped */ }
      droneRef.current = null;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (masterRef.current && ctxRef.current) {
        masterRef.current.gain.setTargetAtTime(
          next ? 0 : 0.7,
          ctxRef.current.currentTime,
          0.05,
        );
      }
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      stopBGM();
      ctxRef.current?.close();
    };
  }, [stopBGM]);

  return { playSound, muted, toggleMute, startBGM, stopBGM };
}
