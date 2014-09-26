# scoped-registry
Lightweight npm registry for scoped packages. *WORK-IN-PROGRESS*

[![Build Status](https://travis-ci.org/z0mt3c/scoped-registry.png)](https://travis-ci.org/z0mt3c/scoped-registry)
[![Dependency Status](https://gemnasium.com/z0mt3c/scoped-registry.png)](https://gemnasium.com/z0mt3c/scoped-registry)

## Installation

```
npm install -g scoped-registry
```

## Start

```bash
scoped-registry start -c /path/to/config.yml
```

## Use
Authenticate/register against the scoped-registry for a specific scope

```bash
npm login --registry=http://localhost:8600/ --scope=@myscope
```

## Configuration

```yml
# Server options containing host and port where the registry should listen on.
server:
  host: localhost
  port: 8600
  # Options gives you the possibility to pass any server options to the hapi server
  # Reference: https://github.com/hapijs/hapi/blob/master/docs/Reference.md#new-serverhost-port-options
  #options: {}

# Registry options
registry:
  # MongoDB URI
  mongodb: mongodb://127.0.0.1/scoped_registry?connectTimeoutMS=3000

  # Used for access token signing (jsonwebtokens)
  secret: s3cr3t!

  # baseUrl is used to generate tarball URLs
  baseUrl: http://localhost:8600

  # Enable / Disable user registration - defaults to true
  #userRegistration: true

  # Max bytes limit for payloads (containing readme as well as tarball)
  #maxBytes: 1048576
# Authentications strategy, with its default values.
  #authentication:
  #  strategy: scoped-registry-auth-mongodb
  #  options: {}
# Permissions represent the ACL of scoped-registry
  permissions:
    # Allow all authenticated users to install and publish packages of all scopes
    '**':
    # Install defines who is able to load the tarball. Possible keyword values are none, user or all.
      install: all
    # Publish defines who is able to publish, unpublish, tag packages/versions. Possible keyword values are none, user or all.
      publish:
        users: test

    # Define rules for packages with scope @test
    #'@test/*':
    #  install: all
    # Instead of using a keyword users can be granted by its username
    #  publish:
    #    users:
    #      - john
    #      - jane

# Logging: good can be used for logging, all options are passed directly to the plugin configuration.
# Goods reference manual can be found here: https://github.com/hapijs/good
good:
  subscribers:
    console:
      - request
      - log
      - error
    # Logging events with tag request to a specific log file
    #./requests.log:
    #  - request
```
