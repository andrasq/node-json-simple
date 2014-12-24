

var JsonSimple = require('../index');

module.exports = {
    setUp: function(done) {
        this.cut = JsonSimple;
        done();
    },

    'encodes primitive types': function(t) {
        // Supports the primitive types of `string`, `number`, list (`Array`), hash
        //(`Object`), and the special values `null`, `undefined`, `NaN`, and `Infinite`.
        var self = this;
        function tryit(value) {
            var c = self.cut.encode(value);
            var j = JSON.stringify(value);
            t.equal(c, j, value + ": wrong encoded value " + c + ", expected " + j);
        }
        tryit("Hello, world.\n\u0007");
        tryit(123);
        tryit(123.456);
        tryit({a: 123, b: "test"});
        tryit([1, 2, "test"]);
        // NOTE: array-like objects encode as array not object:
        // (function args(){ tryit(arguments); })(1, 2.34, "test arguments");
        tryit(new Buffer("Hello"));
        tryit(undefined);
        tryit({a: undefined});
        tryit([1, undefined, 2]);
        tryit(null);
        tryit({a: null});
        tryit([1, null, 2]);
        tryit(NaN);
        tryit(Infinity);
        t.done();
    },

    'encodes complex arrays': function(t) {
        var data = [[1, 2, {x:1}], {a: 3, b: 4, c: [5,6,7]}];
        var json = this.cut.encode(data);
        t.equal(json, JSON.stringify(data));    // [[1,2,{"x":1}],{"a":3,"b":4,"c":[5,6,7]}]
        t.done();
    },

    'encodes array-like object as array': function(t) {
        // omit for now
        // t.equal(this.cut.encode({length: 1, '0': 1}), "[1]");
        t.done();
    },

    'encodes empty array-like as object': function(t) {
        t.equal(this.cut.encode({length: 0}), '{"length":0}');
        t.done();
    },

    'encodes complex objects': function(t) {
        // sample object from the `tosource` package
        var complex =
            [ 4, 5, 6, "hello", undefined,
              { a: 1, 'b': 2, '1': 3, 'if': 5, yes: true, no: false,
                nan: NaN, infinity: Infinity, 'undefined': undefined, 'null': null },
                // function foo() { },                          -- not same
                // /we$/gi,                                     -- not same
                // new Date("Wed, 09 Aug 1995 00:00:00 GMT")    -- not same
            ];
        t.equal(this.cut.encode(complex), JSON.stringify(complex));
        t.done();
    },

    'decodes json': function(t) {
        var data = [1, 2, {c: 3}];
        var a = this.cut.decode(this.cut.encode(data));
        t.deepEqual(a, data);
        t.done();
    },
};
