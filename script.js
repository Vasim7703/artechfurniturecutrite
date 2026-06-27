document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const statusMessage = document.getElementById('statusMessage');
    const statusText = document.getElementById('statusText');

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight dropzone on drag over
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.remove('dragover');
        }, false);
    });

    // Handle dropped files
    dropzone.addEventListener('drop', handleDrop, false);

    // Handle selected files via input
    fileInput.addEventListener('change', function() {
        if (this.files && this.files.length > 0) {
            processFile(this.files[0]);
        }
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files && files.length > 0) {
            processFile(files[0]);
        }
    }

    function showStatus(message, isError = false) {
        statusMessage.className = `status-message ${isError ? 'error' : 'success'}`;
        statusMessage.innerHTML = `<span class="status-icon">${isError ? '✕' : '✓'}</span><p>${message}</p>`;
        statusMessage.classList.remove('hidden');
    }

    function hideStatus() {
        statusMessage.classList.add('hidden');
    }

    function processFile(file) {
        hideStatus();

        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            showStatus('Please upload a valid CSV file.', true);
            return;
        }

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                try {
                    if (results.errors && results.errors.length > 0) {
                        console.warn("Parse warnings:", results.errors);
                    }
                    
                    const data = results.data;
                    if (data.length === 0) {
                        showStatus('The CSV file appears to be empty.', true);
                        return;
                    }

                    const processedData = processHomagData(data);
                    
                    const originalName = file.name.replace('.csv', '');
                    downloadCSV(processedData, `${originalName}_Processed.csv`);
                    
                    showStatus('Processing complete! Your file is downloading.');
                } catch (error) {
                    console.error("Processing error:", error);
                    showStatus('An error occurred during processing. Please check the console.', true);
                }
            },
            error: function(error) {
                console.error("Parsing error:", error);
                showStatus('Failed to read the CSV file.', true);
            }
        });
    }

    function processHomagData(data) {
        // 1. Normalize Venner_ naming convention across all fields
        const fixVenner = (val) => {
            if (typeof val !== 'string') return val;
            if (val.includes('+Venner_+')) {
                let parts = val.split('+');
                let vIndex = parts.indexOf('Venner_');
                if (vIndex !== -1 && vIndex < parts.length - 1) {
                    parts.splice(vIndex, 1);
                    parts.push('Venner_');
                    return parts.join('+');
                }
            }
            return val;
        };

        data.forEach(row => {
            Object.keys(row).forEach(key => {
                row[key] = fixVenner(row[key]);
            });
        });

        // 2. Process the "Grain" logic (0 -> N, 1 -> Y)
        data.forEach(row => {
            if (row.hasOwnProperty('Grain') && row['Grain'] !== null && row['Grain'] !== undefined) {
                const val = String(row['Grain']).trim();
                if (val === '0' || val === '0.0') {
                    row['Grain_Mapped'] = 'N';
                } else if (val === '1' || val === '1.0') {
                    row['Grain_Mapped'] = 'Y';
                } else {
                    row['Grain_Mapped'] = 'Y'; // Fallback for invalid values
                }
            } else {
                row['Grain_Mapped'] = 'Y'; // Fallback if missing
            }
        });

        // 4. Generate the "X of Y" grouping logic
        const groups = {};
        data.forEach(row => {
            const poArticle = row['PO&Article'] || '';
            const artDesc = row['ART_DESC'] || '';
            const key = `${poArticle}|${artDesc}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(row);
        });

        Object.keys(groups).forEach(key => {
            const group = groups[key];
            const totalY = group.length;
            group.forEach((row, index) => {
                row['Total_Y'] = totalY;
                row['Current_X'] = index + 1;
            });
        });

        // 3. & 5. Map to 32 columns
        const cleanData = data.map(row => {
            const indexVal = row['Index'] || '';
            const partName = row['PartName'] || '';
            const col1 = (indexVal && partName) ? `${indexVal}-${partName}` : (indexVal || partName);

            return [
                col1,                                   // Col1
                row['MATNAME'] || '',                   // Col2
                row['CLENG'] || '',                     // Col3
                row['CWIDTH'] || '',                    // Col4
                row['CNT'] || '',                       // Col5
                "",                                     // Col6
                "",                                     // Col7
                row['Grain_Mapped'],                    // Col8 (Dynamic Grain logic)
                "",                                     // Col9
                row['Barcode'] || '',                   // Col10
                row['MAT'] || '',                       // Col11
                row['PO&Article'] || '',                // Col12
                row['EdgeTransition'] || '',            // Col13
                row['Edge1'] || '',                     // Col14
                row['Edge3'] || '',                     // Col15
                row['Edge4'] || '',                     // Col16
                row['Edge2'] || '',                     // Col17
                row['Customer_Order'] || '',            // Col18
                row['Customername'] || '',              // Col19
                row['CustomerCompany'] || '',           // Col20
                row['SURFBOT'] || '',                   // Col21
                `${row['Current_X'] || ''} of ${row['Total_Y'] || ''}`, // Col22
                row['SURFTOP'] || '',                   // Col23
                row['ART_DESC'] || '',                  // Col24
                row['ART_SIZE'] || '',                  // Col25
                row['CNC_1'] || '',                     // Col26
                row['CNC_2'] || '',                     // Col27
                row['CUT_THK'] || '',                   // Col28
                row['FinishLength'] || '',              // Col29
                row['FinishWitdh'] || '',               // Col30
                row['FinishThickness'] || '',           // Col31
                row['BITMAPS'] || ''                    // Col32
            ];
        });

        return cleanData;
    }

    function downloadCSV(data, filename) {
        // 6. Export without column headers, saved as a standard comma CSV
        const csv = Papa.unparse(data, {
            header: false,
            delimiter: ",",
            skipEmptyLines: true
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        
        if (navigator.msSaveBlob) { // IE 10+
            navigator.msSaveBlob(blob, filename);
        } else {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url); // Clean up memory
        }
    }
});
