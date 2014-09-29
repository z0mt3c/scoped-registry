var Registry = require('./registry');
var Permission = require('./permission');
var schemas = require('./schemas');
var Hoek = require('hoek');
var _ = require('lodash');
var utils = require('./utils');
var mongodb = require('mongodb');
var marked = require('marked');
var jwt = require('jsonwebtoken');
var Joi = require('joi');

var defaultOptions = {
	alwaysRequireAuthentication: false,
	authStrategy: 'jwt-token',
	userRegistration: true,
	maxBytes: 1048576 * 1000,
	authentication: {
		strategy: 'scoped-registry-auth-mongodb',
		options: {}
	}
};

exports.register = function (plugin, pluginOptions, next) {
	var Hapi = plugin.hapi;
	var options = Hoek.applyToDefaults(defaultOptions, pluginOptions);
	Joi.assert(options, schemas.RegistryConfig, 'Invalid registry configuration');

	mongodb.MongoClient.connect(options.mongodb, function (err, db) {
		if (err) {
			throw err;
		}

		var authOptions = options.authentication.options;
		authOptions.mongodb = db;

		var permission = new Permission(options.permissions);
		var AuthStrategy = require(options.authentication.strategy);
		var authStrategy = new AuthStrategy(authOptions);

		var registry = new Registry(options, db);

		var internals = {
			isRegistrationActive: function () {
				return options.userRegistration === true && _.isFunction(authStrategy.createUser);
			},
			permissions: function (pkgName, user) {
				return permission.permissions(pkgName, user);
			},
			canInstall: function (pkgName, user) {
				return permission.canInstall(pkgName, user);
			},
			canPublish: function (pkgName, user) {
				return permission.canPublish(pkgName, user);
			},
			_createToken: function (tokenData, reply) {
				Hoek.assert(!tokenData.password, 'Password should never be included');
				return reply(null, jwt.sign(tokenData, options.secret, options.jwtOptions));
			},
			validateTokenData: function (tokenData, reply) {
				authStrategy.validateTokenData(tokenData, function (error, isValid) {
					if (error || !isValid) {
						return reply(error, isValid);
					} else {
						delete tokenData.password;
						return reply(err, isValid, tokenData);
					}
				});
			},
			createUser: function (data, reply) {
				authStrategy.createUser(data, function (error, tokenData) {
					if (error) return reply(error);
					internals._createToken(tokenData, reply);
				});
			},
			validateCredentials: function (data, reply) {
				authStrategy.validateCredentials(data, function (error, isValid, tokenData) {
					if (error || !isValid) {
						return reply(error, isValid);
					} else {
						internals._createToken(tokenData, function (error, token) {
							return reply(error, isValid, token);
						});
					}
				});
			}
		};

		plugin.register({
			name: 'hapi-auth-jwt',
			plugin: require('hapi-auth-jwt')
		}, function (err) {
			Hoek.assert(!err, 'Error loading jwt plugin');
			plugin.auth.strategy(options.authStrategy, 'jwt', {
				key: options.secret,
				validateFunc: internals.validateTokenData
			});
		});

		var writeAuthStrategy = options.authStrategy;
		var readAuthStrategy = {
			strategy: options.authStrategy,
			mode: options.alwaysRequireAuthentication ? 'required' : 'optional'
		};


		/**
		 * Get package information (may for a specific version)
		 */
		plugin.route({
			method: 'GET',
			path: '/{package}',
			config: {
				tags: ['api'],
				description: 'Get package',
				auth: readAuthStrategy,
				validate: {
					params: schemas.PackageParams
				},
				handler: function (request, reply) {
					registry.info(request.params.package, function (error, info) {
						if (error) {
							return reply(error && error.isBoom ? error : Hapi.error.internal('Failed to receive package information', error));
						} else if (info) {
							return reply(info);
						} else {
							return reply(Hapi.error.notFound());
						}
					});
				}
			}
		});

		plugin.route({
			method: 'GET',
			path: '/{package}/{version}',
			config: {
				tags: ['api'],
				description: 'Get package version',
				auth: readAuthStrategy,
				validate: {
					params: schemas.PackageVersionParams
				},
				handler: function (request, reply) {
					registry.info(request.params.package, function (error, info) {
						if (error) {
							return reply(Hapi.error.internal('Failed to receive package information', error));
						} else if (info && info.versions[request.params.version]) {
							return reply(info.versions[request.params.version]);
						} else {
							return reply(Hapi.error.notFound());
						}
					});
				}
			}
		});

		/**
		 * Publish new package or star/unstar
		 */
		plugin.route({
			method: 'PUT',
			path: '/{package}',
			config: {
				tags: ['api'],
				auth: writeAuthStrategy,
				description: 'Publish a new package/version or star/unstar package',
				payload: {
					maxBytes: options.maxBytes
				},
				validate: {
					params: schemas.PackageParams,
					payload: schemas.PackagePayload
				},
				handler: function (request, reply) {
					var data = request.payload;
					var permissions = internals.permissions(request.params.package, request.auth.credentials);
					var star = !data.versions && data.users;

					if (star && permissions.install) {
						var username = request.auth.credentials.name;
						var star = data.users[username] || false;
						registry[star ? 'star' : 'unstar'](data._id, username, function (error) {
							if (error) {
								return reply(error && error.isBoom ? error : Hapi.error.internal('Failed to star/unstar package ' + data._id));
							} else {
								return reply().code(201);
							}
						});
					} else if (!star && permissions.publish) {
						registry.publish(data, function (error) {
							if (error) {
								return reply(error && error.isBoom ? error : Hapi.error.internal('Publishing failed', error));
							} else {
								return reply().code(201);
							}
						});
					} else {
						return reply(Hapi.error.forbidden('Not allowed to access this package'));
					}
				}
			}
		});

		/**
		 * Unpublish package or version
		 */
		plugin.route({
			method: 'PUT',
			path: '/{package}/-rev/{revision}',
			config: {
				tags: ['api'],
				description: 'Unpublish versions',
				auth: writeAuthStrategy,
				validate: {
					payload: schemas.PackagePayload,
					params: schemas.PackageRevisionParams
				},
				handler: function (request, reply) {
					if (!internals.canPublish(request.params.package, request.auth.credentials)) {
						return reply(Hapi.error.forbidden('Not allowed to access this package'));
					} else {
						var data = request.payload;
						registry.update(data, function (error) {
							if (error) {
								return reply(error && error.isBoom ? error : Hapi.error.internal('Publishing failed', error));
							}

							return reply().code(201);
						});
					}
				}
			}
		});

		plugin.route({
			method: 'DELETE',
			path: '/{package}/-rev/{revision}',
			config: {
				tags: ['api'],
				description: 'Unpublish package',
				auth: writeAuthStrategy,
				validate: {
					params: schemas.PackageRevisionParams
				},
				handler: function (request, reply) {
					if (!internals.canPublish(request.params.package, request.auth.credentials)) {
						return reply(Hapi.error.forbidden('Not allowed to access this package'));
					} else {
						registry.unpublish(request.params.package, function (error) {
							if (error) {
								return reply(error && error.isBoom ? error : Hapi.error.internal('Unpublish package failed', error));
							}

							return reply().code(201);
						});
					}
				}
			}
		});

		/**
		 * Tagging of versions. Deletion of tag is currently not supported by npm client?
		 */
		plugin.route({
			method: 'PUT',
			path: '/{package}/{tag}',
			config: {
				tags: ['api'],
				description: 'Create a new tag',
				auth: writeAuthStrategy,
				validate: {
					params: schemas.TagParams
				},
				handler: function (request, reply) {
					var version = _.isString(request.payload) ? request.payload : null;

					if (!internals.canPublish(request.params.package, request.auth.credentials)) {
						return reply(Hapi.error.forbidden('Not allowed to access this package'));
					} else if (!version) {
						return reply(Hapi.error.badRequest('Version missing'));
					} else {
						registry.tag(request.params.package, request.params.tag, version, function (error, count) {
							if (error) {
								return reply(error && error.isBoom ? error : Hapi.error.internal('Publishing failed', error));
							} else if (count < 1) {
								return reply(Hapi.error.notFound());
							} else {
								reply().code(201);
							}
						});
					}
				}
			}
		});

		plugin.route({
			method: 'DELETE',
			path: '/{package}/{tag}',
			config: {
				tags: ['api'],
				description: 'Delete a tag',
				auth: writeAuthStrategy,
				validate: {
					params: schemas.TagParams
				},
				handler: function (request, reply) {
					if (!internals.canPublish(request.params.package, request.auth.credentials)) {
						return reply(Hapi.error.forbidden('Not allowed to access this package'));
					} else {
						registry.untag(request.params.package, request.params.tag, function (error, count) {
							if (error) {
								return reply(error && error.isBoom ? error : Hapi.error.internal('Publishing failed', error));
							} else if (count < 1) {
								return reply(Hapi.error.notFound());
							} else {
								reply().code(201);
							}
						});
					}
				}
			}
		});

		/**
		 * File/tarball handling. Deletion is automatically performed on unpublish.
		 */
		plugin.route({
			method: 'GET',
			path: '/tarball/{package}/{filename}',
			config: {
				tags: ['api'],
				description: 'Get package tarball',
				auth: readAuthStrategy,
				validate: {
					params: schemas.TarballParams
				},
				handler: function (request, reply) {
					var filename = utils.unescapeName(request.params.filename);
					var packageName = utils.unescapeName(request.params.package);

					if (!internals.canInstall(packageName, request.auth.credentials)) {
						return reply(Hapi.error.forbidden('Not allowed to access this package'));
					} else {
						registry.fetchArchive(packageName, filename, function (error, stream) {
							if (error) {
								return reply(Hapi.error.internal('Fetching tarball failed', error));
							} else if (stream) {
								return reply(stream).code(200);
							} else {
								return reply(Hapi.error.notFound());
							}
						});
					}
				}
			}
		});

		plugin.route({
			method: 'DELETE',
			path: '/tarball/{filename}/-rev/{revision}',
			config: {
				tags: ['api'],
				description: 'Remove package tarball',
				auth: writeAuthStrategy,
				validate: {
					params: schemas.TarballRevisionParams
				},
				handler: function (request, reply) {
					reply().code(201);
				}
			}
		});

		/**
		 * Full package listings - used for local search in general. How does it work for
		 * scoped-registries?
		 */
		plugin.route({
			method: 'GET',
			path: '/-/all',
			config: {
				tags: ['api'],
				description: 'Search for package',
				auth: readAuthStrategy,
				handler: function (request, reply) {
					registry.all(null, function (error, result) {
						if (error) {
							return reply(error && error.isBoom ? error : Hapi.error.internal('Publishing failed', error));
						} else if (result) {
							return reply(result);
						} else {
							return reply().code(204);
						}
					});
				}
			}
		});

		plugin.route({
			method: 'GET',
			path: '/-/all/since',
			config: {
				tags: ['api'],
				description: 'List changed packages since',
				auth: readAuthStrategy,
				validate: {
					query: schemas.AllSinceQuery
				},
				handler: function (request, reply) {
					registry.all(request.query.startkey, function (error, result) {
						if (error) {
							return reply(error && error.isBoom ? error : Hapi.error.internal('Publishing failed', error));
						} else if (result) {
							return reply(result);
						} else {
							return reply().code(204);
						}
					});
				}
			}
		});

		/**
		 * Search call - not sure this is used by npm client. Seems like the client performs
		 * local search based on /all data. How is it performed for scoped-registries?
		 */
		plugin.route({
			method: 'GET',
			path: '/-/all/search',
			config: {
				tags: ['api'],
				description: 'List changed packages with keyword',
				auth: readAuthStrategy,
				validate: {
					query: schemas.Search
				},
				handler: function (request, reply) {
					registry.find(request.query.query, function (error, result) {
						if (error) {
							return reply(error && error.isBoom ? error : Hapi.error.internal('Publishing failed', error));
						} else if (result) {
							return reply(result);
						} else {
							return reply().code(204);
						}
					});
				}
			}
		});

		/**
		 * User related routes
		 */
		plugin.route({
			method: 'PUT',
			path: '/-/user/org.couchdb.user:{username}',
			config: {
				tags: ['api'],
				description: 'Create or authenticate user',
				validate: {
					params: schemas.UserParams,
					payload: schemas.CreateOrAuthenticateUser
				},
				handler: function (request, reply) {
					internals.validateCredentials(request.payload, function (error, valid, token) {
						if (error) {
							return reply(error.isBoom ? error : Hapi.error.internal('Error during authentication', error));
						} else if (valid && token) {
							return reply({token: token}).code(201);
						} else if (valid === false) {
							return reply(Hapi.error.unauthorized('User credentials incorrect'));
						} else if (internals.isRegistrationActive()) {
							internals.createUser(request.payload, function (error, token) {
								if (!error && token) {
									return reply({token: token}).code(201);
								} else {
									return reply(error && error.isBoom ? error : Hapi.error.internal('Error during registration', error));
								}
							});
						} else {
							return reply(Hapi.error.forbidden('User registration is disabled / not supported.'));
						}
					});
				}
			}
		});

		plugin.route({
			method: 'GET',
			path: '/-/user/org.couchdb.user',
			config: {
				tags: ['api'],
				description: 'Get currently authenticated user',
				auth: writeAuthStrategy,
				handler: function (request, reply) {
					return reply(request.auth.credentials);
				}
			}
		});

		plugin.route({
			method: 'PUT',
			path: '/-/user/org.couchdb.user:{username}/-rev/{revision}',
			config: {
				tags: ['api'],
				description: 'Update user',
				auth: writeAuthStrategy,
				validate: {
					params: schemas.UserRevisionParams,
					payload: schemas.UpdateUser
				},
				handler: function (request, reply) {
					return reply(Hapi.error.notImplemented());
				}
			}
		});

		/**
		 * Additional routes - not supported by npm client
		 */
		plugin.route({
			method: 'GET',
			path: '/-/status',
			config: {
				tags: ['api'],
				description: 'Registry status',
				auth: readAuthStrategy,
				handler: function (request, reply) {
					registry.status(function (error, status) {
						if (status) {
							return reply(status)
						} else {
							return reply(error && error.isBoom ? error : Hapi.error.internal('Failed to receive registry status', error));
						}
					});
				}
			}
		});

		plugin.route({
			method: 'GET',
			path: '/{package}/readme',
			config: {
				tags: ['api'],
				description: 'Get readme',
				auth: readAuthStrategy,
				validate: {
					params: schemas.PackageParams
				},
				handler: function (request, reply) {
					var packageName = request.params.package;
					registry.info(packageName, function (error, document) {
						if (error) {
							return reply(error && error.isBoom ? error : Hapi.error.internal('Fetching readme failed', error));
						} else if (document && document.readme) {
							return reply(marked(document.readme)).code(200);
						} else {
							return reply(Hapi.error.notFound());
						}
					});
				}
			}
		});

		plugin.route({
			method: 'GET',
			path: '/{package}/{version}/readme',
			config: {
				tags: ['api'],
				description: 'Get readme',
				auth: readAuthStrategy,
				validate: {
					params: schemas.PackageVersionParams
				},
				handler: function (request, reply) {
					registry.readme(request.params.package, request.params.version, function (error, readme) {
						if (error) {
							return reply(error && error.isBoom ? error : Hapi.error.internal('Fetching readme failed', error));
						} else if (readme) {
							return reply(marked(readme)).code(200);
						} else {
							return reply(Hapi.error.notFound());
						}
					});
				}
			}
		});


		/**
		 * Expose through plugin interface
		 */
		plugin.expose('registry', registry);
		plugin.expose('authentication', authStrategy);
		plugin.expose('internals', internals);

		next();
	});
};

exports.register.attributes = {
	name: 'scoped-registry-api',
	version: require('../package.json').version
};
