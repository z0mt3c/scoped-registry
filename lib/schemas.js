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
	//stale: Joi.string().valid('update_after').required(),
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
