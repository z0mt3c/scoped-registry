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

	describe('unpublishing', function() {
		beforeEach(function(done) {
			dropDb(function() {
				registry.publish(fixPublish, function(error, results) {
					expect(error).not.to.exist;
					expect(results).to.exist;
					done();
				});
			});
		});

		it('complete package', function(done) {
			registry.unpublish(fixPublish.name, function(error, results) {
				expect(error).not.to.exist;
				expect(results).to.exist;

				registry.status(function(error, status) {
					expect(error).not.to.exist;
					expect(status).to.include({'package_count': 0, 'release_count': 0});
					done();
				});
			});
		});

		it('removePackage', function(done) {
			registry.removePackage(fixPublish.name, function(error, results) {
				expect(error).not.to.exist;
				expect(results).to.exist;

				registry.status(function(error, status) {
					expect(error).not.to.exist;
					expect(status).to.include({'package_count': 0, 'release_count': 1});
					done();
				});
			});
		});

		it('removeVersion', function(done) {
			registry.removeVersion(fixPublish.name, fixPublish['dist-tags']['latest'], function(error, results) {
				expect(error).not.to.exist;
				expect(results).to.exist;

				registry.status(function(error, status) {
					expect(error).not.to.exist;
					expect(status).to.include({'package_count': 0, 'release_count': 0});
					done();
				});
			});
		});
	});
});
