var Sequelize = require('sequelize');
var config = require('../config');
var prompt = require('prompt');
var bcrypt = require('bcrypt');
var util = require('util');

require('../models/index').then((db) => {
	var input = {};

	prompt.start();
	prompt.get({
		properties: {
			firstName: {
				description: 'First Name',
				required: true
			},

			lastName: {
				description: 'Last Name',
				required: true
			},

			password: {
				description: 'Password',
				hidden: true,
				required: true,
				before: function (value) {
					return bcrypt.hashSync(value, 15);
				}
			},

			email: {
				description: 'Email',
				required: true
			},

			mobileNumber: {
				description: 'Phone Number',
				required: true
			}
		}
	}, function (err, results) {
		if (err) {
			process.exit(1);
		} else {
			db.User.build(results).save().then((what) => {
				console.log('User created with id ' + what.id);

				process.exit(0);
			}).catch((err) => {
				console.log(err);
				process.exit(1);
			});
		}
	});
}).catch(function (err) {
	console.log(err);
	process.exit(1);
});