var Hapi = require('hapi');
var Hoek = require('hoek');
var _ = require('lodash');
var async = require('async');
var utils = require('../lib/utils');

console.log("                                 _________");
console.log(" ______________________________________  /");
console.log(" __  ___/  ___/  __ \\__  __ \\  _ \\  __  /");
console.log(" _(__  )/ /__ / /_/ /_  /_/ /  __/ /_/ /");
console.log(" /____/ \\___/ \\____/_  .___/\\___/\\__,_/");
console.log("                    /_/");
console.log("                                   _____       _____");
console.log("          ___________________ ___(_)________  /____________  __");
console.log("   _________  ___/  _ \\_  __ `/_  /__  ___/  __/_  ___/_  / / /");
console.log("   _/_____/  /   /  __/  /_/ /_  / _(__  )/ /_ _  /   _  /_/ /");
console.log("          /_/    \\___/_\\__, / /_/  /____/ \\__/ /_/    _\\__, /");
console.log("                      /____/                          /____/");
console.log("");

utils.loadConfig(function (err, config) {
	console.log('Starting scoped-registry (powered by hapi ' + Hapi.version + ')');

	var host = config.server.host;
	var port = config.server.port;
	var server = new Hapi.Server(host, port, config.server.options || {});
	var plugins = [
		{plugin: require('../'), pluginOptions: config.registry},
	];

	if (config.good) {
		plugins.push({plugin: require('good'), pluginOptions: config.good})
	}

	if (!config.web || config.web.active !== false) {
		var webPrefix = '/-/static/web';

		plugins.push({
			plugin: require('scoped-registry-web'),
			pluginOptions: {},
			options: {route: {prefix: webPrefix}}
		});

		server.route({
			method: 'GET',
			path: '/',
			handler: function (request, reply) {
				reply.redirect(webPrefix);
			}
		});

		/*
		server.route({
			method: 'GET',
			path: '/favicon.ico',
			handler: function (request, reply) {
				reply.redirect(webPrefix);
			}
		});*/
	}

	async.each(plugins, function (plugin, next) {
		var info = plugin.plugin.register.attributes.pkg || plugin.plugin.register.attributes;
		console.log('-> register plugin ' + info.name + ' v' + info.version);
		server.pack.register({
			plugin: plugin.plugin,
			options: plugin.pluginOptions
		}, plugin.options || {}, function (error) {
			next(error);
		});
	}, function (error) {
		if (error) throw error;
		server.start(function (error) {
			if (error) throw error;
			console.log('scoped-registry is listening at: http://' + host + ':' + port);
		});
	});
});
