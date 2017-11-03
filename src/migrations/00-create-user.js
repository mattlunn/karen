'use strict';
module.exports = {
	up: function(queryInterface, Sequelize) {
		return queryInterface.createTable('users', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER
			},
			handle: {
				type: Sequelize.STRING
			},
			password: {
				type: Sequelize.STRING
			},
			createdAt: {
				allowNull: false,
				type: Sequelize.DATE
			},
			updatedAt: {
				allowNull: false,
				type: Sequelize.DATE
			}
		}).then(() => {
		  return queryInterface.addIndex('users', {
		    fields: ['handle'],
        unique: true
      });
    });
	},
	down: function(queryInterface) {
		return queryInterface.dropTable('users');
	}
};