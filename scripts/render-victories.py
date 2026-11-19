"""Render the offline conquest films from Decimal Dungeon's original art (Pillow and ffmpeg)."""
from functools import lru_cache
from math import cos, pi, sin
from pathlib import Path
import random
import subprocess

from PIL import Image, ImageDraw, ImageOps

ASSETS = Path(__file__).resolve().parents[1] / "web/assets"
FILMS = {
    "slime-forest": ("slime", "fern", "hopper"),
    "crystal-cave": ("sprite", "golem", "moth"),
    "forgotten-ruins": ("mimic", "fern", "keeper"),
    "skeleton-keep": ("squire", "wisp", "guardian"),
    "dragon-lair": ("drake", "sprite", "golem"),
    "shadow-castle": ("guardian", "wisp", "keeper"),
}
WIDTH, HEIGHT, FPS = 848, 320, 24
HEROES = ("ranger", "knight", "mage")
GOLD = "#ffda75"
MINT = "#9efae4"


def ease(t):
    t = min(1, max(0, t))
    return t * t * (3 - 2 * t)


@lru_cache(maxsize=None)
def sprite(name, height):
    with Image.open(ASSETS / (name + ".png")) as source:
        return source.convert("RGBA").resize((round(height * source.width / source.height), height),
                                             Image.Resampling.LANCZOS)


def flag(draw, x, y, height, timing, friendly):
    """Two-tone swallowtail standard with a stitched diamond."""
    top = y - height
    w = int(height * .56)
    wave = round(2 * sin(timing * 5 + x / 90))
    draw.line((x + 1, top, x + 1, y), fill="#20293d", width=4)
    draw.line((x, top, x, y), fill="#efc67f", width=2)
    x += 2
    pts = [(x, top+2), (x+w, top+wave+3), (x+w-7, top+11+wave),
           (x+w, top+21+wave), (x, top+19)]
    draw.polygon(pts, fill="#2b736c" if friendly else "#984356", outline="#193044")
    draw.line(pts[:2], fill=GOLD if friendly else "#ffb1a2", width=2)
    draw.polygon([(x+8, top+6), (x+12, top+10), (x+8, top+14), (x+4,top+10)],fill=GOLD)
    draw.rectangle((x-4, top-3, x-1, top),fill=GOLD)


def star(draw, x, y, radius, color):
    draw.line((x-radius,y,x+radius,y),fill=color,width=2)
    draw.line((x,y-radius,x,y+radius),fill=color,width=2)
    draw.rectangle((x-1,y-1,x+1,y+1),fill="#fff8ce")


def render(name, foes):
    backdrop = ImageOps.fit(Image.open(ASSETS / (name + ".webp")).convert("RGB"), (WIDTH, HEIGHT))
    rng = random.Random(113)
    # Mixed ranks fan out as the foreground gets closer to the camera.
    armies = []
    for row in range(4):
        for side, cast in enumerate((HEROES, foes)):
            for col in range(7):
                h = 25 + row * 8 + rng.randint(-2, 2)
                spacing = 29 + row * 5
                dist = 63 + (6-col)*spacing + row*8 + rng.randint(-4,4)
                armies.append((side, row, col, dist, 176+row*40+rng.randint(-4,4),
                               sprite(cast[(row + col // 2) % 3], h), rng.uniform(0,2*pi)))
    armies.sort(key=lambda unit: unit[4])
    sparks = [(rng.uniform(245,605), rng.uniform(62,136), rng.uniform(0,6),
               rng.uniform(-23,23), rng.choice((MINT,GOLD,"#fbaf84","#fbf4c8"))) for _ in range(45)]
    dest = ASSETS / "victories" / (name + ".mp4")
    dest.parent.mkdir(exist_ok=True)
    command = ["ffmpeg","-hide_banner","-loglevel","error","-y","-f","rawvideo","-pixel_format","rgb24",
               "-video_size",f"{WIDTH}x{HEIGHT}","-framerate",str(FPS),"-i","-","-an","-c:v","libx264",
               "-preset","fast","-crf","21","-pix_fmt","yuv420p","-movflags","+faststart",str(dest)]
    with subprocess.Popen(command, stdin=subprocess.PIPE) as video:
        for frame in range(6*FPS):
            t = frame / FPS
            img = backdrop.copy()
            draw = ImageDraw.Draw(img)
            advance = ease((t-.25)/1.95)
            retreat = ease((t-3.3)/1.5)
            for side, row, col, dist, floor, unit, phase in armies:
                direction = 1 if side == 0 else -1
                x = WIDTH/2 - direction*(dist + 65*(1-advance) - 40*advance)
                if side == 1:
                    x += retreat*(WIDTH/2 + dist + 10)
                else:
                    x += ease((t-3.6)/1.4)*(33+8*col)
                y = floor
                # Cadence switches from marching to cheering as the flag goes up.
                jump = (2+row*.6)*abs(sin(t*7+phase))
                if side == 0 and t > 4:
                    jump += 6*max(0,sin(t*7+phase)) * ease(t-4)
                if t < 3.3 or side == 1:
                    x += 2*sin(t*6+phase)
                if x < -50 or x > WIDTH+50:
                    continue
                x, y = round(x), round(y)
                draw.ellipse((x-unit.width*.35, y-4, x+unit.width*.35, y+3),fill="#233530")
                if row in (1,3) and col == 2:
                    flag(draw,x-3,y-3,unit.height+17,t,not side)
                img.paste(unit,(x-unit.width//2,y-unit.height-round(jump)),unit)
            if 1.25 < t < 3.85:
                for i in range(11):
                    portion = (t*1.8 + i*.283) % 1
                    a = 220+(i*33)%142
                    b = 483+(i*19)%121
                    if i % 3 == 0:
                        a, b = b, a
                    start = 176 + (i*27)%96
                    end = start - 6
                    def at(p):
                        return (a+(b-a)*p,start+(end-start)*p-70*sin(pi*p))
                    x,y = at(portion)
                    color = "#ffc080" if i%3 == 0 else MINT
                    draw.line([at(max(0,portion-.07)),(x,y)],fill=color,width=2)
                    if portion > .91:
                        star(draw,x,y,5,color)
                    else:
                        draw.rectangle((x-1,y-1,x+2,y+2),fill="#fffad6")
            if t > 3.9:
                rise = ease((t-3.9)/.8)
                flag(draw,472,236,round(18+95*rise),t,True)
                for x,y,phase,speed,color in sparks:
                    p = (t-4)*1.3-phase*.16
                    if 0 < p < 1.8:
                        xx, yy = x+speed*p, y-30*p+34*p*p
                        if int(phase*9)%5 == 0:
                            star(draw,xx,yy,3,color)
                        else:
                            draw.rectangle((xx,yy,xx+2,yy+3),fill=color)
            video.stdin.write(img.tobytes())
        video.stdin.close()
        if video.wait():
            raise RuntimeError(f"Encoding failed for {name}")
    print(dest.name, flush=True)


if __name__ == "__main__":
    for biome, monsters in FILMS.items():
        render(biome, monsters)
