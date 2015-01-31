/**
 * parse a json string into the object hierarchy
 * proof of concept vanilla recursive descent scanner
 * actually decoding the termsn is optional
 *
 * 2015-01-29 - AR.
 */

//var jsonlib = require('/home/andras/node/npm/json-simple/build/Release/jsonlib.node');

module.exports = function(s) {
    if (this && this !== global) return new jsonParser();
    var ret = {v: undefined};
    var end = scanTerm(s, 0, ret);
    // assert end + whitespace === s.length
    return ret.v;
};

var decodeLiterals = true;      // 40% faster without (the float test)
var decodeStrings = true;       // no effect? (5% if all else omitted)
var decodeNames = true;         // 11% slower without?? (but 10% faster if all else omitted)
var decodeObjects = true;       // 20% faster without
// jsonparse bench.js: 210ms all true, 91ms all false

function jsonParser( options ) {
    options = options || {};
}
jsonParser.prototype = {
    parse: function(s) {
        this.termCount = this.arrayCount = this.objectCount = this.maxNestingDepth = this._depth = 0;
        var ret = {v: 0};
        this.scanTerm(s, 0, ret);
        return ret.v;
    },
    scanTerm: scanTerm,
    scanString: scanString,
    scanLiteral: scanLiteral,
    scanArray: scanArray,
    scanObject: scanObject,
};

function skipWhitespace( s, i ) {
    var ch;
    // ' ', '\n', '\t', '\r'
    while ((ch = s.charCodeAt(i)) === 0x20 || ch === 0x0a || ch === 0x09 || ch === 0x0d) i++;
    return i;
}

function scanTerm( str, i, retval ) {
    // stats about the json: termCount += 1;
    var ch = str[i];
    if (ch === '"') {
        return scanString(str, i, retval);
    }
    else if (ch === '[') {
        return scanArray(str, i, retval);
    }
    else if (ch === '{') {
        return scanObject(str, i, retval);
    }
    else {
        return scanLiteral(str, skipWhitespace(str, i), retval);
    }
}

// 4% faster to have function at top-level, not inside decodeString; node-v0.11.13 11% faster
function containsEscapes( s, i, j ) {
    while (i<j) if (s.charCodeAt(i++) === 0x5c) return true;
    return false;
};

function decodeString( s, i, j ) {
    return containsEscapes(s, i+1, j-1) ? JSON.parse(s.slice(i, j)) : s.slice(i+1, j-1);
}

// called on the leading '"' of the string
// strings are double-quoted and may contain escape sequences started with \
function scanString( str, i, retval ) {
    var i0 = i, len = str.length;
    while (++i < len) {
        var ch = str[i];
        if (ch === '\\' && str[i+1] === '"') i++;
        else if (ch === '"') {
            if (retval) {
                if (decodeStrings) retval.v = decodeString(str, i0, i+1);
                else retval.v = str.slice(i0, i+1);
            }
            return i+1;
        }
    }
    throw new Error(makeScanError("missing close-quote starting", str, i));
}

