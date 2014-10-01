var _ = require('lodash');
var mongodb = require('mongodb');
var utils = require('./utils');
var Hoek = require('hoek');
var Grid = require('gridfs-stream');
var async = require('async');
var crypto = require('crypto');

var Storage = module.exports = function (options, db) {
	Hoek.assert(db, 'Database has to be present');
	this.options = options;
	this.db = db;
	this.gfs = Grid(db, mongodb);
};

Storage.prototype.fetchArchive = function (packageName, filename, next) {
	var gfs = this.gfs;
	var options = {
		filename: packageName + '/' + filename,
		package: packageName
	};

	gfs.exist(options, function (error, found) {
		return next(error, found ? gfs.createReadStream(options) : null);
	});
};

Storage.prototype.saveArchive = function (data, next) {
	var db = this.db;
	var version = _.first(_.values(data.versions));
	var archiveName = data.name + '/' + utils.createArchiveName(version);
	var filename = _.first(_.keys(data._attachments));
	var attachment = data._attachments[filename];

	var buffer = new Buffer(attachment.data, 'base64');
	var shasum = crypto.createHash('sha1');
	shasum.update(buffer);

	var metadata = {
		filename: filename,
		package: data.name,
		version: version.version,
		readme: version.readme,
		shasum: shasum.digest('hex')
	};

	var gridStore = new mongodb.GridStore(db, archiveName, "w", {
		content_type: 'binary/octet-stream',
		metadata: metadata
	});

	gridStore.open(function (error, gridStore) {
		if (error) return next(error);
		gridStore.write(buffer, function (error, gridStore) {
			if (error) return next(error);
			gridStore.close(function (error) {
				if (error) return next(error);
				return next(null);
			});
		});
	});
};

Storage.prototype.removeAllArchives = function (packageName, next) {
	var self = this;
	var ids = [];

	var removeFiles = function () {
		async.each(ids, function (id, next) {
			mongodb.GridStore.unlink(self.db, id, next);
		}, next);
	};

	this.db.collection('fs.files').find({
		filename: {$regex: '^' + packageName},
		'metadata.package': packageName
	}).each(function (error, item) {
		if (error) {
			return next(error);
		} else if (item) {
			ids.push(item._id);
		} else {
			// last iteration does not have item
			return removeFiles();
		}
	});
};

Storage.prototype.removeArchiveFile = function (packageName, fileName, next) {
	var self = this;

	this.db.collection('fs.files').findOne({
		filename: packageName + '/' + fileName,
		'metadata.package': packageName
	}, function (error, item) {
		if (error) {
			return next(error);
		} else if (item) {
			return mongodb.GridStore.unlink(self.db, item._id, next);
		} else {
			return next(null, false);
		}
	});
};
