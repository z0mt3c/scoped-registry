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

var fixPublish = require('./fixtures/publish_joi.json');

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

    describe('tagging', function () {
        before(function (done) {
            dropDb(function () {
                registry.publish(fixPublish, function (error, results) {
                    expect(error).not.to.exist;
                    expect(results).to.exist;
                    done();
                });
            });
        });

        it('tag', function (done) {
            registry.tag(fixPublish.name, 'beta', '4.7.0', function (error, results) {
                expect(error).not.to.exist;
                expect(results).to.eql(1);
                registry.info(fixPublish.name, function (error, info) {
                    expect(error).not.to.exist;
                    expect(info).to.have.deep.property('dist-tags.beta', '4.7.0');
                    done();
                });
            });
        });

		it('tag non-existing version', function (done) {
            registry.tag(fixPublish.name, 'beta2', '1.2.3', function (error, results) {
                expect(error).not.to.exist;
                expect(results).to.eql(0);
                registry.info(fixPublish.name, function (error, info) {
                    expect(error).not.to.exist;
                    expect(info).to.not.have.deep.property('dist-tags.beta2');
                    done();
                });
            });
        });

        it('untag', function (done) {
            registry.untag(fixPublish.name, 'beta', function (error, results) {
                expect(error).not.to.exist;
                expect(results).to.exist;
                registry.info(fixPublish.name, function (error, info) {
                    expect(error).not.to.exist;
                    expect(info).not.to.have.deep.property('dist-tags.beta');
                    done();
                });
            });
        });
    });
});
