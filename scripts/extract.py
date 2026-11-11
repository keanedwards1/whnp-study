#!/usr/bin/env python3
"""Extract the "Disorder Tables" Google Doc into app data.

Input:  scripts/raw/doc.json  (Google Docs API `documents.get` response, as
        returned by the Google Docs `read_doc` tool; may be wrapped in {"content": ...})
Output: data/disorders.json   structured data used by the app
        data/disorders.md     human/LLM-readable markdown version
        public/images/*       images embedded in table cells

Text is copied VERBATIM from the doc: no spelling, medical, or formatting
corrections. Only leading/trailing whitespace per cell is trimmed and runs of
blank lines are collapsed to one.

Usage:  python3 -I scripts/extract.py [--no-images]
"""
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "raw" / "doc.json"
OUT_JSON = ROOT / "data" / "disorders.json"
OUT_MD = ROOT / "data" / "disorders.md"
IMG_DIR = ROOT / "public" / "images"


def slug(s: str, maxlen: int = 40) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s[:maxlen].rstrip("-") or "x"


def para_text(p: dict) -> tuple[str, list[str]]:
    """Return (text, inline image ids) for one paragraph."""
    parts, imgs = [], []
    for el in p.get("elements", []):
        if "textRun" in el:
            parts.append(el["textRun"].get("content", ""))
        elif "inlineObjectElement" in el:
            imgs.append(el["inlineObjectElement"]["inlineObjectId"])
    text = "".join(parts).replace("\u000b", "\n").rstrip("\n")
    if p.get("bullet") and text.strip():
        text = "• " + text
    return text, imgs


def cell_content(cell: dict) -> tuple[str, list[str]]:
    lines, imgs = [], []
    for ce in cell.get("content", []):
        if "paragraph" in ce:
            t, i = para_text(ce["paragraph"])
            lines.append(t)
            imgs.extend(i)
        elif "table" in ce:  # not present in this doc, but don't drop text silently
            for r in ce["table"]["tableRows"]:
                for c in r["tableCells"]:
                    t, i = cell_content(c)
                    lines.append(t)
                    imgs.extend(i)
    text = "\n".join(lines).strip()
    text = re.sub(r"\n[ \t]*\n(?:[ \t]*\n)+", "\n\n", text)  # collapse blank-line runs
    return text, imgs


