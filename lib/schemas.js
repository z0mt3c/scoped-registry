var Joi = require('joi');
var schemas = module.exports = {};
var blacklistedPackageNames = ['node_modules', '__proto__', 'package.json', 'favicon.ico'];

schemas.pattern = {
	version: /^[a-zA-Z0-9_!~*'()@][-a-zA-Z0-9_.!~*'()@]*$/,
	packageName: /^(?:(@[-a-zA-Z0-9_.!~*'()]+)\/|)([a-zA-Z0-9_!~*'()][-a-zA-Z0-9_.!~*'()]*)$/
};

schemas.User = Joi.object().keys({
	name: Joi.string().required(),
	email: Joi.string().required(),
	password: Joi.string().required()
}).options({
	className: 'User',
	allowUnknown: true,
	stripUnknown: false
});

schemas.AuthenticateUser = schemas.User;
schemas.CreateOrAuthenticateUser = schemas.User;
schemas.UpdateUser = schemas.User;

schemas.UserParams = Joi.object().keys({
	username: Joi.string().required()
});

schemas.UserRevisionParams = Joi.object().keys({
	username: Joi.string().required(),
	revision: Joi.string().required()
});

schemas.PackageName = Joi.string().invalid(blacklistedPackageNames).regex(schemas.pattern.packageName).required();

schemas.TarballParams = Joi.object().keys({
	package: schemas.PackageName,
	filename: Joi.string().required()
});

schemas.TarballRevisionParams = Joi.object().keys({
	filename: Joi.string().required(),
	revision: Joi.string().required()
});

schemas.PackageParams = Joi.object().keys({
	package: schemas.PackageName
});

schemas.PackageVersionParams = Joi.object().keys({
	version: Joi.string().regex(schemas.pattern.version).required()
}).concat(schemas.PackageParams);

schemas.PackageRevisionParams = Joi.object().keys({
	revision: Joi.string().required()
}).concat(schemas.PackageParams);

schemas.TagParams = Joi.object().keys({
	tag: Joi.string().required()
}).concat(schemas.PackageParams);

schemas.AllSinceQuery = Joi.object().keys({
	startkey: Joi.date().required()
});

schemas.Search = Joi.object().keys({
	query: Joi.string().required()
});

schemas.Object = Joi.object();
schemas.Any = Joi.any();


schemas.PackagePayload = Joi.object().keys({
	_id: schemas.PackageName,
	name: Joi.ref('_id')
}).options({
	className: 'Package',
	allowUnknown: true,
	stripUnknown: false
});

// Configuration

var Identity = Joi.alternatives().try(Joi.string(), Joi.array().includes(Joi.string()));

schemas.AccessRight = Joi.object().keys({
	users: Identity.optional(),
	groups: Identity.optional()
});

schemas.AccessRightKey = Joi.string().valid(['all', 'user', 'none']);
schemas.AccessRightAlternative = Joi.alternatives().try(schemas.AccessRight, schemas.AccessRightKey);

schemas.Permission = Joi.object().keys({
	install: schemas.AccessRightAlternative.required(),
	publish: schemas.AccessRightAlternative.required()
});

schemas.RegistryConfig = Joi.object().keys({
	mongodb: Joi.string().required(),
	secret: Joi.string().required(),
	baseUrl: Joi.string().required(),
	userRegistration: Joi.boolean().optional(),
	maxBytes: Joi.number().integer().optional(),
	permissions: Joi.object().pattern(/.*/, schemas.Permission).required()
}).options({
	allowUnknown: true,
	stripUnknown: false
});

schemas.ServerConfig = Joi.object().keys({
	host: Joi.string().default('0.0.0.0'),
	port: Joi.number().integer().default(8600),
	options: Joi.object().optional()
});

schemas.WebConfig = Joi.object().keys({
	active: Joi.boolean().optional()
});

schemas.Config = Joi.object().keys({
	server: schemas.ServerConfig,
	registry: schemas.RegistryConfig,
	web: schemas.WebConfig.optional(),
	good: Joi.object().optional()
});
