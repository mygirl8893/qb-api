![](https://avatars3.githubusercontent.com/u/31820267?v=4&s=100)

# qiibee API

*A NodeJS RESTful API to connect to the qiibee blockchain*

> **Disclaimer**: this a PoC of the qiibee API, it's development is a work in progress and may not pass all quality tests. We welcome bug reports and/or contributions


[![Build Status](https://travis-ci.org/qiibee/qb-contracts.svg?branch=master)](https://travis-ci.org/qiibee/qb-api)

## API documentation
Click [here](https://api.qiibee.com/) to get our documentation

## Requirements

- Node v8

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
 - this has been validated to be working with version `5.7.x`
 - for OSX you can do `brew install mysql@5.7`
 - start service using `brew services start mysql@5.7`
 - access mysql using the `mysql` program at `/usr/local/Cellar/mysql\@5.7/5.7.25/bin/mysql` from the terminal
  - eg. `/usr/local/Cellar/mysql\@5.7/5.7.25/bin/mysql --version`, `/usr/local/Cellar/mysql\@5.7/5.7.25/bin/mysql -u root`
 - inside the `mysql` console run:
  - `CREATE DATABASE qiibee;`
  - `ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '';`
 - further on you'll be accessing the mysql console using the command `mysql -u root`
 - note that the password is blank / no password

* Start

```console
npm install
# start dependencies locally and an instance of qb-api
npm run localenv launch
```

Go to [localhost:3000](http://localhost:3000)

To run a transaction and fetch the history do:

```console
npm localenv seed
```

## License 

qiibee API is open source and distributed under the Apache License v2.0

  [node.js]: <http://nodejs.org>
