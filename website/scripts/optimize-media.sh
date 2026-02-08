#!/bin/bash
# Media Optimization Script for Guardian Website
# Optimizes videos and images for web delivery

set -e

echo "🎥 Guardian Media Optimization"
echo "=============================="
echo ""

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ Error: ffmpeg is not installed"
    echo "Install with: brew install ffmpeg (macOS) or apt-get install ffmpeg (Linux)"
    exit 1
fi

# Check if we have media files
if [ ! -d "public/media" ]; then
    echo "❌ Error: public/media directory not found"
    exit 1
fi

cd public/media

echo "📊 Original sizes:"
du -sh *.{mp4,png} 2>/dev/null || true
echo ""

# Video Optimization
echo "🎬 Optimizing videos..."
for video in *.mp4; do
    # Skip if already optimized
    if [[ "$video" == *"-optimized.mp4" ]] || [[ "$video" == *"-mobile.mp4" ]]; then
        continue
    fi
    
    filename=$(basename "$video" .mp4)
    
    # Desktop optimized (h264, good quality, web-optimized)
    if [ ! -f "${filename}-optimized.mp4" ]; then
        echo "  → ${filename}-optimized.mp4 (desktop)"
        if ffmpeg -i "$video" \
            -vcodec libx264 \
            -crf 28 \
            -preset fast \
            -movflags +faststart \
            -vf "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2" \
            -an \
            "${filename}-optimized.mp4" \
            -y -loglevel error; then
            # Verify file was created and is not empty
            if [ ! -s "${filename}-optimized.mp4" ]; then
                echo "     ⚠️  Warning: Output file is empty, removing..."
                rm -f "${filename}-optimized.mp4"
            else
                echo "     ✓ Created successfully"
            fi
        else
            echo "     ❌ Failed to optimize ${filename}"
            rm -f "${filename}-optimized.mp4"
        fi
    fi
    
    # Mobile optimized (lower resolution, smaller size)
    if [ ! -f "${filename}-mobile.mp4" ]; then
        echo "  → ${filename}-mobile.mp4 (mobile)"
        if ffmpeg -i "$video" \
            -vcodec libx264 \
            -crf 32 \
            -preset fast \
            -movflags +faststart \
            -vf "scale='min(960,iw)':'min(540,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2" \
            -an \
            "${filename}-mobile.mp4" \
            -y -loglevel error; then
            # Verify file was created and is not empty
            if [ ! -s "${filename}-mobile.mp4" ]; then
                echo "     ⚠️  Warning: Output file is empty, removing..."
                rm -f "${filename}-mobile.mp4"
            else
                echo "     ✓ Created successfully"
            fi
        else
            echo "     ❌ Failed to optimize ${filename}"
            rm -f "${filename}-mobile.mp4"
        fi
    fi
done

echo ""
echo "🖼️  Optimizing images..."

# Image optimization with imagemagick (if available)
if command -v magick &> /dev/null || command -v convert &> /dev/null; then
    for image in *.png; do
        # Skip if already optimized
        if [[ "$image" == *"-optimized.png" ]]; then
            continue
        fi
        
        filename=$(basename "$image" .png)
        
        # WebP conversion (90% quality)
        if [ ! -f "${filename}.webp" ]; then
            echo "  → ${filename}.webp"
            if command -v magick &> /dev/null; then
                magick "$image" -quality 90 -define webp:method=6 "${filename}.webp"
            else
                convert "$image" -quality 90 -define webp:method=6 "${filename}.webp"
            fi
        fi
        
        # Optimized PNG (keep as fallback)
        if [ ! -f "${filename}-optimized.png" ]; then
            echo "  → ${filename}-optimized.png"
            if command -v magick &> /dev/null; then
                magick "$image" -strip -quality 85 "${filename}-optimized.png"
            else
                convert "$image" -strip -quality 85 "${filename}-optimized.png"
            fi
        fi
    done
else
    echo "⚠️  ImageMagick not found, skipping image optimization"
    echo "   Install with: brew install imagemagick (macOS)"
fi

echo ""
echo "📊 Final sizes:"
du -sh * 2>/dev/null || true

echo ""
echo "✅ Media optimization complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Update components to use -optimized and -mobile variants"
echo "  2. Consider moving large media to CDN (Vercel Blob, Cloudinary)"
echo "  3. Test loading on slow network (Chrome DevTools → Network → Slow 3G)"
