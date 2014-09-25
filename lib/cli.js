var _ = require('lodash');
var Hoek = require('hoek');
var utils = require('./utils');
var argv = require('yargs').argv;

var internals = {
};

var commands = {
	start: function () {
		require('../server/server');
	},
	/*
	createConfig: function() {
	},
	addUser: function() {
		var config = utils.loadConfig();
	},
	removeUser: function() {
		var config = utils.loadConfig();
	},
	changePassword: function() {
		var config = utils.loadConfig();
	},
	*/
	version: function() {
		var packageJson = require('../package.json');
        console.log(packageJson.name + ' v' + packageJson.version);
	},
	help: function () {
		console.log('Supported commands: \n - ' + _.keys(commands).join('\n - ') + '\n');
	}
};

var command = _.first(argv._);
commands[_.has(commands, command) ? command : 'help']();






