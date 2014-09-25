var utils = module.exports = {};
var _ = require('lodash');
var fs = require('fs');
var yaml = require('js-yaml');
var Hoek = require('hoek');
var Joi = require('joi');
var schemas = require('./schemas');

//name.replace('/', '%2f')
utils.escapeName = encodeURIComponent;

//need? name.replace('%2f', '/')
utils.unescapeName = decodeURIComponent;

utils.createDefaultPackage = function (data) {
	Hoek.assert(data && data.name, 'Package data missing');
	return {
		_id: data.name,
		name: data.name,
		description: data.description
	};
};

utils.createReleaseName = function (version) {
	Hoek.assert(version && version.name && version.version, 'Version data missing');
	return version.name + '-' + version.version;
};

utils.createArchiveName = function (version) {
	return utils.createReleaseName(version) + '.tgz';
};

utils.createRootUpdate = function (data) {
	Hoek.assert(data, 'Cannot create root updated of nothing');
	var dataToSet = _.pick(data, ['description', 'readme', 'maintainers', 'repository', 'readmeFilename', 'homepage', 'keywords', 'contributors', 'bugs']);
	dataToSet['time.modified'] = new Date();
	return dataToSet;
};

utils.createDistTagsUpdate = function (data) {
	Hoek.assert(data && data['dist-tags'], 'Cannot data or dist-tags');
	return _.reduce(data['dist-tags'], function (memo, value, key) {
		memo['dist-tags.' + key] = value;
		return memo;
	}, {});
};

utils.transformPackageDocument = function (packageDocument, options) {
	Hoek.assert(packageDocument, 'No package document available');

	packageDocument.time = _.reduce(packageDocument.versions, function (memo, version) {
		version.dist.tarball = utils.createArchiveURL(version, options);

		if (version.created) {
			memo[version.version] = version.created;
		}

		return memo;
	}, packageDocument.time);

	packageDocument.users = _.reduce(packageDocument.users, function (memo, username) {
		memo[username] = true;
		return memo;
	}, {});

	packageDocument.versions = _.indexBy(packageDocument.versions, 'version');
	delete packageDocument._attachments;
	packageDocument._rev = 'latest';

	return packageDocument;
};

utils.createArchiveURL = function (version, options) {
	var baseUrl = options.baseUrl;
	var archiveName = utils.escapeName(utils.createArchiveName(version));
	return baseUrl + '/tarball/' + utils.escapeName(version.name) + '/' + archiveName;
};

utils.extractScope = function (packageName) {
	var match = packageName ? schemas.pattern.packageName.exec(packageName) : null;
	return match && match.length >= 2 ? match[1] : null;
};

utils.loadConfig = function (cb) {
	var argv = require('yargs').alias('c', 'config').default('c', '/etc/scoped-registry/config.yml').argv;
	var configFile = argv.c;
	Hoek.assert(fs.existsSync(configFile), 'File not found at: ' + configFile);
	var config = yaml.safeLoad(fs.readFileSync(configFile, 'utf8'));
	Joi.assert(config, schemas.Config, 'Invalid scoped-registry configuration');

	if (cb) {
		Joi.validate(config, schemas.Config, cb);
	}

	return config;
};
