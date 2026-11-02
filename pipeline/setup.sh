#!/usr/bin/env bash
# One-time setup per machine for the Fringe Lines video pipeline.
# node_modules and the Python venv live OUTSIDE Google Drive so Drive doesn't sync them.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CACHE="$HOME/.cache/fringe-lines-video"

for t in ffmpeg ffprobe node npm jq; do command -v $t >/dev/null || { echo "missing: $t (brew install $t)"; exit 1; }; done

# Python: faster-whisper for word-level transcripts
VENV="$HOME/.shorts-skill"
[ -d "$VENV" ] || python3 -m venv "$VENV"
"$VENV/bin/pip" install --quiet --upgrade pip
"$VENV/bin/pip" install --quiet faster-whisper numpy opencv-python pillow mediapipe yt-dlp
M="$HOME/.cache/fringe-lines-video/models"; mkdir -p "$M"
[ -f "$M/yunet.onnx" ] || curl -sfL -o "$M/yunet.onnx" https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx
[ -f "$M/selfie_multiclass.tflite" ] || curl -sfL -o "$M/selfie_multiclass.tflite" https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite

# Node: install Remotion in the cache dir, symlink into the project
mkdir -p "$CACHE"
cp "$HERE/remotion/package.json" "$CACHE/"
[ -f "$HERE/remotion/package-lock.json" ] && cp "$HERE/remotion/package-lock.json" "$CACHE/"
(cd "$CACHE" && npm install --no-audit --no-fund --silent)
[ -f "$CACHE/package-lock.json" ] && cp "$CACHE/package-lock.json" "$HERE/remotion/"
rm -rf "$HERE/remotion/node_modules"
ln -sfn "$CACHE/node_modules" "$HERE/remotion/node_modules"
echo "pipeline ready: venv=$VENV node_modules=$CACHE/node_modules"
