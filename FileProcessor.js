

/**
 * Download a string to a file
 */
function downloadFile(content, filename, mimetype) {
    let a = window.document.createElement('a');
    a.href = window.URL.createObjectURL(new Blob([content], {type: mimetype}));
    a.download = filename;

    // Append anchor to body.
    document.body.appendChild(a);
    a.click();

    // Remove anchor from body
    document.body.removeChild(a);
}


/**
 * Read a local file in chunks, called onChunk(), onFinish() and onError()
 * when appropriate.
 */
function processLocalFileInChunks(file, onChunk, onFinish, onError, chunksize=65536) {
    let filesize = file.size
    let offset = 0;
    let currentChunk = 0;
    let nchunks = filesize / chunksize;

    // Read chunk-wise https://stackoverflow.com/a/28318964/2597135
    // This will read a chunk from the file.
    let chunkReaderBlock = function(_offset, length, _file) {
        let reader = new FileReader();
        let blob = _file.slice(_offset, length + _offset);
        reader.onload = readEventHandler;
        reader.readAsText(blob);
    }

    /*
     * This is called once a chunk has been read.
     * It will let onChunk() process the chunk,
     * and then read the next chunk, if any
     */
    let readEventHandler = function(evt) {
        if (evt.target.error == null) { // if no error occured during reading
            offset += evt.target.result.length;
            currentChunk++;
            // Process chunk
            onChunk(evt.target.result, currentChunk, nchunks)
        } else { // Error occured during reading
            onError(evt.target.error)
            return;
        }
        if (offset >= filesize) {
            // Finished
            onFinish()
        } else {
            // Read next chunk
            chunkReaderBlock(offset, chunksize, file);
        }
    }

    // Start reading the first chunk
    chunkReaderBlock(offset, chunksize, file);
}
