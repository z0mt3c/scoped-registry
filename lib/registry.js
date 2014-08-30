var _ = require('lodash');
var mongodb = require('mongodb');
var utils = require('./utils');
var crypto = require('crypto');
var Grid = require('gridfs-stream');
var async = require('async');
var Boom = require('boom');
var Hoek = require('hoek');

var Registry = module.exports = function (options, db) {
    Hoek.assert(db, 'Database has to be present');
    Hoek.assert(options.baseUrl, 'baseUrl has to be present');
    this.options = options;
    this.db = db;
    this.gfs = Grid(db, mongodb);
};

Registry.prototype.info = function (pkg, next) {
    Hoek.assert(pkg, 'Package name has to be present');
    var packageName = utils.unescapeName(pkg);
    var self = this;

    var callback = function (error, packageDocument) {
        if (packageDocument) {
            packageDocument = utils.transformPackageDocument(packageDocument, self.options);
			var version = Hoek.reach(packageDocument, 'dist-tags.latest');
            self.readme(packageName, version, function(error, readme) {
				if (readme) {
					packageDocument.readme = readme;
				}

				return next(error, packageDocument);
			});
        } else {
			return next(error, packageDocument);
		}
    };

    this.db.collection('packages').findOne({_id: packageName}, callback);
};

Registry.prototype.fetchArchive = function (filename, next) {
    filename = utils.unescapeName(filename);
    var gfs = this.gfs;
    var options = {'filename': filename};

    gfs.exist(options, function (error, found) {
        return next(error, found ? gfs.createReadStream(options) : null);
    });
};

Registry.prototype.versions = function (packageName, next) {
    this.db.collection('packages').aggregate([
        {$match: {_id: packageName}},
        {$project: {'versions.version': 1, _id: 0}},
        {$unwind: '$versions'},
        {$project: {'version': '$versions.version'}}
    ], function (error, result) {
        return next(error, _.pluck(result, 'version'));
    });
};

Registry.prototype.update = function (data, next) {
    var self = this;
    var targetVersions = _.keys(data.versions);

    self.versions(data._id, function (error, versions) {
        Hoek.assert(error || versions, 'Error or versions should always be present');
        if (error) {
            return next(error);
        } else if (versions) {
            var versionsToRemove = _.difference(versions, targetVersions);

            async.each(versionsToRemove, function (version, next) {
                self.removeVersion(data._id, version, next);
            }, function (error) {
                if (error) return next(error);
                return self.updateRootFromTag(data._id, 'latest', next);
            });
        }
    });
};

Registry.prototype.updateRootFromTag = function (packageName, tag, next) {
    Hoek.assert(packageName, 'Missing packageName');
    Hoek.assert(_.isString(tag), 'Missing tag');
    var self = this;

    this.info(packageName, function (error, packageDocument) {
        if (error) return next(error);
        if (packageDocument) {
            var versionName = packageDocument['dist-tags'][tag];
            Hoek.assert(versionName, 'Missing tag ' + tag + ' in package ' + packageName);
            var version = packageDocument.versions[versionName];

            self.readme(packageName, versionName, function (error, readme) {
                if (error) return next(error);
                version.readme = readme;
                self.updateRoot(version, next);
            });
        } else {
            return next(null, false);
        }
    });
};

Registry.prototype.updateRoot = function (data, next) {
    var dataToSet = utils.createRootUpdate(data);

    this.db.collection('packages').update(
        {_id: data.name},
        {$set: dataToSet},
        {upsert: false, multi: false},
        function (error, count) {
            next(error, count === 1);
        });
};

Registry.prototype.publish = function (data, cb) {
    var self = this;

    async.series({
            'package': function (next) {
                self.createPackage(data, next);
            },
            'version': function (next) {
                self.createVersion(data, next);
            },
            'archive': function (next) {
                self.saveArchive(data, next);
            },
            'updateRoot': function (next) {
                self.updateRootFromTag(data._id, 'latest', next);
            },
            'cleanup': function (next) {
                self.cleanupPackage(data._id, next);
            }
        },
        cb);
};

