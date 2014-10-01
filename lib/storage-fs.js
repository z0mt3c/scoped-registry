var _ = require('lodash');
var mongodb = require('mongodb');
var utils = require('./utils');
var Hoek = require('hoek');
var Grid = require('gridfs-stream');
var async = require('async');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');

var Storage = module.exports = function (options) {
	this.storagePath = Hoek.reach(options, 'storage.path');
    Hoek.assert(this.storagePath, 'registry.storage.path missing');
	this.options = options;
};

Storage.prototype.fetchArchive = function (packageName, fileName, next) {
	var archiveFile = path.join(this.storagePath, utils.escapeName(packageName), utils.escapeName(fileName));

	fs.exists(archiveFile, function (exists) {
		if (!exists) {
			return next(null, null);
		} else {
			return next(null, fs.createReadStream(archiveFile));
		}
	});
};

Storage.prototype.saveArchive = function (data, next) {
	var version = _.first(_.values(data.versions));
	var filename = _.first(_.keys(data._attachments));
	var attachment = data._attachments[filename];
	var buffer = new Buffer(attachment.data, 'base64');
	var archiveFile = path.join(this.storagePath, utils.escapeName(data.name), utils.escapeName(utils.createArchiveName(version)));

	utils.writeFile(archiveFile, buffer, next);
};

Storage.prototype.removeAllArchives = function (packageName, next) {
	var packagePath = path.join(this.storagePath, utils.escapeName(packageName));
	rimraf(packagePath, next);
};

Storage.prototype.removeArchiveFile = function (packageName, fileName, next) {
	var archiveFile = path.join(this.storagePath, utils.escapeName(packageName), utils.escapeName(fileName));
	fs.exists(archiveFile, function (exists) {
		if (!exists) {
			return next(null, false);
		} else {
			fs.unlink(archiveFile, function(error) {
				return next(error, !error);
			});
		}
	});
};
