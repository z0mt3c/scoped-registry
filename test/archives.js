var Lab = require('lab');
var Code = require('code');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var beforeEach = lab.beforeEach;
var after = lab.after;
var expect = Code.expect;

var config = require('./config.json');
var Registry = require('../lib/registry');
var mongodb = require('mongodb');
var _ = require('lodash');
var utils = require('../lib/utils');
var Hoek = require('hoek');

var fixPublish = require('./fixtures/publish_joi.json');

describe('registry', function() {
	var db, registry;

	var dropDb = function(done) {
		db.dropDatabase(function() {
			registry = new Registry(config, db);
			done();
		});
	};

	before(function(done) {
		mongodb.MongoClient.connect(config.mongodb, function(err, database) {
			Hoek.assert(!err, 'Database connection failed');
			db = database;
			dropDb(done);
		});
	});

	after(function(done) {
		db.close(function() {
			done();
		});
	});

	describe('archiving', function() {
		describe('deleting', function() {
			beforeEach(function(done) {
				dropDb(function() {
					registry.saveArchive(fixPublish, function(error, data) {
						expect(error).not.to.exist;
						done();
					});
				});
			});

			it('conditions', function(done) {
				registry.status(function(error, status) {
					expect(error).not.to.exist;
					expect(status).to.include({'package_count': 0, 'release_count': 1});
					done();
				});
			});

			it('removeArchiveFile', function(done) {
				registry.removeArchiveFile('@test/joi', '@test/joi-4.7.0.tgz', function(error) {
					expect(error).not.to.exist;
					registry.status(function(error, status) {
						expect(error).not.to.exist;
						expect(status).to.include({'package_count': 0, 'release_count': 0});
						done();
					});
				});
			});

			it('removeArchive', function(done) {
				registry.removeArchive('@test/joi', '4.7.0', function(error) {
					expect(error).not.to.exist;
					registry.status(function(error, status) {
						expect(error).not.to.exist;
						expect(status).to.include({'package_count': 0, 'release_count': 0});
						done();
					});
				});
			});
		});

		describe('reading', function() {
			before(function(done) {
				dropDb(function() {
					registry.saveArchive(fixPublish, function(error, data) {
						expect(error).not.to.exist;
						done();
					});
				});
			});

			it('conditions', function(done) {
				registry.status(function(error, status) {
					expect(error).not.to.exist;
					expect(status).to.include({
						'package_count': 0,
						'release_count': 1
					});
					done();
				});
			});

			it('fetchArchive', function(done) {
				registry.fetchArchive('@test/joi', '@test/joi-4.7.0.tgz', function(error, stream) {
					expect(error).not.to.exist;
					expect(stream).to.exist;

					var data = '';

					stream.on('data', function(buffer) {
						data += buffer.toString('utf8');
					});

					stream.on('end', function() {
						var fixtureData = fixPublish['_attachments']['@test/joi-4.7.0.tgz'].data;
						expect(data).to.equal(new Buffer(fixtureData, 'base64').toString('utf8'));
						done();
					});
				});
			});
		});
	});
});
