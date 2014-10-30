var Lab = require('lab');
var Code = require('code');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;

var Permission = require('../lib/permission');

describe('permission', function() {
	it('init', function(done) {
		expect(function() {
			new Permission();
		}).to.throw();

		expect(function() {
			new Permission([{pattern: ''}]);
		}).to.throw(/Invalid pattern/);

		expect(function() {
			new Permission([]);
		}).not.to.throw();

		done();
	});


	describe('defaults', function() {
		it('all/none', function(done) {
			var permission = new Permission({});
			expect(permission.canInstall('@404/module')).to.be.false;
			expect(permission.canPublish('@404/module')).to.be.false;
			expect(permission.canInstall('@404/module', {name: 'a', group: 'b'})).to.be.false;
			expect(permission.canPublish('@404/module', {name: 'a', group: 'b'})).to.be.false;
			done();
		});
	});

	describe('keywords', function() {
		it('all/none', function(done) {
			var permission = new Permission({
				'@all/*': {
					publish: 'all',
					install: 'all'
				},
				'@nothing/*': {
					publish: 'none',
					install: 'none'
				},
				'@install/*': {
					publish: 'none',
					install: 'all'
				},
				'@publish/*': {
					publish: 'all',
					install: 'none'
				},
				'@none/*': {
					publish: 'asdf',
					install: 'asdf'
				}
			});

			expect(permission.canInstall('@all/module')).to.be.true;
			expect(permission.canPublish('@all/module')).to.be.true;

			expect(permission.canInstall('@nothing/module')).to.be.false;
			expect(permission.canPublish('@nothing/module')).to.be.false;

			expect(permission.canInstall('@install/module')).to.be.true;
			expect(permission.canPublish('@install/module')).to.be.false;

			expect(permission.canInstall('@publish/module')).to.be.false;
			expect(permission.canPublish('@publish/module')).to.be.true;

			expect(permission.canInstall('@none/module')).to.be.false;
			expect(permission.canPublish('@none/module')).to.be.false;

			done();
		});

		it('user', function(done) {
			var permission = new Permission({
				'@user/*': {
					publish: 'user',
					install: 'user'
				}
			});

			expect(permission.canInstall('@user/module', {})).to.be.false;
			expect(permission.canPublish('@user/module', {})).to.be.false;

			expect(permission.canInstall('@user/module', {name: 'test'})).to.be.true;
			expect(permission.canPublish('@user/module', {name: 'test'})).to.be.true;

			done();
		});
	});


	describe('specific user', function() {
		it('1', function(done) {
			var permission = new Permission({
				'@user/*': {
					publish: {
						users: ['tim']
					},
					install: {
						users: ['tim', 'thao']
					}
				}
			});

			expect(permission.canInstall('@user/module', {})).to.be.false;
			expect(permission.canPublish('@user/module', {})).to.be.false;

			expect(permission.canInstall('@user/module', {name: 'x'})).to.be.false;
			expect(permission.canPublish('@user/module', {name: 'x'})).to.be.false;

			expect(permission.canInstall('@user/module', {name: 'tim'})).to.be.true;
			expect(permission.canPublish('@user/module', {name: 'tim'})).to.be.true;

			expect(permission.canInstall('@user/module', {name: 'thao'})).to.be.true;
			expect(permission.canPublish('@user/module', {name: 'thao'})).to.be.false;

			done();
		});

		it('2', function(done) {
			var permission = new Permission({
				'@user/*': {
					publish: {
						users: 'tim',
						groups: 'group'
					},
					install: {
						users: ['tim', 'thao']
					}
				},
				'@user/test-*': {
					publish: {
						users: 'thao'
					},
					install: {
						users: ['tim', 'thao']
					}
				}
			});

			expect(permission.canInstall('@user/module', {})).to.be.false;
			expect(permission.canPublish('@user/module', {})).to.be.false;

			expect(permission.canInstall('@user/module', {name: 'x'})).to.be.false;
			expect(permission.canPublish('@user/module', {name: 'x'})).to.be.false;

			expect(permission.canInstall('@user/module', {name: 'tim'})).to.be.true;
			expect(permission.canPublish('@user/module', {name: 'tim'})).to.be.true;

			expect(permission.canInstall('@user/module', {name: 'thao'})).to.be.true;
			expect(permission.canPublish('@user/module', {name: 'thao'})).to.be.false;
			expect(permission.canPublish('@user/test-module', {name: 'thao'})).to.be.true;

			expect(permission.canPublish('@user/module', {name: 'thao', groups: 'group'})).to.be.true;
			expect(permission.canPublish('@user/module', {name: 'x', groups: 'group'})).to.be.true;
			expect(permission.canPublish('@user/module', {name: 'tim', groups: 'group'})).to.be.true;

			done();
		});
	});


	describe('specific group', function() {
		it('1', function(done) {
			var permission = new Permission({
				'@user/*': {
					publish: {
						groups: ['tim']
					},
					install: {
						groups: ['tim', 'thao']
					}
				}
			});

			expect(permission.canInstall('@user/module', {})).to.be.false;
			expect(permission.canPublish('@user/module', {})).to.be.false;

			expect(permission.canInstall('@user/module', {name: 'a', groups: 'x'})).to.be.false;
			expect(permission.canPublish('@user/module', {name: 'a', groups: 'x'})).to.be.false;

			expect(permission.canInstall('@user/module', {name: 'a', groups: 'tim'})).to.be.true;
			expect(permission.canPublish('@user/module', {name: 'a', groups: 'tim'})).to.be.true;

			expect(permission.canInstall('@user/module', {name: 'a', groups: 'thao'})).to.be.true;
			expect(permission.canPublish('@user/module', {name: 'a', groups: 'thao'})).to.be.false;

			done();
		});

		it('2', function(done) {
			var permission = new Permission({
				'@user/*': {
					publish: {
						groups: 'tim'
					},
					install: {
						groups: ['tim', 'thao']
					}
				}
			});

			expect(permission.canInstall('@user/module', {})).to.be.false;
			expect(permission.canPublish('@user/module', {})).to.be.false;

			expect(permission.canInstall('@user/module', {name: 'a', groups: 'x'})).to.be.false;
			expect(permission.canPublish('@user/module', {name: 'a', groups: 'x'})).to.be.false;

			expect(permission.canInstall('@user/module', {name: 'a', groups: 'tim'})).to.be.true;
			expect(permission.canPublish('@user/module', {name: 'a', groups: 'tim'})).to.be.true;

			expect(permission.canInstall('@user/module', {name: 'a', groups: ['thao', 'tim']})).to.be.true;
			expect(permission.canPublish('@user/module', {name: 'a', groups: ['thao', 'tim']})).to.be.true;

			expect(permission.canInstall('@user/module', {name: 'a', groups: 'thao'})).to.be.true;
			expect(permission.canPublish('@user/module', {name: 'a', groups: 'thao'})).to.be.false;

			done();
		});
	});


	describe('internals', function() {
		it('ensureArray', function(done) {
			expect(Permission._internals.ensureArray()).to.not.exist;
			expect(Permission._internals.ensureArray(null)).to.not.exist;
			expect(Permission._internals.ensureArray(undefined)).to.not.exist;
			expect(Permission._internals.ensureArray('a')).to.deep.equal(['a']);
			expect(Permission._internals.ensureArray(1)).to.deep.equal([1]);
			done();
		});
	});
});
