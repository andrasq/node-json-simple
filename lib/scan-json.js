/**
 * parse a json string into the object hierarchy
 * proof of concept vanilla recursive descent scanner
 *
 * Copyright (C) 2015 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * 2015-01-31 - AR.
 */

function JsonScanner( options ) {
    this.partial = null;
    this.retval = null;
}
JsonScanner.prototype = {
    /*
     * terms are arrays of [type, base, bound, [contents]]
     *     string       ['s', i, j]
     *     plaintext    ['t', i, j]
     *     literal      ['l', i, j]
     *     array        ['a', i, j, [array-terms]]
     *     object       ['o', i, j, [object-namevals]]
     *     nameval      [name, value]
     */
    scan:
    function scan( s ) {
        var term = this.scanTerm(s, 0);
        var i = skipWhitespace(s, term[2]);
        if (i !== s.length) throw new Error(makeScanError("unexpected trailing text", s, i));
        return term;
    },

    parse:
    function parse( s ) {
        if (typeof s !== 'string') s += "";
        var term = this.scan(s);
        return this.parse_r(s, term);
    },

    parse_r:
    function parse_r( str, term ) {
        switch (term[0]) {
        case 's': return JSON.parse(str.slice(term[1], term[2]));
        //case 't': return str.slice(term[1]+1, term[2]-1);
        case 't': return decodeString(str, term[1], term[2]);
        //case 'l': return JSON.parse(str.slice(term[1], term[2]));
        //case 'l': return eval(str.slice(term[1], term[2]));   // eval is **slow** !
        case 'l':
            var s = str.slice(term[1], term[2]);
            if (s === 'null') return null;
            else if (s === 'true') return true;
            else if (s === 'false') return false;
            else {
                s = +(s);
                //if (s === NaN) throw new Error(makeScanError("invalid number", str, term[1]));
                // with the NaN test is 5% slower
                return s;
            }
            break;
        case 'a':
            var i, a = term[3], ret = new Array();
            for (i=0; i<a.length; i++) ret.push(this.parse_r(str, a[i]));
            return ret;
        case 'o':
            var i, a = term[3], ret = {};
            for (i=0; i<a.length; i++) ret[this.parse_r(str, a[i][0])] = this.parse_r(str, a[i][1]);
            return ret;
        default: throw new Error("unknown term");
        }
    },

    scanTerm:
    // called on whitepace or start of next term
    // scanTerm skips leading whitespace
    function scanTerm( str, i ) {
        i = skipWhitespace(str, i);
        var ch = str.charCodeAt(i);
        // " [ {
        if (ch === 0x22) return this.scanString(str, i);
        else if (ch === 0x5b) return this.scanArray(str, i);
        else if (ch === 0x7b) return this.scanObject(str, i);
        else return this.scanLiteral(str, i);
    },

    scanString:
    // called on the leading '"' of the string
    // strings are double-quoted and may contain escape sequences started with \
    function scanString( str, i0, spanOnly ) {
        var i = i0, type = 't', len = str.length;
        var ch, ch2;
        ch2 = str.charCodeAt(i+1);
        for (i++; i<len; i++) {
            ch = ch2;
            ch2 = str.charCodeAt(i+1);
            // '"'
            if (ch === 0x22) return [type, i0, i+1 /*, str.slice(i0, i+1)*/];
            // '\\' '\\' '"'
            else if (ch === 0x5c && (ch2 === 0x5c || ch === 0x22)) { type = 's'; i++; }
        }
        throw new Error(makeScanError("missing close-quote starting", str, i));
    },

    scanLiteral:
    // called on the first letter of the literal
    // literals are true, false, null, and numbers
    function scanLiteral( str, i0 ) {
        var i = i0, len = str.length;
        for ( ; i<len; i++) {
            // same as charCodeAt, faster than indexOf
            // struct lookup much slower
            var ch = str[i];;
            if (ch === ',' || ch === ']' || ch === '}' || ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') break;
        }
        return ['l', i0, i /*, str.slice(i0, i)*/];
        // note: not possible to reliably detect premature end of string, eg 123 vs 12345
    },

    scanArray:
    // called on the leading '[' of the array
    function scanArray( str, i0 ) {
        var values = new Array();
        var i = i0, term, len = str.length;
        i++;
        while (i < len && str[i] !== ']') {
            term = this.scanTerm(str, i);
            values.push(term);
            i = skipWhitespace(str, term[2]);
            if (str[i] === ',') {
                // faster to not enforce all json restrictions
                //if (str[i+1] === ']') throw new Error(makeScanError("trailing comma in array", str, i));
                i++;
            }
            else if (str[i] === ']') break;
            else throw new Error(makeScanError("unrecognized char in array", str, i));
        }
        return ['a', i0, i+1, values];
    },

    scanObject:
    // called on the leading '{' of the object
    function scanObject( str, i0 ) {
        var values = new Array();
        var i = i0, ch, b1, e1, len = str.length;
        i++;
        while (i < len && str[i] !== '}') {
            i = skipWhitespace(str, i);
            ch = str[i];
            if (ch === '"') {
                var name = this.scanString(str, i);
                i = skipWhitespace(str, name[2]);
                if (str[i] !== ':') throw new Error(makeScanError("expected ':' after name", str, e1));
                var value = this.scanTerm(str, i+1);
                values.push([name, value]);
                i = skipWhitespace(str, value[2]);
                if (str[i] === ',') {
                    i++;
                    //if (str[i] === '}') throw new Error(makeScanError("trailing comma in object", str, i));
                }
            }
            else if (ch === '}') break;
            else throw new Error(makeScanError("unrecognized char in object", str, i));
        }
        return ['o', i0, i+1, values];
    },

};

function makeScanError( msg, str, i ) {
    return msg + " at " + i + ": " + str.slice(i, i+20);
}

function skipWhitespace( s, i ) {
    var ch;
    // ' ', '\n', '\t', '\r'
    while ((ch = s.charCodeAt(i)) === 0x20 || ch === 0x0a || ch === 0x09 || ch === 0x0d) i++;
    return i;
}

function decodeString( s, i, j ) {
    return containsEscapes(s, i+1, j-1) ? JSON.parse(s.slice(i, j)) : s.slice(i+1, j-1);

    if (!containsEscapes(s, i+1, j-1)) return s.slice(i+1, j-1);

    var ch, b, buf = new Buffer(j - i - 2);
    for (b=0; i<j; i++) {
        ch = s.charCodeAt(i);
        if (ch === 0x5c) {
            ch = s.charCodeAt(i+1);
            if (ch === 0x5c) { buf[b] = 0x5c; i++ }             // \\
            else if (ch === 0x22) { buf[b] = 0x22; i++ }        // \"
            else if (ch === 0x75) {                             // \u0000
                var n = parseInt(str.slice(i+1, i+5), 16);
                if (n >= 0 && n < 0x10000) { buf[b] = n; i++ }
                else throw new Error(makeScanError("invalid unicode character", str, i));
            }
            else buf[b] = 0x5b;
        }
        b++;
    }
    return buf.slice(0, b).toString();
}

// 4% faster to have function at top-level, not inside decodeString; node-v0.11.13 11% faster
function containsEscapes( s, i, j ) {
    while (i<j) if (s.charCodeAt(i++) === 0x5c) return true;
    return false;
};


var _scanner = new JsonScanner();
module.exports = function(s) {
    return _scanner.scan(s);
};
module.exports.JsonScanner = JsonScanner;


// quicktest:
/**

function print_r( term, indent ) {
    indent = indent || "";
    ret = "";
    switch (term[0]) {
    case 's':
    case 't':
    case 'l':
        ret += indent + util.inspect(term);
        break;
    case 'a':
        ret += indent + "Array [ " + term[1] + " " + term[2] + "\n";
        for (var i=0; i<term[3].length; i++) ret += print_r(term[3][i], indent + "    ") + "\n";
        ret += indent + "] Array";
        break;
    case 'o':
        ret += indent + "Object [" + term[1] + " " + term[2] + "\n";
        for (var i=0; i<term[3].length; i++) ret += print_r(term[3][i], indent + "    ") + "\n";
        ret += indent + "] Object (" + term[1] + ")";
        break;
    default:
        // name-value tuple?
        ret += print_r(term[0], indent) + " " + print_r(term[1], indent).trimLeft();
        //throw new Error("unknown term");
        break;
    }
    return ret;
}

var util = require('util');
var assert = require('assert');

var json = '' +
    '{"name":"SVC","hostname":"work2","pid":16563,"audit":true,"level":"info",' +
    '"remoteAddress":"127.0.0.1","remotePort":35882,"req_id":"-",' +
    '"req":{"method":"POST","url":"/testKid/coll1/findOne",' +
        '"headers":{"authorization":"Basic VGVzdDpUZXN0",' +
            '"user-agent":"curl/7.26.0","host":"0.0.0.0:4242","accept":"*' + '/*","content-type":"application/json","content-length":"12"},' +
        '"httpVersion":"1.1","trailers":{},"version":"1.0.0","timers":{}},' +
    '"res":{"statusCode":200,"headers":{"content-type":"application/json"},"trailer":false},' +
    '"rusage":{"utime":0.01200000000000001,"stime":0,"wtime":0.011333196191117167,"maxrss":120,"inblock":0,"oublock":0},' +
    '"query":null,"latency":null,"_audit":true,"msg":"handled: 200","time":"2015-01-28T18:47:41.325Z","v":0,"requestId":"-"}';

var v, js = new JsonScanner();
console.log(print_r(v = js.scan(json)));

assert.deepEqual(js.parse_r(json, v), JSON.parse(json));

while (true) {
var i;
t1 = Date.now();
for (i=0; i<10000; i++) JSON.parse(json);
console.log("JSON.parse", Date.now()-t1);
// 100k/s

var scan = module.exports;
t1 = Date.now();
for (i=0; i<10000; i++) scan(json);
console.log("scan-json", Date.now()-t1);
// 90k/s

var scan = module.exports;
t1 = Date.now();
for (i=0; i<10000; i++) js.parse_r(json, scan(json));
console.log("scan-parse-json", Date.now()-t1);
// 29.4k/s
}

/**/

/* notes:

- faster to look up str.length than to pass it in
- passing an object to receive the return value is 8% faster than passing a callback
- variable name length affects code speed (actually, it affects memory layout, which affects speed)
- code is *very* sensitive to memory layout -- adding comment lines can affect speed!

- could use a binding.floatLength(str, i, j) call to quickly test for properly formatted float -- not! calling C++ much slower
- could use a binding.containsChars(str, i, j, chars) call to quickly scan for embedded \ escapes -- not! calling C++ much slower

- see also https://github.com/bjouhier/i-json

Todo:
- pass in a state object to scanners
- support continued parsing
- should error out on empty input
- string.slice is *much* faster than buffer.slice.toString
- this scanner is 10% slower than node v0.10.29 JSON.parse, but 27% faster than v0.12 ?

*/
