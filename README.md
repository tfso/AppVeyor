# AppVeyor Command-line tools

## Installation

    npm install -g tfso/appveyor
    
## Requirements

You must have an AppVeyor account. The command lines is supposed to be run by AppVeyor in a build process in build scripts, normally in appveyor.yml configuration.

## Yaml
AppVeyor configuration file 'appveyor.yml' can be configured to build Sencha projects by using the command line tool after installing this repository as global package as described above. See below for an example in yaml format, and the usage commands in next topic.

```yaml
environment:
  nodejs_version: "4"
  SENCHACMD_URL: http://cdn.sencha.com/cmd/6.1.2/jre/SenchaCmd-6.1.2-windows-32bit.zip
  SENCHACMD_REPOSITORY: https://sencharepo.example.org/packages/
branches:
    only:
      - master

skip_tags: true

install:
  - ps: Install-Product node $env:nodejs_version
  - node --version
  - npm install -g tfso/AppVeyor#1.0.58

build_script:
  - build-sencha install --url %SENCHACMD_URL% --destination c:\tools\sencha-cmd\
  - build-sencha repository tfso %SENCHACMD_REPOSITORY% --sencha-cmd c:\tools\sencha-cmd\sencha.exe
  - build-sencha build --path %APPVEYOR_BUILD_FOLDER% --sencha-cmd c:\tools\sencha-cmd\sencha.exe
  - build-sencha publish
```

## Usage

### path-version
```
  Usage: patch-version [options] <file>

  AppVeyor command-line tool for patching version to a file, defaults to package.json

  Options:

    -h, --help                 output usage information
    -V, --version              output the version number
    -b, --build-version [raw]  Version number in format 0.0.1 where it defaults to env:APPVEYOR_BUILD_VERSION
```

### build-sencha --help
```
  Usage: build-sencha [options] [command]


  Commands:

    install [options]
    repository <name> <url>  Add a remote repository that should be used
    build [options]          Build all packages and apps in a workspace
    *

  AppVeyor command-line tool for building Sencha (ExtJS) projects. Either provide path to sencha 
  command with option, env:SENCHACMD

  Options:

    -h, --help               output usage information
    -V, --version            output the version number
    -c, --sencha-cmd <path>  Path to sencha command, either given by install or environment SENCHACMD
```

### build-sencha install --help
```
  Usage: install [options]

  Options:

    -h, --help       output usage information
    -u, --url <url>  Url to sencha command sdk
```

### build-sencha repository --help
```
  Usage: repository [options] <name> <url>

  Add a remote repository that should be used

  Options:

    -h, --help  output usage information
```

### build-sencha build --help
```
  Usage: build [options]

  Build all packages and apps in a workspace

  Options:

    -h, --help              output usage information
    -p, --path <workspace>  Path to workspace
```
