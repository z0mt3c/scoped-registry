var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var after = lab.after;
var expect = Lab.expect;

var config = require('./config.json');
var Registry = require('../lib/registry');
var mongodb = require('mongodb');
var _ = require('lodash');
var utils = require('../lib/utils');
var Hoek = require('hoek');

var fixPublishUpdate = require('./fixtures/publish_joi_update.json');

describe('registry', function () {
    var db, registry;

    var dropDb = function (done) {
        db.dropDatabase(function () {
            registry = new Registry(config, db);
            done();
        });
    };

    before(function (done) {
        mongodb.MongoClient.connect(config.mongodb, function (err, database) {
            Hoek.assert(!err, 'Database connection failed');
            db = database;
            dropDb(done);
        });
    });

    after(function (done) {
        db.close(function () {
            done();
        });
    });

    describe('all', function () {
        var since;

        before(function (done) {
            since = new Date();
            dropDb(done);
        });

        it('publish update', function (done) {
            registry.publish(fixPublishUpdate, function (error, results) {
                expect(error).not.to.exist;
                expect(results).to.exist;
                done();
            });
        });

        it('all since before publish', function (done) {
            registry.all(since, function (error, document) {
                expect(error).not.to.exist;
                expect(document).to.be.a('array').and.have.length(1);
                done();
            });
        });

        it('all since now', function (done) {
            registry.all(new Date(), function (error, document) {
                expect(error).not.to.exist;
                expect(document).to.be.a('array').and.have.length(0);
                done();
            });
        });
    });
});
