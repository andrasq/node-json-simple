

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
            t.deepEqual(c, j, value + ": wrong encoded value " + c + ", expected " + j);
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

        // corner cases: undefined should be skipped
        tryit({u: undefined, a: 1, b: 2})
        tryit({a: 1, u: undefined, b: 2})
        tryit({a: 1, b: 2, u: undefined})
        // functions should be skipped
        tryit({u: function(){}, a: 1, b: 2})
        tryit({a: 1, u: function(){}, b: 2})
        tryit({a: 1, b: 2, u: function(){}})

        t.done();
    },

    'encodes arrays': function(t) {
        var a = [1, 2.5, "three", [4], null, undefined, 0, false, true, {a: 123}];
        t.equal(JSON.stringify(a), this.cut.encode(a));
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

    'encodes objects': function(t) {
        var o = {a:1, b:2.5, c:"three", d:[4], e:null, f:undefined, g:0, h:false, i:true, j:{a: 123}};
        t.equal(JSON.stringify(o), this.cut.encode(o));
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

    'test encode 100k datapoints speed': function(t) {
        var data = {
            t: 1234567890,
            k: "measured-attribute-name",
            v: 1234.567,
        };
        var i, x;
        for (i=0; i<100000; i++) x = this.cut.encode(data);
        // for (i=0; i<100000; i++) x = JSON.stringify(data);
        // 67ms json-simple for 15B string, 119ms JSON.stringify (77%), 63ms for float (88%) (1.5m/s)
        t.done();
    },

    'test encode 10k loglines speed': function(t) {
        var data = {
              "name" : "MyApp",
              "hostname" : "server",
              "pid" : 22467,
              "audit" : true,
              "level" : "info",
              "remoteAddress" : "127.0.0.1",
              "remotePort" : 58539,
              "req_id" : "-",
              "req" : {
                "method" : "GET",
                "url" : "/healthcheck",
                "headers" : {
                  "host" : "localhost:8888"
                },
                "httpVersion" : "1.1",
                "trailers" : {
                },
                "version" : "1.0.0",
                "timers" : {
                }
              },
              "res" : {
                "statusCode" : 200,
                "trailer" : false
              },
              "rusage" : {
                "utime" : 0,
                "stime" : 0,
                "wtime" : 0.00018252001609653234,
                "maxrss" : 0,
                "inblock" : 0,
                "oublock" : 0
              },
              "query" : null,
              "latency" : null,
              "_audit" : true,
              "msg" : "handled: 200",
              "time" : "2015-01-15T05:04:55.114Z",
              "v" : 0,
              "requestId" : "-"
        };
        var i, x;
        for (i=0; i<10000; i++) x = this.cut.encode(data);
        //for (i=0; i<10000; i++) x = JSON.stringify(data);
        // 75ms for 10k encodes of 533B strings: 133k/s (vs JSON.stringify 103ms)
        // in production, throughput drops from 4.0k/s to 3.2k/s, ie 3.2k in .2 sec => 16k/s ?? (135k/s)
        // both JSON and json-simple, same thing
        t.done();
    },
};
