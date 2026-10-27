import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

def create_neobrutalist_icon(size: int = 1024) -> Image.Image:
    # High-resolution supersampled drawing canvas
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    scale = size / 512.0
    def s(v): return int(round(v * scale))

    # Colors
    c_black = (0, 0, 0, 255)
    c_yellow = (253, 224, 71, 255)     # #FDE047 Cyber Yellow
    c_pink = (255, 79, 135, 255)       # #FF4F87 Hot Neon Pink
    c_white = (255, 255, 255, 255)
    c_cyan = (56, 189, 248, 255)       # #38BDF8 Sky Cyan
    c_lime = (163, 230, 53, 255)       # #A3E635 Acid Lime
    c_dark = (24, 24, 27, 255)         # #18181B Zinc 900

    card_x = s(40)
    card_y = s(40)
    card_w = s(432)
    card_h = s(432)
    card_r = s(48)
    shadow_offset = s(18)

    # 1. Hard pitch-black Neo-Brutalist shadow
    draw.rounded_rectangle(
        [card_x + shadow_offset, card_y + shadow_offset, card_x + card_w + shadow_offset, card_y + card_h + shadow_offset],
        radius=card_r, fill=c_black
    )

    # 2. Main card body base
    # Create mask for rounded card
    card_mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(card_mask)
    mask_draw.rounded_rectangle([card_x, card_y, card_x + card_w, card_y + card_h], radius=card_r, fill=255)

    card_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    card_draw = ImageDraw.Draw(card_layer)

    # Top half: Yellow
    card_draw.rectangle([card_x, card_y, card_x + card_w, card_y + s(240)], fill=c_yellow)
    # Bottom half: Hot Pink
    card_draw.rectangle([card_x, card_y + s(240), card_x + card_w, card_y + card_h], fill=c_pink)
    # Heavy dividing line
    card_draw.line([(card_x, card_y + s(240)), (card_x + card_w, card_y + s(240))], fill=c_black, width=s(14))

    # Mask card content
    img.paste(card_layer, (0, 0), card_mask)

    # 3. Outer heavy black border
    draw.rounded_rectangle([card_x, card_y, card_x + card_w, card_y + card_h], radius=card_r, outline=c_black, width=s(16))

    # 4. Top Header Label Bar (White badge with black border & hard shadow)
    lbl_x = s(72)
    lbl_y = s(68)
    lbl_w = s(368)
    lbl_h = s(50)
    lbl_sh = s(8)
    draw.rounded_rectangle([lbl_x + lbl_sh, lbl_y + lbl_sh, lbl_x + lbl_w + lbl_sh, lbl_y + lbl_h + lbl_sh], radius=s(12), fill=c_black)
    draw.rounded_rectangle([lbl_x, lbl_y, lbl_x + lbl_w, lbl_y + lbl_h], radius=s(12), fill=c_white, outline=c_black, width=s(8))

    # Color dots inside label
    draw.rounded_rectangle([lbl_x + s(14), lbl_y + s(12), lbl_x + s(40), lbl_y + s(38)], radius=s(6), fill=c_cyan, outline=c_black, width=s(4))
    draw.rounded_rectangle([lbl_x + s(48), lbl_y + s(12), lbl_x + s(74), lbl_y + s(38)], radius=s(6), fill=c_lime, outline=c_black, width=s(4))
    draw.rounded_rectangle([lbl_x + s(82), lbl_y + s(12), lbl_x + s(108), lbl_y + s(38)], radius=s(6), fill=c_pink, outline=c_black, width=s(4))

    # Label text: MISTUS AV
    try:
        font_large = ImageFont.truetype("arialbd.ttf", s(22))
        font_small = ImageFont.truetype("courbd.ttf", s(14))
    except Exception:
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()

    draw.text((lbl_x + s(126), lbl_y + s(13)), "MISTUS AV", fill=c_black, font=font_large)

    # Tag: LOOP
    tag_x = lbl_x + s(285)
    draw.rounded_rectangle([tag_x, lbl_y + s(10), tag_x + s(68), lbl_y + s(40)], radius=s(6), fill=c_yellow, outline=c_black, width=s(4))
    draw.text((tag_x + s(10), lbl_y + s(14)), "LOOP", fill=c_black, font=font_small)

    # 5. Middle Cassette Bridge Deck
    cas_x = s(76)
    cas_y = s(136)
    cas_w = s(360)
    cas_h = s(120)
    draw.rounded_rectangle([cas_x + s(8), cas_y + s(8), cas_x + cas_w + s(8), cas_y + cas_h + s(8)], radius=s(20), fill=c_black)
    draw.rounded_rectangle([cas_x, cas_y, cas_x + cas_w, cas_y + cas_h], radius=s(20), fill=c_dark, outline=c_black, width=s(10))

    # Center tape window
    win_x = s(186)
    win_y = s(156)
    win_w = s(140)
    win_h = s(80)
    draw.rounded_rectangle([win_x, win_y, win_x + win_w, win_y + win_h], radius=s(10), fill=c_cyan, outline=c_black, width=s(7))

    # Fast play symbol inside window
    tri_x = s(244)
    tri_y = s(166)
    draw.polygon([(tri_x + s(6), tri_y + s(6)), (tri_x + s(6), tri_y + s(54)), (tri_x + s(48), tri_y + s(30))], fill=c_black)
    draw.polygon([(tri_x, tri_y), (tri_x, tri_y + s(48)), (tri_x + s(42), tri_y + s(24))], fill=c_yellow)
    draw.polygon([(tri_x, tri_y), (tri_x, tri_y + s(48)), (tri_x + s(42), tri_y + s(24))], outline=c_black, width=s(6))

    # Left Spool / Reel (Audio)
    spool_l_x = s(140)
    spool_l_y = s(196)
    r_outer = s(46)
    r_inner = s(18)
    draw.ellipse([spool_l_x - r_outer + s(6), spool_l_y - r_outer + s(6), spool_l_x + r_outer + s(6), spool_l_y + r_outer + s(6)], fill=c_black)
    draw.ellipse([spool_l_x - r_outer, spool_l_y - r_outer, spool_l_x + r_outer, spool_l_y + r_outer], fill=c_white, outline=c_black, width=s(9))
    draw.ellipse([spool_l_x - s(32), spool_l_y - s(32), spool_l_x + s(32), spool_l_y + s(32)], outline=c_black, width=s(5))
    draw.ellipse([spool_l_x - r_inner, spool_l_y - r_inner, spool_l_x + r_inner, spool_l_y + r_inner], fill=c_yellow, outline=c_black, width=s(6))
    draw.ellipse([spool_l_x - s(6), spool_l_y - s(6), spool_l_x + s(6), spool_l_y + s(6)], fill=c_black)

    # Right Spool / Reel (Video)
    spool_r_x = s(372)
    spool_r_y = s(196)
    draw.ellipse([spool_r_x - r_outer + s(6), spool_r_y - r_outer + s(6), spool_r_x + r_outer + s(6), spool_r_y + r_outer + s(6)], fill=c_black)
    draw.ellipse([spool_r_x - r_outer, spool_r_y - r_outer, spool_r_x + r_outer, spool_r_y + r_outer], fill=c_white, outline=c_black, width=s(9))
    draw.ellipse([spool_r_x - s(32), spool_r_y - s(32), spool_r_x + s(32), spool_r_y + s(32)], outline=c_black, width=s(5))
    draw.ellipse([spool_r_x - r_inner, spool_r_y - r_inner, spool_r_x + r_inner, spool_r_y + r_inner], fill=c_lime, outline=c_black, width=s(6))
    draw.ellipse([spool_r_x - s(6), spool_r_y - s(6), spool_r_x + s(6), spool_r_y + s(6)], fill=c_black)

    # 6. Lower Left Card: Equalizer Audio Waves
    b1_x = s(76)
    b1_y = s(296)
    b1_w = s(166)
    b1_h = s(124)
    draw.rounded_rectangle([b1_x + s(8), b1_y + s(8), b1_x + b1_w + s(8), b1_y + b1_h + s(8)], radius=s(16), fill=c_black)
    draw.rounded_rectangle([b1_x, b1_y, b1_x + b1_w, b1_y + b1_h], radius=s(16), fill=c_white, outline=c_black, width=s(9))
    draw.text((b1_x + s(14), b1_y + s(12)), "AUDIO", fill=c_black, font=font_small)

    bars = [
        (s(18), s(40), c_lime),
        (s(40), s(70), c_lime),
        (s(62), s(92), c_yellow),
        (s(84), s(60), c_cyan),
        (s(106), s(82), c_lime),
        (s(128), s(50), c_lime),
    ]
    for bx, bh, bcol in bars:
        bar_bottom = b1_y + b1_h - s(14)
        draw.rounded_rectangle([b1_x + bx, bar_bottom - bh, b1_x + bx + s(14), bar_bottom], radius=s(4), fill=bcol, outline=c_black, width=s(4))

    # 7. Lower Right Card: Video Filmstrip
    b2_x = s(270)
    b2_y = s(296)
    b2_w = s(166)
    b2_h = s(124)
    draw.rounded_rectangle([b2_x + s(8), b2_y + s(8), b2_x + b2_w + s(8), b2_y + b2_h + s(8)], radius=s(16), fill=c_black)
    draw.rounded_rectangle([b2_x, b2_y, b2_x + b2_w, b2_y + b2_h], radius=s(16), fill=c_white, outline=c_black, width=s(9))
    draw.text((b2_x + s(14), b2_y + s(12)), "VIDEO", fill=c_black, font=font_small)

    # Film monitor
    mon_x = b2_x + s(14)
    mon_y = b2_y + s(38)
    mon_w = b2_w - s(28)
    mon_h = s(72)
    draw.rounded_rectangle([mon_x, mon_y, mon_x + mon_w, mon_y + mon_h], radius=s(8), fill=c_dark, outline=c_black, width=s(6))

    # Film sprockets top & bottom
    for i in range(7):
        sp_x = mon_x + s(6) + i * s(18)
        draw.rectangle([sp_x, mon_y + s(4), sp_x + s(10), mon_y + s(12)], fill=c_white)
        draw.rectangle([sp_x, mon_y + mon_h - s(12), sp_x + s(10), mon_y + mon_h - s(4)], fill=c_white)

    # Center mini play inside film
    draw.polygon([(mon_x + s(60), mon_y + s(26)), (mon_x + s(60), mon_y + s(46)), (mon_x + s(78), mon_y + s(36))], fill=c_cyan, outline=c_white, width=s(3))

    # 8. Center Looping Badge (Intersecting Infinity Loop)
    c_x = s(256)
    c_y = s(358)
    c_r = s(38)
    draw.ellipse([c_x - c_r + s(8), c_y - c_r + s(8), c_x + c_r + s(8), c_y + c_r + s(8)], fill=c_black)
    draw.ellipse([c_x - c_r, c_y - c_r, c_x + c_r, c_y + c_r], fill=c_yellow, outline=c_black, width=s(9))
    # Two curved loop arrows forming repeat loop
    draw.arc([c_x - s(24), c_y - s(24), c_x + s(24), c_y + s(24)], start=20, end=160, fill=c_black, width=s(6))
    draw.polygon([(c_x - s(14), c_y + s(18)), (c_x - s(26), c_y + s(24)), (c_x - s(24), c_y + s(12))], fill=c_black)

    draw.arc([c_x - s(24), c_y - s(24), c_x + s(24), c_y + s(24)], start=200, end=340, fill=c_black, width=s(6))
    draw.polygon([(c_x + s(14), c_y - s(18)), (c_x + s(26), c_y - s(24)), (c_x + s(24), c_y - s(12))], fill=c_black)

    return img

if __name__ == "__main__":
    out_dir = Path("public")
    out_dir.mkdir(exist_ok=True)

    img_1024 = create_neobrutalist_icon(1024)

    # 512x512 PNG
    img_512 = img_1024.resize((512, 512), Image.Resampling.LANCZOS)
    img_512.save(out_dir / "icon-512.png", "PNG")
    print("Saved public/icon-512.png")

    # Multi-resolution ICO (16, 32, 48, 64, 128, 256)
    img_512.save(out_dir / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("Saved public/favicon.ico")

    # Also save artifact preview
    artifact_preview = Path("public/icon-preview.png")
    img_512.save(artifact_preview, "PNG")