def sniff_ext(b: bytes) -> str:
    if b[:3] == b"\xff\xd8\xff":
        return "jpg"
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if b[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "webp"
    raise ValueError("unrecognized image type")


def main() -> None:
    download = "--no-images" not in sys.argv
    raw = json.loads(RAW.read_text())
    doc = raw.get("content", raw)
    tab = doc["tabs"][0]["documentTab"]
    body = tab["body"]["content"]
    inline = tab.get("inlineObjects", {})

    sections, pending_title, pending_notes = [], None, []
    seen_sec, img_jobs = set(), []

    def new_section(title: str, notes: list[str]) -> dict:
        sid = slug(title)
        while sid in seen_sec:
            sid += "-2"
        seen_sec.add(sid)
        return {"id": sid, "title": title, "columns": [], "notes": notes, "rows": [], "empty": False}

    for el in body:
        if "paragraph" in el:
            p = el["paragraph"]
            text, _ = para_text(p)
            text = text.strip()
            if not text:
                continue
            style = p.get("paragraphStyle", {}).get("namedStyleType", "")
            if style.startswith("HEADING") or pending_title is None:
                if pending_title is not None:  # heading with no table after it
                    s = new_section(pending_title, pending_notes)
                    s["empty"] = True
                    sections.append(s)
                pending_title, pending_notes = text, []
            else:
                pending_notes.append(text)
        elif "table" in el:
            title = pending_title or "Untitled"
            sec = new_section(title, pending_notes)
            pending_title, pending_notes = None, []
            trs = el["table"]["tableRows"]
            header = [cell_content(c)[0] for c in trs[0]["tableCells"]]
            cols, used = [], set()
            for i, h in enumerate(header):
                h = h or f"Column {i + 1}"
                while h in used:
                    h += " (2)"
                used.add(h)
                cols.append(h)
            sec["columns"] = cols
            row_ids = set()
            for tr in trs[1:]:
                cells, images = {}, []
                for ci, c in enumerate(tr["tableCells"]):
                    t, ids = cell_content(c)
                    cells[cols[ci]] = t
                    for oid in ids:
                        images.append((oid, cols[ci]))
                condition = cells[cols[0]]
                cond_label = condition.split("\n")[0]
                rid = f"{sec['id']}--{slug(cond_label)}"
                while rid in row_ids:
                    rid += "-2"
                row_ids.add(rid)
                row = {"id": rid, "condition": condition, "cells": cells, "images": []}
                for n, (oid, col) in enumerate(images, 1):
                    emb = inline[oid]["inlineObjectProperties"]["embeddedObject"]
                    base = f"{sec['id']}-{slug(cond_label, 30)}-{n}"
                    ref = {"file": base, "alt": emb.get("description") or "", "column": col}
                    row["images"].append(ref)
                    img_jobs.append((ref, emb["imageProperties"]["contentUri"]))
                sec["rows"].append(row)
            sections.append(sec)
    if pending_title is not None:
        s = new_section(pending_title, pending_notes)
        s["empty"] = True
        sections.append(s)

    # images
    if download:
        IMG_DIR.mkdir(parents=True, exist_ok=True)
        for ref, uri in img_jobs:
            existing = sorted(IMG_DIR.glob(ref["file"] + ".*"))
            if existing:  # already downloaded on a previous run
                ref["file"] = f"/images/{existing[0].name}"
                continue
            # curl uses the system trust store (python.org builds often lack CA certs)
            b = subprocess.run(["curl", "-sSfL", "--retry", "5", "--retry-all-errors",
                                "--retry-delay", "2", "--max-time", "60", uri],
                               check=True, capture_output=True).stdout
            name = f"{ref['file']}.{sniff_ext(b)}"
            (IMG_DIR / name).write_bytes(b)
            ref["file"] = f"/images/{name}"
    else:
        for ref, _ in img_jobs:
            existing = sorted(IMG_DIR.glob(ref["file"] + ".*"))
            ref["file"] = f"/images/{existing[0].name}" if existing else ""

    out = {
        "source": {
            "title": doc.get("title"),
            "documentId": doc.get("documentId"),
            "revisionId": doc.get("revisionId"),
            "extractedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "sections": sections,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")

    # markdown
    def md_cell(s: str) -> str:
        return s.replace("|", "\\|").replace("\n", "<br>")

    md = [f"# {doc.get('title')}", "",
          "Verbatim export of the source Google Doc. Do not correct content.", ""]
    for s in sections:
        md += [f"## {s['title']}", ""]
        if s["empty"]:
            md += ["_(No content in source document.)_", ""]
        for n in s["notes"]:
            md += [n, ""]
        if s["columns"]:
            md.append("| " + " | ".join(md_cell(c) for c in s["columns"]) + " |")
            md.append("|" + "---|" * len(s["columns"]))
            for r in s["rows"]:
                md.append("| " + " | ".join(md_cell(r["cells"][c]) for c in s["columns"]) + " |")
            md.append("")
            for r in s["rows"]:
                for im in r["images"]:
                    md.append(f"- Image for **{r['condition'].splitlines()[0]}** ({im['column']}): `{im['file']}` — {im['alt']}")
            md.append("")
    OUT_MD.write_text("\n".join(md))

    n_tables = sum(1 for s in sections if s["columns"])
    n_rows = sum(len(s["rows"]) for s in sections)
    n_imgs = sum(len(r["images"]) for s in sections for r in s["rows"])
    empty = [s["title"] for s in sections if s["empty"]]
    print(f"sections={len(sections)} tables={n_tables} rows={n_rows} images={n_imgs} empty={empty}")


if __name__ == "__main__":
    main()
