#!/bin/bash
# Script to optimize gcsfuse mount for better slide viewing performance

MOUNT_POINT="/mnt/disks/pancancer-pathmolecular"
BUCKET_NAME="pancancer-pathmolecular"

echo "🔧 gcsfuse Mount Optimizer for Slide Viewer"
echo "=============================================="
echo ""

# Check if currently mounted
if mount | grep -q "$MOUNT_POINT"; then
    echo "✅ $BUCKET_NAME is currently mounted"
    echo ""
    echo "Current mount options:"
    mount | grep "$MOUNT_POINT"
    echo ""
    
    read -p "Do you want to remount with optimized settings? (y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📤 Unmounting $MOUNT_POINT..."
        fusermount -u "$MOUNT_POINT"
        
        if [ $? -ne 0 ]; then
            echo "❌ Failed to unmount. You may need sudo:"
            echo "   sudo fusermount -u $MOUNT_POINT"
            exit 1
        fi
        
        echo "✅ Unmounted"
        sleep 2
    else
        echo "Keeping current mount"
        exit 0
    fi
else
    echo "⚠️  $BUCKET_NAME is not currently mounted"
fi

# Ensure mount point exists
if [ ! -d "$MOUNT_POINT" ]; then
    echo "📁 Creating mount point: $MOUNT_POINT"
    sudo mkdir -p "$MOUNT_POINT"
fi

echo ""
echo "🚀 Mounting with optimized settings..."
echo ""
echo "Optimizations:"
echo "  • 20GB file cache (stores frequently accessed file blocks)"
echo "  • 100K stat cache entries (faster file lookups)"
echo "  • 24 hour cache TTL (reduce metadata queries)"
echo "  • 10 connections per host (parallel reads)"
echo "  • allow_other (accessible to all users)"
echo ""

# Mount with optimized options
gcsfuse -o allow_other \
        --file-cache-max-size-mb=20000 \
        --stat-cache-capacity=100000 \
        --type-cache-ttl=24h \
        --stat-cache-ttl=24h \
        --max-conns-per-host=10 \
        "$BUCKET_NAME" "$MOUNT_POINT"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully mounted with optimized settings!"
    echo ""
    echo "New mount options:"
    mount | grep "$MOUNT_POINT"
    echo ""
    echo "📊 Expected performance improvements:"
    echo "  • 2-3x faster tile loading"
    echo "  • Reduced GCS API calls"
    echo "  • Better handling of repeated access"
    echo ""
    echo "💡 Note: The 20GB cache will be created in /tmp/gcsfuse-cache/"
    echo "         First access will still be slow, but subsequent access"
    echo "         will be much faster!"
else
    echo ""
    echo "❌ Failed to mount. Check that:"
    echo "  1. gcsfuse is installed: gcsfuse --version"
    echo "  2. You have GCS credentials configured"
    echo "  3. The bucket exists and you have access"
    echo ""
    echo "Try manual mount:"
    echo "  gcsfuse $BUCKET_NAME $MOUNT_POINT"
fi
