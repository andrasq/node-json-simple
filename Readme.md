json-simple
===========

Fast JSON encoder.  Handles a simplified subset of the input accepted by
JSON.stringify, but runs 2x faster.  Ideal for encoding data for export,
won't work for arbitrary object serialization.

Data exchange formats are simple; they tend to be plain arrays or hashes with
no inherited properties, simple ascii property names, containing fairly simple
data layouts.  Targeting this narrower domain allows the code to run faster.

Supports the primitive types `string`, `number`, list (`Array`), hash
(`Object`), and the special values `null`, `undefined`, `NaN`, and `Infinite`.
Nested arrays and nested objects work too.

Outputs a `JSON.parse` compatible string.


        json = require('json-simple');
        var data = [0, "one", {two: 2}];
        var str = json.encode(data);            // => [0,"one",{"two":2}]
        json.decode(str);                       // => data
        JSON.parse(str);                        // => data
        

Installation
------------

        npm install json-simple

        npm test json-simple


Methods
-------

### encode( data )

Convert the data into a json string.  Converts arrays, objects, numbers,
strings and special values (see Supported Types below).

        json = require('json-simple');
        json.encode({a:1, b:"two"});

### decode( string )

Parse the json string into the corresponding native data item.

        json = require('json-simple');
        json.decode('{"a":1,"b":"two"}');


Supported Types
---------------

- string
- number
- Object (but see Differences, below)
- Array and array-like objects (Buffer, arguments - having .length and [0])
- null
- undefined in object (property is omitted, like JSON)
- undefined in array (encoded as null, like JSON)
- NaN (as null, like JSON)
- Infinity (as null, like JSON)
- -Infinity (as null, like JSON)
- undefined (returns undefined, like JSON, which errors out in JSON.parse)
- Buffer (as Array, like JSON)
- function (as undefined, "null" or skipped, like JSON)


Differences from JSON.stringify
-------------------------------

- Array-like objects are encoded as arrays, not objects.  Objects are
  Array-like if they have a numeric length property and their [0] property is
  not undefined.  Thus `encode(arguments)` creates an stringified array.
- Date is not special, and will not be converted to `toISOString()`
- RegExp is not special, and will not be converted to `{}`
- object property names are expected to be plain ASCII, and are not encoded
  They are not tested for validity, and non-ASCII names may result in broken
  (un-parseable) JSON output
- does not distinguish object own properties from inerited properties


Restrictions
------------

- property names must be printable ascii without doublequotes or \ (the names are not serialized)
- `Date` is not special, treated as Object (JSON would emit formatted string)
- `RegExp` is not special, treated as Object (Json would emit {})
- `Function` is not special (JSON would emit undefined)
- array-like objects are not tested beyond ['length'] and [0] properties.
  `Buffer` encodes as an array (like JSON), but `arguments` does too (unlike JSON).
  Empty array-like objects are encoded as objects.
- hash keys (object property names) are not encoded, so no escaping is done.
  Embedded double-quotes, backslashes or utf-8 chars will result in invalid json.
- inherited properties are not distinguished from own properties


TODO
----

- Decoding is not native, but `JSON.parse(json)` or `eval("'" + json + "'")` will both work.


Related Work
------------

- JSON js built-in json encoder/decoder
- [tosource](https://www.npmjs.com/package/tosource) reversible json encoder, for object serialization
