#!/usr/bin/env python3
"""
Generate thumbnails from whole slide images for the slide viewer.
Supports various slide formats via openslide.
"""

import os
import sys
import argparse
from pathlib import Path
from tqdm import tqdm
import numpy as np
from PIL import Image

try:
    import openslide
except ImportError:
    print("Error: openslide-python not installed")
    print("Install with: pip install openslide-python")
    sys.exit(1)


def generate_thumbnail(slide_path, output_path, max_size=(2048, 2048), quality=85):
    """
    Generate a thumbnail from a whole slide image.

    Args:
        slide_path: Path to the whole slide image
        output_path: Path to save the thumbnail
        max_size: Maximum dimensions (width, height)
        quality: JPEG quality (1-100)
    """
    try:
        # Open the slide
        slide = openslide.OpenSlide(slide_path)

        # Get the best level for thumbnail
        # Use level that's closest to desired size
        target_size = max_size[0]
        level = slide.level_count - 1

        for i in range(slide.level_count):
            level_dims = slide.level_dimensions[i]
            if level_dims[0] <= target_size * 2:
                level = i
                break

        # Get the image at the selected level
        level_dims = slide.level_dimensions[level]
        thumbnail = slide.read_region((0, 0), level, level_dims)

        # Convert RGBA to RGB
        thumbnail = thumbnail.convert("RGB")

        # Resize to fit within max_size while maintaining aspect ratio
        thumbnail.thumbnail(max_size, Image.Resampling.LANCZOS)

        # Save the thumbnail
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        thumbnail.save(output_path, "JPEG", quality=quality)

        slide.close()
        return True

    except Exception as e:
        print(f"Error processing {slide_path}: {e}")
        return False


def batch_generate_thumbnails(
    input_dir, output_dir, max_size=(2048, 2048), quality=85, extensions=None
):
    """
    Generate thumbnails for all slides in a directory.

    Args:
        input_dir: Directory containing whole slide images
        output_dir: Directory to save thumbnails
        max_size: Maximum thumbnail dimensions
        quality: JPEG quality
        extensions: List of file extensions to process (default: common slide formats)
    """
    if extensions is None:
        extensions = [".svs", ".tif", ".tiff", ".ndpi", ".vms", ".vmu", ".scn", ".mrxs"]

    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Find all slide files
    slide_files = []
    for ext in extensions:
        slide_files.extend(input_path.rglob(f"*{ext}"))

    print(f"Found {len(slide_files)} slide files")

    # Process each slide
    success_count = 0
    for slide_file in tqdm(slide_files, desc="Generating thumbnails"):
        # Create output filename
        relative_path = slide_file.relative_to(input_path)
        output_file = output_path / relative_path.with_suffix(".jpg")

        # Skip if thumbnail already exists
        if output_file.exists():
            continue

        # Generate thumbnail
        if generate_thumbnail(str(slide_file), str(output_file), max_size, quality):
            success_count += 1

    print(f"\nSuccessfully generated {success_count} thumbnails")


def generate_from_csv(
    csv_path,
    output_dir,
    path_column="FILE_PATH",
    id_column="SAMPLE_ACCESSION",
    max_size=(2048, 2048),
    quality=85,
):
    """
    Generate thumbnails for slides listed in a CSV file.

    Args:
        csv_path: Path to CSV file with slide information
        output_dir: Directory to save thumbnails
        path_column: Name of column containing slide paths
        id_column: Name of column containing sample IDs
        max_size: Maximum thumbnail dimensions
        quality: JPEG quality
    """
    import pandas as pd

    # Read CSV
    print(f"Reading CSV: {csv_path}")
    df = pd.read_csv(csv_path)

    if path_column not in df.columns:
        print(f"Error: Column '{path_column}' not found in CSV")
        return

    if id_column not in df.columns:
        print(f"Error: Column '{id_column}' not found in CSV")
        return

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print(f"Processing {len(df)} slides from CSV")

    success_count = 0
    for _, row in tqdm(df.iterrows(), total=len(df), desc="Generating thumbnails"):
        slide_path = row[path_column]
        sample_id = row[id_column]

        if pd.isna(slide_path) or not os.path.exists(slide_path):
            continue

        output_file = output_path / f"{sample_id}.jpg"

        # Skip if exists
        if output_file.exists():
            continue

        if generate_thumbnail(slide_path, str(output_file), max_size, quality):
            success_count += 1

    print(f"\nSuccessfully generated {success_count} thumbnails")


def main():
    parser = argparse.ArgumentParser(
        description="Generate thumbnails from whole slide images",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate thumbnails from directory
  python generate_thumbnails.py --input /path/to/slides --output /path/to/thumbnails
  
  # Generate from CSV file
  python generate_thumbnails.py --csv results.csv --output /path/to/thumbnails
  
  # Custom size and quality
  python generate_thumbnails.py --input /path/to/slides --output /path/to/thumbnails --size 4096 --quality 90
        """,
    )

    parser.add_argument(
        "--input", "-i", type=str, help="Input directory with slide files"
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        required=True,
        help="Output directory for thumbnails",
    )
    parser.add_argument("--csv", type=str, help="CSV file with slide paths")
    parser.add_argument(
        "--path-column",
        type=str,
        default="FILE_PATH",
        help="CSV column with file paths",
    )
    parser.add_argument(
        "--id-column",
        type=str,
        default="SAMPLE_ACCESSION",
        help="CSV column with sample IDs",
    )
    parser.add_argument(
        "--size", type=int, default=2048, help="Maximum thumbnail size (default: 2048)"
    )
    parser.add_argument(
        "--quality", type=int, default=85, help="JPEG quality 1-100 (default: 85)"
    )

    args = parser.parse_args()

    max_size = (args.size, args.size)

    if args.csv:
        # Generate from CSV
        generate_from_csv(
            args.csv,
            args.output,
            path_column=args.path_column,
            id_column=args.id_column,
            max_size=max_size,
            quality=args.quality,
        )
    elif args.input:
        # Generate from directory
        batch_generate_thumbnails(
            args.input, args.output, max_size=max_size, quality=args.quality
        )
    else:
        parser.error("Either --input or --csv must be specified")


if __name__ == "__main__":
    main()
