var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var after = lab.after;
var expect = Lab.expect;

var config = require('./config.json');
var Storage = require('../lib/storage');
var mongodb = require('mongodb');
var _ = require('lodash');
var utils = require('../lib/utils');
var Hoek = require('hoek');

var fixPublish = require('./fixtures/publish_joi.json');
var fixPublish2 = require('./fixtures/publish_dummy.json');
var fixPublish3 = require('./fixtures/publish_joi_update.json');

describe('storage', function () {
	var db, storage;

	var dropDb = function (done) {
		db.dropDatabase(function () {
			storage = new Storage(config, db);
			done();
		});
	};

	before(function (done) {
		mongodb.MongoClient.connect(config.mongodb, function (err, database) {
			Hoek.assert(!err, 'Database connection failed');
			db = database;

			dropDb(function () {
				done();
			});
		});
	});

	after(function (done) {
		db.close(function () {
			done();
		});
	});


	it('save 1', function (done) {
		storage.saveArchive(fixPublish, function (err, meta) {
			expect(err).not.to.exist;
			expect(meta).to.exist;
			done();
		});
	});

	it('save 2', function (done) {
		storage.saveArchive(fixPublish2, function (err, meta) {
			expect(err).not.to.exist;
			expect(meta).to.exist;
			done();
		});
	});

	it('save 3', function (done) {
		storage.saveArchive(fixPublish3, function (err, meta) {
			expect(err).not.to.exist;
			expect(meta).to.exist;
			done();
		});
	});

	it('fetch', function (done) {
		storage.fetchArchive('@test/joi', '@test/joi-4.7.0.tgz', function (err, data) {
			expect(err).not.to.exist;
			expect(data).to.exist;

			var responseData = "";

			data.on('data', function (response) {
				responseData += response;
			});
			data.on('end', function () {
				expect(responseData).to.eql('DATA');
				done();
			});
		});
	});

	it('fetch 404', function (done) {
		storage.fetchArchive('@test/joi', '@test/joi-4.123.tgz', function (err, data) {
			expect(err).not.to.exist;
			expect(data).not.to.exist;
			done();
		});
	});

	it('remove 404', function (done) {
		storage.removeArchiveFile('@test/joi', '@test/joi-4.123.tgz', function (err, data) {
			expect(err).not.to.exist;
			expect(data).to.be.false;
			done();
		});
	});

	it('remove archive', function (done) {
		storage.removeArchiveFile('@test/dummy', '@test/dummy-4.7.0.tgz', function (err, data) {
			expect(err).not.to.exist;
			expect(data).to.exist;

			storage.fetchArchive('@test/dummy', '@test/dummy-4.7.0.tgz', function (err, data) {
				expect(err).not.to.exist;
				expect(data).not.to.exist;
				done();
			});
		});
	});

	it('remove all archives of package', function (done) {
		storage.removeAllArchives('@test/joi', function (err) {
			expect(err).not.to.exist;

			storage.fetchArchive('@test/joi', '@test/joi-4.7.0.tgz', function (err, data) {
				expect(err).not.to.exist;
				expect(data).not.to.exist;
				done();
			});
		});
	});
});
