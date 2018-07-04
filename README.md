![](https://avatars3.githubusercontent.com/u/31820267?v=4&s=100)

# qiibee API

*A NodeJS RESTful API to connect to the qiibee blockchain*

> **Disclaimer**: this a PoC of the qiibee API, it's development is a work in progress and may not pass all quality tests. We welcome bug reports and/or contributions


[![Build Status](https://travis-ci.org/qiibee/qb-contracts.svg?branch=master)](https://travis-ci.org/qiibee/qb-api)

## API documentation
Click [here](https://api.qiibee.com/) to get our documentation

## Requirements

- Node v8 or higher

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

* Clone the project
```console
git clone https://github.com/qiibee/qb-api.git
cd qb-api
```

* Edit config
  - Add your infura token in the placeholder in src/config/config.js

* Setup mysql locally
 - this has been validated to be working with `mysql  Ver 8.0.11 for osx10.13 on x86_64 (Homebrew)`
 - for OSX you can do `brew install mysql`
 - 	access mysql using the `mysql` program from the terminal
 -  inside the `mysql` console type `CREATE DATABASE qiibee`
 -  next type `ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'a12345678$X'`
 -  further on you'll be accessing the mysql console using the command `mysql -u root --password` and type in the above password

* Start

```console
npm install
# start dependencies locally
npm localdev start
npm start
```

Go to [localhost:3000](http://localhost:3000)

To run a transaction and fetch the history do:

```console
npm localdev seed
```

## License

qiibee API is open source and distributed under the Apache License v2.0

  [node.js]: <http://nodejs.org>
