/**
 * Configuration file for the Slide Viewer
 * Update these paths to match your local setup
 */

const CONFIG = {
    // Default dataset to load
    defaultDataset: 'TCGA_ID',

    // DEBUG: Version marker to check if config is cached
    configVersion: 'v5_2026-03-09',

    // Server configuration
    server: {
        port: 8080,
        host: 'localhost'
    },

    // Display settings
    display: {
        defaultQcOpacity: 50,
        defaultAttentionOpacity: 70,
        showQcOverlayByDefault: true,
        showAttentionOverlayByDefault: false,
    },

    // QC Mask color coding configuration
    qcMask: {
        categories: {
            1: { name: 'Tissue', color: '#4CAF50', description: 'Good quality tissue' },
            2: { name: 'Fold', color: '#FFC107', description: 'Tissue folding' },
            3: { name: 'Dark Spot', color: '#8B4513', description: 'Artifacts & foreign objects' },
            4: { name: 'Pen Marker', color: '#E91E63', description: 'Ink markings' },
            5: { name: 'Edge/Bubble', color: '#2196F3', description: 'Boundaries & air bubbles' },
            6: { name: 'Out of Focus', color: '#9E9E9E', description: 'Focus issues' },
            7: { name: 'Background', color: '#F5F5F5', description: 'Background/empty' }
        },
        defaultOpacity: 0.7,
        showLegendByDefault: false,
        showStatsByDefault: false
    },

    // Dataset-specific configurations
    datasets: {
        TCGA_ID: {
            name: 'TCGA In-Distribution',

            csvPath: '/mnt/disks/ahaas-persistent-std-tcga/data/metadata/clam_training/df_summary_v10.csv',

            thumbnailBasePath: '/mnt/disks/slides-tcga',
            qcMaskBasePath: '/mnt/disks/slides-tcga',

            resultsBasePath: '/mnt/disks/ahaas-persistent-std-tcga/results',
            analysisDir: 'analysis_tcga_id_test',
            defaultExperiment: 'v4.0_reg_tls',
            predictionsFile: 'tcga_id_test_results.csv',

            columnMapping: {
                sampleId: 'slide_id',
                filePath: 'slide_path',
                maskPath: 'path_grandqc_mask',
                cancerType: 'cancer_type',
                biopsySite: 'cancer_type',
                procedureDate: 'initial_pathologic_dx_year',
            },

            imagePatterns: {
                thumbnail: [
                    '{basePath}/{sampleId}.svs.jpg',
                    '{basePath}/{sampleId}.jpg',
                ],
                qcMask: [
                    '{basePath}/{sampleId}_qc.png',
                    '{basePath}/{sampleId}_mask.png',
                ],
                attentionMap: [],
            }
        },

        TCGA_OOD: {
            name: 'TCGA Out-of-Distribution',

            csvPath: '/mnt/disks/ahaas-persistent-std-tcga/data/metadata/description/tcga_slides_univ2_grandqc_clinical_v2.csv',

            thumbnailBasePath: '/mnt/disks/slides-tcga',
            qcMaskBasePath: '/mnt/disks/slides-tcga',

            resultsBasePath: '/mnt/disks/ahaas-persistent-std-tcga/results',
            analysisDir: 'analysis_tcga_ood_test',
            defaultExperiment: 'v4.0_reg_tls',
            predictionsFile: 'tcga_ood_test_results.csv',

            columnMapping: {
                sampleId: 'slide_id',
                filePath: 'slide_path',
                maskPath: 'path_mask',
                cancerType: 'type',
                biopsySite: 'tcga_id',
                procedureDate: 'initial_pathologic_dx_year',
            },

            imagePatterns: {
                thumbnail: [
                    '{basePath}/{sampleId}.svs.jpg',
                    '{basePath}/{sampleId}.jpg',
                ],
                qcMask: [
                    '{basePath}/{sampleId}_qc.png',
                    '{basePath}/{sampleId}_mask.png',
                ],
                attentionMap: [],
            }
        },

        PROFILE_READER_STUDY: {
            name: 'PROFILE Reader Study',
            prepopulateIds: true,

            csvPath: '/mnt/disks/ahaas-persistent-std-profile/data/metadata/reader_study/all_slides_reader_study.csv',

            thumbnailBasePath: '/mnt/disks/ahaas-persistent-std-profile/data/preprocessing',
            qcMaskBasePath: '/path/to/profile_reader_study/qc_masks',          // TODO

            resultsBasePath: '/mnt/disks/ahaas-persistent-std-tcga/results',
            analysisDir: 'analysis_profile_reader_study',
            defaultExperiment: 'v4.0_reg_tls',
            predictionsFile: 'profile_results_readerstudy.csv',

            columnMapping: {
                sampleId: 'SAMPLE_ACCESSION',
                filePath: 'FILE_PATH',
                maskPath: 'MASK_PATH',
                cancerType: 'onco_tree_code_level_2',
                biopsySite: 'BIOPSY_SITE',
                procedureDate: 'PROCEDURE_DT',
            },

            imagePatterns: {
                thumbnail: [
                    '{basePath}/{sampleId}.svs',
                ],
                qcMask: [
                    '{basePath}/{sampleId}.svs_mask.png',
                ],
                attentionMap: [
                    '{basePath}/{sampleId}.svs_overlay_QC.jpg',
                    '{basePath}/{sampleId}.svs_OVERLAY.jpg',
                    '{basePath}/{sampleId}_attention.png',
                ]
            }
        },

        PROFILE: {
            name: 'PROFILE',

            csvPath: '/mnt/disks/ahaas-persistent-std-profile/data/metadata/images/df_he_all_v3_grandqc.csv',

            thumbnailBasePath: '/mnt/disks/ahaas-persistent-std-profile/data/preprocessing',
            qcMaskBasePath: '/path/to/profile/qc_masks',                        // TODO

            resultsBasePath: '/path/to/profile/results',                        // TODO
            analysisDir: 'analysis_profile',                                    // TODO
            defaultExperiment: 'v1.0',                                          // TODO
            predictionsFile: 'profile_results.csv',

            columnMapping: {
                sampleId: 'SAMPLE_ACCESSION',
                filePath: 'FILE_PATH',
                maskPath: 'MASK_PATH',
                cancerType: 'onco_tree_code_level_2',
                biopsySite: 'BIOPSY_SITE',
                procedureDate: 'PROCEDURE_DT',
            },

            imagePatterns: {
                thumbnail: [
                    '{basePath}/{sampleId}.svs.jpg',
                ],
                qcMask: [
                    '{basePath}/{sampleId}.svs_mask.png',
                ],
                attentionMap: [
                    '{basePath}/{sampleId}.svs_overlay_QC.jpg',
                    '{basePath}/{sampleId}.svs_OVERLAY.jpg',
                    '{basePath}/{sampleId}_attention.png',
                ]
            }
        },

        CM_25: {
            name: 'CM-25',

            csvPath: '/path/to/cm_25/metadata.csv',                             // TODO

            thumbnailBasePath: '/path/to/cm_25/thumbnails',                     // TODO
            qcMaskBasePath: '/path/to/cm_25/qc_masks',                          // TODO

            resultsBasePath: '/path/to/cm_25/results',                          // TODO
            analysisDir: 'analysis_cm_25',                                      // TODO
            defaultExperiment: 'v1.0',                                          // TODO
            predictionsFile: 'checkmate_025_results.csv',

            columnMapping: {
                sampleId: 'sample_id',                                          // TODO
                filePath: 'file_path',                                          // TODO
                maskPath: 'mask_path',                                          // TODO
                cancerType: 'cancer_type',                                      // TODO
                biopsySite: 'biopsy_site',                                      // TODO
                procedureDate: 'procedure_date',                                // TODO
            },

            imagePatterns: {
                thumbnail: [
                    '{basePath}/{sampleId}.svs.jpg',
                    '{basePath}/{sampleId}.jpg',
                ],
                qcMask: [
                    '{basePath}/{sampleId}_mask.png',
                    '{basePath}/{sampleId}_qc.png',
                ],
                attentionMap: [
                    '{basePath}/{sampleId}_attention.jpg',
                    '{basePath}/{sampleId}_overlay.jpg',
                ]
            }
        },

        CM_214: {
            name: 'CM-214',

            csvPath: '/path/to/cm_214/metadata.csv',                            // TODO

            thumbnailBasePath: '/path/to/cm_214/thumbnails',                    // TODO
            qcMaskBasePath: '/path/to/cm_214/qc_masks',                         // TODO

            resultsBasePath: '/path/to/cm_214/results',                         // TODO
            analysisDir: 'analysis_cm_214',                                     // TODO
            defaultExperiment: 'v1.0',                                          // TODO
            predictionsFile: 'checkmate_214_results.csv',                       // TODO: confirm filename

            columnMapping: {
                sampleId: 'sample_id',                                          // TODO
                filePath: 'file_path',                                          // TODO
                maskPath: 'mask_path',                                          // TODO
                cancerType: 'cancer_type',                                      // TODO
                biopsySite: 'biopsy_site',                                      // TODO
                procedureDate: 'procedure_date',                                // TODO
            },

            imagePatterns: {
                thumbnail: [
                    '{basePath}/{sampleId}.svs.jpg',
                    '{basePath}/{sampleId}.jpg',
                ],
                qcMask: [
                    '{basePath}/{sampleId}_mask.png',
                    '{basePath}/{sampleId}_qc.png',
                ],
                attentionMap: [
                    '{basePath}/{sampleId}_attention.jpg',
                    '{basePath}/{sampleId}_overlay.jpg',
                ]
            }
        }
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
