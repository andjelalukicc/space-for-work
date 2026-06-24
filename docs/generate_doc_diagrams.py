from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


OUT_DIR = Path(__file__).resolve().parent / "figma-export" / "png"
OUT_DIR.mkdir(parents=True, exist_ok=True)

BG = "#FFFFFF"
INK = "#171827"
MUTED = "#606874"
BORDER = "#B8B5FF"
BOX = "#F1EFFF"
GROUP = "#FFFBEA"
ACCENT = "#1F6689"
ORANGE = "#FF9138"


def font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/DejaVuSans-Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/DejaVuSans.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


TITLE = font(42, True)
H2 = font(28, True)
BODY = font(24)
SMALL = font(19)
TINY = font(16)


def wrap_text(draw, text, fnt, max_width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=fnt) <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_wrapped(draw, xy, text, fnt, fill, max_width, line_gap=6):
    x, y = xy
    for line in wrap_text(draw, text, fnt, max_width):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + line_gap
    return y


def rounded_box(draw, xy, title, body=None, fill=BOX, outline=BORDER, title_fill=INK, width=3):
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=18, fill=fill, outline=outline, width=width)
    draw.text((x1 + 24, y1 + 20), title, font=H2, fill=title_fill)
    if body:
        y = y1 + 62
        for item in body:
            y = draw_wrapped(draw, (x1 + 24, y), item, SMALL, MUTED, x2 - x1 - 48, line_gap=5)
            y += 8


def actor(draw, center, label):
    x, y = center
    draw.ellipse((x - 34, y - 34, x + 34, y + 34), fill="#F7F6FF", outline=BORDER, width=3)
    w = draw.textlength(label, font=BODY)
    draw.text((x - w / 2, y + 48), label, font=BODY, fill=INK)


def arrow(draw, start, end, fill=INK, width=3):
    draw.line((start, end), fill=fill, width=width)
    ex, ey = end
    sx, sy = start
    dx = 1 if ex >= sx else -1
    dy = 1 if ey >= sy else -1
    draw.polygon([(ex, ey), (ex - 16 * dx, ey - 7 * dy), (ex - 7 * dx, ey - 16 * dy)], fill=fill)


def generate_usecase():
    img = Image.new("RGB", (1600, 1800), BG)
    draw = ImageDraw.Draw(img)
    draw.text((90, 70), "Dijagram slucajeva upotrebe", font=TITLE, fill=INK)
    draw.text((90, 128), "Space For Work coworking portal i commerce sistem", font=BODY, fill=MUTED)

    system = (340, 220, 1510, 1650)
    draw.rounded_rectangle(system, radius=28, fill=GROUP, outline="#D7C66B", width=3)
    draw.text((370, 250), "Granica sistema", font=H2, fill=INK)

    actors = {
        "Gost": (170, 360),
        "Korisnik": (170, 690),
        "Admin": (170, 1060),
        "Stripe": (170, 1390),
    }
    for label, pos in actors.items():
        actor(draw, pos, label)

    boxes = {
        "Pregled ponude": (420, 330, 760, 430),
        "Registracija i prijava": (420, 470, 760, 570),
        "Rezervacija prostora": (420, 650, 760, 750),
        "Moje rezervacije": (420, 790, 760, 890),
        "Kupovina paketa": (830, 610, 1170, 710),
        "Stripe Checkout": (830, 750, 1170, 850),
        "Demo potvrda": (830, 890, 1170, 990),
        "Webhook potvrda": (830, 1290, 1170, 1390),
        "Admin korisnici": (420, 1040, 760, 1140),
        "Admin rezervacije": (420, 1180, 760, 1280),
        "Admin katalog": (830, 1040, 1170, 1140),
        "Admin transakcije": (830, 1180, 1170, 1280),
    }
    for label, xy in boxes.items():
        rounded_box(draw, xy, label, fill=BOX if "Admin" not in label else "#F3F7FA")

    # actor to use case links
    arrow(draw, (230, 360), (420, 380), ACCENT)
    arrow(draw, (230, 360), (420, 520), ACCENT)
    arrow(draw, (230, 690), (420, 700), ACCENT)
    arrow(draw, (230, 690), (420, 840), ACCENT)
    arrow(draw, (230, 690), (830, 660), ACCENT)
    arrow(draw, (230, 1060), (420, 1090), ACCENT)
    arrow(draw, (230, 1060), (420, 1230), ACCENT)
    arrow(draw, (230, 1060), (830, 1090), ACCENT)
    arrow(draw, (230, 1060), (830, 1230), ACCENT)
    arrow(draw, (230, 1390), (830, 1340), ORANGE)

    # include/extend style links
    draw.line(((1000, 710), (1000, 750)), fill=MUTED, width=3)
    draw.text((1030, 720), "extend", font=TINY, fill=MUTED)
    draw.line(((1000, 710), (1000, 890)), fill=MUTED, width=3)
    draw.text((1030, 850), "fallback", font=TINY, fill=MUTED)
    arrow(draw, (1170, 800), (1360, 800), ORANGE)
    actor(draw, (1420, 800), "Stripe")
    arrow(draw, (1420, 880), (1170, 1340), ORANGE)
    arrow(draw, (1170, 1340), (1170, 1230), MUTED)
    draw.text((1195, 1278), "placanje vidljivo adminu", font=TINY, fill=MUTED)

    rounded_box(
        draw,
        (420, 1480, 1390, 1588),
        "Kljucni poslovni procesi",
        [
            "Identitet i pristup, katalog usluga, booking, porudzbina i placanje, administracija.",
        ],
        fill="#FFFFFF",
        outline="#DDE5EA",
    )

    img.save(OUT_DIR / "doc-usecase.png", quality=95)


