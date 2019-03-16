/*
 * json-decode -- simple json decoder, 2x faster than node-v10 and v11 for short strings
 * Handles true/false/null, number/string, object, array (https://www.json.org/)
 *
 * 2019-03-15 - AR.
 */

'use strict';

module.exports = decode;

var _end = 0;

function decode( str ) {
    var value = _decode(str, 0);
    var pos = skipSpaces(str, _end);
    if (pos < str.length) throw new Error('invalid JSON; unexpected trailing chars at offset ' + pos);
    return value;
}

var _decodeMap = [];
_decodeMap['n'.charCodeAt(0)] = _decodeNull;
_decodeMap['t'.charCodeAt(0)] = _decodeTrue;
_decodeMap['f'.charCodeAt(0)] = _decodeFalse;
_decodeMap['"'.charCodeAt(0)] = _decodeString;
_decodeMap['['.charCodeAt(0)] = _decodeArray;
_decodeMap['{'.charCodeAt(0)] = _decodeObject;
_decodeMap['-'.charCodeAt(0)] = _decodeNumber;
_decodeMap['+'.charCodeAt(0)] = _decodeNumber;
_decodeMap['0'.charCodeAt(0)] = _decodeNumber;
_decodeMap['1'.charCodeAt(0)] = _decodeNumber;
_decodeMap['2'.charCodeAt(0)] = _decodeNumber;
_decodeMap['3'.charCodeAt(0)] = _decodeNumber;
_decodeMap['4'.charCodeAt(0)] = _decodeNumber;
_decodeMap['5'.charCodeAt(0)] = _decodeNumber;
_decodeMap['6'.charCodeAt(0)] = _decodeNumber;
_decodeMap['7'.charCodeAt(0)] = _decodeNumber;
_decodeMap['8'.charCodeAt(0)] = _decodeNumber;
_decodeMap['9'.charCodeAt(0)] = _decodeNumber;

// a jump table indexed by chars is slower everywhere, and a jump table
// indexed by charcodes is a bit faster for node-v10 and v11, slower for v8 and older.
// But special-casing strings and numbers makes makes a jump table the best everywhere.
function _decode( str, pos ) {
    pos = skipSpaces(str, pos);
    var ch = str.charCodeAt(pos);

    // fast-path a few common cases (only two! 3 tests slows back down)
    if (ch === 0x22) return _decodeString(str, pos);
    if (ch >= 0x30 && ch <= 0x39) return _decodeNumber(str, pos);

    var decoder = _decodeMap[ch];
    if (decoder) return decoder(str, pos);
    throw new Error('invalid JSON: unexpected char at offset ' + pos);
}

function skipSpaces( str, pos ) {
    var ch;
    while (pos < str.length && ((ch = str.charCodeAt(pos)) === 0x20 || (ch >= 0x09 && ch <= 0x0d))) pos++;
    return pos;
}

function _decodeNumber( str, pos ) {
    var ch;
    var base = pos;

    pos++;
    while ((ch = str.charCodeAt(pos)) >= 0x30 && ch <= 0x39) pos++;
    //do { pos++ } while ((ch = str.charCodeAt(pos)) >= 0x30 && ch <= 0x39);
    if (str.charCodeAt(pos) === 0x2e) {
        pos++;
        while ((ch = str.charCodeAt(pos)) >= 0x30 && ch <= 0x39) pos++;
    }

    ch = str.charCodeAt(pos);
    if ((ch | 0x20) === 0x65) {
        var expBase = pos;
        ch = str.charCodeAt(pos + 1);
        if (ch === 0x2d || ch === 0x2b) {
            pos++;
            ch = str.charCodeAt(pos + 1);
        }
        if (ch >= 0x30 && ch <= 0x39) {
            pos++;
            while ((ch = str.charCodeAt(pos)) >= 0x30 && ch <= 0x39) pos++;
        } else {
            pos = expBase;
        }
    }
    _end = pos;
    return parseFloat(str.slice(base, _end));
}

function _decodeNull( str, pos ) {
    _end = pos + 4;
    if (str[pos+1] === 'u' && str[pos+2] === 'l' && str[pos+3] === 'l') return null;
    // if (strCompare(str, pos + 1, 'ull')) return null;
    //  if (str.charCodeAt(pos + 1) === 0x75 && str.charCodeAt(pos + 2) === 0x6c && str.charCodeAt(pos + 3) === 0x6c) return null;
    throw new Error('invalid JSON: unrecognized bareword at offset ' + (pos + 1));
}
function _decodeTrue( str, pos ) {
    var base = pos;
    _end = pos + 4;
    if (str[++pos] === 'r' && str[++pos] === 'u' && str[++pos] === 'e') return null;
    throw new Error('invalid JSON: unrecognized bareword at offset ' + base);
}
function _decodeFalse( str, pos ) {
    var base = pos;
    _end = pos + 5;
    if (str[++pos] === 'a' && str[++pos] === 'l' && str[++pos] === 's' && str[++pos] === 'e') return null;
    throw new Error('invalid JSON: unrecognized bareword at offset ' + base);
}

