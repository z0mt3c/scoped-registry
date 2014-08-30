var minimatch = require('minimatch');
var _ = require('lodash');
var Hoek = require('hoek');

var internals = {
	parseAccessor: function (input) {
		if (_.isString(input)) {
			return [input];
		} else if (_.isArray(input)) {
			return input;
		} else {
			return null;
		}
	},
	parseAccess: function (input) {
		if (input === 'all') {
			return 'all';
		} else if (input === 'user') {
			return 'user';
		} else if (_.isObject(input)) {
			return {
				users: internals.parseAccessor(input.users),
				groups: internals.parseAccessor(input.groups)
			};
		} else {
			return 'none';
		}
	},
	parseRules: function (rules) {
		return _.map(rules, function (value, key) {
			var minimatcher = key || value.pattern;
			var pattern = minimatch.makeRe(minimatcher);

			if (!pattern) {
				throw new Error('Invalid pattern: ' + minimatcher);
			}

			return {
				pattern: pattern,
				permissions: {
					install: internals.parseAccess(value.install),
					publish: internals.parseAccess(value.publish)
				}
			};
		});
	},
	filterPackageRules: function (rules, packageName) {
		return _.filter(rules, function (rule) {
			return rule.pattern.test(packageName)
		});
	},
	ensureArray: function(value) {
		if (!value) {
			return value;
		}

		return	_.isArray(value) ? value : [value];
	},
	checkPermission: function (result, permissions, action, user) {
		var rule = permissions[action];

		if (!result[action]) {
			if (_.isString(rule)) {
				if (rule === 'all') {
					result[action] = true;
				} else if (rule === 'user' && Hoek.reach(user, 'name')) {
					result[action] = true;
				}
			} else {
				Hoek.assert(_.isObject(rule), 'Rule should be a string or an object');

				var allowUsers = rule.users;
				var allowGroups = rule.groups;

				if (allowUsers && Hoek.reach(user, 'name') && _.contains(allowUsers, user.name)) {
					result[action] = true;
				} else if (allowGroups && user.groups && _.intersection(allowGroups, internals.ensureArray(user.groups)).length > 0) {
					result[action] = true;
				}
			}
		}
	},
	determinePermissions: function (rules, packageName, user) {
		var packageRules = internals.filterPackageRules(rules, packageName);
		return _.reduce(packageRules, function (memo, rule) {
			internals.checkPermission(memo, rule.permissions, 'install', user);
			internals.checkPermission(memo, rule.permissions, 'publish', user);
			return memo;
		}, {
			install: false,
			publish: false
		});
	}
};

var Permission = module.exports = function (rules) {
	Hoek.assert(rules, 'Rules are required');
	this.rules = internals.parseRules(rules);
};

Permission.prototype.permissions = function (packageName, user) {
	return internals.determinePermissions(this.rules, packageName, user);
};

Permission.prototype.canInstall = function (packageName, user) {
	return this.permissions(packageName, user).install;
};

Permission.prototype.canPublish = function (packageName, user) {
	return this.permissions(packageName, user).publish;
};

module.exports._internals = internals;
