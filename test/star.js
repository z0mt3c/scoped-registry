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

    describe('staring', function () {
        before(function (done) {
            dropDb(function () {
                registry.publish(fixPublish, function (error, results) {
                    expect(error).not.to.exist;
                    expect(results).to.exist;
                    done();
                });
            });
        });

        it('star', function (done) {
            registry.star(fixPublish.name, 'tester', function (error, results) {
                expect(error).not.to.exist;
                expect(results).to.exist;
                registry.info(fixPublish.name, function (error, info) {
                    expect(error).not.to.exist;
                    expect(info).to.have.deep.property('users.tester', true);
                    done();
                });
            });
        });

        it('unstar', function (done) {
            registry.info(fixPublish.name, function (error, info) {
                expect(error).not.to.exist;
                expect(info).to.have.deep.property('users.tester', true);
                registry.unstar(fixPublish.name, 'tester', function (error, results) {
                    expect(error).not.to.exist;
                    expect(results).to.exist;
                    registry.info(fixPublish.name, function (error, info) {
                        expect(error).not.to.exist;
                        expect(info).to.have.property('users').that.eql({});
                        done();
                    });
                });
            });
        });
    });
});
