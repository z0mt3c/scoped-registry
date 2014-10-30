var Lab = require('lab');
var Code = require('code');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
var before = lab.before;
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

	describe('tagging', function() {
		before(function(done) {
			dropDb(function() {
				registry.publish(fixPublish, function(error, results) {
					expect(error).not.to.exist;
					expect(results).to.exist;
					done();
				});
			});
		});

		it('tag', function(done) {
			registry.tag(fixPublish.name, 'beta', '4.7.0', function(error, results) {
				expect(error).not.to.exist;
				expect(results).to.deep.equal(1);
				registry.info(fixPublish.name, function(error, info) {
					expect(error).not.to.exist;
					expect(info['dist-tags']).to.include({'beta':'4.7.0'});

					done();
				});
			});
		});

		it('tag non-existing version', function(done) {
			registry.tag(fixPublish.name, 'beta2', '1.2.3', function(error, results) {
				expect(error).not.to.exist;
				expect(results).to.deep.equal(0);
				registry.info(fixPublish.name, function(error, info) {
					expect(error).not.to.exist;
					expect(info['dist-tags']).not.to.include('beta2');
					done();
				});
			});
		});

		it('untag', function(done) {
			registry.untag(fixPublish.name, 'beta', function(error, results) {
				expect(error).not.to.exist;
				expect(results).to.exist;
				registry.info(fixPublish.name, function(error, info) {
					expect(error).not.to.exist;
					expect(info['dist-tags']).not.to.include('beta');
					done();
				});
			});
		});
	});
});
