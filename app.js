const { createApp } = Vue;

createApp({
    data() {
        return {
            searchId: '',
            slideData: null,
            loading: false,
            error: null,
            thumbnailPath: null,
            qcMaskPath: null,
            attentionMapPath: null,
            qcOpacity: 50,
            attentionOpacity: 70,
            showHeatmap: true,
            showQcOverlay: true,
            showAttentionOverlay: false,
            
            // WSI Viewer
            viewer: null,
            wsiLoading: false,
            viewerZoom: 1.0,
            
            // Navigation
            allSlides: [],
            currentSlideIndex: -1,
            
            // Configuration - Update these paths to match your setup
            config: {
                csvPath: 'data.csv',
                thumbnailBasePath: 'images',
                qcMaskBasePath: 'images',
                attentionMapBasePath: 'images'
            }
        }
    },
    
    methods: {
        async loadSlide() {
            if (!this.searchId.trim()) {
                this.error = 'Please enter a Sample Accession ID';
                return;
            }

            this.loading = true;
            this.error = null;
            this.slideData = null;

            try {
                // Load CSV data
                const response = await fetch(this.config.csvPath);
                const csvText = await response.text();
                
                // Parse CSV
                const lines = csvText.split('\n');
                const headers = lines[0].split(',');
                
                // Parse all slides and store them
                if (this.allSlides.length === 0) {
                    for (let i = 1; i < lines.length; i++) {
                        const values = this.parseCSVLine(lines[i]);
                        if (values.length === headers.length) {
                            const row = {};
                            headers.forEach((header, idx) => {
                                row[header.trim()] = values[idx];
                            });
                            if (row.SAMPLE_ACCESSION && row.SAMPLE_ACCESSION.trim()) {
                                this.allSlides.push(row);
                            }
                        }
                    }
                }
                
                // Find the slide
                let foundSlide = null;
                let slideIndex = -1;
                
                for (let i = 0; i < this.allSlides.length; i++) {
                    if (this.allSlides[i].SAMPLE_ACCESSION === this.searchId.trim()) {
                        foundSlide = this.allSlides[i];
                        slideIndex = i;
                        break;
                    }
                }

                if (!foundSlide) {
                    this.error = `Slide ID "${this.searchId}" not found in database`;
                    return;
                }

                // Store current index
                this.currentSlideIndex = slideIndex;

                // Convert numeric fields
                this.slideData = this.convertNumericFields(foundSlide);
                
                // Load image paths
                this.loadImagePaths(this.slideData.SAMPLE_ACCESSION);
                
            } catch (err) {
                this.error = `Error loading slide data: ${err.message}`;
                console.error(err);
            } finally {
                this.loading = false;
            }
        },

        parseCSVLine(line) {
            const result = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            
            result.push(current.trim());
            return result;
        },

        convertNumericFields(data) {
            const numericFields = [
                'qc_tissue_share', 'qc_background_share', 'qc_folds_share',
                'qc_dark_share', 'qc_pen_share', 'qc_bubbles_share', 'qc_focus_share',
                'total_pixels', 'qc_tissue_sum', 'qc_background_sum',
                'pred_num_tls', 'pred_num_gc', 'pred_num_tls_raw', 'pred_num_gc_raw',
                'predictions', 'confidence', 'confidence_class_0', 'confidence_class_1'
            ];

            const converted = { ...data };
            
            numericFields.forEach(field => {
                if (converted[field] !== undefined && converted[field] !== '') {
                    converted[field] = parseFloat(converted[field]);
                }
            });

            converted.prediction_successful = converted.prediction_successful === 'True' || converted.prediction_successful === true;

            return converted;
        },

        loadImagePaths(sampleId) {
            // Try to load thumbnail (GrandQC format: BL-13-E42518.svs.jpg)
            const thumbnailPossiblePaths = [
                `${this.config.thumbnailBasePath}/${sampleId}.svs.jpg`,
                `${this.config.thumbnailBasePath}/${sampleId}.jpg`,
                `${this.config.thumbnailBasePath}/${sampleId}.png`,
            ];
            
            this.checkImageExists(thumbnailPossiblePaths).then(path => {
                this.thumbnailPath = path;
            });

            // Try to load QC mask (GrandQC format: BL-13-E42518.svs_map_QC.png)
            const qcMaskPossiblePaths = [
                `${this.config.qcMaskBasePath}/${sampleId}.svs_map_QC.png`,
                `${this.config.qcMaskBasePath}/${sampleId}.svs_MASK_COL.png`,
                `${this.config.qcMaskBasePath}/${sampleId}_qc_mask.png`,
            ];
            
            this.checkImageExists(qcMaskPossiblePaths).then(path => {
                this.qcMaskPath = path;
            });

            // Try to load attention map or overlay (GrandQC format: BL-13-E42518.svs_overlay_QC.jpg)
            const attentionMapPossiblePaths = [
                `${this.config.attentionMapBasePath}/${sampleId}.svs_overlay_QC.jpg`,
                `${this.config.attentionMapBasePath}/${sampleId}.svs_OVERLAY.jpg`,
                `${this.config.attentionMapBasePath}/${sampleId}_attention.png`,
            ];
            
            this.checkImageExists(attentionMapPossiblePaths).then(path => {
                this.attentionMapPath = path;
            });
        },

        async checkImageExists(paths) {
            for (const path of paths) {
                try {
                    const response = await fetch(path, { method: 'HEAD' });
                    if (response.ok) {
                        return path;
                    }
                } catch (err) {
                    // Continue to next path
                }
            }
            return null;
        },

        clearSlide() {
            this.searchId = '';
            this.slideData = null;
            this.error = null;
            this.thumbnailPath = null;
            this.qcMaskPath = null;
            this.attentionMapPath = null;
            this.currentSlideIndex = -1;
            
            // Destroy viewer
            if (this.viewer) {
                this.viewer.destroy();
                this.viewer = null;
            }
        },
        
        // Navigation methods
        canGoPrevious() {
            return this.currentSlideIndex > 0;
        },
        
        canGoNext() {
            return this.currentSlideIndex >= 0 && this.currentSlideIndex < this.allSlides.length - 1;
        },
        
        goToPrevious() {
            if (this.canGoPrevious()) {
                const prevSlide = this.allSlides[this.currentSlideIndex - 1];
                this.searchId = prevSlide.SAMPLE_ACCESSION;
                this.loadSlide();
            }
        },
        
        goToNext() {
            if (this.canGoNext()) {
                const nextSlide = this.allSlides[this.currentSlideIndex + 1];
                this.searchId = nextSlide.SAMPLE_ACCESSION;
                this.loadSlide();
            }
        },
        
        getCurrentPosition() {
            if (this.currentSlideIndex >= 0 && this.allSlides.length > 0) {
                return `${this.currentSlideIndex + 1} / ${this.allSlides.length}`;
            }
            return '';
        },

        formatNumber(num) {
            if (num === undefined || num === null) return 'N/A';
            return num.toLocaleString();
        },

        // WSI Viewer Methods
        initViewer() {
            if (!this.slideData || !this.slideData.FILE_PATH) {
                alert('No slide path available');
                return;
            }

            this.wsiLoading = true;

            // Destroy existing viewer
            if (this.viewer) {
                this.viewer.destroy();
                this.viewer = null;
            }

            try {
                // Encode the slide path for URL
                const slidePath = encodeURIComponent(this.slideData.FILE_PATH);
                
                // Build DZI URL
                const dziUrl = `/dzi/slide.dzi?path=${slidePath}`;
                
                console.log('Loading WSI from:', this.slideData.FILE_PATH);
                console.log('DZI URL:', dziUrl);
                
                // Initialize OpenSeadragon viewer
                this.viewer = OpenSeadragon({
                    id: "openseadragon-viewer",
                    prefixUrl: "https://cdn.jsdelivr.net/npm/openseadragon@4.1.0/build/openseadragon/images/",
                    
                    // Tile source using our DZI server
                    tileSources: {
                        Image: {
                            xmlns: "http://schemas.microsoft.com/deepzoom/2008",
                            Url: `/dzi/slide_files/?path=${slidePath}`,
                            Format: "jpeg",
                            Overlap: "1",
                            TileSize: "254"
                        }
                    },
                    
                    // Viewer settings
                    showNavigator: true,
                    navigatorPosition: "BOTTOM_RIGHT",
                    showNavigationControl: true,
                    navigationControlAnchor: OpenSeadragon.ControlAnchor.TOP_LEFT,
                    
                    // Performance settings optimized for network storage
                    animationTime: 0.3,
                    blendTime: 0.1,
                    constrainDuringPan: false,
                    maxZoomPixelRatio: 2,
                    minZoomLevel: 0.5,
                    visibilityRatio: 0.8,  // Load fewer tiles outside view
                    zoomPerScroll: 1.2,
                    timeout: 120000,
                    immediateRender: false,
                    
                    // Aggressive preloading and caching
                    preload: true,
                    imageLoaderLimit: 8,  // Load 8 tiles in parallel
                    maxImageCacheCount: 300,  // Cache more tiles
                    
                    // Reduce tile loading during animation
                    minPixelRatio: 0.65,  // Lower quality during zoom for faster loading
                    
                    // Interaction settings
                    gestureSettingsMouse: {
                        scrollToZoom: true,
                        clickToZoom: false,
                        dblClickToZoom: true,
                        pinchToZoom: true,
                        flickEnabled: true
                    },
                });

                // Add event listeners for better feedback
                this.viewer.addHandler('open', () => {
                    this.wsiLoading = false;
                    console.log('Viewer opened successfully');
                });
                
                this.viewer.addHandler('tile-loaded', () => {
                    // Tiles are loading
                });
                
                this.viewer.addHandler('tile-load-failed', (event) => {
                    console.warn('Tile load failed:', event);
                });
                
                // Load slide info first
                fetch(`/slide-info?path=${slidePath}`)
                    .then(response => response.json())
                    .then(info => {
                        console.log('Slide info:', info);
                        console.log(`Loading ${info.dimensions[0]}x${info.dimensions[1]} slide with ${info.level_count} pyramid levels`);
                        
                        // Now open the DZI
                        this.viewer.open(dziUrl);
                    })
                    .catch(error => {
                        console.error('Error loading slide info:', error);
                        // Try to open anyway
                        this.viewer.open(dziUrl);
                    });

                // Add event listeners
                this.viewer.addHandler('zoom', (event) => {
                    this.viewerZoom = event.zoom;
                });

                this.viewer.addHandler('open', () => {
                    this.wsiLoading = false;
                    console.log('WSI loaded successfully');
                });

                this.viewer.addHandler('open-failed', (event) => {
                    this.wsiLoading = false;
                    console.error('Failed to load WSI:', event);
                    alert('Failed to load whole slide image. Make sure the server has OpenSlide installed and the file path is correct.');
                });

                this.viewer.addHandler('tile-load-failed', (event) => {
                    console.error('Tile load failed:', event);
                });

            } catch (error) {
                this.wsiLoading = false;
                console.error('Error initializing viewer:', error);
                alert('Error initializing viewer: ' + error.message);
            }
        },

        toggleFullscreen() {
            if (!this.viewer) return;
            
            this.viewer.setFullScreen(!this.viewer.isFullPage());
        }
    },

    mounted() {
        console.log('Slide Viewer initialized');
        console.log('CSV Path:', this.config.csvPath);
        
        // Add keyboard navigation
        window.addEventListener('keydown', (e) => {
            // Only trigger if not typing in input field
            if (e.target.tagName === 'INPUT') return;
            
            // Arrow keys for navigation
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.canGoPrevious()) {
                    this.goToPrevious();
                }
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.canGoNext()) {
                    this.goToNext();
                }
            }
        });
    }
}).mount('#app');
