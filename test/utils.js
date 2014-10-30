var Lab = require('lab');
var Code = require('code');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;

var utils = require('../lib/utils');

describe('utils', function() {
	it('createDefaultPackage', function(done) {
		var input = {
			name: 'Name',
			description: 'Description'
		};

		var output = {
			_id: 'Name',
			name: 'Name',
			description: 'Description'
		};

		expect(utils.createDefaultPackage(input)).to.deep.equal(output);
		expect(utils.createDefaultPackage.bind(this, {})).to.throw();
		expect(utils.createDefaultPackage.bind(this)).to.throw();

		done();
	});


	it('createReleaseName', function(done) {
		expect(utils.createReleaseName({name: 'test', version: '1'})).to.deep.equal('test-1');
		expect(utils.createReleaseName.bind(this, {})).to.throw();
		expect(utils.createReleaseName.bind(this, {name: 'test'})).to.throw();
		expect(utils.createReleaseName.bind(this, {version: 'test'})).to.throw();
		expect(utils.createReleaseName.bind(this)).to.throw();
		done();
	});

	it('createArchiveName', function(done) {
		expect(utils.createArchiveName({name: 'test', version: '1'})).to.deep.equal('test-1.tgz');
		expect(utils.createArchiveName.bind(this)).to.throw();
		done();
	});

	it('createArchiveURL', function(done) {
		expect(utils.createArchiveURL({
			name: 'test',
			version: '1'
		}, {baseUrl: 'test'})).to.equal('test/tarball/test/test-1.tgz');
		expect(utils.createArchiveURL.bind(this)).to.throw();
		done();
	});

	it('createRootUpdate', function(done) {
		expect(utils.createRootUpdate({})['time.modified']).to.be.a.date();
		expect(utils.createRootUpdate({keywords: ['asdf']}).keywords).to.only.include('asdf');
		expect(utils.createRootUpdate({asdf: true}).asdf).not.exist;
		expect(utils.createRootUpdate.bind(this)).to.throw();
		done();
	});

	it('createDistTagsUpdate', function(done) {
		expect(utils.createDistTagsUpdate.bind(this)).to.throw();
		expect(utils.createDistTagsUpdate.bind(this, {})).to.throw();
		expect(utils.createDistTagsUpdate({'dist-tags': {}})).to.deep.equal({});
		expect(utils.createDistTagsUpdate({'dist-tags': {'test': 123}})).to.include({ 'dist-tags.test': 123 });
		done();
	});

	it('extractScope', function(done) {
		expect(utils.extractScope('@test2/test3')).to.equal('@test2');
		expect(utils.extractScope('@asdf')).not.to.exist;
		expect(utils.extractScope('asdf')).not.to.exist;
		expect(utils.extractScope('asdf/asdf')).not.to.exist;
		expect(utils.extractScope(false)).not.to.exist;
		done();
	});

	it('transformPackageDocument', function(done) {
		expect(utils.transformPackageDocument.bind(this)).to.throw();
		expect(utils.transformPackageDocument.bind(this, {})).not.to.throw();
		expect(utils.transformPackageDocument.bind(this, {}, {})).not.to.throw();
		//expect(utils.transformPackageDocument({'dist-tags': {}})).to.deep.equal({});

		expect(utils.transformPackageDocument({_attachments: 'test'}, {})).not.to.include('_attachments');
		expect(utils.transformPackageDocument({users: ['tim', 'tom']}, {}).users).to.include({
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
		}, {}).time).to.only.include({now: testDate, '1': testDate});

		done();
	});
});
