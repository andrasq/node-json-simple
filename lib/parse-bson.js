/**
 * rudimentary bson parser
 * for timings, to see how much room there is for bson speedup
 * (not that much... maybe 20-30%)
 *
 * Copyright (C) 2015 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */


function getBsonEntities( buf, base0, bound, target ) {
    var base = base0;
    while (base < bound) {
        var type = buf[base];
        var nameEnd = indexOfZero(buf, base + 1);
        var name = buf.toString('utf8', base+1, nameEnd);
        base = nameEnd + 1;
        switch (type) {
        case 0x10:      // signed 32-bit little-endian int
// FIXME: breaks on neagative numbers
            target[name] = getLength(buf, base);
            base += 4;
            break;
        case 0x02:      // counted utf8 string, length *not* part of count
            var len = getLength(buf, base);
            base += 4;
            target[name] = buf.toString('utf8', base, base+len-1);
            base += len;
            if (buf[base-1] !== 0) throwError(new Error("invalid bson, string at " + base-len-4 + " not zero terminated"));
            break;
        case 0x03:      // object, length part of count
            var len = getLengthZ(buf, base, 'object');
            target[name] = getBsonEntities(buf, base+4, base+len-1, {});
            base += len;
            break;
        case 0x04:      // array, length part of count
            var len = getLengthZ(buf, base, 'array');
            target[name] = getBsonEntities(buf, base+4, base+len-1, new Array());
            base += len;
            break;
        case 0x01:      // 64-bit ieee 754 little-endian float
            target[name] = getFloat(buf, base);
            base += 8;
            break;
        case 0x08:      // 1B, boolean
            target[name] = buf[base] ? true : false;
            base += 1;
            break;
        case 0x0a:      // null
            target[name] = null;
            break;
        case 0x05:      // binary
        case 0x06:      // deprecated (undefined)
        case 0x07:      // ObjectID
        case 0x09:      // Date()
        case 0x0b:      // RegExp()
        case 0x0c:      // deprecated (db ref)
        case 0x0d:      // Function()
        case 0x0e:      // symbol
        case 0x0f:      // code with scope
        case 0x11:      // timestamp
        case 0x12:      // int64
        default:
            throwError(new Error("unsupported bson entity type " + type + " at " + base));
            break;
        }
    }
    if (base !== bound) throwError(new Error("invalid bson, bad length starting at " + base0));
    return target;
}

function throwError( err ) {
    throw err;
}

function parseBsonObject( buf ) {
    return getBsonEntities(buf, 4, getLength(buf, 0) - 1, {});
}

function parseBsonArray( buf ) {
    return getBsonEntities(buf, 4, getLength(buf, 0) - 1, new Array());
}

function indexOfZero( buf, pos ) {
    //while (buf.get(pos)) pos++;
    while (buf[pos]) pos++;
    return pos;
}

function getLengthZ( buf, pos, entityType ) {
    var len = getLength(buf, pos);
    if (buf[pos+len-1] !== 0) throw new Error("invalid bson, " + entityType + " at " + pos + " not zero terminated");
    return len;
}

function getLength( buf, pos ) {
    // nb: shift is a bit faster, but converts 32-bit as signed to float
    return buf[pos] +
        (buf[pos+1] << 8) +
        (buf[pos+2] << 16) +
        (buf[pos+3] * 0x1000000);
}

// extract the 64-bit little-endian ieee 754 floating-point value 
function getFloat( buf, pos ) {
    // see http://en.wikipedia.org/wiki/Double-precision_floating-point_format
    // 1 bit sign + 11 bits exponent + (1 hidden 1 bit) + 52 bits mantissa (stored)

    var lowWord = getLength(buf, pos);
    var highWord = getLength(buf, pos+4);
    var scaledMantissa = (highWord & 0xFFFFF) + lowWord * (1/0x100000000);
    var exponent = (highWord & 0x7FF00000) >> 20;
    var sign = highWord & 0x80000000 ? -1 : 1;

    var value;
    if (exponent === 0x7ff) {
        // zero mantissa is signed Infinity, nonzero mantissa is NaN
        if (scaledMantissa) value = NaN;
        else value = Infinity;
    }
    else if (exponent === 0x000) {
        // zero and subnormals (small values)
        if (!scaledMantissa) value = 0;
        else value = scaledMantissa * (1/0x100000)
    }
    else {
        // normalized values with an implied 53rd 1 bit and 1023-biased exponent
        exponent -= 1023;
        value = 1 + scaledMantissa * (1/0x100000);
        value = value * pow2(exponent);
    }
    return sign * value;
}

