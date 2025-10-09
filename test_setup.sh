#!/bin/bash
# Test the slide viewer setup

echo "🧪 Testing Slide Viewer Setup"
echo "================================"
echo ""

# Test 1: Check if files exist
echo "✓ Checking application files..."
files=("index.html" "app.js" "config.js" "server.py" "start.sh")
all_files_exist=true

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file (MISSING)"
        all_files_exist=false
    fi
done
echo ""

# Test 2: Check Python
echo "✓ Checking Python..."
if command -v python3 &> /dev/null; then
    python_version=$(python3 --version)
    echo "  ✓ $python_version"
else
    echo "  ✗ Python 3 not found"
fi
echo ""

# Test 3: Check configuration
echo "✓ Checking configuration..."
if [ -f "config.js" ]; then
    csv_path=$(grep -oP "csvPath: '\K[^']+" config.js)
    echo "  CSV Path: $csv_path"
    
    if [ -f "$csv_path" ]; then
        echo "  ✓ CSV file exists"
        line_count=$(wc -l < "$csv_path")
        echo "  Lines in CSV: $line_count"
    else
        echo "  ✗ CSV file not found at: $csv_path"
    fi
else
    echo "  ✗ config.js not found"
fi
echo ""

# Test 4: Check port availability
echo "✓ Checking port 8080..."
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "  ✗ Port 8080 is in use"
    echo "  Use: ./start.sh --port <OTHER_PORT>"
else
    echo "  ✓ Port 8080 is available"
fi
echo ""

# Test 5: Check image directories
echo "✓ Checking image directories..."

# Extract paths from config
if [ -f "config.js" ]; then
    thumbnail_path=$(grep -oP "thumbnailBasePath: '\K[^']+" config.js)
    qc_path=$(grep -oP "qcMaskBasePath: '\K[^']+" config.js)
    attention_path=$(grep -oP "attentionMapBasePath: '\K[^']+" config.js)
    
    if [ -d "$thumbnail_path" ]; then
        thumb_count=$(find "$thumbnail_path" -type f \( -name "*.jpg" -o -name "*.png" \) 2>/dev/null | wc -l)
        echo "  ✓ Thumbnails: $thumb_count files"
    else
        echo "  ✗ Thumbnail directory not found: $thumbnail_path"
    fi
    
    if [ -d "$qc_path" ]; then
        qc_count=$(find "$qc_path" -type f -name "*mask*.png" 2>/dev/null | wc -l)
        echo "  ✓ QC Masks: $qc_count files"
    else
        echo "  ⚠ QC mask directory not found: $qc_path (optional)"
    fi
    
    if [ -d "$attention_path" ]; then
        att_count=$(find "$attention_path" -type f \( -name "*attention*.png" -o -name "*attn*.png" \) 2>/dev/null | wc -l)
        echo "  ✓ Attention maps: $att_count files"
    else
        echo "  ⚠ Attention map directory not found: $attention_path (optional)"
    fi
fi
echo ""

# Summary
echo "================================"
if [ "$all_files_exist" = true ]; then
    echo "✅ Setup looks good!"
    echo ""
    echo "To start the viewer:"
    echo "  ./start.sh"
    echo ""
    echo "Then open: http://localhost:8080"
else
    echo "⚠️  Some files are missing"
    echo "Please check the errors above"
fi
echo "================================"
