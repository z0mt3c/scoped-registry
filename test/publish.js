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

	describe('publishing', function() {
		describe('step-by-step', function() {
			before(dropDb);

			describe('createPackage', function() {
				it('initial', function(done) {
					registry.createPackage(fixPublish, function(error, data) {
						expect(error).not.to.exist;
						expect(data).to.deep.equal(1);

						registry.info('@test/joi', function(error, info) {
							expect(error).not.to.exist;
							expect(info).to.include({'_id': fixPublish.name, 'name': fixPublish.name});
							expect(info).to.deep.include({'dist-tags': {}, 'versions': {}, 'users': {}});
							expect(info.time.created).to.be.a.date();
							expect(info.time.modified).to.be.a.date();
							done();
						});
					});
				});

				it('duplicate', function(done) {
					registry.createPackage(fixPublish, function(error, data) {
						expect(error).not.to.exist;
						expect(data).to.deep.equal(1);

						registry.status(function(error, status) {
							expect(error).not.to.exist;
							expect(status).to.include({'package_count': 1, 'release_count': 0});
							done();
						});
					});
				});
			});

			describe('createVersion', function() {
				it('initial', function(done) {
					registry.createVersion(fixPublish, function(error, data) {
						expect(error).not.to.exist;
						expect(data).to.be.true;

						registry.info('@test/joi', function(error, info) {
							expect(error).not.to.exist;
							expect(info).to.include({'_id': fixPublish.name, 'name': fixPublish.name});
							var distTags = fixPublish['dist-tags'];
							expect(info).to.deep.include({'dist-tags': distTags});
							expect(info.time.created).to.be.a.date();
							expect(info.time.modified).to.be.a.date();
							var clonedVersion = _.cloneDeep(fixPublish.versions[distTags.latest]);
							delete clonedVersion.readme;
							clonedVersion.dist.tarball = utils.createArchiveURL(clonedVersion, config);
							expect(info.versions[distTags.latest]).to.be.deep.equal(clonedVersion);
							done();
						});
					});
				});

				it('duplicate', function(done) {
					registry.createVersion(fixPublish, function(error, data) {
						expect(error).to.exist;
						expect(error.message).to.deep.equal('Version already present / Package not present');
						expect(data).not.to.exist;
						done();
					});
				});
			});

			describe('saveArchive', function() {
				it('initial', function(done) {
					registry.saveArchive(fixPublish, function(error) {
						expect(error).not.to.exist;

						registry.status(function(error, status) {
							expect(error).not.to.exist;
							expect(status).to.include({'package_count': 1, 'release_count': 1});
							done();
						});
					});
				});

				it('duplicate', function(done) {
					registry.saveArchive(fixPublish, function(error, data) {
						expect(error).not.to.exist;

						registry.status(function(error, status) {
							expect(error).not.to.exist;
							expect(status).to.include({'package_count': 1, 'release_count': 1});
							done();
						});
					});
				});
			});

			describe('updateRootFromTag', function() {
				it('initial', function(done) {
					registry.updateRootFromTag('@test/joi', 'latest', function(error) {
						expect(error).not.to.exist;

						registry.info('@test/joi', function(error, info) {
							var version = fixPublish.versions[fixPublish['dist-tags'].latest];
							var dbVersion = info.versions[info['dist-tags'].latest];

							_.each(['description', 'maintainers', 'repository', 'readmeFilename', 'homepage', 'keywords', 'contributors', 'bugs'], function(attribute) {
								expect(dbVersion[attribute]).to.deep.equal(version[attribute]);
								expect(info[attribute]).to.deep.equal(version[attribute]);
							});

							done();
						});
					});
				});
			});

			describe('cleanup', function() {
				it('nothing to clean', function(done) {
					registry.info('@test/joi', function(error, info1) {
						expect(error).not.to.exist;
						expect(info1).to.exist;
						registry.cleanupPackage('@test/joi', function(error) {
							expect(error).not.to.exist;
							registry.info('@test/joi', function(error, info2) {
								expect(error).not.to.exist;
								expect(info2).to.exist;
								expect(info1).to.deep.equal(info2);
								done();
							});
						});
					});
				});
			});
		});

		describe('all-in-one', function() {
			before(dropDb);

			it('initial', function(done) {
				registry.publish(fixPublish, function(error, results) {
					expect(error).not.to.exist;
					expect(results).to.exist;
					done();
				});
			});
		});
	});
});
