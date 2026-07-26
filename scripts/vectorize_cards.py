#!/usr/bin/env python3
"""Raddrizza fotografie di carte e le converte in SVG vettoriali a colori."""

from __future__ import annotations

import argparse
import csv
import html
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

import cv2
import numpy as np


OUTPUT_WIDTH = 844
OUTPUT_HEIGHT = 1440
CARD_ASPECT_RATIO = OUTPUT_WIDTH / OUTPUT_HEIGHT
CORNER_RADIUS = 42


def order_corners(points: np.ndarray) -> np.ndarray:
    points = points.reshape(4, 2).astype(np.float32)
    ordered = np.zeros((4, 2), dtype=np.float32)
    sums = points.sum(axis=1)
    differences = np.diff(points, axis=1).reshape(-1)
    ordered[0] = points[np.argmin(sums)]
    ordered[2] = points[np.argmax(sums)]
    ordered[1] = points[np.argmin(differences)]
    ordered[3] = points[np.argmax(differences)]
    return ordered


def detect_card_corners(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    scale = min(1.0, 1100.0 / max(height, width))
    small = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)

    # La carta è chiara e poco satura rispetto al tavolo di legno.
    mask = cv2.inRange(hsv, np.array([0, 0, 82]), np.array([180, 80, 255]))
    close_size = max(15, int(round(min(small.shape[:2]) * 0.025)) | 1)
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_size, close_size)),
        iterations=2,
    )
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)),
    )

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    image_area = small.shape[0] * small.shape[1]
    center = np.array([small.shape[1] / 2, small.shape[0] / 2])
    candidates: list[tuple[float, np.ndarray]] = []

    for contour in contours:
        area = cv2.contourArea(contour)
        ratio = area / image_area
        if ratio < 0.07 or ratio > 0.72:
            continue
        rotated = cv2.minAreaRect(contour)
        side_a, side_b = rotated[1]
        if min(side_a, side_b) < 1:
            continue
        aspect = max(side_a, side_b) / min(side_a, side_b)
        if not 1.25 <= aspect <= 2.15:
            continue
        rectangularity = area / (side_a * side_b)
        contour_center = np.array(rotated[0])
        center_penalty = np.linalg.norm(contour_center - center) / max(small.shape[:2])
        score = area * max(0.1, rectangularity) * max(0.2, 1.0 - center_penalty)
        candidates.append((score, contour))

    if not candidates:
        # Alcune immagini sono già un ritaglio quasi completo del dorso della carta.
        original_aspect = max(height, width) / min(height, width)
        if 1.45 <= original_aspect <= 2.05:
            inset_x = width * 0.004
            inset_y = height * 0.004
            return np.array(
                [
                    [inset_x, inset_y],
                    [width - 1 - inset_x, inset_y],
                    [width - 1 - inset_x, height - 1 - inset_y],
                    [inset_x, height - 1 - inset_y],
                ],
                dtype=np.float32,
            )
        raise RuntimeError("contorno della carta non riconosciuto")

    contour = max(candidates, key=lambda item: item[0])[1]
    hull = cv2.convexHull(contour)
    perimeter = cv2.arcLength(hull, True)
    polygon = cv2.approxPolyDP(hull, 0.018 * perimeter, True)
    if len(polygon) == 4:
        corners = polygon.reshape(4, 2).astype(np.float32)
    else:
        corners = cv2.boxPoints(cv2.minAreaRect(contour)).astype(np.float32)

    ordered = order_corners(corners / scale)
    top_width = np.linalg.norm(ordered[1] - ordered[0])
    bottom_width = np.linalg.norm(ordered[2] - ordered[3])
    left_height = np.linalg.norm(ordered[3] - ordered[0])
    right_height = np.linalg.norm(ordered[2] - ordered[1])
    detected_ratio = ((top_width + bottom_width) / 2) / ((left_height + right_height) / 2)

    # Se il rilevamento ha incluso una striscia di tavolo, restringe solo i lati
    # usando il rapporto reale ricavato dalla mediana dell'intero mazzo.
    if detected_ratio > CARD_ASPECT_RATIO * 1.06:
        correction = CARD_ASPECT_RATIO / detected_ratio
        top_center = (ordered[0] + ordered[1]) / 2
        bottom_center = (ordered[3] + ordered[2]) / 2
        ordered[0] = top_center + (ordered[0] - top_center) * correction
        ordered[1] = top_center + (ordered[1] - top_center) * correction
        ordered[3] = bottom_center + (ordered[3] - bottom_center) * correction
        ordered[2] = bottom_center + (ordered[2] - bottom_center) * correction

    return ordered


