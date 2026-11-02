#!/usr/bin/env python3
"""Verbatim word-level transcription of one speaker's audio track.

Unlike claude-shorts' transcribe.py, this nudges Whisper to KEEP disfluencies
(um, uh, like, you know) so they can be cut for filler removal.

Usage:
  ~/.shorts-skill/bin/python pipeline/transcribe_verbatim.py AUDIO --speaker Quinn \
      --offset 6.2 --output work/<ep>/words-quinn.json

--offset shifts all timestamps onto the Descript sequence timeline (the clip's
<start> in the XML), so every speaker's words share one clock.
"""
import argparse, json, os, time

FILLER_PROMPT = ("Um, uh, so, like, you know, I mean, uh, hmm. "
                 "Yeah, um, I- I think, uh, it's, like, really good.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("--speaker", required=True)
    ap.add_argument("--offset", type=float, default=0.0)
    ap.add_argument("--model", default="large-v3-turbo")
    ap.add_argument("--output", required=True)
    a = ap.parse_args()

    from faster_whisper import WhisperModel
    t0 = time.time()
    model = WhisperModel(a.model, device="cpu", compute_type="int8",
                         cpu_threads=os.cpu_count() or 8)
    # Decode with ffmpeg ourselves: faster-whisper's PyAV path breaks on av>=17.
    import subprocess, numpy as np
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", a.audio, "-f", "s16le", "-ac", "1",
                          "-ar", "16000", "-"], capture_output=True, check=True).stdout
    audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768.0
    segs, info = model.transcribe(
        audio, language="en", beam_size=5, word_timestamps=True,
        initial_prompt=FILLER_PROMPT, condition_on_previous_text=False,
        vad_filter=True, vad_parameters=dict(min_silence_duration_ms=500, speech_pad_ms=200),
    )
    words, segments = [], []
    for s in segs:
        sw = [{"word": w.word.strip(), "start": round(w.start + a.offset, 3),
               "end": round(w.end + a.offset, 3), "prob": round(w.probability, 3),
               "speaker": a.speaker} for w in (s.words or [])]
        words += sw
        segments.append({"start": round(s.start + a.offset, 3), "end": round(s.end + a.offset, 3),
                         "speaker": a.speaker, "text": s.text.strip(), "words": sw})
        print(f"[{s.end + a.offset:8.1f}s] {s.text.strip()[:80]}", flush=True)
    os.makedirs(os.path.dirname(os.path.abspath(a.output)), exist_ok=True)
    with open(a.output, "w") as f:
        json.dump({"speaker": a.speaker, "offset": a.offset, "model": a.model,
                   "seconds": round(time.time() - t0, 1), "segments": segments,
                   "words": words}, f)
    print(f"done: {len(words)} words in {time.time() - t0:.0f}s -> {a.output}")


if __name__ == "__main__":
    main()
