# Generates the placeholder catalogue illustrations in public/img/items (replace with real photos from the admin).
import os
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "img", "items")
os.makedirs(OUT, exist_ok=True)
INK, TEAL, CORAL, GOLD, CREAM, SKY, LEAF = "#1c2a2b", "#0e4f54", "#ef5b4c", "#f6b32a", "#fff8ee", "#3c8fd9", "#2f9e6e"

def wrap(bg, body, floor="#00000014"):
    confetti = "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" opacity=".55"/>' for x, y, r, c in
                       [(40, 40, 5, GOLD), (360, 54, 4, CORAL), (330, 30, 3, "#fff"), (70, 90, 3, "#fff"), (300, 100, 5, SKY), (24, 140, 3, LEAF)])
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="{bg}"/>{confetti}<ellipse cx="200" cy="262" rx="150" ry="16" fill="{floor}"/>{body}</svg>'

def monobloc(x, y, s=1, c="#fdfdfd", o=INK):
    return f'''<g transform="translate({x} {y}) scale({s})" stroke="{o}" stroke-width="4" stroke-linejoin="round" fill="{c}">
<path d="M-38 -110 Q0 -128 38 -110 L34 -40 L-34 -40 Z"/><path d="M-30 -96 L30 -96 M-28 -80 L28 -80 M-26 -64 L26 -64" fill="none" stroke-width="3" opacity=".35"/>
<path d="M-46 -40 L46 -40 L42 -24 L-42 -24 Z"/><path d="M-40 -24 L-48 40 M40 -24 L48 40 M-30 -24 L-34 34 M30 -24 L34 34" fill="none" stroke-width="6" stroke-linecap="round"/>
<path d="M-40 -24 L-48 40 M40 -24 L48 40" fill="none" stroke="{c}" stroke-width="2" stroke-linecap="round"/></g>'''

def tiffany(x, y, c="#e8c97a"):
    rungs = "".join(f'<line x1="{-28+i*14}" y1="-118" x2="{-28+i*14}" y2="-50" />' for i in range(5))
    return f'''<g transform="translate({x} {y})" stroke="{INK}" stroke-width="4" fill="none" stroke-linecap="round">
<g stroke="{c}" stroke-width="7">{rungs}</g><path d="M-36 -120 Q0 -132 36 -120" stroke="{c}" stroke-width="9"/>
<rect x="-42" y="-50" width="84" height="16" rx="6" fill="#fff" stroke="{INK}"/><path d="M-36 -34 L-42 40 M36 -34 L42 40 M-20 -34 L-22 34 M20 -34 L22 34" stroke="{c}" stroke-width="7"/>
<path d="M-38 6 L38 6" stroke="{c}" stroke-width="5"/></g>'''

def round_table():
    return f'''<g stroke="{INK}" stroke-width="4" stroke-linejoin="round">
<path d="M200 248 L160 258 M200 248 L240 258 M200 168 L200 248" stroke-width="8" stroke-linecap="round" fill="none"/>
<ellipse cx="200" cy="150" rx="128" ry="34" fill="#fff"/><path d="M72 150 Q78 210 120 222 L280 222 Q322 210 328 150" fill="#fff"/>
<ellipse cx="200" cy="150" rx="128" ry="34" fill="#fff"/><path d="M120 222 Q200 236 280 222" fill="none" stroke-width="3" opacity=".4"/>
<g fill="{GOLD}" stroke-width="3"><circle cx="200" cy="140" r="12"/></g><path d="M200 128 l0 -18" stroke="{LEAF}" stroke-width="4"/>
<path d="M188 112 q12 -14 24 0" fill="{CORAL}" stroke-width="3"/></g>'''

def long_table():
    return f'''<g stroke="{INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
<path d="M70 128 L330 128 L350 150 L50 150 Z" fill="#d9a066"/><rect x="50" y="150" width="300" height="14" fill="#b97d45"/>
<path d="M76 164 L68 252 M324 164 L332 252 M100 164 L106 240 M300 164 L294 240" stroke-width="7" fill="none"/>
<path d="M106 200 L294 200" stroke-width="4" opacity=".5"/></g>'''

