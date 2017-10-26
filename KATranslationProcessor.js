
/**
 * This is called for untranslated strings.
 * It will not be called for already-translated strings
 * 
 * Must return the translated string if it can be translated.
 * Must return null if the string can't be auto-translated.
 */
function tryAutotranslate(english, translated) {
    // Formulas
    let isFormulaOnly = english.match(/^\$[^\$]+\$(\s|\\n)*$/g);
    let containsText = _.includes(english, "\\text{");
    // URLs:
    //   ![](web+graphie://ka-perseus-graphie.s3.amazonaws.com/...)
    //   web+graphie://ka-perseus-graphie.s3.amazonaws.com/...
    //   https://ka-perseus-graphie.s3.amazonaws.com/...png
    let isPerseusImageURL = english.match(/^(!\[\]\()?\s*(http|https|web\+graphie):\/\/ka-perseus-(images|graphie)\.s3\.amazonaws\.com\/[0-9a-f]+(\.(svg|png|jpg))?\)?\s*$/g)

    if(isFormulaOnly && !containsText) {
        return english; // Nothing to translate
    }

    if(isPerseusImageURL) {
        return english; // Nothing to translate
    }

    // Can't autotranslate
    return null;
}

/**
 * In the UI, show that we have autotranslated something.
 * Modify this if it doesn't look good in the UI ;-)
 */
function showAutotranslatedString(english, translated) {
    $("#results").append(`<p>Auto-translated <em>${english}</em> to <em>${translated}</em></p>`)
}

function handleTranslations(po) {
    let autoTranslatedCount = 0;
    for (let trans of Object.values(po)) {
        let engl = trans.msgid;
        // Ignore everything but first translations
        let translation = trans.msgstr === undefined ? "" : trans.msgstr[0];
        // Does string have at least one translation?
        let hasTranslations = translation != "";
        // Try to auto-translate if it has any translations
        if(!hasTranslations) {
            let autotranslation = tryAutotranslate(engl, translation);
            if(autotranslation) {
                // Insert into PO data structure (will be exported later)
                trans.msgstr = [autotranslation];
                // Update UI
                showAutotranslatedString(engl, autotranslation);
                // Update stats
                autoTranslatedCount++;
            }
        }
        // Remove comments, they just take up space in the resulting  file
        delete trans.comments;
    }
    return autoTranslatedCount;
 }

/**
 * Handle a parsed PO object
 */
function handlePOObject(filename, po) {
    let autoTranslatedCount = 0;
    // Remove previous results
    $("#results").empty();
    // Go through PO file and try to auto-translate untranslated strings.
    autoTranslatedCount += handleTranslations(po.translations['']);
    $("#progressMsg").text(`Auto-translated ${autoTranslatedCount} strings`)
    // Export to new PO
    downloadFile(new POExporter(po).compile(),
        filename + ".translated.po",
        'text/x-gettext-translation')
}

  /**
   * This is called when the user selected a file
   * It reads the file (in chunks)
   */
function onFileSelected(files) {
    let file = files[0];
    let pop = new POParser();
    $("#progressMsg").text(`Loading ${file.name} ...`)

    processLocalFileInChunks(file, (chunk, currentChunk, nchunks) => { // On chunk
        pop._lexer(chunk);
        // Update progress
        $("#loadProgress").attr("value", 100 * (currentChunk / nchunks))
    }, () => { // On finished
        let po = pop._finalize();
        $("#progressMsg").text("Auto-translating... ")
        handlePOObject(file.name, po);
    }, (err) => { // Error while reading file
        $("#progressMsg").text(`Read error: ${err}`);
    })
}