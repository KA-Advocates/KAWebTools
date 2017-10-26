/**
 * Based on https://github.com/smhg/gettext-parser
 * Modified for ES6 and browser compat by Uli Köhler (2017)
 * Licensed under the MIT license
 */

/**
 * Convert first letters after - to uppercase, other lowercase
 *
 * @param {String} str String to be updated
 * @return {String} A string with uppercase words
 */
function upperCaseWords (str="") {
  return str
    .toLowerCase()
    .trim()
    .replace(/^(MIME|POT?(?=-)|[a-z])|-[a-z]/gi, function (str) {
      return str.toUpperCase();
    });
}

/**
 * Normalizes charset name. Converts utf8 to utf-8, WIN1257 to windows-1257 etc.
 *
 * @param {String} charset Charset name
 * @return {String} Normalized charset name
 */
function formatCharset (charset, defaultCharset) {
  return (charset || 'iso-8859-1').toString().toLowerCase()
    .replace(/^utf[-_]?(\d+)$/, 'utf-$1')
    .replace(/^win(?:dows)?[-_]?(\d+)$/, 'windows-$1')
    .replace(/^latin[-_]?(\d+)$/, 'iso-8859-$1')
    .replace(/^(us[-_]?)?ascii$/, 'ascii')
    .replace(/^charset$/, defaultCharset || 'iso-8859-1')
    .trim();
}

/**
 * Joins a header object of key value pairs into a header string
 *
 * @param {Object} header Object of key value pairs
 * @return {String} Header string
 */
function generateHeader (header) {
  var lines = [];

  Object.keys(header || {}).forEach(function (key) {
    if (key) {
      lines.push(upperCaseWords(key) + ': ' + (header[key] || '').trim());
    }
  });

  return lines.join('\n') + (lines.length ? '\n' : '');
}


/**
 * Folds long lines according to PO format
 *
 * @param {String} str PO formatted string to be folded
 * @param {Number} [maxLen=76] Maximum allowed length for folded lines
 * @return {Array} An array of lines
 */
function foldLine (str, maxLen) {
  maxLen = maxLen || 76;

  var lines = [];
  var curLine = '';
  var pos = 0;
  var len = str.length;
  var match;

  while (pos < len) {
    curLine = str.substr(pos, maxLen);

    // ensure that the line never ends with a partial escaping
    // make longer lines if needed
    while (curLine.substr(-1) === '\\' && pos + curLine.length < len) {
      curLine += str.charAt(pos + curLine.length);
    }

    // ensure that if possible, line breaks are done at reasonable places
    if ((match = curLine.match(/\\n/))) {
      curLine = curLine.substr(0, match.index + 2);
    } else if (pos + curLine.length < len) {
      if ((match = curLine.match(/(\s+)[^\s]*$/)) && match.index > 0) {
        curLine = curLine.substr(0, match.index + match[1].length);
      } else if ((match = curLine.match(/([\x21-\x40\x5b-\x60\x7b-\x7e]+)[^\x21-\x40\x5b-\x60\x7b-\x7e]*$/)) && match.index > 0) {
        curLine = curLine.substr(0, match.index + match[1].length);
      }
    }

    lines.push(curLine);
    pos += curLine.length;
  }

  return lines;
}

/**
 * Exposes general compiler function. Takes a translation
 * object as a parameter and returns PO object
 *
 * @param {Object} table Translation object
 * @return {Buffer} Compiled PO object
 */

if(typeof module !== "undefined") {
    module.exports = function(table, options) {
        var compiler = new Compiler(table, options);
        return compiler.compile();
    };
}


class POExporter {
    /**
     * Creates a PO compiler object.
     *
     * @constructor
     * @param {Object} table Translation table to be compiled
     */
    constructor(table, options) {
        this._table = table || {};
        this._table.headers = this._table.headers || {};
        this._table.translations = this._table.translations || {};
        this._options = options || {};
        if (!('foldLength' in this._options)) {
            this._options.foldLength = 76;
        }
        this._translations = [];
        this._handleCharset();
    }

