/**
 * Configuration file for the Slide Viewer
 * Update these paths to match your local setup
 */

const CONFIG = {
    // Path to the CSV file with slide metadata and predictions
    csvPath: 'data.csv',
    
    // Base path for slide thumbnails (GrandQC images)
    thumbnailBasePath: 'images',
    
    // Base path for GrandQC quality control masks
    qcMaskBasePath: 'images',
    
    // Base path for attention maps
    attentionMapBasePath: 'images',
    
    // Server configuration
    server: {
        port: 8080,
        host: 'localhost'
    },
    
    // Image path patterns (will try these in order)
    // GrandQC format: {sampleId}.svs.jpg, {sampleId}.svs_map_QC.png, etc.
    imagePatterns: {
        thumbnail: [
            '{basePath}/{sampleId}.svs.jpg',
            '{basePath}/{sampleId}.jpg',
            '{basePath}/{sampleId}.png',
        ],
        qcMask: [
            '{basePath}/{sampleId}.svs_map_QC.png',
            '{basePath}/{sampleId}.svs_MASK_COL.png',
            '{basePath}/{sampleId}_qc_mask.png',
        ],
        attentionMap: [
            '{basePath}/{sampleId}.svs_overlay_QC.jpg',
            '{basePath}/{sampleId}.svs_OVERLAY.jpg',
            '{basePath}/{sampleId}_attention.png',
        ]
    },
    
    // Display settings
    display: {
        defaultQcOpacity: 50,
        defaultAttentionOpacity: 70,
        showQcOverlayByDefault: true,
        showAttentionOverlayByDefault: false,
    },
    
    // CSV column mappings (if your CSV has different column names)
    columnMapping: {
        sampleId: 'SAMPLE_ACCESSION',
        cancerType: 'onco_tree_code_level_2',
        biopsySite: 'BIOPSY_SITE',
        procedureDate: 'PROCEDURE_DT',
        // Add more mappings as needed
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
