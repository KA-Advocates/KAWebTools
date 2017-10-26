/**
 * Based on https://github.com/smhg/gettext-parser
 * Modified for ES6 and browser compat by Uli Köhler (2017)
 * Licensed under the MIT license
 */

class POParser {

    /**
     * State constants for parsing FSM
     */
    static get states() {
        return {
            none: 0x01,
            comments: 0x02,
            key: 0x03,
            string: 0x04
        }
    }

    /**
     * Value types for lexer
     */
    static get types() {
        return {
            comments: 0x01,
            key: 0x02,
            string: 0x03
        };
    }

    /**
     * String matches for lexer
     */
    static get symbols() {
        return {
            quotes: /["']/,
            comments: /#/,
            whitespace: /\s/,
            key: /[\w\-[\]]/
        };
    }

    /**
     * Creates a PO parser object. If PO object is a string,
     * UTF-8 will be used as the charset
     *
     * @constructor
     * @param {Buffer|String} fileContents PO object
     * @param {String} [defaultCharset] Default charset to use
     */
    constructor(fileContents, defaultCharset) {
        this._charset = defaultCharset || 'utf-8';

        this._lex = [];
        this._escaped = false;
        this._node = {};
        this._state = POParser.states.none;

        if (typeof fileContents === 'string') {
            this._charset = 'utf-8';
            this._fileContents = fileContents;
        } else {
            this._handleCharset(fileContents);
        }
    }

    /**
     * Parses the PO object and returns translation table
     *
     * @return {Object} Translation table
     */
    parse() {
        this._lexer(this._fileContents);
        return this._finalize(this._lex);
    }

    /**
     * Parses a header string into an object of key-value pairs
     *
     * @param {String} str Header string
     * @return {Object} An object of key-value pairs
     */
    static parseHeader(str) {
        var lines = (str || '').split('\n');
        var headers = {};

        for(let line of lines) {
            let parts = line.trim().split(':');
            let key = (parts.shift() || '').trim().toLowerCase();
            let value = parts.join(':').trim();
            if (key) {
                headers[key] = value;
            }
        }

        return headers;
    }


    /**
     * Normalizes charset name. Converts utf8 to utf-8, WIN1257 to windows-1257 etc.
     *
     * @param {String} charset Charset name
     * @return {String} Normalized charset name
     */
    static formatCharset(charset, defaultCharset) {
        return (charset || 'iso-8859-1').toString().toLowerCase()
            .replace(/^utf[-_]?(\d+)$/, 'utf-$1')
            .replace(/^win(?:dows)?[-_]?(\d+)$/, 'windows-$1')
            .replace(/^latin[-_]?(\d+)$/, 'iso-8859-$1')
            .replace(/^(us[-_]?)?ascii$/, 'ascii')
            .replace(/^charset$/, defaultCharset || 'iso-8859-1')
            .trim();
    }



    /**
     * Detects charset for PO strings from the header
     *
     * @param {Buffer} headers Header value
     */
    _handleCharset(buf) {
        var str = (buf || '').toString();
        var pos;
        var headers = '';
        var match;

        if ((pos = str.search(/^\s*msgid/im)) >= 0) {
            if ((pos = pos + str.substr(pos + 5).search(/^\s*(msgid|msgctxt)/im))) {
                headers = str.substr(0, pos);
            }
        }

        if ((match = headers.match(/[; ]charset\s*=\s*([\w-]+)(?:[\s;]|\\n)*"\s*$/mi))) {
            this._charset = POParser.formatCharset(match[1], this._charset);
        }

        if (this._charset === 'utf-8') {
            this._fileContents = str;
        } else {
            // requires text-encoding library
            this._fileContents = new TextDecoder(this._charset).decode(buf);
        }
    }

    /**
     * Token parser. Parsed state can be found from this._lex
     *
     * @param {String} chunk String
     */
    _lexer(chunk) {
        for (var i = 0, len = chunk.length; i < len; i++) {
            let chr = chunk.charAt(i);
            switch (this._state) {
                case POParser.states.none:
                    if (chr.match(POParser.symbols.quotes)) {
                        this._node = {
                            type: POParser.types.string,
                            value: '',
                            quote: chr
                        };
                        console.log
                        this._lex.push(this._node);
                        this._state = POParser.states.string;
                    } else if (chr.match(POParser.symbols.comments)) {
                        this._node = {
                            type: POParser.types.comments,
                            value: ''
                        };
                        this._lex.push(this._node);
                        this._state = POParser.states.comments;
                    } else if (!chr.match(POParser.symbols.whitespace)) {
                        this._node = {
                            type: POParser.types.key,
                            value: chr
                        };
                        this._lex.push(this._node);
                        this._state = POParser.states.key;
                    }
                    break;
                case POParser.states.comments:
                    if (chr === '\n') {
                        this._state = POParser.states.none;
                    } else if (chr !== '\r') {
                        this._node.value += chr;
                    }
                    break;
                case POParser.states.string:
                    if (this._escaped) {
                        switch (chr) {
                            case 't':
                                this._node.value += '\t';
                                break;
                            case 'n':
                                this._node.value += '\n';
                                break;
                            case 'r':
                                this._node.value += '\r';
                                break;
                            default:
                                this._node.value += chr;
                        }
                        this._escaped = false;
                    } else {
                        if (chr === this._node.quote) {
                            this._state = POParser.states.none;
                        } else if (chr === '\\') {
                            this._escaped = true;
                            break;
                        } else {
                            this._node.value += chr;
                        }
                        this._escaped = false;
                    }
                    break;
                case POParser.states.key:
                    if (!chr.match(POParser.symbols.key)) {
                        this._state = POParser.states.none;
                        i--;
                    } else {
                        this._node.value += chr;
                    }
                    break;
            }
        }
    }

    /**
     * Join multi line strings
     *
     * @param {Object} tokens Parsed tokens
     * @return {Object} Parsed tokens, with multi line strings joined into one
     */
    _joinStringValues(tokens) {
        var lastNode;
        var response = [];

        for (var i = 0, len = tokens.length; i < len; i++) {
            if (lastNode && tokens[i].type === POParser.types.string && lastNode.type === POParser.types.string) {
                lastNode.value += tokens[i].value;
            } else if (lastNode && tokens[i].type === POParser.types.comments && lastNode.type === POParser.types.comments) {
                lastNode.value += '\n' + tokens[i].value;
            } else {
                response.push(tokens[i]);
                lastNode = tokens[i];
            }
        }

        return response;
    }



    /**
     * Parse comments into separate comment blocks
     *
     * @param {Object} tokens Parsed tokens
     */
    _parseComments(tokens) {
        // parse comments
        for(let node of tokens) {
            var comment, lines;

            if (node && node.type === POParser.types.comments) {
                comment = {
                    translator: [],
                    extracted: [],
                    reference: [],
                    flag: [],
                    previous: []
                };
                lines = (node.value || '').split(/\n/);
                for(let line of lines) {
                    switch (line.charAt(0) || '') {
                        case ':':
                            comment.reference.push(line.substr(1).trim());
                            break;
                        case '.':
                            comment.extracted.push(line.substr(1).replace(/^\s+/, ''));
                            break;
                        case ',':
                            comment.flag.push(line.substr(1).replace(/^\s+/, ''));
                            break;
                        case '|':
                            comment.previous.push(line.substr(1).replace(/^\s+/, ''));
                            break;
                        default:
                            comment.translator.push(line.replace(/^\s+/, ''));
                    }
                }
                node.value = {};

                for(let key of Object.keys(comment)) {
                    if (comment[key] && comment[key].length) {
                        node.value[key] = comment[key].join('\n');
                    }
                }
            }
        }
    }

    /**
     * Join gettext keys with values
     *
     * @param {Object} tokens Parsed tokens
     * @return {Object} Tokens
     */
    _handleKeys(tokens) {
        var response = [];
        var lastNode;

        for (var i = 0, len = tokens.length; i < len; i++) {
            if (tokens[i].type === POParser.types.key) {
                lastNode = {
                    key: tokens[i].value
                };
                if (i && tokens[i - 1].type === POParser.types.comments) {
                    lastNode.comments = tokens[i - 1].value;
                }
                lastNode.value = '';
                response.push(lastNode);
            } else if (tokens[i].type === POParser.types.string && lastNode) {
                lastNode.value += tokens[i].value;
            }
        }

        return response;
    }


    /**
     * Separate different values into individual translation objects
     *
     * @param {Object} tokens Parsed tokens
     * @return {Object} Tokens
     */
    _handleValues(tokens) {
        var response = [];
        var lastNode;
        var curContext;
        var curComments;

        for (var i = 0, len = tokens.length; i < len; i++) {
            if (tokens[i].key.toLowerCase() === 'msgctxt') {
                curContext = tokens[i].value;
                curComments = tokens[i].comments;
            } else if (tokens[i].key.toLowerCase() === 'msgid') {
                lastNode = {
                    msgid: tokens[i].value
                };

                if (curContext) {
                    lastNode.msgctxt = curContext;
                }

                if (curComments) {
                    lastNode.comments = curComments;
                }

                if (tokens[i].comments && !lastNode.comments) {
                    lastNode.comments = tokens[i].comments;
                }

                curContext = false;
                curComments = false;
                response.push(lastNode);
            } else if (tokens[i].key.toLowerCase() === 'msgid_plural') {
                if (lastNode) {
                    lastNode.msgid_plural = tokens[i].value;
                }

                if (tokens[i].comments && !lastNode.comments) {
                    lastNode.comments = tokens[i].comments;
                }

                curContext = false;
                curComments = false;
            } else if (tokens[i].key.substr(0, 6).toLowerCase() === 'msgstr') {
                if (lastNode) {
                    lastNode.msgstr = (lastNode.msgstr || []).concat(tokens[i].value);
                }

                if (tokens[i].comments && !lastNode.comments) {
                    lastNode.comments = tokens[i].comments;
                }

                curContext = false;
                curComments = false;
            }
        }

        return response;
    }

    /**
     * Compose a translation table from tokens object
     *
     * @param {Object} tokens Parsed tokens
     * @return {Object} Translation table
     */
    _normalize(tokens) {
        var msgctxt;
        var table = {
            charset: this._charset,
            headers: undefined,
            translations: {}
        };

        for (var i = 0, len = tokens.length; i < len; i++) {
            msgctxt = tokens[i].msgctxt || '';

            if (!table.translations[msgctxt]) {
                table.translations[msgctxt] = {};
            }

            if (!table.headers && !msgctxt && !tokens[i].msgid) {
                table.headers = POParser.parseHeader(tokens[i].msgstr[0]);
            }

            table.translations[msgctxt][tokens[i].msgid] = tokens[i];
        }

        return table;
    }

    /**
     * Converts parsed tokens to a translation table
     *
     * @param {Object} tokens Parsed tokens
     * @returns {Object} Translation table
     */
    _finalize(tokens=undefined) {
        if(tokens === undefined) {
            tokens = this._lex;
        }

        var data = this._joinStringValues(tokens);
        this._parseComments(data);
        data = this._handleKeys(data);
        data = this._handleValues(data);

        return this._normalize(data);
    }

}

if(typeof module !== "undefined") {
    module.exports = {
        POParser: POParser,
        parse: function(buffer, defaultCharset) {
            let parser = new POParser(buffer, defaultCharset);
            return parser.parse();
        }
    }
}