def table_cloth():
    return f'''<g stroke="{INK}" stroke-width="4" stroke-linejoin="round">
<path d="M60 112 L340 112 L360 132 L40 132 Z" fill="#fff"/><path d="M40 132 L360 132 L370 236 Q340 226 315 238 Q290 226 265 238 Q240 226 215 238 Q190 226 165 238 Q140 226 115 238 Q90 226 65 238 Q48 230 30 236 Z" fill="#fff"/>
<path d="M30 236 Q200 214 370 236" fill="none" stroke="{CORAL}" stroke-width="6" opacity=".9"/>
<path d="M90 140 L84 220 M150 140 L148 226 M250 140 L252 226 M310 140 L316 220" stroke-width="3" opacity=".18" fill="none"/>
<rect x="170" y="80" width="60" height="32" rx="4" fill="{GOLD}" stroke-width="3"/><path d="M185 80 v-12 h30 v12" fill="none" stroke-width="3"/></g>'''

def tent(big=False):
    w = 150 if big else 112
    peaks = 2 if big else 1
    roof = f'M{200-w} 120 ' + "".join(f'L{200-w + (2*w/peaks)*(i+0.5)} {54} L{200-w + (2*w/peaks)*(i+1)} 120 ' for i in range(peaks)) + "Z"
    scallop = "".join(f'<path d="M{200-w + i*2*w/ (8 if big else 6)} 120 q{w/(8 if big else 6)} 22 {2*w/(8 if big else 6)} 0" fill="{CORAL if i%2 else "#fff"}"/>' for i in range(8 if big else 6))
    return f'''<g stroke="{INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
<path d="{roof}" fill="#fff"/>{"".join(f'<path d="M{200-w + (2*w/peaks)*(i+0.5)} 54 L{200-w + (2*w/peaks)*(i+0.5) - 22} 120 M{200-w + (2*w/peaks)*(i+0.5)} 54 L{200-w + (2*w/peaks)*(i+0.5)+22} 120" stroke="{CORAL}" stroke-width="10" fill="none"/>' for i in range(peaks))}
<path d="{roof}" fill="none"/>{scallop}
<path d="M{200-w+6} 120 L{200-w+6} 252 M{200+w-6} 120 L{200+w-6} 252" stroke-width="7"/>{'<path d="M200 120 L200 252" stroke-width="7"/>' if big else ''}
<path d="M{200-w+6} 252 l-24 6 M{200+w-6} 252 l24 6" stroke-width="3" opacity=".5"/></g>'''

def videoke():
    return f'''<g stroke="{INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
<rect x="70" y="70" width="160" height="186" rx="14" fill="{TEAL}"/><circle cx="150" cy="200" r="38" fill="#0a3a3e"/><circle cx="150" cy="200" r="16" fill="{GOLD}"/>
<rect x="88" y="88" width="124" height="70" rx="6" fill="#16232a"/><path d="M100 136 h60 M100 146 h40" stroke="{GOLD}" stroke-width="4"/><path d="M104 104 l10 10 l14 -18 l14 22" stroke="{CORAL}" stroke-width="3" fill="none"/>
<text x="150" y="128" font-family="sans-serif" font-size="13" font-weight="700" fill="#fff" stroke="none" text-anchor="middle">98</text>
<g transform="rotate(-22 290 160)"><rect x="276" y="140" width="28" height="98" rx="12" fill="#fff"/><circle cx="290" cy="128" r="24" fill="#d9dde0"/><path d="M276 120 h28 M276 132 h28" stroke-width="2" opacity=".4"/></g>
<g transform="rotate(16 340 180)"><rect x="328" y="166" width="24" height="84" rx="10" fill="{CORAL}"/><circle cx="340" cy="156" r="20" fill="#d9dde0"/></g>
<path d="M256 60 q8 -10 0 -20 M270 66 q14 -16 0 -32" stroke="{GOLD}" stroke-width="4" fill="none"/>
<path d="M240 40 l0 22 a6 6 0 1 1 -6 -6" stroke="#fff" stroke-width="4" fill="none"/></g>'''

def chafing():
    return f'''<g stroke="{INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
<path d="M90 230 L110 160 M310 230 L290 160 M90 230 h40 M270 230 h40" stroke-width="7" fill="none"/>
<rect x="100" y="150" width="200" height="56" rx="10" fill="#cfd6db"/><path d="M84 150 h232" stroke-width="6"/>
<path d="M104 150 Q110 70 200 66 Q290 70 296 150 Z" fill="#e7ecef"/><path d="M130 110 Q160 84 200 82" stroke="#fff" stroke-width="8" fill="none" opacity=".9"/>
<rect x="186" y="50" width="28" height="16" rx="6" fill="{GOLD}"/>
<path d="M170 236 q-10 -16 6 -26 q-2 12 10 16 q2 -10 10 -14 q6 14 -4 24 z" fill="{CORAL}" stroke-width="3"/><rect x="164" y="236" width="44" height="14" rx="4" fill="#5b6770"/>
<path d="M150 44 q8 -10 0 -20 M200 36 q8 -10 0 -20 M250 44 q8 -10 0 -20" stroke="#9fb0ba" stroke-width="4" fill="none"/></g>'''

