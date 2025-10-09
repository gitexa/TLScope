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
                
                // Find the slide
                let foundSlide = null;
                for (let i = 1; i < lines.length; i++) {
                    const values = this.parseCSVLine(lines[i]);
                    if (values.length === headers.length) {
                        const row = {};
                        headers.forEach((header, idx) => {
                            row[header.trim()] = values[idx];
                        });
                        
                        if (row.SAMPLE_ACCESSION === this.searchId.trim()) {
                            foundSlide = row;
                            break;
                        }
                    }
                }

                if (!foundSlide) {
                    this.error = `Slide ID "${this.searchId}" not found in database`;
                    return;
                }

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
        },

        formatNumber(num) {
            if (num === undefined || num === null) return 'N/A';
            return num.toLocaleString();
        }
    },

    mounted() {
        console.log('Slide Viewer initialized');
        console.log('CSV Path:', this.config.csvPath);
    }
}).mount('#app');