def rectify_card(image: np.ndarray, corners: np.ndarray) -> np.ndarray:
    destination = np.array(
        [
            [0, 0],
            [OUTPUT_WIDTH - 1, 0],
            [OUTPUT_WIDTH - 1, OUTPUT_HEIGHT - 1],
            [0, OUTPUT_HEIGHT - 1],
        ],
        dtype=np.float32,
    )
    matrix = cv2.getPerspectiveTransform(corners, destination)
    rectified = cv2.warpPerspective(
        image,
        matrix,
        (OUTPUT_WIDTH, OUTPUT_HEIGHT),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return cv2.bilateralFilter(rectified, 7, 35, 35)


def border_pixels(image: np.ndarray, thickness: int = 24) -> np.ndarray:
    return np.concatenate(
        [
            image[:thickness].reshape(-1, 3),
            image[-thickness:].reshape(-1, 3),
            image[:, :thickness].reshape(-1, 3),
            image[:, -thickness:].reshape(-1, 3),
        ]
    )


def balance_front_card(image: np.ndarray) -> np.ndarray:
    border = border_pixels(image)
    border_hsv = cv2.cvtColor(border.reshape(-1, 1, 3), cv2.COLOR_BGR2HSV).reshape(-1, 3)
    if float(np.median(border_hsv[:, 1])) >= 48:
        return image

    channel_median = np.maximum(np.median(border, axis=0), 1)
    target = min(238.0, float(np.mean(channel_median)) * 1.12)
    gains = np.clip(target / channel_median, 0.88, 1.28)
    return np.clip(image.astype(np.float32) * gains.reshape(1, 1, 3), 0, 255).astype(np.uint8)


def canonical_color(bgr: np.ndarray) -> str:
    hue, saturation, value = cv2.cvtColor(np.uint8([[bgr]]), cv2.COLOR_BGR2HSV)[0, 0]
    hue, saturation, value = int(hue), int(saturation), int(value)
    if value < 102:
        return "#17181d"
    if saturation < 68 or (value > 168 and saturation < 112):
        return "#f8f8f5"
    if hue <= 9 or hue >= 171:
        return "#cf3545"
    if hue <= 39:
        return "#e5c51c"
    if hue <= 88:
        return "#17784b"
    if hue <= 133:
        return "#276aa5"
    if hue <= 170:
        return "#824d91"
    return "#17181d"


def quantize_card(image: np.ndarray, color_count: int = 10) -> tuple[np.ndarray, list[str]]:
    balanced = balance_front_card(image)
    sample = cv2.resize(
        balanced,
        (OUTPUT_WIDTH // 2, OUTPUT_HEIGHT // 2),
        interpolation=cv2.INTER_AREA,
    )
    pixels = sample.reshape((-1, 3)).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 45, 0.25)
    cv2.setRNGSeed(42)
    _, _, centers = cv2.kmeans(
        pixels,
        color_count,
        None,
        criteria,
        4,
        cv2.KMEANS_PP_CENTERS,
    )

    full = balanced.reshape((-1, 3)).astype(np.float32)
    raw_labels = np.empty(len(full), dtype=np.uint8)
    chunk_size = 80000
    for start in range(0, len(full), chunk_size):
        chunk = full[start : start + chunk_size]
        distances = ((chunk[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
        raw_labels[start : start + chunk_size] = np.argmin(distances, axis=1)
    raw_labels = raw_labels.reshape((OUTPUT_HEIGHT, OUTPUT_WIDTH))

    hsv_image = cv2.cvtColor(balanced, cv2.COLOR_BGR2HSV)
    border = border_pixels(hsv_image)
    border_hue, border_saturation, _ = np.median(border, axis=0)
    if border_saturation > 60:
        background_color = canonical_color(
            cv2.cvtColor(
                np.uint8([[[int(border_hue), max(150, int(border_saturation)), 190]]]),
                cv2.COLOR_HSV2BGR,
            )[0, 0]
        )
        mapped_colors: list[str] = []
        for center in centers:
            center_hue = int(cv2.cvtColor(np.uint8([[center]]), cv2.COLOR_BGR2HSV)[0, 0, 0])
            hue_distance = min(abs(center_hue - border_hue), 180 - abs(center_hue - border_hue))
            mapped_colors.append(background_color if hue_distance <= 12 else "#f8f8f5")
    else:
        mapped_colors = [canonical_color(center.astype(np.uint8)) for center in centers]

    colors: list[str] = []
    color_to_index: dict[str, int] = {}
    labels = np.empty_like(raw_labels)
    for raw_index, color in enumerate(mapped_colors):
        if color not in color_to_index:
            color_to_index[color] = len(colors)
            colors.append(color)
        labels[raw_labels == raw_index] = color_to_index[color]
    return labels, colors


def trace_mask(mask: np.ndarray) -> tuple[str, list[str]]:
    if cv2.countNonZero(mask) < 5:
        return "", []
    with tempfile.TemporaryDirectory(prefix="taotl-potrace-") as directory:
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
                "1",
                "--alphamax",
                "1.15",
                "--opttolerance",
                "0.055",
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
            return "", []
        paths = [
            path.attrib["d"]
            for path in group.findall("svg:path", namespace)
            if path.attrib.get("d")
        ]
        return group.attrib.get("transform", ""), paths


def vectorize(image: np.ndarray, source_name: str) -> str:
    labels, colors = quantize_card(image)
    counts = np.bincount(labels.reshape(-1), minlength=len(colors))
    background_index = int(np.argmax(counts))
    background = colors[background_index]
    layers: list[tuple[int, int, str, str, list[str]]] = []

    for color_index, color in enumerate(colors):
        if color_index == background_index:
            continue
        mask = np.where(labels == color_index, 255, 0).astype(np.uint8)
        mask = cv2.medianBlur(mask, 3)

        # Elimina eventuali strisce di tavolo rimaste fuori dal bordo della carta.
        component_count, component_labels, component_stats, _ = cv2.connectedComponentsWithStats(mask)
        for component_index in range(1, component_count):
            x, y, width, height, area = component_stats[component_index]
            spans_height = y <= 1 and y + height >= OUTPUT_HEIGHT - 1
            spans_width = x <= 1 and x + width >= OUTPUT_WIDTH - 1
            if area > OUTPUT_WIDTH * OUTPUT_HEIGHT * 0.01 and (spans_height or spans_width):
                mask[component_labels == component_index] = 0

        transform, paths = trace_mask(mask)
        if paths:
            red, green, blue = (int(color[index : index + 2], 16) for index in (1, 3, 5))
            luminance = int(0.2126 * red + 0.7152 * green + 0.0722 * blue)
            layers.append((cv2.countNonZero(mask), luminance, color, transform, paths))

    # Campiture grandi per prime, dettagli scuri per ultimi.
    layers.sort(key=lambda layer: (layer[1] < 92, -layer[0]))
    source = html.escape(source_name, quote=True)
    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{OUTPUT_WIDTH}" '
            f'height="{OUTPUT_HEIGHT}" viewBox="0 0 {OUTPUT_WIDTH} {OUTPUT_HEIGHT}" '
            'role="img">'
        ),
        f"<title>{source}</title>",
        "<defs>",
        (
            f'<clipPath id="card"><rect width="{OUTPUT_WIDTH}" height="{OUTPUT_HEIGHT}" '
            f'rx="{CORNER_RADIUS}" ry="{CORNER_RADIUS}"/></clipPath>'
        ),
        "</defs>",
        f'<rect width="{OUTPUT_WIDTH}" height="{OUTPUT_HEIGHT}" rx="{CORNER_RADIUS}" fill="{background}"/>',
        '<g clip-path="url(#card)">',
    ]
    for _, _, color, transform, paths in layers:
        safe_transform = html.escape(transform, quote=True)
        parts.append(f'<g transform="{safe_transform}" fill="{color}" stroke="none">')
        parts.extend(f'<path d="{path}"/>' for path in paths)
        parts.append("</g>")
    parts.extend(
        [
            "</g>",
            (
                f'<rect x="1" y="1" width="{OUTPUT_WIDTH - 2}" height="{OUTPUT_HEIGHT - 2}" '
                f'rx="{CORNER_RADIUS}" fill="none" stroke="#d6d6d0" stroke-width="2"/>'
            ),
            "</svg>",
        ]
    )
    return "\n".join(parts) + "\n"


def convert_file(source: Path, destination: Path, debug_dir: Path | None) -> tuple[str, str]:
    image = cv2.imread(str(source), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError("file immagine non leggibile")
    corners = detect_card_corners(image)
    rectified = rectify_card(image, corners)
    destination.write_text(vectorize(rectified, source.name), encoding="utf-8")
    if debug_dir is not None:
        debug_dir.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(debug_dir / f"{destination.stem}.png"), rectified)
    return source.name, destination.name


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--debug-dir", type=Path)
    args = parser.parse_args()

    sources = sorted(
        path
        for path in args.input_dir.iterdir()
        if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png"}
    )
    if args.limit is not None:
        sources = sources[: args.limit]
    if not sources:
        raise SystemExit("Nessuna immagine trovata.")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    converted: list[tuple[str, str]] = []
    errors: list[tuple[str, str]] = []
    for index, source in enumerate(sources, start=1):
        destination = args.output_dir / f"{source.stem}.svg"
        try:
            converted.append(convert_file(source, destination, args.debug_dir))
            print(f"[{index}/{len(sources)}] OK {source.name}")
        except Exception as error:
            errors.append((source.name, str(error)))
            print(f"[{index}/{len(sources)}] ERRORE {source.name}: {error}")

    with (args.output_dir / "indice.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["originale", "svg"])
        writer.writerows(converted)

    print(f"Convertite: {len(converted)}; errori: {len(errors)}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