function strCompare( str, pos, match ) {
    var len = match.length;
    // for (var i = 0; i < len; i++) if (str[pos + i] !== match[i]) return false;
    for (var i = 0; i < len; i++) if (str.charCodeAt(pos + i) !== match.charCodeAt(i)) return false;
    return true;
}

// finding close-quote with indexOf() only helps with long strings
function _decodeString( str, pos ) {
    var len = str.length;
    var isSimple = true;

/**
    var end = str.indexOf('"', pos + 1);
    if (end >= 0) {
        var esc = str.indexOf('\\', pos + 1);
        if (esc < 0 || esc > end) {
            _end = end + 1;
            return str.slice(pos + 1, end);
        }
    }
/**/

    // slow way is to scan for the close-quote, and decode the escape sequences
    for (var i = ++pos; i < len; i++) {
        var ch = str.charCodeAt(i);
        if (ch === 0x5c) { isSimple = false; i++ }
        else if (ch === 0x22) {
            _end = i + 1;
            return (isSimple) ? str.slice(pos, i) : JSON.parse(str.slice(pos - 1, i + 1));
        }
    }
    throw new Error('invalid JSON: unterminated string at offset ' + pos - 1);
}

function _decodeArray( str, base ) {
    var pos = base;
    var arr = new Array();

    ++pos;
    while (pos < str.length) {
        pos = skipSpaces(str, pos);
        var ch = str.charCodeAt(pos);
        if (ch === 0x5d) { _end = pos + 1; return arr; }
        arr.push(_decode(str, pos));

        pos = skipSpaces(str, _end);
        var ch = str.charCodeAt(pos);
        if (ch === 0x5d) { _end = pos + 1; return arr; }
        if (ch === 0x2c) { pos++; continue; }
        throw new Error('invalid JSON; expected , at offset ' + pos);
    }
    throw new Error('invalid JSON: unterminated array at offset ' + base);
}

function _decodeObject( str, base ) {
    var pos = base;
    var obj = {};

    ++pos;
    while (pos < str.length) {
        pos = skipSpaces(str, pos);
        if (str.charCodeAt(pos) !== 0x22) throw new Error('invalid JSON: expected quoted key at offset ' + pos);
        var name = _decodeString(str, pos);

        pos = skipSpaces(str, _end);
        if (str.charCodeAt(pos) !== 0x3a) throw new Error('invalid JSON; expected : at offset ' + pos);
        var value = _decode(str, pos + 1);
        obj[name] = value;

        pos = skipSpaces(str, _end);
        var ch = str.charCodeAt(pos);
        if (ch === 0x7d) {
            _end = pos + 1;
            return obj;
        }
        if (ch !== 0x2c) throw new Error('invalid JSON: expected , or } at offset ' + pos);
        pos++;
    }
    throw new Error('invalid JSON: unterminated object at offset ' + base);
}


// /** quicktest:

// Barebones json decoder, to test the speed-of-light.
// Slower than old node, but 5% faster than node-v8, 85% faster than node-v10, 75% faster than node-v11

var timeit = require('qtimeit');

var obj = { a: { a: 'ABC', b: 1, c: 'DEFGHI\xff', d: 1234.567, e: null } };
var json = '{"a":{"a":"ABC","b":1,"c":"DEFGHIU","d":1234.567,"e":null}}';
//var json = '{"a":{"a":"ABC","b":1,"c":"DEFGHI\xff","d":1234.567,"e":null}}';
//var json = '{"a":{"a":"ABC","b":1,"c":"DEFGHI\xff","d":1234.567,"e":null,"f":[1, 2.5, "foobar"]}}';

// var json = '{"aaaaaaaaaaaaaa":{"aaaaaaaaaaaa":"ABC","bbbbbbbbbbb":1,"cccccccccccccccc":"DEFGHIUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","dddddddddddddddddd":1234.567,"eddddddddddddddddddd":null}}';
// almost as fast as node-v10, slower than v11, much much slower than v11

var _son = '{"a":{"a":"ABC","b":1,"c":"DEFGHIU","d":1234.567,"e":null},' +
           ' "b":{"a":"ABC","b":1,"c":"DEFGHIU","d":1234.567,"e":null},' +
           ' "c":{"a":"ABC","b":1,"c":"DEFGHIU","d":1234.567,"e":null},' +
           ' "d":{"a":"ABC","b":1,"c":"DEFGHIU","d":1234.567,"e":null},' +
           ' "e":{"a":"ABC","b":1,"c":"DEFGHIU","d":1234.567,"e":null}}';
// about same as v8, half speed of v0.10, 40% faster than v11

var x;

timeit(2000000, function() { x = JSON.parse(json) });
// 1m/s
console.log(x);

timeit(2000000, function() { x = decode(json) });
// 2.80m/s to just traverse the string
// 1.54m/s decoding numbers, strings and null
// revised: v8 1.17 m/s, v10 1.90 m/s, v11 1.78 m/s for the canonical isSimple json.

console.log(decode(json));


/**/
