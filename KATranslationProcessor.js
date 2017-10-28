// Global indexers
let pat = new PatternIndexer();
let tbi = new TextBlockIndexer();

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
    // contains a \text{ clause except specific text clauses:
    //   \text{ cm}
    //   \text{ m}
    //   \text{ g}
    let containsText = english.match(/\\text\{(?! ?cm\})(?! ?m\})(?! ?g\})/);
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

    for (let trans of Object.values(po.translations[''])) {
        let engl = trans.msgid;
        // Ignore everything but first translations
        let translation = trans.msgstr === undefined ? null : trans.msgstr[0];
        // Does string have at least one translation?
        let hasTranslations = translation != "";

        tbi.add(engl, translation);
        pat.add(engl, translation)
        // Try to auto-translate if it has any translations
        if(!hasTranslations) {
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
    pat.cleanup()
    pat.showStats()
    return newPO;
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

function handleParsedXLIFF(dom) {
    let bodies = dom.getElementsByTagName("body")
    for(let body of bodies) { // Usually there is only one  body
        let transUnits = body.getElementsByTagName("trans-unit")
        let toRemove = []
        for(let transUnit of transUnits) {
            let source = transUnit.getElementsByTagName("source")[0]
            let target = transUnit.getElementsByTagName("target")[0]
            let isUntranslated = (target.getAttribute("state") == "needs-translation");
            let mayRemove = true; // set to false when we auto-translate it. false means we won't delete it from the result
            // Get msgid/msgstr equivalent
            let engl = source.innerHTML;
            let translated = isUntranslated ? null : target.innerHTML;
            // Index
            tbi.add(engl, translated);
            if(isUntranslated) {
                pat.add(engl, translated);
                let autotranslation = tryAutotranslate(engl, translated);
                if(autotranslation) { // if we have an autotranslation
                    target.innerHTML = autotranslation;
                    target.removeAttribute("state"); // Remove "needs-translation"
                    mayRemove = false; // Include in the final file
                    // Update UI
                    showAutotranslatedString(engl, autotranslation);
                }
            }
            // Remove context in order to save space
            let notes = transUnit.getElementsByTagName("note");
            for(let note of notes) {
                transUnit.removeChild(note)
            }
            // Remove (whitespace) text nodes inside <trans-unit> to save space
            for(let child of transUnit.childNodes) {
                if(child.nodeType == Node.TEXT_NODE) {
                    transUnit.removeChild(child)
                }
            }
            // Delete element if we didnt autotranslate
            if(mayRemove) {
                toRemove.push(transUnit)
            }
        }
        // Remove (whitespace-only) text content (from pretty XML formatting) from the body to reduce size
        for(let child of body.childNodes) {
            if(child.nodeType == Node.TEXT_NODE) {
                toRemove.push(child);
            }
        }
        // Remove non-autotranslated elements
        for(let toRemoveElem of toRemove) {
            body.removeChild(toRemoveElem);
        }
    }
    return dom; // modified DOM
}

function handleSelectedFile(file) {
    $("#progressMsg").text(`Loading ${file.name} ...`)
    if(file.name.endsWith(".po")) {
        let pop = new POParser();
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
    } else if (file.name.endsWith(".xliff")) {
        processLocalFile(file, (content) => {
            let parser = new DOMParser();
            // File loaded ; progress = 50%
            $("#loadProgress").attr("value", 50);
            let dom = parser.parseFromString(content, "application/xml");
            // File parsed ; progress = 100%
            $("#loadProgress").attr("value", 100);
            $("#progressMsg").text("Auto-translating... ")
            // Modify DOM with auto-translations
            dom = handleParsedXLIFF(dom);
            // Export DOM = download
            $("#progressMsg").text("Exporting...")
            let xml = new XMLSerializer().serializeToString(dom);
            downloadFile(xml, `${file.name}.translated.xliff`, "application/xml")
        }, console.error)
    } else {
        alert(`Unknown file (please use PO or XLIFF): ${file.name}`)
    }
}

/**
* This is called when the user selected a file
* It reads the file (in chunks)
*/
function onFileSelected(files) {
    for(let file of files) {
        handleSelectedFile(file);
    }
}

if(typeof module !== "undefined") {
    const _ = require("lodash")
    module.exports = {
        tryAutotranslate: tryAutotranslate
    }
}