// called on the first letter of the literal
// literals are true, false, null, and numbers
function scanLiteral( str, i, retval ) {
    var len = str.length;
    var i0 = i;
    for ( ; i<len; i++) {
        // same as charCodeAt, faster than indexOf
        // struct lookup much slower
        var ch = str[i];;
        if (ch === ',' || ch === ']' || ch === '}' || ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') break;
    }
    if (retval) {
        if (decodeLiterals) {
            var mm, word = str.slice(i0, i);
            if ((mm = word.match(/^[+-]?([0-9]+\.?|\.[0-9]+)[0-9]*([eE][+-]?[0-9]+)?$/))) retval.v = parseFloat(word);
            // 16% faster to not convert floats to numbers (ie, leave them as string)
            // valid json floats have a more limited syntax (see http://json.org)
            else if (word === 'null') retval.v = null;
            else if (word === 'true') retval.v = true;
            else if (word === 'false') retval.v = false;
            else throw new Error(makeScanError("unrecognized bareword", str, i));
        }
        else retval.v = str.slice(i0, i);
    }
    return i;
}

// called on the leading '[' of the array
function scanArray( str, i, retval ) {
    var values = new Array();
    var i0 = i, ret = {v: 0}, len = str.length;
    i++;
    // stats about the json: arrayCount += 1;
    // stats about the json: nestingDepth +=1; if (nestingDepth > maxNestingDepth) maxNestingDepth += 1;
    while (str[i] !== ']' && i < len) {
        i = skipWhitespace(str, i);
        i = scanTerm(str, i, ret);
        values.push(ret.v);
        i = skipWhitespace(str, i);
        if (str[i] === ',') {
            // faster to not enforce all json restrictions
            //if (str[i+1] === ']') throw new Error(makeScanError("trailing comma in array", str, i));
            i++;
        }
        else if (str[i] === ']') break;
        else throw new Error(makeScanError("unrecognized char in array", str, i));
    }
    retval.v = values;
    return i+1;
}

// called on the leading '{' of the object
function scanObject( str, i, retval ) {
    if (decodeObjects) {
        var hash = {};
    }
    else {
        var values = new Array();
        values.isHash = true;
    }
    var i0 = str, ch, b1, e1, ret2 = {v: null}, len = str.length;
    i++;
    // stats about the json: objectCount += 1;
    // stats about the json: nestingDepth +=1; if (nestingDepth > maxNestingDepth) maxNestingDepth += 1;
    while (str[i] !== '}' && i < len) {
        i = skipWhitespace(str, i);
        ch = str[i];
        if (ch === '"') {
            b1 = i;
            e1 = scanString(str, i);
            i = skipWhitespace(str, e1);
            if (str[i] !== ':') throw new Error(makeScanError("expected ':' after name", str, e1));
            i = skipWhitespace(str, i+1);
            i = scanTerm(str, i, ret2);
            // have (b1)name(e1):value(i)

            var name = decodeNames ? decodeString(str, b1, e1) : str.slice(b1, e1);
            if (decodeObjects) hash[name] = ret2.v;
            else values.push([name, ret2.v]);

            i = skipWhitespace(str, i);
            if (str[i] === ',') {
                i++;
                //if (str[i] === '}') throw new Error(makeScanError("trailing comma in object", str, i));
            }
        }
        else if (ch === '}') break;
        else throw new Error(makeScanError("unrecognized char in object", str, i));
    }

    if (decodeObjects) retval.v = hash;
    else retval.v = values;

    return i+1;
}

function makeScanError( msg, str, i ) {
    return msg + " at " + i + ": " + str.slice(i, i+20);
}


// quicktest:
/**

var util = require('util');
var assert = require('assert');

//console.log(scanTerm('{"a":1,"b":2,"c":[1,"two",{},3.14]}', 0));
var json = '{"name":"KDS","hostname":"work2","pid":16563,"audit":true,"level":"info","remoteAddress":"127.0.0.1","remotePort":35882,"req_id":"-","req":{"method":"POST","url":"/testKid/coll1/findOne","headers":{"authorization":"Basic QWRtaW46aWJGN29JcEJaQVhScGdVNXVIbVV2NzdZNXVkZEcw","user-agent":"curl/7.26.0","host":"0.0.0.0:4242","accept":"*' + '/*","content-type":"application/json","content-length":"12"},"httpVersion":"1.1","trailers":{},"version":"1.0.0","timers":{}},"res":{"statusCode":200,"headers":{"content-type":"application/json"},"trailer":false},"rusage":{"utime":0.01200000000000001,"stime":0,"wtime":0.011333196191117167,"maxrss":120,"inblock":0,"oublock":0},"query":null,"latency":null,"_audit":true,"msg":"handled: 200","time":"2015-01-28T18:47:41.325Z","v":0,"requestId":"-"}';
var retval = {v: 0};
js = new jsonParser();
console.log(js.scanTerm(json, 0, retval));
console.log(retval.v);
assert.deepEqual(retval.v, JSON.parse(json));
//console.log(util.inspect(retval.v));

while (true) {
var i;
t1 = Date.now();
for (i=0; i<10000; i++) JSON.parse(json);
console.log("JSON.parse", Date.now()-t1);
// 100k/s

var parse = module.exports;
t1 = Date.now();
for (i=0; i<10000; i++) parse(json);
console.log("scanTerm", Date.now()-t1);
// 90k/s
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

*/
