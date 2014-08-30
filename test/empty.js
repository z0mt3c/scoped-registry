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

var fixPublishBeta = require('./fixtures/publish_joi_update_beta.json');

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

    describe('empty', function () {
        before(dropDb);

        it('all', function (done) {
            registry.all(null, function (error, document) {
                expect(error).not.to.exist;
                expect(document).to.be.a('array').and.have.length(0);
                done();
            });
        });

        it('all since', function (done) {
            registry.all(new Date(), function (error, document) {
                expect(error).not.to.exist;
                expect(document).to.be.a('array').and.have.length(0);
                done();
            });
        });

        it('package not found', function (done) {
            registry.info('name', function (error, document) {
                expect(error).not.to.exist;
                expect(document).not.to.exist;
                done();
            });
        });

        it('versions for non existing package', function (done) {
            registry.versions('name', function (error, versions) {
                expect(error).not.to.exist;
                expect(versions).to.have.length(0);
                done();
            });
        });

        it('archive not found', function (done) {
            registry.fetchArchive('name.tgz', function (error, stream) {
                expect(error).not.to.exist;
                expect(stream).not.to.exist;
                done();
            });
        });

        it('status', function (done) {
            registry.status(function (error, status) {
                expect(error).not.to.exist;
                expect(status).to.have.property('package_count', 0);
                done();
            });
        });

        it('star', function (done) {
            registry.star('name', 'user', function (error) {
                expect(error).to.exist;
                done();
            })
        });

        it('unstar', function (done) {
            registry.unstar('name', 'user', function (error) {
                expect(error).to.exist;
                done();
            })
        });

        it('removePackage', function (done) {
            registry.removePackage('name', function (error, results) {
                expect(error).to.exist;
                done();
            })
        });

        it('unpublish', function (done) {
            registry.unpublish('name', function (error, results) {
                expect(error).to.exist;
                expect(results).to.exist;
                done();
            })
        });

        it('readme', function (done) {
            registry.readme('name', 'version', function (error, results) {
                expect(error).not.to.exist;
                expect(results).not.to.exist;
                done();
            });
        });

        it('update', function (done) {
            registry.update(fixPublishBeta, function (error, results) {
                expect(error).not.to.exist;
                expect(results).to.be.false;
                done();
            });
        });

        it('removeArchiveFile', function (done) {
            registry.removeArchiveFile('test', function (error, results) {
                expect(error).not.to.exist;
                expect(results).to.be.false;
                done();
            });
        });
    });
});
