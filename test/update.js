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
var fixPublishUpdate = require('./fixtures/publish_joi_update.json');
var fixPublishBeta = require('./fixtures/publish_joi_update_beta.json');
var fixUnpublishUpdate = require('./fixtures/unpublish_joi_update.json');
var fixUnpublishBeta = require('./fixtures/unpublish_joi_beta.json');

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

    describe('updating', function () {
        before(function (done) {
            dropDb(function () {
                registry.publish(fixPublish, function (error, results) {
                    expect(error).not.to.exist;
                    expect(results).to.exist;
                    done();
                });
            });
        });

        it('condition', function (done) {
            registry.info(fixPublish.name, function (error, info) {
                var latest = fixPublish['dist-tags'].latest;
                expect(info.readme).to.eql(fixPublish.versions[latest].readme);

                var latest2 = fixPublishUpdate['dist-tags'].latest;
                var beta = fixPublishBeta['dist-tags'].beta;
                expect(fixPublishUpdate.versions[latest2].readme).not.to.eql(fixPublishBeta.versions[beta].readme);
                expect(fixPublishUpdate.versions[latest2].readme).not.to.eql(fixPublish.versions[latest].readme);

                done();
            });
        });

        it('publish update', function (done) {
            registry.publish(fixPublishUpdate, function (error, results) {
                expect(error).not.to.exist;
                expect(results).to.exist;

                registry.info(fixPublish.name, function (error, info) {
                    expect(error).not.to.exist;
                    var latestBefore = fixPublish['dist-tags'].latest;
                    var latest = fixPublishUpdate['dist-tags'].latest;
                    expect(info).to.have.deep.property('dist-tags.latest', latest);
                    expect(info.readme).to.eql(fixPublishUpdate.versions[latest].readme);
                    var clonedVersion = _.cloneDeep(fixPublishUpdate.versions[latest]);
                    delete clonedVersion.readme;
                    clonedVersion.dist.tarball = utils.createArchiveURL(clonedVersion, config);
                    expect(info).to.have.property('versions').that.have.property(latest).that.eql(clonedVersion);
                    expect(info).to.have.property('versions').that.have.property(latestBefore);
                    done();
                });
            });
        });

        it('publish tagged update', function (done) {
            registry.publish(fixPublishBeta, function (error) {
                expect(error).not.to.exist;
                registry.info(fixPublish.name, function (error, info) {
                    expect(error).not.to.exist;
                    expect(_.keys(info.versions)).to.have.length(3);
                    var latest = fixPublishUpdate['dist-tags'].latest;
                    var beta = fixPublishBeta['dist-tags'].beta;
                    expect(info).to.have.deep.property('dist-tags.latest', latest);
                    expect(info).to.have.deep.property('dist-tags.beta', beta);
                    expect(info.readme).to.eql(fixPublishUpdate.versions[latest].readme);
                    expect(info.readme).not.to.eql(fixPublishBeta.versions[beta].readme);

                    var clonedVersion = _.cloneDeep(fixPublishBeta.versions[beta]);
                    delete clonedVersion.readme;
                    clonedVersion.dist.tarball = utils.createArchiveURL(clonedVersion, config);
                    expect(info).to.have.property('versions').that.have.property(beta).that.eql(clonedVersion);
                    expect(info).to.have.property('versions').that.have.property(latest);

                    done();
                });
            });
        });

        it('unpublish update', function (done) {
            registry.update(fixUnpublishUpdate, function (error) {
                expect(error).not.to.exist;
                registry.info(fixPublish.name, function (error, info) {
                    expect(error).not.to.exist;
                    expect(_.keys(info.versions)).to.have.length(2);
                    expect(_.keys(info['dist-tags'])).to.have.length(2);
                    expect(info['dist-tags'].latest).to.eql(info['dist-tags'].beta);
                    done();
                });
            });
        });

        it('unpublish beta', function (done) {
            registry.update(fixUnpublishBeta, function (error) {
                expect(error).not.to.exist;
                registry.info(fixPublish.name, function (error, info) {
                    expect(error).not.to.exist;
                    expect(_.keys(info.versions)).to.have.length(1);
                    expect(_.keys(info['dist-tags'])).to.have.length(1);
                    done();
                });
            });
        });
    });
});
