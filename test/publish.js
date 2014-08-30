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

    describe('publishing', function () {
        describe('step-by-step', function () {
            before(dropDb);

            describe('createPackage', function () {
                it('initial', function (done) {
                    registry.createPackage(fixPublish, function (error, data) {
                        expect(error).not.to.exist;
                        expect(data).to.eql(1);

                        registry.info('@test/joi', function (error, info) {
                            expect(error).not.to.exist;
                            expect(info).to.have.property('_id', fixPublish.name);
                            expect(info).to.have.property('name', fixPublish.name);
                            expect(info).to.have.property('dist-tags').that.eql({});
                            expect(info).to.have.property('versions').that.eql({});
                            expect(info).to.have.property('users').that.eql({});
                            expect(info).to.have.deep.property('time.created').that.is.a('date');
                            expect(info).to.have.deep.property('time.modified').that.is.a('date');
                            done();
                        });
                    });
                });

                it('duplicate', function (done) {
                    registry.createPackage(fixPublish, function (error, data) {
                        expect(error).not.to.exist;
                        expect(data).to.eql(1);

                        registry.status(function (error, status) {
                            expect(error).not.to.exist;
                            expect(status).to.have.property('package_count', 1);
                            expect(status).to.have.property('release_count', 0);
                            done();
                        });
                    });
                });
            });

            describe('createVersion', function () {
                it('initial', function (done) {
                    registry.createVersion(fixPublish, function (error, data) {
                        expect(error).not.to.exist;
                        expect(data).to.be.true;

                        registry.info('@test/joi', function (error, info) {
                            expect(error).not.to.exist;
                            expect(info).to.have.property('_id', fixPublish.name);
                            expect(info).to.have.property('name', fixPublish.name);
                            var distTags = fixPublish['dist-tags'];
                            expect(info).to.have.property('dist-tags').that.eql(distTags);
                            var clonedVersion = _.cloneDeep(fixPublish.versions[distTags.latest]);
                            delete clonedVersion.readme;
                            clonedVersion.dist.tarball = utils.createArchiveURL(clonedVersion, config);
                            expect(info).to.have.property('versions').that.have.property(distTags.latest).that.eql(clonedVersion);
                            done();
                        });
                    });
                });

                it('duplicate', function (done) {
                    registry.createVersion(fixPublish, function (error, data) {
                        expect(error).to.exist;
                        expect(error.message).to.eql('Version already present / Package not present');
                        expect(data).not.to.exist;
                        done();
                    });
                });
            });

            describe('saveArchive', function () {
                it('initial', function (done) {
                    registry.saveArchive(fixPublish, function (error, data) {
                        expect(error).not.to.exist;
                        expect(data).to.have.property('filename', '@test/joi-4.7.0.tgz');
                        expect(data).to.have.property('package', '@test/joi');
                        expect(data).to.have.property('version', '4.7.0');
                        expect(data).to.have.property('readme');
                        expect(data).to.have.property('shasum');

                        registry.status(function (error, status) {
                            expect(error).not.to.exist;
                            expect(status).to.have.property('package_count', 1);
                            expect(status).to.have.property('release_count', 1);
                            done();
                        });
                    });
                });

                it('duplicate', function (done) {
                    registry.saveArchive(fixPublish, function (error, data) {
                        expect(error).not.to.exist;
                        expect(data).to.have.property('filename', '@test/joi-4.7.0.tgz');

                        registry.status(function (error, status) {
                            expect(error).not.to.exist;
                            expect(status).to.have.property('package_count', 1);
                            expect(status).to.have.property('release_count', 1);
                            done();
                        });
                    });
                });
            });

            describe('updateRootFromTag', function () {
                it('initial', function (done) {
                    registry.updateRootFromTag('@test/joi', 'latest', function (error) {
                        expect(error).not.to.exist;

                        registry.info('@test/joi', function (error, info) {
                            var version = fixPublish.versions[fixPublish['dist-tags'].latest];
                            var dbVersion = info.versions[info['dist-tags'].latest];

                            _.each(['description', 'maintainers', 'repository', 'readmeFilename', 'homepage', 'keywords', 'contributors', 'bugs'], function (attribute) {
                                expect(dbVersion[attribute]).to.eql(version[attribute]);
                                expect(info[attribute]).to.eql(version[attribute]);
                            });

                            expect(info['readme']).to.eql(version['readme']);
                            done();
                        });
                    });
                });
            });

            describe('cleanup', function () {
                it('nothing to clean', function (done) {
                    registry.info('@test/joi', function (error, info1) {
                        expect(error).not.to.exist;
                        expect(info1).to.exist;
                        registry.cleanupPackage('@test/joi', function (error) {
                            expect(error).not.to.exist;
                            registry.info('@test/joi', function (error, info2) {
                                expect(error).not.to.exist;
                                expect(info2).to.exist;
                                expect(info1).to.eql(info2);
                                done();
                            });
                        });
                    });
                });
            });
        });

        describe('all-in-one', function () {
            before(dropDb);

            it('initial', function (done) {
                registry.publish(fixPublish, function (error, results) {
                    expect(error).not.to.exist;
                    expect(results).to.exist;
                    done();
                });
            });
        });
    });
});
