var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var beforeEach = lab.beforeEach;
var after = lab.after;
var expect = Lab.expect;

var config = require('./config.json');
var Registry = require('../lib/registry');
var mongodb = require('mongodb');
var _ = require('lodash');
var utils = require('../lib/utils');
var Hoek = require('hoek');
var Hapi = require('hapi');
var jwt = require('jsonwebtoken');

var fixPublishDummy = require('./fixtures/publish_dummy.json');
var fixPublish = require('./fixtures/publish_joi.json');
var fixPublishUpdate = require('./fixtures/publish_joi_update.json');
var fixPublishBeta = require('./fixtures/publish_joi_update_beta.json');
var fixUnpublishUpdate = require('./fixtures/unpublish_joi_update.json');
var fixUnpublishBeta = require('./fixtures/unpublish_joi_beta.json');

var user = {
	unknown: {
		name: 'abc',
		password: 'secret',
		email: 'em@il.tld'
	},
	valid: {
		name: 'bcd',
		password: 'secret',
		email: 'em@il.tld'
	},
	permitted: {
		name: 'bcd2',
		password: 'secret',
		email: 'em@il.tld'
	},
	invalid: {
		name: 'bcd',
		password: 'secret!',
		email: 'em@il.tld'
	}
};

describe('plugin', function () {
	var db, registry, server, token, token_permitted;

	var dropDb = function (done) {
		db.dropDatabase(function () {
			registry = new Registry(config, db);
			done();
		});
	};

	var publishPackage = function (done) {
		var registry = server.plugins['scoped-registry-api'].registry;
		registry.publish(fixPublishDummy, function (error, data) {
			expect(error).not.to.exist;
			expect(data).to.exist;
			done();
		});
	};

	var setupServer = function (options, done) {
		server = Hapi.createServer('0.0.0.0', 1234);
		server.pack.register({
			plugin: require('../'),
			options: options
		}, function (err) {
			expect(err).not.to.exist;

			var internals = server.plugins['scoped-registry-api'].internals;
			internals.createUser(_.clone(user.valid), function (err, newToken) {
				expect(err).not.to.exist;
				expect(newToken).to.exist;
				token = newToken;

				internals.createUser(_.clone(user.permitted), function (err, newToken) {
					expect(err).not.to.exist;
					expect(newToken).to.exist;
					token_permitted = newToken;

					publishPackage(function () {
						done();
					});
				});
			});
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

	describe('alwaysRequireAuthentication: false', function () {
		before(function (done) {
			var options = _.clone(config);
			options.alwaysRequireAuthentication = false;

			dropDb(function () {
				setupServer(options, function () {
					done();
				});
			});
		});

		describe('/-/all', function () {
			it('all', function (done) {
				server.inject({
					method: 'get',
					url: '/-/all'
				}, function (res) {
					expect(res.statusCode).to.be.eql(200);
					expect(res.result).to.have.length(1);
					done();
				});
			});

			it('since', function (done) {
				server.inject({
					method: 'get',
					url: '/-/all/since?startkey=' + encodeURIComponent(new Date().toISOString())
				}, function (res) {
					expect(res.statusCode).to.be.eql(200);
					expect(res.result).to.have.length(0);
					done();
				});
			});
		});

		describe('/-/status', function () {
			it('get', function (done) {
				server.inject({
					method: 'get',
					url: '/-/status'
				}, function (res) {
					expect(res.statusCode).to.be.eql(200);
					expect(res.result).to.have.property('package_count', 1);
					expect(res.result).to.have.property('release_count', 1);
					done();
				});
			});
		});

		describe('/-/all/search', function () {
			it('hit', function (done) {
				server.inject({
					method: 'get',
					url: '/-/all/search?query=dummy'
				}, function (res) {
					expect(res.statusCode).to.be.eql(200);
					expect(res.result).to.have.length(1);
					done();
				});
			});

			it('no hit', function (done) {
				server.inject({
					method: 'get',
					url: '/-/all/search?query=asdf'
				}, function (res) {
					expect(res.statusCode).to.be.eql(200);
					expect(res.result).to.have.length(0);
					done();
				});
			});
		});

		describe('GET /tarball', function () {
			it('forbidden', function (done) {
				server.inject({
					method: 'get',
					url: '/tarball/%40test%2Fdummy/%40test%2Fdummy-4.7.0.tgz'
				}, function (res) {
					expect(res.statusCode).to.be.eql(403);
					done();
				});
			});

			it('valid', function (done) {
				server.inject({
					method: 'get',
					url: '/tarball/%40test%2Fdummy/%40test%2Fdummy-4.7.0.tgz',
					headers: {
						Authorization: 'bearer ' + token
					}
				}, function (res) {
					expect(res.statusCode).to.be.eql(200);
					expect(res.result).to.be.eql('DATA');
					done();
				});
			});
		});

		describe('GET /package', function () {
			it('not found', function (done) {
				server.inject({
					method: 'get',
					url: '/@scope%2Fpackage'
				}, function (res) {
					expect(res.statusCode).to.be.eql(404);
					done();
				});
			});

			it('not found with version', function (done) {
				server.inject({
					method: 'get',
					url: '/@scope%2Fpackage/4.7.0'
				}, function (res) {
					expect(res.statusCode).to.be.eql(404);
					done();
				});
			});

			it('found', function (done) {
				server.inject({
					method: 'get',
					url: '/@test%2Fdummy'
				}, function (res) {
					expect(res.statusCode).to.be.eql(200);
					expect(res.result).to.exist;
					expect(res.result.versions['4.7.0']).to.have.deep.property('dist.tarball', 'http://localhost:8600/tarball/%40test%2Fdummy/%40test%2Fdummy-4.7.0.tgz');
					done();
				});
			});

			it('found with version', function (done) {
				server.inject({
					method: 'get',
					url: '/@test%2Fdummy/4.7.0'
				}, function (res) {
					expect(res.statusCode).to.be.eql(200);
					done();
				});
			});
		});
	});

	describe('alwaysRequireAuthentication: true', function () {
		before(function (done) {
			var options = _.clone(config);
			options.alwaysRequireAuthentication = true;

			dropDb(function () {
				setupServer(options, function () {
					done();
				});
			});
		});

		describe('GET /package', function () {
			it('no auth', function (done) {
				server.inject({
					method: 'get',
					url: '/@scope%2Fpackage'
				}, function (res) {
					expect(res.statusCode).to.be.eql(401);
					done();
				});
			});

			it('404', function (done) {
				server.inject({
					method: 'get',
					url: '/@scope%2Fpackage',
					headers: {
						Authorization: 'bearer ' + token
					}
				}, function (res) {
					expect(res.statusCode).to.be.eql(404);
					done();
				});
			});

			it('found', function (done) {
				server.inject({
					method: 'get',
					url: '/@test%2Fdummy',
					headers: {
						Authorization: 'bearer ' + token
					}
				}, function (res) {
					expect(res.statusCode).to.be.eql(200);
					done();
				});
			});
		});

		describe('/tagging', function () {
			it('not existing tag', function (done) {
				server.inject({
					method: 'put',
					url: '/@test%2Fasdfasdf/tagName',
					headers: {
						Authorization: 'bearer ' + token_permitted
					},
					payload: JSON.stringify('4.7.0')
				}, function (res) {
					expect(res.statusCode).to.be.eql(404);
					done();
				});
			});

			it('unauthorized tag', function (done) {
				server.inject({
					method: 'put',
					url: '/@test%2Fdummy/tagName',
					headers: {
						Authorization: 'bearer ' + token
					},
					payload: JSON.stringify('4.7.0')
				}, function (res) {
					expect(res.statusCode).to.be.eql(403);
					done();
				});
			});

			it('missing version', function (done) {
				server.inject({
					method: 'put',
					url: '/@test%2Fdummy/tagName',
					headers: {
						Authorization: 'bearer ' + token_permitted
					}
				}, function (res) {
					expect(res.statusCode).to.be.eql(400);
					done();
				});
			});

			it('tag', function (done) {
				server.inject({
					method: 'put',
					url: '/@test%2Fdummy/tagName',
					headers: {
						Authorization: 'bearer ' + token_permitted
					},
					payload: JSON.stringify('4.7.0')
				}, function (res) {
					expect(res.statusCode).to.be.eql(201);
					var registry = server.plugins['scoped-registry-api'].registry;
					registry.info('@test/dummy', function (error, info) {
						expect(error).to.not.exist;
						expect(info).to.exist;
						expect(info).to.have.deep.property('dist-tags.tagName', '4.7.0');
						done();
					});
				});
			});


			it('not existing tag', function (done) {
				server.inject({
					method: 'delete',
					url: '/@test%2Fasdfasdf/tagName',
					headers: {
						Authorization: 'bearer ' + token_permitted
					},
					payload: JSON.stringify('4.7.0')
				}, function (res) {
					expect(res.statusCode).to.be.eql(404);
					done();
				});
			});

			it('unauthorized untag', function (done) {
				server.inject({
					method: 'delete',
					url: '/@test%2Fdummy/tagName',
					headers: {
						Authorization: 'bearer ' + token
					}
				}, function (res) {
					expect(res.statusCode).to.be.eql(403);
					done();
				});
			});

			it('untag', function (done) {
				server.inject({
					method: 'delete',
					url: '/@test%2Fdummy/tagName',
					headers: {
						Authorization: 'bearer ' + token_permitted
					}
				}, function (res) {
					var registry = server.plugins['scoped-registry-api'].registry;
					registry.info('@test/dummy', function (error, info) {
						expect(error).to.not.exist;
						expect(info).to.exist;
						expect(info).to.not.have.deep.property('dist-tags.tagName');
						done();
					});
				});
			});
		});

		describe('/package', function () {
			it('publish unauthorized', function (done) {
				server.inject({
					method: 'put',
					url: '/@test%2Fjoi',
					payload: fixPublish
				}, function (res) {
					expect(res.statusCode).to.be.eql(401);
					done();
				});
			});

			it('publish forbidden', function (done) {
				server.inject({
					method: 'put',
					url: '/@test%2Fjoi',
					headers: {
						Authorization: 'bearer ' + token
					},
					payload: fixPublish
				}, function (res) {
					expect(res.statusCode).to.be.eql(403);
					done();
				});
			});

			it('star', function (done) {
				server.inject({
					method: 'put',
					url: '/@test%2Fjoi',
					headers: {
						Authorization: 'bearer ' + token
					},
					payload: {
						_id: fixPublish.name,
						name: fixPublish.name,
						users: {
							'bcd': true
						}
					}
				}, function (res) {
					expect(res.statusCode).to.be.eql(404);
					done();
				});
			});

			it('publish success', function (done) {
				server.inject({
					method: 'put',
					url: '/@test%2Fjoi',
					headers: {
						Authorization: 'bearer ' + token_permitted
					},
					payload: fixPublish
				}, function (res) {
					expect(res.statusCode).to.be.eql(201);
					done();
				});
			});

			it('star', function (done) {
				server.inject({
					method: 'put',
					url: '/@test%2Fjoi',
					headers: {
						Authorization: 'bearer ' + token
					},
					payload: {
						_id: fixPublish.name,
						name: fixPublish.name,
						users: {
							'bcd': true
						}
					}
				}, function (res) {
					expect(res.statusCode).to.be.eql(201);
					done();
				});
			});

			it('check star', function (done) {
				server.inject({
					method: 'get',
					url: '/@test%2Fjoi',
					headers: {
						Authorization: 'bearer ' + token
					}
				}, function (res) {
					expect(res.statusCode).to.be.eql(200);
					expect(res.result.users).to.be.eql({bcd: true});
					done();
				});
			});

			it('unstar', function (done) {
				server.inject({
					method: 'put',
					url: '/@test%2Fjoi',
					headers: {
						Authorization: 'bearer ' + token
					},
					payload: {
						_id: fixPublish.name,
						name: fixPublish.name,
						users: {}
					}
				}, function (res) {
					expect(res.statusCode).to.be.eql(201);
					done();
				});
			});

			it('check unstar', function (done) {
				server.inject({
					method: 'get',
					url: '/@test%2Fjoi',
					headers: {
						Authorization: 'bearer ' + token
					}
				}, function (res) {
					expect(res.statusCode).to.be.eql(200);
					expect(res.result.users).to.be.eql({});
					done();
				});
			});
		});


		describe('unpublish', function () {
			beforeEach(function (done) {
				var options = _.clone(config);
				options.alwaysRequireAuthentication = true;

				dropDb(function () {
					setupServer(options, function () {
						done();
					});
				});
			});

			it('unpublish package unauthorized', function (done) {
				server.inject({
					method: 'delete',
					url: '/@test%2Fdummy/-rev/revision',
					headers: {
						Authorization: 'bearer ' + token
					}
				}, function (res) {
					expect(res.statusCode).to.be.eql(403);

					server.inject({
						method: 'get',
						url: '/@test%2Fdummy',
						headers: {
							Authorization: 'bearer ' + token
						}
					}, function (res) {
						expect(res.statusCode).to.be.eql(200);
						done();
					});
				});
			});


			it('unpublish package', function (done) {
				server.inject({
					method: 'delete',
					url: '/@test%2Fdummy/-rev/revision',
					headers: {
						Authorization: 'bearer ' + token_permitted
					}
				}, function (res) {
					expect(res.statusCode).to.be.eql(201);

					server.inject({
						method: 'get',
						url: '/@test%2Fdummy',
						headers: {
							Authorization: 'bearer ' + token_permitted
						}
					}, function (res) {
						expect(res.statusCode).to.be.eql(404);
						done();
					});
				});
			});

			it('unpublish version unauthorized', function (done) {
				var update = _.clone(fixPublishDummy);
				update.versions = {};
				server.inject({
					method: 'put',
					url: '/@test%2Fdummy/-rev/revision',
					headers: {
						Authorization: 'bearer ' + token
					},
					payload: update
				}, function (res) {
					expect(res.statusCode).to.be.eql(403);

					server.inject({
						method: 'get',
						url: '/@test%2Fdummy',
						headers: {
							Authorization: 'bearer ' + token
						}
					}, function (res) {
						expect(res.statusCode).to.be.eql(200);
						done();
					});
				});
			});


			it('unpublish version', function (done) {
				var update = _.clone(fixPublishDummy);
				update.versions = {};
				server.inject({
					method: 'put',
					url: '/@test%2Fdummy/-rev/revision',
					headers: {
						Authorization: 'bearer ' + token_permitted
					},
					payload: update
				}, function (res) {
					expect(res.statusCode).to.be.eql(201);

					server.inject({
						method: 'get',
						url: '/@test%2Fdummy',
						headers: {
							Authorization: 'bearer ' + token_permitted
						}
					}, function (res) {
						expect(res.statusCode).to.be.eql(404);
						done();
					});
				});
			});
		});
	});

	describe('registration', function () {
		describe('enabled', function () {
			before(function (done) {
				var options = _.clone(config);
				options.userRegistration = true;
				dropDb(function () {
					setupServer(options, function () {
						done();
					});
				});
			});

			it('success', function (done) {
				server.inject({
					method: 'put',
					url: '/-/user/org.couchdb.user:' + user.unknown.name,
					payload: user.unknown
				}, function (res) {
					expect(res.statusCode).to.be.eql(201);
					done();
				});
			});
		});

		describe('disabled', function () {
			before(function (done) {
				var options = _.clone(config);
				options.userRegistration = false;
				dropDb(function () {
					setupServer(options, done);
				});
			});

			it('failed', function (done) {
				server.inject({
					method: 'put',
					url: '/-/user/org.couchdb.user:' + user.unknown.name,
					payload: user.unknown
				}, function (res) {
					expect(res.statusCode).to.be.eql(403);
					done();
				});
			});
		});
	});

	describe('authentication', function () {
		before(function (done) {
			var options = _.clone(config);
			options.userRegistration = false;
			dropDb(function () {
				setupServer(options, function () {
					done();
				});
			});
		});

		it('success', function (done) {
			server.inject({
				method: 'put',
				url: '/-/user/org.couchdb.user:' + user.valid.name,
				payload: user.valid
			}, function (res) {
				expect(res.statusCode).to.be.eql(201);
				expect(res.result).to.have.property('token');
				done();
			});
		});

		it('invalid', function (done) {
			server.inject({
				method: 'put',
				url: '/-/user/org.couchdb.user:' + user.invalid.name,
				payload: user.invalid
			}, function (res) {
				expect(res.statusCode).to.be.eql(401);
				expect(res.result).not.to.have.property('token');
				done();
			});
		});

		it('unknown / registration disabled', function (done) {
			server.inject({
				method: 'put',
				url: '/-/user/org.couchdb.user:' + user.unknown.name,
				payload: user.unknown
			}, function (res) {
				expect(res.statusCode).to.be.eql(403);
				expect(res.result).not.to.have.property('token');
				done();
			});
		});

		it('current user', function (done) {
			server.inject({
				method: 'get',
				url: '/-/user/org.couchdb.user',
				headers: {
					Authorization: 'bearer ' + token
				}
			}, function (res) {
				expect(res.statusCode).to.be.eql(200);
				done();
			});
		});
	});

	describe('readme', function () {
		before(function (done) {
			var options = _.clone(config);
			options.userRegistration = false;
			dropDb(function () {
				setupServer(options, function () {
					done();
				});
			});
		});

		it('check readme for non existing package', function (done) {
			server.inject({
				method: 'get',
				url: '/@test%2Fasdfadsfasdfa/readme',
				headers: {
					Authorization: 'bearer ' + token
				}
			}, function (res) {
				expect(res.statusCode).to.be.eql(404);
				done();
			});
		});

		it('check readme', function (done) {
			server.inject({
				method: 'get',
				url: '/@test%2Fdummy/readme',
				headers: {
					Authorization: 'bearer ' + token
				}
			}, function (res) {
				expect(res.statusCode).to.be.eql(200);
				expect(res.result).to.be.eql('<p>README1</p>\n');
				done();
			});
		});

		it('check readme for version', function (done) {
			server.inject({
				method: 'get',
				url: '/@test%2Fdummy/4.7.0/readme',
				headers: {
					Authorization: 'bearer ' + token
				}
			}, function (res) {
				expect(res.statusCode).to.be.eql(200);
				expect(res.result).to.be.eql('<p>README1</p>\n');
				done();
			});
		});

		it('check readme for non existing version', function (done) {
			server.inject({
				method: 'get',
				url: '/@test%2Fdummy/5.0.0/readme',
				headers: {
					Authorization: 'bearer ' + token
				}
			}, function (res) {
				expect(res.statusCode).to.be.eql(404);
				done();
			});
		});

		it('check readme for non existing package and version', function (done) {
			server.inject({
				method: 'get',
				url: '/@test%2Fasdfasdf/5.0.0/readme',
				headers: {
					Authorization: 'bearer ' + token
				}
			}, function (res) {
				expect(res.statusCode).to.be.eql(404);
				done();
			});
		});
	});


	describe('not implemented / not used', function () {
		before(function (done) {
			var options = _.clone(config);
			options.userRegistration = false;
			dropDb(function () {
				setupServer(options, function () {
					done();
				});
			});
		});

		it('update user', function (done) {
			server.inject({
				method: 'put',
				url: '/-/user/org.couchdb.user:' + user.valid.name + '/-rev/1',
				headers: {
					Authorization: 'bearer ' + token
				},
				payload: user.valid
			}, function (res) {
				expect(res.statusCode).to.be.eql(501);
				done();
			});
		});

		it('delete tarball', function (done) {
			server.inject({
				method: 'delete',
				url: '/tarball/filename/-rev/revision',
				headers: {
					Authorization: 'bearer ' + token
				},
				payload: user.valid
			}, function (res) {
				expect(res.statusCode).to.be.eql(201);
				done();
			});
		});
	});
});