def class_box(draw, xy, name, fields, fill=BOX):
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=16, fill=fill, outline=BORDER, width=3)
    draw.text((x1 + 20, y1 + 16), name, font=H2, fill=INK)
    draw.line((x1, y1 + 58, x2, y1 + 58), fill=BORDER, width=2)
    y = y1 + 76
    for field in fields:
        draw.text((x1 + 20, y), field, font=SMALL, fill=MUTED)
        y += 28


def generate_class():
    img = Image.new("RGB", (1600, 2200), BG)
    draw = ImageDraw.Draw(img)
    draw.text((90, 70), "Dijagram klasa", font=TITLE, fill=INK)
    draw.text((90, 128), "Stalna struktura sistema: korisnici, resursi, rezervacije, porudzbine i placanja", font=BODY, fill=MUTED)

    boxes = {
        "Korisnik": (610, 220, 990, 430, ["id", "imePrezime", "email", "uloga", "status"]),
        "Prostorija": (120, 560, 500, 790, ["id", "naziv", "tip", "kapacitet", "aktivna"]),
        "Rezervacija": (610, 560, 990, 820, ["id", "datum", "pocetak", "kraj", "status", "preklapaSeSa()"]),
        "Obavestenje": (1100, 560, 1480, 790, ["id", "korisnikId", "tip", "poruka", "procitano"]),
        "Proizvod": (120, 1080, 500, 1370, ["id", "slug", "naziv", "kategorija", "cena", "stanje", "aktivan"]),
        "Porudzbina": (610, 1050, 990, 1320, ["id", "userId", "status", "ukupanIznos", "stripeSessionId", "oznaciPlacena()"]),
        "StavkaPorudzbine": (610, 1500, 990, 1740, ["id", "productId", "kolicina", "jedinicnaCena", "iznosStavke"]),
        "PlatnaEvidencija": (1100, 1080, 1480, 1350, ["stripeSessionId", "paymentIntentId", "cardLast4", "paidAt", "kanal"]),
    }
    for name, (x1, y1, x2, y2, fields) in boxes.items():
        class_box(draw, (x1, y1, x2, y2), name, fields, fill="#F1EFFF" if name not in {"Porudzbina", "PlatnaEvidencija"} else "#FFF4EA")

    # Relationships
    arrow(draw, (800, 430), (800, 560), ACCENT)
    draw.text((825, 485), "1 korisnik kreira * rezervacija", font=TINY, fill=MUTED)

    arrow(draw, (500, 675), (610, 675), ACCENT)
    draw.text((505, 638), "1 prostorija ima * rezervacija", font=TINY, fill=MUTED)

    arrow(draw, (990, 680), (1100, 675), ACCENT)
    draw.text((1005, 640), "dogadjaj kreira", font=TINY, fill=MUTED)

    arrow(draw, (800, 430), (800, 1050), ORANGE)
    draw.text((830, 900), "1 korisnik ima * porudzbina", font=TINY, fill=MUTED)

    arrow(draw, (990, 1180), (1100, 1215), ORANGE)
    draw.text((1005, 1150), "0..1 platna evidencija", font=TINY, fill=MUTED)

    arrow(draw, (800, 1320), (800, 1500), ORANGE)
    draw.text((825, 1400), "1 porudzbina agregira 1..* stavki", font=TINY, fill=MUTED)

    arrow(draw, (500, 1225), (610, 1620), ORANGE)
    draw.text((255, 1420), "1 proizvod moze biti u * stavki", font=TINY, fill=MUTED)

    rounded_box(
        draw,
        (120, 1880, 1480, 2060),
        "Napomena za implementaciju",
        [
            "StavkaPorudzbine je asocijativna klasa izmedju Porudzbine i Proizvoda, jer cuva kolicinu i cenu u trenutku kupovine.",
            "PlatnaEvidencija moze biti zasebna tabela ili deo Porudzbine; u ovom projektu se Stripe podaci cuvaju na porudzbini radi jednostavnosti.",
        ],
        fill="#FFFFFF",
        outline="#DDE5EA",
    )

    img.save(OUT_DIR / "doc-class.png", quality=95)


if __name__ == "__main__":
    generate_usecase()
    generate_class()
    print(OUT_DIR / "doc-usecase.png")
    print(OUT_DIR / "doc-class.png")