Registry.prototype.createPackage = function (data, next) {
    var rootDocument = utils.createDefaultPackage(data);
    var insert = {
        $setOnInsert: {
            'name': data.name,
            'dist-tags': {},
            'versions': [],
            'time': {
                created: new Date(),
                modified: new Date()
            }
        }
    };

    this.db.collection('packages').update({_id: rootDocument._id}, insert, {upsert: true}, next);
};

Registry.prototype.createVersion = function (data, next) {
    var version = _.first(_.values(data.versions));
    Hoek.assert(version, 'No version found');
    version.created = new Date();
    var where = {_id: data.name, 'versions.version': {$ne: version.version}};
    delete version.dist.tarball;
    var versionClone = _.clone(version);
    delete versionClone.readme;

    var update = {
        $push: {
            versions: versionClone
        },
        $set: utils.createDistTagsUpdate(data)
    };

    var options = {upsert: false, multi: false};

    this.db.collection('packages').update(where, update, options, function (error, count) {
        if (error) return next(error);
        if (count === 1) return next(null, true);
        if (count === 0) return next(Boom.conflict('Version already present / Package not present'));
        Hoek.assert(false, 'count <= 1 or error should be present');
    });
};

Registry.prototype.saveArchive = function (data, next) {
    var db = this.db;
    var version = _.first(_.values(data.versions));
    var filename = _.first(_.keys(data._attachments));
    var attachment = data._attachments[filename];

    var buffer = new Buffer(attachment.data, 'base64');
    var shasum = crypto.createHash('sha1');
    shasum.update(buffer);

    var metadata = {
        'filename': filename,
        'package': data.name,
        'version': version.version,
        'readme': version.readme,
        'shasum': shasum.digest('hex')
    };

    var gridStore = new mongodb.GridStore(db, filename, "w", {
        'content_type': 'binary/octet-stream',
        'metadata': metadata
    });

    gridStore.open(function (error, gridStore) {
        if (error) return next(error);
        gridStore.write(buffer, function (error, gridStore) {
            if (error) return next(error);
            gridStore.close(function (error) {
                if (error) return next(error);
                return next(null, metadata);
            });
        });
    });
};

Registry.prototype.unpublish = function (packageName, next) {
    var self = this;

    async.series({
            'package': function (next) {
                self.removePackage(packageName, next);
            },
            'archives': function (next) {
                self.removeAllArchives(packageName, next);
            }
        },
        function (error, results) {
            next(error, results);
        });
};

Registry.prototype.removePackage = function (packageName, next) {
    this.db.collection('packages').remove({_id: packageName}, function (error, rows) {
        if (error) return next(error);
        if (rows === 1) return next(error, rows);
        return next(Boom.notFound('Package not found'));
    });
};

Registry.prototype.removeVersion = function (packageName, version, next) {
    var self = this;

    async.series({
            'version': function (next) {
                self.db.collection('packages').update({_id: packageName}, {
                    $pull: {versions: {version: version}}
                }, function (error, count) {
                    next(error, count);
                });
            },
            'archive': function (next) {
                self.removeArchive(packageName, version, next);
            },
            'package': function (next) {
                self.versions(packageName, function (error, versions) {
                    if (error) return next(error);
                    if (_.isEmpty(versions)) return self.removePackage(packageName, next);
                    return next();
                });
            },
            'cleanup': function (next) {
                self.cleanupPackage(packageName, function (error) {
                    if (error) return next(error);
                    return next()
                });
            },
            'updateRoot': function (next) {
                self.updateRootFromTag(packageName, 'latest', next);
            }
        },
        function (error, results) {
            next(error, results);
        });
};

Registry.prototype.star = function (packageName, user, next) {
    var update = {$addToSet: {users: user}};
    var options = {upsert: false, multi: false};

    this.db.collection('packages').update({_id: packageName}, update, options, function (error, count) {
        if (error) return next(new Boom.internal('Database error', error));
        if (count === 1) return next(error, count);
        return next(Boom.notFound());
    });
};

Registry.prototype.unstar = function (packageName, user, next) {
    var update = {$pull: {users: user}};
    var options = {upsert: false, multi: false};

    this.db.collection('packages').update({_id: packageName}, update, options, function (error, count) {
        if (error) return next(new Boom.internal('Database error', error));
        if (count === 1) return next(error, count);
        return next(Boom.notFound());
    });
};