def bouncy():
    towers = "".join(f'<rect x="{x}" y="70" width="44" height="160" rx="14" fill="{c}"/><circle cx="{x+22}" cy="62" r="20" fill="{GOLD}"/>' for x, c in [(70, CORAL), (286, CORAL)])
    return f'''<g stroke="{INK}" stroke-width="4" stroke-linejoin="round">
<rect x="96" y="120" width="208" height="110" rx="12" fill="{SKY}"/><path d="M96 150 Q200 132 304 150" fill="none" stroke="#fff" stroke-width="4" opacity=".7"/>
<path d="M118 120 v-26 q20 -16 40 0 v26 M178 120 v-34 q22 -18 44 0 v34 M242 120 v-26 q20 -16 40 0 v26" fill="{GOLD}"/>
{towers}<rect x="60" y="226" width="280" height="28" rx="12" fill="{LEAF}"/><path d="M150 180 h100 v46 h-100 z" fill="#fff" opacity=".85"/>
<path d="M180 180 v46 M220 180 v46" stroke-width="3" opacity=".4"/></g>'''

def deco(pastel=False):
    cols = ["#f7c6d4", "#cfe3f7", "#fff1b8", "#d5f0dc", "#e6d6f7"] if pastel else [CORAL, GOLD, SKY, LEAF, "#fff"]
    arch = "".join(f'<circle cx="{200 + 128*__import__("math").cos(__import__("math").pi*(i/16))}" cy="{226 - 150*__import__("math").sin(__import__("math").pi*(i/16))}" r="{20 if i%2 else 17}" fill="{cols[i%5]}"/>' for i in range(17))
    flags = "".join(f'<path d="M{130+i*20} 128 l10 18 l10 -18 z" fill="{cols[i%5]}"/>' for i in range(7))
    label = "BINYAG" if pastel else "HAPPY BIRTHDAY"
    return f'''<g stroke="{INK}" stroke-width="3" stroke-linejoin="round">
<rect x="112" y="104" width="176" height="130" rx="8" fill="{"#fff" if pastel else "#16232a"}"/>{flags}
<text x="200" y="182" font-family="Georgia, serif" font-size="{22 if pastel else 18}" font-weight="700" fill="{TEAL if pastel else GOLD}" stroke="none" text-anchor="middle">{label}</text>
<path d="M150 198 h100" stroke="{CORAL if not pastel else "#e9a5b8"}" stroke-width="4"/>{arch}</g>'''

def generic():
    return f'''<g stroke="{INK}" stroke-width="4" stroke-linejoin="round"><path d="M120 120 L200 84 L280 120 L280 220 L200 256 L120 220 Z" fill="#e8c38f"/>
<path d="M120 120 L200 156 L280 120 M200 156 L200 256" fill="none"/><path d="M160 102 L240 138" stroke="{CORAL}" stroke-width="10"/></g>'''

ART = {
    "monobloc-chair": wrap("#cfe8e6", monobloc(150, 220) + monobloc(250, 226, 1.0, "#ffffff")),
    "tiffany-chair": wrap("#f4e3c8", tiffany(150, 214) + tiffany(255, 222, "#d9b25b")),
    "round-table": wrap("#e5dcf3", round_table()),
    "long-table": wrap("#d8ead9", long_table()),
    "table-cloth": wrap("#fde1dc", table_cloth()),
    "tent-10x10": wrap("#d6e8f7", tent()),
    "tent-20x20": wrap("#cfe1ef", tent(True)),
    "videoke": wrap("#fde7c4", videoke()),
    "chafing-dish": wrap("#f1e6d6", chafing()),
    "bouncy-castle": wrap("#dff1e8", bouncy()),
    "deco-birthday": wrap("#fbd9cf", deco()),
    "deco-pastel": wrap("#f7eef5", deco(True)),
    "generic": wrap("#efe6d8", generic()),
}
for k, v in ART.items():
    with open(os.path.join(OUT, f"{k}.svg"), "w") as f:
        f.write(v)
print("wrote", len(ART))
