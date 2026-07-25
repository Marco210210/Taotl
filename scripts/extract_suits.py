#!/usr/bin/env python3
"""Estrae i cinque semi centrali dagli assi fotografati, senza alterarne le proporzioni."""

from __future__ import annotations

import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "semi_img"
OUTPUT_DIR = ROOT / "assets" / "design"

SOURCES = {
    "heart": SOURCE_DIR / "WhatsApp Image 2026-07-25 at 13.15.56.jpeg",
    "club": SOURCE_DIR / "WhatsApp Image 2026-07-25 at 13.15.56 (1).jpeg",
    "mask": SOURCE_DIR / "WhatsApp Image 2026-07-25 at 13.15.56 (2).jpeg",
    "spear": SOURCE_DIR / "WhatsApp Image 2026-07-25 at 13.15.56 (3).jpeg",
    "diamond": SOURCE_DIR / "WhatsApp Image 2026-07-25 at 13.24.00.jpeg",
}

COLORS = {
    "heart": "#cf3545",
    "diamond": "#cf3545",
    "club": "#17181d",
    "spear": "#17181d",
}


def clean_binary(mask: np.ndarray) -> np.ndarray:
    height, width = mask.shape
    kernel_size = max(3, (min(height, width) // 180) | 1)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    cleaned = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel, iterations=1)
    return cv2.medianBlur(cleaned, 5)


def largest_center_component(mask: np.ndarray, fill_holes: bool = True) -> np.ndarray:
    count, labels, stats, centroids = cv2.connectedComponentsWithStats(mask)
    height, width = mask.shape
    candidates: list[tuple[float, int]] = []
    for index in range(1, count):
        x, y, component_width, component_height, area = stats[index]
        center_x, center_y = centroids[index]
        if area < height * width * 0.002:
            continue
        distance = np.hypot((center_x - width / 2) / width, (center_y - height / 2) / height)
        score = area * max(0.25, 1.0 - distance)
        candidates.append((score, index))
    if not candidates:
        raise RuntimeError("nessun simbolo centrale riconosciuto")
    selected = max(candidates)[1]
    component = np.where(labels == selected, 255, 0).astype(np.uint8)

    if not fill_holes:
        return component

    # La sagoma deve restare piena: elimina i piccoli vuoti causati dalla trama della stampa.
    contours, _ = cv2.findContours(component, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    filled = np.zeros_like(component)
    cv2.drawContours(filled, contours, -1, 255, thickness=cv2.FILLED)
    return filled


def foreground_mask(image: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]
    return np.where((saturation > 72) | (value < 125), 255, 0).astype(np.uint8)


def padded_bbox(mask: np.ndarray, padding_ratio: float = 0.035) -> tuple[int, int, int, int]:
    points = cv2.findNonZero(mask)
    if points is None:
        raise RuntimeError("maschera vuota")
    x, y, width, height = cv2.boundingRect(points)
    padding = max(8, round(max(width, height) * padding_ratio))
    return (
        max(0, x - padding),
        max(0, y - padding),
        min(mask.shape[1], x + width + padding),
        min(mask.shape[0], y + height + padding),
    )


def trace_mask(mask: np.ndarray) -> tuple[str, list[str]]:
    with tempfile.TemporaryDirectory(prefix="taotl-suit-") as directory:
        bitmap = Path(directory) / "mask.pbm"
        traced = Path(directory) / "trace.svg"
        if not cv2.imwrite(str(bitmap), mask):
            raise RuntimeError("impossibile creare la maschera temporanea")
        subprocess.run(
            [
                "potrace",
                str(bitmap),
                "--svg",
                "--invert",
                "--output",
                str(traced),
                "--turdsize",
                "8",
                "--alphamax",
                "1.2",
                "--opttolerance",
                "0.04",
                "--unit",
                "10",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        root = ET.parse(traced).getroot()
        namespace = {"svg": "http://www.w3.org/2000/svg"}
        group = root.find("svg:g", namespace)
        if group is None:
            raise RuntimeError("potrace non ha prodotto una sagoma")
        paths = [path.attrib["d"] for path in group.findall("svg:path", namespace) if path.attrib.get("d")]
        return group.attrib.get("transform", ""), paths


def svg_document(name: str, layers: list[tuple[str, np.ndarray]]) -> str:
    height, width = layers[0][1].shape
    output = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMid meet" role="img">'
        ),
        f"<title>Seme {name} originale Taotl</title>",
    ]
    for color, mask in layers:
        transform, paths = trace_mask(mask)
        output.append(f'<g transform="{transform}" fill="{color}" stroke="none">')
        output.extend(f'<path d="{path}"/>' for path in paths)
        output.append("</g>")
    output.append("</svg>")
    return "\n".join(output) + "\n"


def extract_simple(name: str, image: np.ndarray) -> str:
    cleaned = clean_binary(foreground_mask(image))
    # La lancia contiene una lunga fessura bianca intenzionale, che non va riempita.
    central = largest_center_component(cleaned, fill_holes=name != "spear")
    x1, y1, x2, y2 = padded_bbox(central)
    crop = central[y1:y2, x1:x2]
    return svg_document(name, [(COLORS[name], crop)])


def keep_relevant_components(mask: np.ndarray, minimum_area: int) -> np.ndarray:
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
    output = np.zeros_like(mask)
    for index in range(1, count):
        if stats[index, cv2.CC_STAT_AREA] >= minimum_area:
            output[labels == index] = 255
    return output


def extract_mask(image: np.ndarray) -> str:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]
    hue = hsv[:, :, 0]

    yellow = np.where((saturation > 95) & (hue >= 16) & (hue <= 42) & (value > 105), 255, 0).astype(np.uint8)
    black = np.where(value < 115, 255, 0).astype(np.uint8)
    union = clean_binary(cv2.bitwise_or(yellow, black))
    central = largest_center_component(union)
    x1, y1, x2, y2 = padded_bbox(central)

    yellow_crop = clean_binary(yellow[y1:y2, x1:x2])
    black_crop = clean_binary(black[y1:y2, x1:x2])
    area = yellow_crop.shape[0] * yellow_crop.shape[1]
    yellow_crop = keep_relevant_components(yellow_crop, max(18, area // 4000))
    black_crop = keep_relevant_components(black_crop, max(14, area // 6000))
    return svg_document("mask", [("#e5c51c", yellow_crop), ("#17181d", black_crop)])


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, source in SOURCES.items():
        image = cv2.imread(str(source), cv2.IMREAD_COLOR)
        if image is None:
            raise RuntimeError(f"immagine non leggibile: {source}")
        svg = extract_mask(image) if name == "mask" else extract_simple(name, image)
        destination = OUTPUT_DIR / f"suit-{name}.svg"
        destination.write_text(svg, encoding="utf-8")
        print(f"{source.name} -> {destination.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