Registry.prototype.cleanupPackage = function (packageName, next) {
    var self = this;
    this.db.collection('packages').findOne({_id: packageName}, function (error, packageDocument) {
        if (error) return next(error);
        if (packageDocument) {
            var availableVersions = _.pluck(packageDocument.versions, 'version');
            var distTags = _.reduce(packageDocument['dist-tags'], function (memo, value, key) {
                if (_.contains(availableVersions, value)) {
                    memo[key] = value;
                }
                return memo;
            }, {});

            if (!_.has(distTags, 'latest')) {
                distTags.latest = _.last(availableVersions);
            }

            self.db.collection('packages').update(
                {_id: packageName},
                {$set: {'dist-tags': distTags}},
                {upsert: false, multi: false},
                function (error) {
                    next(error);
                });
        } else {
            return next();
        }
    });
};

Registry.prototype.removeArchiveFile = function (fileName, next) {
    var self = this;

    this.db.collection('fs.files').findOne({
        'filename': fileName
    }, function (error, item) {
        if (error) {
            return next(error);
        } else if (item) {
            return mongodb.GridStore.unlink(self.db, item._id, next);
        } else {
            return next(null, false);
        }
    });
};

Registry.prototype.removeArchive = function (packageName, version, next) {
    var fileName = utils.createArchiveName({name: packageName, version: version});
    return this.removeArchiveFile(fileName, next);
};

Registry.prototype.readme = function (packageName, version, next) {
    this.db.collection('fs.files').findOne({
        'filename': {$regex: '^' + packageName},
        'metadata.package': packageName,
        'metadata.version': version
    }, function (error, item) {
        if (error) return next(error);
        if (item && item.metadata.readme) return next(null, item.metadata.readme);
        return next();
    });
};

Registry.prototype.removeAllArchives = function (packageName, next) {
    var self = this;
    var ids = [];

    var removeFiles = function () {
        async.each(ids, function (id, next) {
            mongodb.GridStore.unlink(self.db, id, next);
        }, next);
    };

    this.db.collection('fs.files').find({
        'filename': {$regex: '^' + packageName},
        'metadata.package': packageName
    }).each(function (error, item) {
        if (error) {
            return next(error);
        } else if (item) {
            ids.push(item._id);
        } else {
            // last iteration does not have item
            return removeFiles();
        }
    });
};

Registry.prototype.tag = function (packageName, tag, version, next) {
    var packageName = utils.unescapeName(packageName);
    var dataToSet = {};
    dataToSet['dist-tags.' + tag] = version;

    this.db.collection('packages').update(
        {_id: packageName, 'versions.version': version },
        {$set: dataToSet},
        {upsert: false, multi: false},
        next);
};

Registry.prototype.untag = function (packageName, tag, next) {
    var packageName = utils.unescapeName(packageName);
    var dataToSet = {};
    dataToSet['dist-tags.' + tag] = '';

    this.db.collection('packages').update(
        {_id: packageName},
        {$unset: dataToSet},
        {upsert: false, multi: false},
        next);
};

Registry.prototype.status = function (next) {
    var self = this;

    async.series({
            'package_count': function (next) {
                self.db.collection('packages').count(next);
            },
            'release_count': function (next) {
                self.db.collection('fs.files').count(next);
            }
        },
        function (error, results) {
            return next(error, results);
        });
};

Registry.prototype.all = function (since, next) {
    var find = {};

    if (since) {
        find['time.modified'] = {$gte: since};
    }

    this.db.collection('packages').find(find, {
        _id: 0,
        name: 1,
        description: 1,
        keywords: 1,
        'dist-tags': 1,
        time: 1,
        maintainers: 1
    }).toArray(next);
};

Registry.prototype.find = function (query, next) {
    var find = {
        $or: [
            { '_id' : { $regex: query, $options: 'i' }},
            { 'keywords': query }
        ]
    };

    this.db.collection('packages').find(find, {
        _id: 0,
        name: 1,
        description: 1,
        keywords: 1,
        'dist-tags': 1,
        time: 1,
        maintainers: 1
    }).toArray(next);
};
