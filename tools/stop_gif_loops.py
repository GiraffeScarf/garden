#!/usr/bin/env python3
"""Make *-active.gif previews play once, using the existing image data unchanged.

Run after putting back assets/images/portfolio/: python tools/stop_gif_loops.py
Makes a .gif.looping-backup copy before changing each file. Useful when opening
index.html with file:// where browsers block JavaScript from fetching GIF bytes.
No third-party modules are needed; image frames and delays stay exactly intact.
"""
from pathlib import Path
import shutil


def skip_subblocks(data: bytes, pos: int) -> int:
    while pos < len(data):
        length = data[pos]
        pos += 1
        if length == 0:
            return pos
        pos += length
        if pos > len(data):
            raise ValueError("Truncated GIF sub-block")
    raise ValueError("Unterminated GIF sub-block")


def remove_loop_extensions(data: bytes) -> tuple[bytes, int]:
    if len(data) < 13 or data[:6] not in (b"GIF87a", b"GIF89a"):
        raise ValueError("Not a valid GIF")
    pos = 13
    if data[10] & 0x80:  # Global colour table
        pos += 3 * (2 ** ((data[10] & 7) + 1))
    kept = [data[:pos]]
    removed = 0
    while pos < len(data):
        start = pos
        marker = data[pos]
        pos += 1
        if marker == 0x3B:  # GIF trailer
            kept.append(data[start:])
            return b"".join(kept), removed
        elif marker == 0x21:  # Extension
            if pos >= len(data):
                raise ValueError("Truncated extension")
            label = data[pos]
            pos += 1
            if label == 0xFF:  # Application extension
                header_len = data[pos]
                pos += 1
                application = data[pos:pos + header_len]
                pos += header_len
                pos = skip_subblocks(data, pos)
                if application in (b"NETSCAPE2.0", b"ANIMEXTS1.0"):
                    removed += 1
                    continue
            else:
                pos = skip_subblocks(data, pos)
        elif marker == 0x2C:  # Image block
            if pos + 9 > len(data):
                raise ValueError("Truncated image descriptor")
            packed = data[pos + 8]
            pos += 9
            if packed & 0x80:
                pos += 3 * (2 ** ((packed & 7) + 1))
            pos += 1  # LZW minimum code size
            pos = skip_subblocks(data, pos)
        else:
            raise ValueError(f"Unexpected GIF block 0x{marker:02x} at offset {start}")
        kept.append(data[start:pos])
    raise ValueError("Missing GIF trailer")


def main():
    folder = Path(__file__).resolve().parent.parent / "assets" / "images" / "portfolio"
    if not folder.exists():
        print(f"Image folder not found: {folder}\nRestore your original images first.")
        return
    gifs = list(folder.rglob("*-active.gif"))
    if not gifs:
        print("No *-active.gif previews found. Restore your portfolio GIFs first.")
        return
    count = 0
    for gif in gifs:
        data = gif.read_bytes()
        try:
            edited, removed = remove_loop_extensions(data)
        except ValueError as exc:
            print(f"Skipped {gif.name}: {exc}")
            continue
        if not removed:
            print(f"Already one-shot: {gif.name}")
            continue
        backup = gif.with_suffix('.gif.looping-backup')
        if not backup.exists():
            shutil.copy2(gif, backup)
        gif.write_bytes(edited)
        count += 1
        print(f"Fixed {gif.name}: removed {removed} loop extension(s), retained original frames")
    print(f"Finished. {count} GIF(s) changed. Originals backed up beside them.")


if __name__ == '__main__':
    main()
