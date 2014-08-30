var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
var expect = Lab.expect;

var utils = require('../lib/utils');

describe('utils', function () {
    it('createDefaultPackage', function (done) {
        var input = {
            name: 'Name',
            description: 'Description'
        };

        var output = {
            _id: 'Name',
            name: 'Name',
            description: 'Description'
        };

        expect(utils.createDefaultPackage(input)).to.eql(output);
        expect(utils.createDefaultPackage.bind(this, {})).to.throw(Error);
        expect(utils.createDefaultPackage.bind(this)).to.throw(Error);

        done();
    });


    it('createReleaseName', function (done) {
        expect(utils.createReleaseName({name: 'test', version: '1'})).to.eql('test-1');
        expect(utils.createReleaseName.bind(this, {})).to.throw(Error);
        expect(utils.createReleaseName.bind(this, {name: 'test'})).to.throw(Error);
        expect(utils.createReleaseName.bind(this, {version: 'test'})).to.throw(Error);
        expect(utils.createReleaseName.bind(this)).to.throw(Error);
        done();
    });

    it('createArchiveName', function (done) {
        expect(utils.createArchiveName({name: 'test', version: '1'})).to.eql('test-1.tgz');
        expect(utils.createArchiveName.bind(this)).to.throw(Error);
        done();
    });

    it('createArchiveURL', function (done) {
        expect(utils.createArchiveURL({name: 'test', version: '1'}, { baseUrl: 'test' })).to.eql('test/tarball/test/test-1.tgz');
        expect(utils.createArchiveURL.bind(this)).to.throw(Error);
        done();
    });

    it('createRootUpdate', function (done) {
        expect(utils.createRootUpdate({})).to.have.property('time.modified').that.is.a('date');
        expect(utils.createRootUpdate({keywords: ['asdf']})).to.have.property('keywords').that.is.eql(['asdf']);
        expect(utils.createRootUpdate({asdf: true})).not.to.have.property('asdf');
        expect(utils.createRootUpdate.bind(this)).to.throw(Error);
        done();
    });

    it('createDistTagsUpdate', function (done) {
        expect(utils.createDistTagsUpdate.bind(this)).to.throw(Error);
        expect(utils.createDistTagsUpdate.bind(this, {})).to.throw(Error);
        expect(utils.createDistTagsUpdate({'dist-tags': {}})).to.eql({});
        expect(utils.createDistTagsUpdate({'dist-tags': {'test': 123}})).to.have.property('dist-tags.test', 123);
        done();
    });

    it('extractScope', function (done) {
        expect(utils.extractScope('@test2/test3')).to.eql('@test2');
        expect(utils.extractScope('@asdf')).not.to.exist;
        expect(utils.extractScope('asdf')).not.to.exist;
        expect(utils.extractScope('asdf/asdf')).not.to.exist;
        expect(utils.extractScope(false)).not.to.exist;
        done();
    });

    it('transformPackageDocument', function (done) {
        expect(utils.transformPackageDocument.bind(this)).to.throw(Error);
        expect(utils.transformPackageDocument.bind(this, {})).not.to.throw(Error);
        expect(utils.transformPackageDocument.bind(this, {}, {})).not.to.throw(Error);
        //expect(utils.transformPackageDocument({'dist-tags': {}})).to.eql({});

        expect(utils.transformPackageDocument({_attachments: 'test'}, {})).not.to.have.property('_attachments');
        expect(utils.transformPackageDocument({users: ['tim', 'tom']}, {})).to.have.property('users').that.is.eql({
            tim: true,
            tom: true
        });

        var testDate = new Date();

        expect(utils.transformPackageDocument({
            time: {now: testDate},
            versions: [
                {name: 'test', version: '1', created: testDate, dist: {}},
                {name: 'test', version: '2', dist: {}}
            ]
        }, {})).to.have.property('time').that.is.eql({now: testDate, '1': testDate });

        done();
    });
});