// given an exponent n, return 2**n
function pow2( exp ) {
    return Math.pow(2, exp);

  var e, pow = 1;
  if (exp < 0) {
    exp = -exp;
    for (e = .5; exp; exp >>= 1, e *= e) if (exp & 1) pow *= e;
    return pow;
  }
  else {
    for (e = 2; exp; exp >>= 1, e *= e) if (exp & 1) pow *= e;
    return pow;
  }
}


// quicktest:
///**

var BSON = require('bson').BSONPure.BSON;

var buffalo = require('buffalo');
buffalo.deserialize = BSON.parse;

var o = { a: 1, b: 2.5, c: "three", };
var o = { "_id" : "545cffef20f9c47358001ad5", "kid" : "k1", "kcoll" : "kc1", "db" : "db1", "coll" : "dc1", "active" : true };

function fptime() { var t = process.hrtime(); return t[0] + t[1] * 1e-9; }
var x = BSON.serialize(o, false, true);
//var x = BSON.serialize({a: 1, b: 2, c: [1,2,3], d: 4, e: 5});
//var x = BSON.serialize({a: [1]});
//var x = new Buffer([14, 0, 0, 0, 16, 65, 65, 65, 0, 1, 0, 0, 0, 0]);
//var x = BSON.serialize({a: -10.5});

//console.log("AR: encoded", x = BSON.serialize({a: 5.25}));
console.log("AR: decoded", BSON.deserialize(x));
//console.log("AR: parsed", parseBsonObject(BSON.serialize(o), 0));

console.log(x);
console.log("AR: test", parseBsonObject(x, 0));

console.log(x.length, ":", x, getFloat(x, 7));
var a = BSON.deserialize(x);
var a = buffalo.parse(x);
t1 = fptime();
for (i=0; i<100000; i++) {
  //x = BSON.serialize(o, false, true);
  // 46k/s 3-item, 30k/s 6-item
  //x = BSON.serialize(o);
  // 50/s

  //a = BSON.deserialize(x);
  // 360k/s 3-item, 125k/s 6-item (95-135k/s, variable) (kvm, 159-170k/s hw)
  //a = buffalo.parse(x);
  // 390k/s 3-item (kvm)
  a = parseBsonObject(x);
  // 575k/s 3-item (kvm, 720k/s hw)
  // 192-195k/s 6-item hw
  // 7% faster for 6-item kds row
}
console.log("AR:", fptime() - t1, a);


// object layout: 4B length (including terminating 0x00), then repeat: (1B type, name-string, 0x00, value), 0x00 terminator

// bson items:  type, name, value
// name: NUL-terminated bytes (cannot contain NUL byte!)
// value: type-specific value
/** from buffalo/lib/bson.js, with notes by AR:
var FLOAT_TYPE             = 1                                  // 64-bit IEEE 754 float
var STRING_TYPE            = 2                                  // 4B count (including NUL byte) + NUL-terminated string
var EMBEDDED_DOCUMENT_TYPE = 3                                  // length (including terminating zero byte) + items contents
var ARRAY_TYPE             = 4                                  // length, then ascii numeric key then value; then terminating 0 byte
var BINARY_TYPE            = 5
var UNDEFINED_TYPE         = 6 // deprecated
var OBJECT_ID_TYPE         = 7
var BOOLEAN_TYPE           = 8                                  // 1B, 00 or 01
var DATE_TIME_TYPE         = 9
var NULL_TYPE              = 0x0A                               // null and undefined, no value
var REG_EXP_TYPE           = 0x0B
var DB_REF_TYPE            = 0x0C // deprecated
var CODE_TYPE              = 0x0D
var SYMBOL_TYPE            = 0x0E
var CODE_WITH_SCOPE_TYPE   = 0x0F
var INT32_TYPE             = 0x10                               // 4B 32-bit signed little-endian
var TIMESTAMP_TYPE         = 0x11
var INT64_TYPE             = 0x12
var MIN_KEY                = 0xFF
var MAX_KEY                = 0x7F

var BINARY_GENERIC_SUBTYPE      = 0x00
var BINARY_FUNCTION_SUBTYPE     = 0x01
var BINARY_OLD_SUBTYPE          = 0x02
var BINARY_UUID_SUBTYPE         = 0x03
var BINARY_MD5_SUBTYPE          = 0x05
var BINARY_USER_DEFINED_SUBTYPE = 0x80
**/

// NaN: as 64-bit float 01 00 00 00 00 00 f0 7f
// Infinity: as float   00 00 00 00 00 00 f0 7f
// -Infinity: as float  00 00 00 00 00 00 f0 ff
// undefined as type null (0a)

// NOTE: sparse arrays are not handled
//     [1, , 3] is encoded to (and decodes as) [1, null, 3]


/**/
