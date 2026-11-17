# First Gambit

A chess school for your very first move: learn the basics, play against an AI, and ask a coach why.

넷플릭스 〈퀸스 갬빗〉을 보고 체스를 배우고 싶어진 사람을 위한 체스 학습 웹사이트입니다.

## What is here

- **Intro**: a wordless 3D loading scene. Six black lacquer pieces (pawn, knight, queen, king, bishop, rook) rise from a white studio floor one by one, a slow key light swings their shadows round, then the king alone is framed and night falls over it.
- **Landing**: a black-and-white editorial cover. A white king stands on the horizon over its black reflection, with *First* above the line and *Gambit* below it.
- **Scroll scene**: scroll down and the black and white pieces appear in the air, tumble, and land on a marble board in the starting position; the last stretch of scroll plays the Queen’s Gambit (1. d4 d5 2. c4).

Click anywhere or press any key to skip the intro. Click the *First Gambit* logo to play it again.

## Files

| Path | What it does |
| --- | --- |
| `index.html` | Page markup and the flat king used on the landing |
| `css/style.css` | All styles, including the phone layout below 900px |
| `js/pieces.js` | Build data for the 3D pieces (lathe profiles, knight head and king cross outlines, rook battlements) |
| `js/engine.js` | Shared WebGL2 renderer: piece and board geometry, black and white lacquer, marble squares, studio lighting, soft shadows, floor reflections |
| `js/intro.js` | The intro timeline and the hand-over to the landing |
| `js/board.js` | The scroll scene: each piece's flight, spin and landing, driven by scroll position |

No build step and no libraries: open `index.html` in a browser, or serve the folder with GitHub Pages. Fonts (Bodoni Moda, Jost) load from Google Fonts. Browsers without WebGL2, or with reduced motion turned on, skip straight to the landing.
