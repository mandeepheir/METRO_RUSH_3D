cat > README.md <<'EOF'
# METRO RUSH 3D
A 3D endless runner for the browser, built with Three.js. No assets: textures and sound are generated in code.


## Features
- 3-lane running, jump, slide, swipe controls for mobile
- Fair procedural obstacle patterns, moving trains, 4 power-ups
- Endless world built from recycled segments (flat memory use)
- Synthesized music and sound effects (Web Audio API)
- Unlockable characters, XP levels, saved progress (LocalStorage)

## Run locally
`python -m http.server 8000` then open http://localhost:8000

## Stack
HTML5 · CSS3 · JavaScript (ES modules) · Three.js · Web Audio API
EOF
git add . && git commit -m "Add README" && git push
