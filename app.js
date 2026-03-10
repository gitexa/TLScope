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
            qcOpacity: 50,
            attentionOpacity: 70,
            showHeatmap: true,
            showQcOverlay: true,
            showAttentionOverlay: false,
            
            // WSI Viewer
            viewer: null,
            wsiLoading: false,
            viewerZoom: 1.0,
            heatmapData: null,
            heatmapColors: null,
            heatmapCanvas: null,
            heatmapAlpha: 60,
            showPatchHeatmap: false,
            _heatmapRafPending: false,
            
            // Navigation
            allSlides: [],
            currentSlideIndex: -1,
            
            // Dataset selection
            selectedDataset: CONFIG.defaultDataset,
            availableDatasets: Object.keys(CONFIG.datasets),

            // Experiment selection (for datasets that support it)
            selectedExperiment: '',
            availableExperiments: [],
            attentionMapInfo: null,
            attentionMapLoading: false,
            showExperimentSection: false,
            experimentPredictions: null,
            experimentPredictionsLoading: false,

            // Cancer type filtering
            selectedCancerType: '',
            availableCancerTypes: [],
            
            // QC Mask visualization
            qcMaskStats: null,
            qcRawPixels: null,      // raw category values per pixel for layer toggling
            qcLayerVisibility: { '1': true, '2': true, '3': true, '4': true, '5': true, '6': true, '7': true },
            showQcLegend: CONFIG.qcMask.showLegendByDefault,
            showQcStats: CONFIG.qcMask.showStatsByDefault,
            qcPieChart: null,
            
            // Configuration - loaded from config.js
            config: CONFIG
        }
    },
    
    computed: {
        currentDatasetConfig() {
            return this.config.datasets[this.selectedDataset];
        },

        filteredSlides() {
            if (!this.selectedCancerType) {
                return this.allSlides;
            }
            const cancerTypeKey = this.currentDatasetConfig.columnMapping.cancerType;
            return this.allSlides.filter(slide => slide[cancerTypeKey] === this.selectedCancerType);
        },

        // Whether the current dataset has a prepopulated ID list (i.e. CSV already loaded)
        hasSampleIdList() {
            const cfg = this.currentDatasetConfig;
            return this.allSlides.length > 0 && !!(cfg.resultsBasePath || cfg.prepopulateIds);
        },

        sampleIdOptions() {
            if (!this.hasSampleIdList) return [];
            const key = this.currentDatasetConfig.columnMapping.sampleId;
            return this.filteredSlides.map(s => s[key]).filter(Boolean);
        },
    },
    
    methods: {
        onDatasetChange() {
            this.allSlides = [];
            this.currentSlideIndex = -1;
            this.slideData = null;
            this.error = null;
            this.searchId = '';
            this.selectedCancerType = '';
            this.availableCancerTypes = [];
            this.selectedExperiment = '';
            this.availableExperiments = [];
            this.attentionMapInfo = null;
            this.experimentPredictions = null;
            console.log('Dataset changed to:', this.selectedDataset);
            this.loadAvailableExperiments();
            // Pre-load the CSV so the sample ID dropdown is immediately available
            if (this.currentDatasetConfig.resultsBasePath || this.currentDatasetConfig.prepopulateIds) {
                this.preloadSlideList();
            }
        },

        async preloadSlideList() {
            if (this.allSlides.length > 0) return;
            try {
                const datasetConfig = this.currentDatasetConfig;
                const sampleIdKey = datasetConfig.columnMapping.sampleId;
                const response = await fetch(datasetConfig.csvPath);
                if (!response.ok) return;
                const csvText = await response.text();
                const lines = csvText.split('\n');
                const headers = this.parseCSVLine(lines[0]);
                for (let i = 1; i < lines.length; i++) {
                    if (!lines[i].trim()) continue;
                    const values = this.parseCSVLine(lines[i]);
                    if (values.length !== headers.length) continue;
                    const row = {};
                    headers.forEach((h, idx) => { row[h.trim()] = values[idx]; });
                    if (row[sampleIdKey]?.trim()) this.allSlides.push(row);
                }
                this.extractCancerTypes();
                console.log('Pre-loaded', this.allSlides.length, 'slides for dropdown');
            } catch (err) {
                console.warn('Could not pre-load slide list:', err.message);
            }
        },

        onSampleIdSelect(event) {
            this.searchId = event.target.value;
            if (this.searchId) this.loadSlide();
        },

        async loadAvailableExperiments() {
            const datasetConfig = this.currentDatasetConfig;
            if (!datasetConfig.resultsBasePath) {
                return; // Dataset doesn't support experiment selection
            }
            try {
                const response = await fetch(`/api/list-experiments?resultsBasePath=${encodeURIComponent(datasetConfig.resultsBasePath)}`);
                if (response.ok) {
                    const data = await response.json();
                    this.availableExperiments = data.experiments || [];
                    // Set default experiment
                    if (datasetConfig.defaultExperiment && this.availableExperiments.includes(datasetConfig.defaultExperiment)) {
                        this.selectedExperiment = datasetConfig.defaultExperiment;
                    } else if (this.availableExperiments.length > 0) {
                        this.selectedExperiment = this.availableExperiments[0];
                    }
                    console.log('Available experiments:', this.availableExperiments);
                }
            } catch (err) {
                console.warn('Could not load experiments:', err.message);
            }
        },

        onExperimentChange() {
            console.log('Experiment changed to:', this.selectedExperiment);
            if (this.slideData) {
                this.loadAttentionMapInfo();
                this.loadExperimentPredictions();
            }
        },

        async loadAttentionMapInfo() {
            const datasetConfig = this.currentDatasetConfig;
            if (!datasetConfig.resultsBasePath || !this.slideData) {
                this.attentionMapInfo = null;
                return;
            }
            const cancerTypeKey = datasetConfig.columnMapping.cancerType;
            const sampleIdKey = datasetConfig.columnMapping.sampleId;
            const cancerType = this.slideData[cancerTypeKey] || '';
            const slideId = this.slideData[sampleIdKey] || '';
            const experiment = this.selectedExperiment || datasetConfig.defaultExperiment || '';
            const analysisDir = datasetConfig.analysisDir || '';

            this.attentionMapLoading = true;
            this.attentionMapInfo = null;
            try {
                const params = new URLSearchParams({
                    resultsBasePath: datasetConfig.resultsBasePath,
                    experiment,
                    analysisDir,
                    cancerType,
                    slideId,
                });
                const response = await fetch(`/api/attention-map?${params}`);
                if (response.ok) {
                    this.attentionMapInfo = await response.json();
                    console.log('Attention map info:', this.attentionMapInfo);
                }
            } catch (err) {
                console.warn('Could not load attention map info:', err.message);
                this.attentionMapInfo = { available: false, reason: err.message };
            } finally {
                this.attentionMapLoading = false;
            }
        },

        async loadExperimentPredictions() {
            const datasetConfig = this.currentDatasetConfig;
            if (!datasetConfig.resultsBasePath || !datasetConfig.predictionsFile || !this.slideData) {
                this.experimentPredictions = null;
                return;
            }
            const sampleIdKey = datasetConfig.columnMapping.sampleId;
            const slideId = this.slideData[sampleIdKey] || '';
            const experiment = this.selectedExperiment || datasetConfig.defaultExperiment || '';
            const analysisDir = datasetConfig.analysisDir || '';

            this.experimentPredictionsLoading = true;
            this.experimentPredictions = null;
            try {
                const params = new URLSearchParams({
                    resultsBasePath: datasetConfig.resultsBasePath,
                    experiment,
                    analysisDir,
                    predictionsFile: datasetConfig.predictionsFile,
                    slideId,
                });
                const response = await fetch(`/api/predictions?${params}`);
                if (response.ok) {
                    this.experimentPredictions = await response.json();
                }
            } catch (err) {
                console.warn('Could not load predictions:', err.message);
                this.experimentPredictions = { available: false, reason: err.message };
            } finally {
                this.experimentPredictionsLoading = false;
            }
        },

        onCancerTypeChange() {
            // Reset current slide when cancer type filter changes
            this.currentSlideIndex = -1;
            this.slideData = null;
            this.searchId = '';
            console.log('Cancer type filter changed to:', this.selectedCancerType || 'All');
        },
        
        extractCancerTypes() {
            // Extract unique cancer types from all slides
            const cancerTypeKey = this.currentDatasetConfig.columnMapping.cancerType;
            const cancerTypesSet = new Set();
            
            this.allSlides.forEach(slide => {
                const cancerType = slide[cancerTypeKey];
                if (cancerType !== undefined && cancerType !== null && cancerType !== '') {
                    cancerTypesSet.add(cancerType);
                }
            });
            
            // Convert to sorted array
            this.availableCancerTypes = Array.from(cancerTypesSet).sort();
            console.log('Found cancer types:', this.availableCancerTypes);
        },
        
        async loadSlide() {
            if (!this.searchId.trim()) {
                this.error = 'Please enter a Sample Accession ID';
                return;
            }

            this.loading = true;
            this.error = null;
            this.slideData = null;

            try {
                const datasetConfig = this.currentDatasetConfig;
                const sampleIdKey = datasetConfig.columnMapping.sampleId;
                
                console.log('Loading slide from dataset:', this.selectedDataset);
                console.log('CSV path:', datasetConfig.csvPath);
                console.log('Sample ID key:', sampleIdKey);
                
                // Load CSV data
                const response = await fetch(datasetConfig.csvPath);
                const csvText = await response.text();
                
                // Parse CSV
                const lines = csvText.split('\n');
                const headers = this.parseCSVLine(lines[0]);
                
                // Parse all slides and store them
                if (this.allSlides.length === 0) {
                    let skippedRows = 0;
                    for (let i = 1; i < lines.length; i++) {
                        // Skip empty lines
                        if (!lines[i].trim()) {
                            continue;
                        }
                        
                        const values = this.parseCSVLine(lines[i]);
                        
                        // Log mismatches for debugging
                        if (values.length !== headers.length) {
                            skippedRows++;
                            if (skippedRows <= 5) {
                                console.warn(`Row ${i} column count mismatch: expected ${headers.length}, got ${values.length}`);
                            }
                            continue;
                        }
                        
                        const row = {};
                        headers.forEach((header, idx) => {
                            row[header.trim()] = values[idx];
                        });
                        
                        if (row[sampleIdKey] && row[sampleIdKey].trim()) {
                            this.allSlides.push(row);
                        }
                    }
                    console.log('Loaded', this.allSlides.length, 'slides from CSV');
                    if (skippedRows > 0) {
                        console.warn(`Skipped ${skippedRows} rows due to column count mismatch`);
                    }
                    
                    // Extract available cancer types from loaded data
                    this.extractCancerTypes();
                }
                
                // Find the slide using the dynamic sample ID key
                // Search in filtered slides if cancer type filter is active
                const slidesToSearch = this.filteredSlides;
                let foundSlide = null;
                let slideIndex = -1;
                
                for (let i = 0; i < slidesToSearch.length; i++) {
                    if (slidesToSearch[i][sampleIdKey] === this.searchId.trim()) {
                        foundSlide = slidesToSearch[i];
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
                
                // Load image paths using the dynamic sample ID key
                const sampleId = this.slideData[sampleIdKey];
                console.log('Loading images for sample ID:', sampleId);
                this.loadImagePaths(sampleId);
                this.loadAttentionMapInfo();
                this.loadExperimentPredictions();
                
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
                'predictions', 'confidence', 'confidence_class_0', 'confidence_class_1',
                'pred', 'pred_raw',
                'TLS_count_BS', 'TLS_count_GR', 'TLS_count_consensus',
                'GC_BS', 'GC_GR', 'GC_consensus'
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
            const datasetConfig = this.currentDatasetConfig;
            
            // Derive thumbnail path from MASK_PATH if available
            const maskPathKey = datasetConfig.columnMapping.maskPath;
            let thumbnailPossiblePaths = [];
            
            if (maskPathKey && this.slideData[maskPathKey]) {
                // Extract thumbnail path from mask path: .svs_mask.png -> .svs.jpg
                const maskPath = this.slideData[maskPathKey];
                const thumbnailPath = maskPath.replace('.svs_mask.png', '.svs.jpg');
                thumbnailPossiblePaths.push(thumbnailPath);
                console.log('Derived thumbnail path from MASK_PATH:', thumbnailPath);
            }
            
            // Fallback to pattern-based paths
            thumbnailPossiblePaths.push(...datasetConfig.imagePatterns.thumbnail.map(pattern =>
                pattern.replace('{basePath}', datasetConfig.thumbnailBasePath)
                       .replace('{sampleId}', sampleId)
            ));
            
            console.log('Checking thumbnail paths:', thumbnailPossiblePaths);
            this.checkImageExists(thumbnailPossiblePaths).then(path => {
                this.thumbnailPath = path;
                console.log('Thumbnail path:', path || 'not found');
            });

            // Try to load QC mask
            const qcMaskPossiblePaths = datasetConfig.imagePatterns.qcMask.map(pattern =>
                pattern.replace('{basePath}', datasetConfig.qcMaskBasePath)
                       .replace('{sampleId}', sampleId)
            );
            
            console.log('Checking QC mask paths:', qcMaskPossiblePaths);
            this.checkImageExists(qcMaskPossiblePaths).then(path => {
                this.qcMaskPath = path;
                console.log('QC mask path:', path || 'not found');
                
                // If found, render to canvas with colorization
                if (path) {
                    this.renderQcMaskToCanvas(path).catch(error => {
                        console.error('Failed to render QC mask:', error);
                    });
                }
            });

            // Attention map is loaded separately via loadAttentionMapInfo (experiment-dependent)
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
        
        // QC Mask colorization methods
        async renderQcMaskToCanvas(imagePath) {
            console.log('Rendering QC mask via API:', imagePath);

            try {
                // Use server-side downsampling + raw grayscale to get category values
                const apiUrl = `/api/qc-mask?path=${encodeURIComponent(imagePath)}&maxDim=2048&raw=1`;
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error(`Failed to fetch mask: ${response.status}`);
                const blob = await response.blob();

                // Downsampled image is small enough for createImageBitmap
                const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });

                const canvas = document.getElementById('qcMaskCanvas');
                if (!canvas) throw new Error('Canvas element not found');

                canvas.width  = bitmap.width;
                canvas.height = bitmap.height;

                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(bitmap, 0, 0);
                bitmap.close();

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const totalPixels = canvas.width * canvas.height;

                // Store raw category values (red channel = value for grayscale PNG)
                const rawPixels = new Uint8Array(totalPixels);
                for (let i = 0; i < totalPixels; i++) {
                    rawPixels[i] = data[i * 4];
                }
                this.qcRawPixels = { data: rawPixels, width: canvas.width, height: canvas.height };

                // Count stats
                const stats = {};
                for (let i = 1; i <= 7; i++) stats[i] = { count: 0, percentage: 0 };
                for (let i = 0; i < rawPixels.length; i++) {
                    const v = rawPixels[i];
                    if (v >= 1 && v <= 7) stats[v].count++;
                }
                for (let i = 1; i <= 7; i++) {
                    stats[i].percentage = (stats[i].count / totalPixels) * 100;
                }

                this.qcMaskStats = stats;
                console.log('QC Mask stats:', stats);

                this.redrawQcMask();

                this.$nextTick(() => {
                    if (this.showQcStats) {
                        this.renderQcPieChart();
                    }
                });
            } catch (error) {
                console.error('Error processing QC mask:', error);
                throw error;
            }
        },
        
        redrawQcMask() {
            if (!this.qcRawPixels) return;

            const { data: rawPixels, width, height } = this.qcRawPixels;

            const colorLut = {};
            for (let v = 1; v <= 7; v++) {
                const cat = this.config.qcMask.categories[v];
                colorLut[v] = cat ? this.hexToRgb(cat.color) : null;
            }

            // Build pixel data once, apply to all canvases
            const imageData = new ImageData(width, height);
            const out = imageData.data;
            for (let i = 0; i < rawPixels.length; i++) {
                const v = rawPixels[i];
                const idx = i * 4;
                if (v >= 1 && v <= 7 && colorLut[v] && this.qcLayerVisibility[String(v)]) {
                    const c = colorLut[v];
                    out[idx]     = c.r;
                    out[idx + 1] = c.g;
                    out[idx + 2] = c.b;
                    out[idx + 3] = 255;
                } else {
                    out[idx + 3] = 0;
                }
            }

            for (const id of ['qcMaskCanvas', 'qcOverlayCanvas']) {
                const canvas = document.getElementById(id);
                if (!canvas) continue;
                canvas.width  = width;
                canvas.height = height;
                canvas.getContext('2d').putImageData(imageData, 0, 0);
            }
        },

        toggleQcLayer(categoryId) {
            this.qcLayerVisibility[categoryId] = !this.qcLayerVisibility[categoryId];
            this.redrawQcMask();
            if (this.showQcStats && this.qcMaskStats) this.renderQcPieChart();
        },

        hexToRgb(hex) {
            // Convert hex color to RGB
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : { r: 0, g: 0, b: 0 };
        },
        
        toggleQcLegend() {
            this.showQcLegend = !this.showQcLegend;
        },
        
        toggleQcStats() {
            this.showQcStats = !this.showQcStats;
            
            // Render or destroy pie chart
            this.$nextTick(() => {
                if (this.showQcStats && this.qcMaskStats) {
                    this.renderQcPieChart();
                } else if (this.qcPieChart) {
                    this.qcPieChart.destroy();
                    this.qcPieChart = null;
                }
            });
        },
        
        renderQcPieChart() {
            // Destroy existing chart
            if (this.qcPieChart) {
                this.qcPieChart.destroy();
            }
            
            const canvas = document.getElementById('qcPieChart');
            if (!canvas || !this.qcMaskStats) {
                return;
            }
            
            const ctx = canvas.getContext('2d');
            
            // Prepare data for chart
            const labels = [];
            const data = [];
            const colors = [];
            
            for (let i = 1; i <= 7; i++) {
                const stat = this.qcMaskStats[i];
                if (stat.count > 0 && this.qcLayerVisibility[String(i)]) {
                    const category = this.config.qcMask.categories[i];
                    labels.push(category.name);
                    data.push(stat.percentage.toFixed(2));
                    colors.push(category.color);
                }
            }
            
            // Create pie chart
            this.qcPieChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: colors,
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 15,
                                font: {
                                    size: 11
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.label + ': ' + context.parsed + '%';
                                }
                            }
                        },
                        title: {
                            display: true,
                            text: 'Category Distribution',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        }
                    }
                }
            });
        },

        clearSlide() {
            this.searchId = '';
            this.slideData = null;
            this.error = null;
            this.thumbnailPath = null;
            this.qcMaskPath = null;
            this.attentionMapInfo = null;
            this.currentSlideIndex = -1;
            this.qcMaskStats = null;
            this.qcRawPixels = null;
            this.qcLayerVisibility = { '1': true, '2': true, '3': true, '4': true, '5': true, '6': true, '7': true };
            
            // Destroy pie chart
            if (this.qcPieChart) {
                this.qcPieChart.destroy();
                this.qcPieChart = null;
            }
            
            // Destroy viewer
            if (this.viewer) {
                this.viewer.destroy();
                this.viewer = null;
            }

            // Clear heatmap
            if (this.heatmapCanvas && this.heatmapCanvas.parentNode) {
                this.heatmapCanvas.parentNode.removeChild(this.heatmapCanvas);
            }
            this.heatmapCanvas = null;
            this.heatmapData = null;
            this.showPatchHeatmap = false;
        },
        
        // Navigation methods
        canGoPrevious() {
            return this.currentSlideIndex > 0;
        },
        
        canGoNext() {
            return this.currentSlideIndex >= 0 && this.currentSlideIndex < this.filteredSlides.length - 1;
        },
        
        goToPrevious() {
            if (this.canGoPrevious()) {
                const prevSlide = this.filteredSlides[this.currentSlideIndex - 1];
                const sampleIdKey = this.currentDatasetConfig.columnMapping.sampleId;
                this.searchId = prevSlide[sampleIdKey];
                this.loadSlide();
            }
        },
        
        goToNext() {
            if (this.canGoNext()) {
                const nextSlide = this.filteredSlides[this.currentSlideIndex + 1];
                const sampleIdKey = this.currentDatasetConfig.columnMapping.sampleId;
                this.searchId = nextSlide[sampleIdKey];
                this.loadSlide();
            }
        },
        
        getCurrentPosition() {
            if (this.currentSlideIndex >= 0 && this.filteredSlides.length > 0) {
                return `${this.currentSlideIndex + 1} / ${this.filteredSlides.length}`;
            }
            return '';
        },

        formatNumber(num) {
            if (num === undefined || num === null) return 'N/A';
            return num.toLocaleString();
        },

        // WSI Viewer Methods
        initViewer() {
            const filePathKey = this.currentDatasetConfig.columnMapping.filePath;
            const slidePath = this.slideData ? this.slideData[filePathKey] : null;
            
            if (!this.slideData || !slidePath) {
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
                const encodedSlidePath = encodeURIComponent(slidePath);
                
                // Build DZI URL
                const dziUrl = `/dzi/slide.dzi?path=${encodedSlidePath}`;
                
                console.log('Loading WSI from:', slidePath);
                console.log('DZI URL:', dziUrl);
                
                // Initialize OpenSeadragon viewer
                this.viewer = OpenSeadragon({
                    id: "openseadragon-viewer",
                    prefixUrl: "https://cdn.jsdelivr.net/npm/openseadragon@4.1.0/build/openseadragon/images/",
                    
                    // Tile source using our DZI server
                    tileSources: {
                        Image: {
                            xmlns: "http://schemas.microsoft.com/deepzoom/2008",
                            Url: `/dzi/slide_files/?path=${encodedSlidePath}`,
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
                    this.loadAttentionHeatmap();
                });
                
                this.viewer.addHandler('tile-loaded', () => {
                    // Tiles are loading
                });
                
                this.viewer.addHandler('tile-load-failed', (event) => {
                    console.warn('Tile load failed:', event);
                });
                
                // Load slide info first
                fetch(`/slide-info?path=${encodedSlidePath}`)
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
                    this.updateHeatmap();
                });

                this.viewer.addHandler('pan', () => { this.updateHeatmap(); });
                this.viewer.addHandler('resize', () => { this.updateHeatmap(); });

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
        },

        async loadAttentionHeatmap() {
            const datasetConfig = this.currentDatasetConfig;
            if (!datasetConfig.resultsBasePath || !this.slideData || !this.viewer) return;

            const cancerTypeKey = datasetConfig.columnMapping.cancerType;
            const sampleIdKey   = datasetConfig.columnMapping.sampleId;
            const cancerType    = this.slideData[cancerTypeKey] || '';
            const slideId       = this.slideData[sampleIdKey]   || '';
            const experiment    = this.selectedExperiment || datasetConfig.defaultExperiment || '';
            const analysisDir   = datasetConfig.analysisDir || '';

            try {
                const params = new URLSearchParams({ resultsBasePath: datasetConfig.resultsBasePath, experiment, analysisDir, cancerType, slideId });
                const response = await fetch(`/api/attention-scores?${params}`);
                if (!response.ok) return;
                const data = await response.json();
                if (!data.available) { console.log('Attention scores not available:', data.reason); return; }

                this.heatmapData = data;
                this._prepareHeatmapColors();
                this.showPatchHeatmap = true;
                this.drawHeatmap();
            } catch (err) {
                console.warn('Could not load attention scores:', err.message);
            }
        },

        _prepareHeatmapColors() {
            // Pre-compute per-patch RGBA colors once after data loads
            const { scores } = this.heatmapData;
            const colors = new Uint8Array(scores.length * 4);
            for (let i = 0; i < scores.length; i++) {
                const t = scores[i];
                colors[i*4]   = Math.round(255 * Math.min(Math.max(1.5 - Math.abs(4*t - 3), 0), 1)); // R
                colors[i*4+1] = Math.round(255 * Math.min(Math.max(1.5 - Math.abs(4*t - 2), 0), 1)); // G
                colors[i*4+2] = Math.round(255 * Math.min(Math.max(1.5 - Math.abs(4*t - 1), 0), 1)); // B
                colors[i*4+3] = 255; // A (controlled at draw time via globalAlpha)
            }
            this.heatmapColors = colors;
        },

        drawHeatmap() {
            if (!this.heatmapData || !this.viewer || !this.showPatchHeatmap) return;

            const { coords, patchSize } = this.heatmapData;
            const colors    = this.heatmapColors;
            const viewport  = this.viewer.viewport;
            const tiledImage = this.viewer.world.getItemAt(0);
            if (!tiledImage) return;

            // Create canvas once, reuse on subsequent draws
            const container = this.viewer.canvas;
            const W = container.clientWidth;
            const H = container.clientHeight;

            if (!this.heatmapCanvas) {
                const canvas = document.createElement('canvas');
                canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
                container.parentElement.appendChild(canvas);
                this.heatmapCanvas = canvas;
            }

            // Resize canvas only if container changed
            if (this.heatmapCanvas.width !== W || this.heatmapCanvas.height !== H) {
                this.heatmapCanvas.width  = W;
                this.heatmapCanvas.height = H;
            }

            const ctx = this.heatmapCanvas.getContext('2d');
            ctx.clearRect(0, 0, W, H);
            ctx.globalAlpha = this.heatmapAlpha / 100;

            // Compute patch screen size from first visible patch to decide render strategy
            const p0vp = tiledImage.imageToViewportCoordinates(new OpenSeadragon.Point(0, 0));
            const p1vp = tiledImage.imageToViewportCoordinates(new OpenSeadragon.Point(patchSize, 0));
            const p0sc = viewport.viewportToViewerElementCoordinates(p0vp);
            const p1sc = viewport.viewportToViewerElementCoordinates(p1vp);
            const patchScreenSize = Math.abs(p1sc.x - p0sc.x);

            if (patchScreenSize < 0.5) return; // Too zoomed out to see anything

            // Compute viewport bounds in image coords for culling off-screen patches
            const bounds = viewport.getBounds();
            const tlImg  = tiledImage.viewportToImageCoordinates(new OpenSeadragon.Point(bounds.x, bounds.y));
            const brImg  = tiledImage.viewportToImageCoordinates(new OpenSeadragon.Point(bounds.x + bounds.width, bounds.y + bounds.height));
            const margin = patchSize * 2;
            const xMin = tlImg.x - margin, xMax = brImg.x + margin;
            const yMin = tlImg.y - margin, yMax = brImg.y + margin;

            // Compute transform: image px → screen px
            // Use a single affine transform derived from two reference points
            const ref0sc = viewport.viewportToViewerElementCoordinates(
                tiledImage.imageToViewportCoordinates(new OpenSeadragon.Point(0, 0)));
            const scale  = patchScreenSize / patchSize;

            for (let i = 0; i < coords.length; i++) {
                const [x, y] = coords[i];

                // Cull off-screen patches
                if (x < xMin || x > xMax || y < yMin || y > yMax) continue;

                const sx = ref0sc.x + x * scale;
                const sy = ref0sc.y + y * scale;
                const sw = patchScreenSize;

                ctx.fillStyle = `rgb(${colors[i*4]},${colors[i*4+1]},${colors[i*4+2]})`;
                ctx.fillRect(sx, sy, sw, sw);
            }

            ctx.globalAlpha = 1;
        },

        updateHeatmap() {
            if (!this._heatmapRafPending) {
                this._heatmapRafPending = true;
                requestAnimationFrame(() => {
                    this._heatmapRafPending = false;
                    if (this.showPatchHeatmap && this.heatmapData) {
                        this.drawHeatmap();
                    } else if (!this.showPatchHeatmap && this.heatmapCanvas) {
                        const ctx = this.heatmapCanvas.getContext('2d');
                        ctx.clearRect(0, 0, this.heatmapCanvas.width, this.heatmapCanvas.height);
                    }
                });
            }
        }
    },

    watch: {
        heatmapAlpha() { this.updateHeatmap(); },
        showPatchHeatmap() { this.updateHeatmap(); },
        showQcOverlay(val) { if (val) this.$nextTick(() => this.redrawQcMask()); },
    },

    mounted() {
        console.log('Slide Viewer initialized');
        console.log('Config Version:', this.config.configVersion || 'UNKNOWN - OLD VERSION');
        console.log('CSV Path:', this.currentDatasetConfig.csvPath);
        this.loadAvailableExperiments();
        if (this.currentDatasetConfig.resultsBasePath || this.currentDatasetConfig.prepopulateIds) {
            this.preloadSlideList();
        }

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
