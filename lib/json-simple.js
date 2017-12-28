/**
 * A quicker way to encode js objects for export.  The speedup is mostly
 * from optimizing ascii strings and not handling non-ascii hash keys.
 * The result used to be appreciably faster than JSON.stringify, but
 * with node v6 and newer the difference is less than 10%.
 *
 * Copyright (C) 2014,2017 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

module.exports.encode = JsonSimple_encode;
module.exports.decode = JsonSimple_decode;


// json encode the string s.
// JSON encodes long strings faster than we can test them, so check length first.
// table lookup is slower than explicit range testing
// Strings containing characters that must be encoded or escaped are fed to JSON.stringify,
// plain ascii strings without quotes or backslashes are encoded as-is.
function json_string(s) {
    var i, len = s.length;
    if (len > 75) return JSON.stringify(s);

    // regex is faster under node-v9, slower under v6, v8
    // return (/[\u0000-\u001f\u007f-\uffff\"\\]/.test(s)) ? JSON.stringify(s) : '"' + s + '"';

    for (i=0; i<len; i++) {
        var code = s.charCodeAt(i);
        if (code < 0x20 || code >= 127 || code === 0x5c || code === 0x22) return JSON.stringify(s);
    }

    return '"' + s + '"';
}

// JSON strinfies standalone undefined as undefined (not a string)
// JSON stringifies a standalone function to undefined
function JsonSimple_encode( s ) {
    var type = typeof s;

    // unknown scalar types return undefined to signal that should omit from hash
    if (type !== 'object') {
        if      (type === 'number')  return (s !== Infinity && s > -Infinity) ? '' + s : 'null';
        else if (type === 'string')  return json_string(s);
        else if (type === 'boolean') return (s ? "true" : "false");
        else return undefined;
    }

    // null is an object
    else if (s === null) {
        return ret = "null";
    }

    // arrays and array-like objects (eg Buffer, arguments) encode as arrays
    else if (Array.isArray(s) || (typeof s.length === 'number' && s[0] !== undefined)) {
        var i, v, len = s.length, ret = "[", sep = "";
        for (i=0; i<len; i++) {
            v = (s[i] === undefined) ? 'null' : JsonSimple_encode(s[i]);
            if (v === undefined) v = 'null';

            ret += sep + v;
            sep = ",";
        }
        return ret += "]";
    }

    // objects
    else {
        var k, v, ret = "{", sep = "";
        for (k in s) {
            v = (s[k] === undefined) ? undefined : JsonSimple_encode(s[k]);
            if (v === undefined) continue;

            ret += sep + '"' + k + '":' + v;
            sep = ",";
        }
        return ret += "}";
    }
};


function JsonSimple_decode( str ) {
    // TODO: see if there is a way to speed up parsing too.
    return JSON.parse(str);
}
