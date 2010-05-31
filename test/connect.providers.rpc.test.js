
/**
 * Module dependencies.
 */

var connect = require('connect'),
    helpers = require('./helpers'),
    assert = require('assert'),
    http = require('http'),
    jsonrpc = require('connect/providers/jsonrpc')

function run(procedures){
    var server = helpers.run([
        { provider: 'jsonrpc', param: procedures }
    ]);
    server.call = function(obj, fn){
        var req = server.request('POST', '/', { 'Content-Type': 'application/json' });
        req.buffer = true;
        req.addListener('response', function(res){
            res.addListener('end', function(){
                fn(res, JSON.parse(res.body));
            });
        });
        if (typeof obj === 'object') {
            obj = JSON.stringify(obj);
        }
        req.write(obj);
        req.end();
    };
    return server;
}

module.exports = {
    test_invalid_version: function(){
        var server = run({});
        server.call({
            jsonrpc: '1.0',
            method: 'add',
            params: [1,2],
            id: 1
        }, function(res, body){
            assert.eql({ id: 1, error: { code: jsonrpc.INVALID_REQUEST, message: 'Invalid Request.' }, jsonrpc: '2.0'}, body);
        });
    },
    
    test_invalid_id: function(){
        var server = run({});
        server.call({
            jsonrpc: '2.0',
            method: 'add',
            params: [1,2]
        }, function(res, body){
            assert.eql({ id: null, error: { code: jsonrpc.INVALID_REQUEST, message: 'Invalid Request.' }, jsonrpc: '2.0' }, body);
        });
    },
    
    test_parse_error: function(){
        var server = run({});
        server.call('{ "invalid:', function(res, body){
            assert.eql({ id: null, error: { code: jsonrpc.PARSE_ERROR, message: 'Parse Error.' }, jsonrpc: '2.0' }, body);
        });
    },
    
    test_invalid_method: function(){
        var server= run({});
        server.call({
            jsonrpc: '2.0',
            method: 'add',
            id: 1
        }, function(res, body){
            assert.eql({ id: 1, error: { code: jsonrpc.METHOD_NOT_FOUND, message: 'Method Not Found.' }, jsonrpc: '2.0' }, body);
        });
    },
    
    test_uncaught_method_exception: function(){
        var server= run({
            add: function(a, b){
                throw new Error('fail!');
            }
        });
        server.call({
            jsonrpc: '2.0',
            method: 'add',
            params: [1,2],
            id: 1
        }, function(res, body){
            assert.eql({ id: 1, error: { code: jsonrpc.INTERNAL_ERROR, message: 'Internal Error.' }, jsonrpc: '2.0' }, body);
        });
    },
    
    test_passing_method_predefined_exception_code: function(){
        var server= run({
            add: function(a, b){
                if (arguments.length === 2) {
                    if (typeof a === 'number' && typeof b === 'number') {
                        this(null, a + b);
                    } else {
                        var err = new Error('Arguments must be numeric.');
                        err.code = jsonrpc.INVALID_PARAMS;
                        this(err);
                    }
                } else {
                    this(jsonrpc.INVALID_PARAMS);
                }
            }
        });
        
        // Invalid params
        
        server.call({
            jsonrpc: '2.0',
            method: 'add',
            params: [1],
            id: 1
        }, function(res, body){
            assert.eql({ id: 1, error: { code: jsonrpc.INVALID_PARAMS, message: 'Invalid Params.' }, jsonrpc: '2.0' }, body);
        });
        
        // Valid
        
        server.call({
            jsonrpc: '2.0',
            method: 'add',
            params: [1, 2],
            id: 2
        }, function(res, body){
            assert.eql({ id: 2, result: 3, jsonrpc: '2.0' }, body);
        });
        
        // Custom exception
        
        server.call({
            jsonrpc: '2.0',
            method: 'add',
            params: [1, {}],
            id: 3
        }, function(res, body){
            assert.eql({ id: 3, error: { code: jsonrpc.INVALID_PARAMS, message: 'Arguments must be numeric.' }, jsonrpc: '2.0' }, body);
        });
    },
    
    test_method_call: function(){
        var server= run({
            add: function(a, b){
                this(null, a + b);
            }
        });
        server.call({
            jsonrpc: '2.0',
            method: 'add',
            params: [1,2],
            id: 1
        }, function(res, body){
            assert.eql({ id: 1, result: 3, jsonrpc: '2.0' }, body);
        });
    }
}