    /**
     * Converts a comments object to a comment string. The comment object is
     * in the form of {translator:'', reference: '', extracted: '', flag: '', previous:''}
     *
     * @param {Object} comments A comments object
     * @return {String} A comment string for the PO file
     */
    _drawComments(comments) {
        var lines = [];
        var types = [{
            key: 'translator',
            prefix: '# '
        }, {
            key: 'reference',
            prefix: '#: '
        }, {
            key: 'extracted',
            prefix: '#. '
        }, {
            key: 'flag',
            prefix: '#, '
        }, {
            key: 'previous',
            prefix: '#| '
        }];

        for(let type of types) {
            if (!comments[type.key]) {
                continue;
            }
            for(let line of comments[type.key].split(/\r?\n|\r/)) {
                lines.push(type.prefix + line);
            }
        };

        return lines.join('\n');
    };

    /**
     * Builds a PO string for a single translation object
     *
     * @param {Object} block Translation object
     * @param {Object} [override] Properties of this object will override `block` properties
     * @return {String} Translation string for a single object
     */
    _drawBlock(block, override) {
        override = override || {};

        var response = [];
        var comments = override.comments || block.comments;
        var msgctxt = override.msgctxt || block.msgctxt;
        var msgid = override.msgid || block.msgid;
        var msgidPlural = override.msgid_plural || block.msgid_plural;
        var msgstr = [].concat(override.msgstr || block.msgstr);

        // add comments
        if (comments && (comments = this._drawComments(comments))) {
            response.push(comments);
        }

        if (msgctxt) {
            response.push(this._addPOString('msgctxt', msgctxt));
        }

        response.push(this._addPOString('msgid', msgid || ''));

        if (msgidPlural) {
            response.push(this._addPOString('msgid_plural', msgidPlural));
            msgstr.forEach(function(msgstr, i) {
                response.push(this._addPOString('msgstr[' + i + ']', msgstr || ''));
            }.bind(this));
        } else {
            response.push(this._addPOString('msgstr', msgstr[0] || ''));
        }

        return response.join('\n');
    };

    /**
     * Escapes and joins a key and a value for the PO string
     *
     * @param {String} key Key name
     * @param {String} value Key value
     * @return {String} Joined and escaped key-value pair
     */
    _addPOString(key, value) {
        key = (key || '').toString();

        // escape newlines and quotes
        value = (value || '').toString()
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\t/g, '\\t')
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n');

        var lines = [value];

        if (this._options.foldLength > 0) {
            lines = foldLine(value, this._options.foldLength);
        }

        if (lines.length < 2) {
            return key + ' "' + (lines.shift() || '') + '"';
        } else {
            return key + ' ""\n"' + lines.join('"\n"') + '"';
        }
    };

    /**
     * Handles header values, replaces or adds (if needed) a charset property
     */
    _handleCharset() {
        var parts = (this._table.headers['content-type'] || 'text/plain').split(';');
        var contentType = parts.shift();
        var charset = formatCharset(this._table.charset);
        var params = [];

        params = parts.map(function(part) {
            var parts = part.split('=');
            var key = parts.shift().trim();
            var value = parts.join('=');

            if (key.toLowerCase() === 'charset') {
                if (!charset) {
                    charset = formatCharset(value.trim() || 'utf-8');
                }
                return 'charset=' + charset;
            }

            return part;
        });

        if (!charset) {
            charset = this._table.charset || 'utf-8';
            params.push('charset=' + charset);
        }

        this._table.charset = charset;
        this._table.headers['content-type'] = contentType + '; ' + params.join('; ');

        this._charset = charset;
    };

    /**
     * Compiles translation object into a PO object
     *
     * @return {Buffer} Compiled PO object
     */
    compile() {
        var response = [];
        var headerBlock = (this._table.translations[''] && this._table.translations['']['']) || {};

        response.push(this._drawBlock(headerBlock, {
            msgstr: generateHeader(this._table.headers)
        }));

        Object.keys(this._table.translations).forEach(function(msgctxt) {
            if (typeof this._table.translations[msgctxt] !== 'object') {
                return;
            }
            Object.keys(this._table.translations[msgctxt]).forEach(function(msgid) {
                if (typeof this._table.translations[msgctxt][msgid] !== 'object') {
                    return;
                }
                if (msgctxt === '' && msgid === '') {
                    return;
                }

                response.push(this._drawBlock(this._table.translations[msgctxt][msgid]));
            }.bind(this));
        }.bind(this));

        return new TextEncoder(this._charset).encode(response.join('\n\n'));
    };

}