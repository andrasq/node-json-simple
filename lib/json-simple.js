/**
 * A quicker way to encode js objects for export.  The speedup is mostly
 * from optimizing ascii strings and not handling non-ascii hash keys.
 * The result is 80-95% faster than JSON.stringify.
 *
 * Copyright (C) 2014 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

module.exports.encode = JsonSimple_encode;
module.exports.decode = JsonSimple_decode;


function json_string(s) {
    var i, len = s.length;
    // JSON encodes long strings faster than we can test them
    if (len > 75) return JSON.stringify(s);
    // regex is slower in tight loops than explicit range testing
    // return s.match(/[\u0000-\u001f\u007f-\uffff\"\\]/) ? JSON.stringify(s) : '"' + s + '"'
    // table lookup is slower than explicit range testing
    for (i=0; i<len; i++) {
        var code = s.charCodeAt(i);
        if (code < 0x20 || code >= 127 || code === 0x5c || code === 0x22) return JSON.stringify(s);
    }
    // plain ascii strings without quotes or backslashes are encoded as-is
    return '"' + s + '"';
}

function JsonSimple_encode(s) {
    var ret;
    var type = typeof s;
    if (type !== 'object') {
        if      (type === 'number')         ret = (s !== Infinity && s > -Infinity) ? s : 'null';
        else if (type === 'string')         ret = json_string(s);
        else if (type === 'boolean')        ret = (s ? "true" : "false");
        else if (type === NaN)              ret = 'null';
        // JSON strinfies standaline undefined as undefined (not a string)
        // JSON stringifies a standalone function to undefined
        else return undefined
    }
    // encode array-like objects as arrays, as a simplified test for Buffer
    else if (Array.isArray(s) || (s && typeof s.length === 'number' && s[0] !== undefined)) {
        var ret = "[", sep = "";
        var i, len = s.length;
        for (i=0; i<len; i++) {
            var type = typeof s[i];
            if      (type === 'string')     ret += sep + json_string(s[i]);
            else if (type === 'number')     ret += sep + (s[i] !== Infinity && s[i] > -Infinity ? s[i] : "null");
            else if (type === 'undefined')  ret += sep + 'null';
            else if (type === 'function')   ret += sep + 'null';
            else                            ret += sep + JsonSimple_encode(s[i]);
            sep = ',';
        }
        ret += "]";
    }
    else if (s === null) {
        ret = "null";
    }
    else {
        var i, ret = "{", sep = "", type;
        for (i in s) {
            var type = typeof s[i];
            if      (type === 'string')     { ret += sep + '"' + i + '":' + json_string(s[i]); sep = ","; }
            else if (type === 'number')     { ret += sep + '"' + i + '":' + (s[i] !== Infinity && s[i] > -Infinity ? s[i] : "null"); sep = ","; }
            else if (type === 'undefined')  ;
            else if (type === 'function')   ;
            else                            { ret += sep + '"' + i + '":' + JsonSimple_encode(s[i]); sep = ","; }
        }
        ret += "}";
    }
    return typeof ret === 'string' ? ret : ret + '';
};


function JsonSimple_decode( str ) {
    // TODO: see if there is a way to speed up parsing too.
    return JSON.parse(str);
}

function print() {
    console.log.apply(null, arguments);
}

// print("decode", JsonSimple_decode("[1,2,[3.5,4]]"));
