
/**
 * Try to autotranslate simple strings
 *
 * This is called for untranslated strings.
 * It will not be called for already-translated strings
 * 
 * Must return the translated string if it can be translated.
 * Must return null if the string can't be auto-translated.
 */
function tryAutotranslate(english, translated) {
    // Formulas:
    //   $...$
    //    **$...$
    let isFormula = english.match(/^>?[\s\*]*(\$[^\$]+\$(\s|\\n|\*)*)+$/g);
    // contains a \\text{ clause except specific text clauses:
    //   \\text{ cm}
    //   \\text{ m}
    //   \\text{ g}
    let containsText = english.match(/\\\\text\{(?! ?cm\})(?! ?m\})(?! ?g\})/);
    // URLs:
    //   ![](web+graphie://ka-perseus-graphie.s3.amazonaws.com/...)
    //   web+graphie://ka-perseus-graphie.s3.amazonaws.com/...
    //   https://ka-perseus-graphie.s3.amazonaws.com/...png
    let isPerseusImageURL = english.match(/^(!\[\]\()?\s*(http|https|web\+graphie):\/\/ka-perseus-(images|graphie)\.s3\.amazonaws\.com\/[0-9a-f]+(\.(svg|png|jpg))?\)?\s*$/g)

    let isFormulaPlusImage = english.match(/^>?[\s\*]*(\$[^\$]+\$(\s|\\n|\*)*)+(!\[\]\()?\s*(http|https|web\+graphie):\/\/ka-perseus-(images|graphie)\.s3\.amazonaws\.com\/[0-9a-f]+(\.(svg|png|jpg))?\)?\s*$/g)

    if(isFormula && !containsText) {
        return english; // Nothing to translate
    }

    if(isPerseusImageURL || isFormulaPlusImage) {
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
    // We will only export autotranslated strings
    let newPO = _.clone(po);
    newPO.translations = {'': []}

    let eff = new ExperimentalFooFinder()

    for (let trans of Object.values(po.translations[''])) {
        let engl = trans.msgid;
        // Ignore everything but first translations
        let translation = trans.msgstr === undefined ? null : trans.msgstr[0];
        // Does string have at least one translation?
        let hasTranslations = translation != "";
        // Try to auto-translate if it has any translations
        if(!hasTranslations) {
            eff.add(engl, translation)
            let autotranslation = tryAutotranslate(engl, translation);
            if(autotranslation) { // if we have an autotranslation
                // Insert new PO data structure (will be exported later)
                newPO.translations[''].push({
                    msgid: engl,
                    msgstr: [autotranslation]
                })
                // Update UI
                showAutotranslatedString(engl, autotranslation);
            }
        }
    }
    eff.cleanup()
    eff.exportJSON()
    return newPO;
 }

// not yet finished
class ExperimentalFooFinder {
    constructor() {
        this.index = {}
        this.translated = {}
    }

    /**
     * Index a english string with optional translation
     */
    add(engl, translation=null) {
        let normalized = engl.replace(/\d/g, "")
        if(this.index[normalized] === undefined) {
            this.index[normalized] = []
        }
        this.index[normalized].push(engl)
        if(translation !== null) {
            this.translated[normalized] = {msgid: engl, msgstr: translation}
        }
    }

    /**
     * Remove strings with no indexed duplicates from the index
     * Call this after indexing all strings 
     */
    cleanup() {
        this.index = _.pickBy(this.index, v => v.length > 1)
    }

    print() {
        for(let [k,v] of Object.entries(this.index)) {
            if(v.length > 2) {
                console.log(v)
            }
        }
    }

    exportJSON() {
        downloadFile(JSON.stringify({
            index: this.index,
            translations: this.translated
        }), "my.json", "application/json")
    }
}
/**
 * Handle a parsed PO object
 */
function handlePOObject(filename, po) {
    // Remove previous results
    $("#results").empty();
    // Go through PO file and try to auto-translate untranslated strings.
    let newPO = handleTranslations(po);
    let autoTranslatedCount = newPO.translations[''].length;
    $("#progressMsg").text(`Auto-translated ${autoTranslatedCount} strings`)
    // Export to new PO
    downloadFile(new POExporter(newPO).compile(),
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

if(typeof module !== "undefined") {
    const _ = require("lodash")
    module.exports = {
        tryAutotranslate: tryAutotranslate
    }
}