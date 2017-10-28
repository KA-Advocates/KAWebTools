
// not yet finished
class PatternIndexer {
    constructor() {
        this.index = {}
        this.translated = {}
    }

    /**
     * Index a english string with optional translation
     */
    add(engl, translation=null) {
        // Remove digits
        let normalized = engl.replace(/\d/g, "")
        if(this.index[normalized] === undefined) {
            this.index[normalized] = []
        }
        this.index[normalized].push(engl)
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

    showStats() {
        console.info(`Pattern storage has ${Object.keys(this.index).length} patterns`)
        let numSiblings = _.sum(Object.values(this.index).map(v => v.length))
        console.info(`Pattern storage has ${numSiblings} strings in total`)
    }

    exportJSON() {
        downloadFile(JSON.stringify(this.index), "pattern-index.json", "application/json")
    }

    exportCSV() {
        let data = 
            _.reverse( // Sort descending
                _.sortBy(Object.entries(this.index), kv => kv[1]) // Sort by num occurrences
            )
        let csv = "";
        for(let [k,v] of data) {
            csv += `"${k.replace("\n", "\\n").replace("\r", "\\r")}",${v.length}\n`;
        }
        downloadFile(csv, "pattern-index.csv", "application/json")
    }
}

/**
 * Get a list of all matches of re in s (full match object returned)
 */
function findAllRegexMatches(s, re) {
    let ret = [];
    let m = null;
    while (m = re.exec(s)) {
        ret.push(m);
    }
    return ret;
}

class TextBlockIndexer {
    constructor() {
        this.index = {} // Text block content => num occurrences
    }

    /**
     * Index a english string with optional translation
     */
    add(engl, translation=null) {
        // Find all text elements
        let matches = findAllRegexMatches(engl, /\\text\{([^\}]+)\}/g);
        for(let match of matches) {
            let inside = match[1]; // inside of text tag
            // Add to index
            if(this.index[inside] === undefined) { // Not yet seen
                this.index[inside] = 0;
            }
            // Increment count
            this.index[inside]++;
        }
    }

    cleanup() {
    }

    print() {
        for(let [k,v] of Object.entries(this.index)) {
                console.log(v)
        }
    }

    exportJSON() {
        downloadFile(JSON.stringify(
            _.reverse( // Sort descending
                _.sortBy(Object.entries(this.index), kv => kv[1]) // Sort by num occurrences
            )
        ), "text-blocks.json", "application/json")
    }

    exportCSV() {
        let data = 
            _.reverse( // Sort descending
                _.sortBy(Object.entries(this.index), kv => kv[1]) // Sort by num occurrences
            )
        let csv = "";
        for(let [k,v] of data) {
            csv += `"${k}",${v}\n`;
        }
        downloadFile(csv, "text-blocks.csv", "application/json")
    }
}