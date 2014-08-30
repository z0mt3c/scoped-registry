var Hapi = require('hapi');
var Hoek = require('hoek');
var _ = require('lodash');
var async = require('async');
var config = require('../config/example.json');

Hoek.assert(config.api, 'api configuration missing');
Hoek.assert(config.good, 'good configuration missing');

var port = config.server.port || 8000;
var server = new Hapi.Server('localhost', port, {});

var plugins = [
    {plugin: require('good'), pluginOptions: config.good},
    {plugin: require('../'), pluginOptions: config.api}
];

async.each(plugins, function (plugin, next) {
    var info = plugin.plugin.register.attributes.pkg || plugin.plugin.register.attributes;
    server.log('server', 'Registering plugin ' + info.name + ' v' + info.version);
    server.pack.register({
        plugin: plugin.plugin,
        options: plugin.pluginOptions
    }, plugin.options || {}, function (error) {
        if (error) throw error;
        next(error);
    });
}, function (error) {
    if (error) throw error;

    server.start(function (error) {
        if (error) throw error;
        server.log('server', 'scoped-registry is running at: http://localhost:' + port);
    });
});